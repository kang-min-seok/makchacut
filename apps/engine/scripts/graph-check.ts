import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import {
  buildTransitGraph,
  type DayType,
  DEFAULT_MIN_TRANSFER_MINUTES,
  homeTargets,
  indexGraph,
  type Journey,
  meetupDepartures,
  minutesToClock,
  modeOf,
  reconstructJourney,
  reverseRaptor,
  type TransitGraph,
  WALK_TIME_FACTORS,
} from '@makchacut/core';
import { searchKakaoAddress } from '@makchacut/data';
import { createDb } from '@makchacut/db';
import { DEFAULT_PLAN_OPTIONS } from '@makchacut/shared';
import { decodeGraphSnapshot, encodeGraphSnapshot } from '#graph/graph-snapshot';
import { GRAPH_SCOPES, type GraphScope, loadGraphInput } from '#graph/stores/graph-input-store';

// 그래프를 만들어 크기·시간·메모리를 재고, 약속 역 → 집 귀가 마감과 경로를 출력한다.
// DB는 읽기만 한다. 집 주소 좌표는 카카오 주소 검색 1회. 메모리를 재려면 --expose-gc로 실행한다.
// 실행: pnpm --filter @makchacut/engine graph:check -- --home "<집 주소>" [--scope subway] 사당 잠실 …

const ENV_FILE = '.env';
const DAY_TYPES: readonly DayType[] = ['weekday', 'sat', 'sun'];
const BYTES_PER_MB = 1024 * 1024;
const SECONDS_PER_MINUTE = 60;
const DB_CLOSE_TIMEOUT_SECONDS = 5;

const { values, positionals: meetups } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { home: { type: 'string' }, scope: { type: 'string', default: 'all' } },
  allowPositionals: true,
});
process.loadEnvFile(ENV_FILE);
const databaseUrl = process.env.DATABASE_URL;
const kakaoKey = process.env.KAKAO_REST_API_KEY;
const scope = GRAPH_SCOPES.find((s) => s === values.scope);
if (!databaseUrl || !kakaoKey || !values.home || !scope || meetups.length === 0) {
  console.error(
    'DATABASE_URL·KAKAO_REST_API_KEY, --home, --scope(all|subway), 약속 역 이름이 필요합니다.',
  );
  process.exit(1);
}

const options = DEFAULT_PLAN_OPTIONS;
const walkTimeFactor = WALK_TIME_FACTORS[options.walkSpeed];
const access = { maxWalkMinutes: options.maxWalkMinutes, walkTimeFactor };

const ms = (start: number) => `${Math.round(performance.now() - start)}ms`;
const mb = (bytes: number) => `${(bytes / BYTES_PER_MB).toFixed(1)}MB`;
const clock = (minutes: number) => minutesToClock(minutes);

function retainedBytes(): number {
  globalThis.gc?.();
  const usage = process.memoryUsage();
  return usage.heapUsed + usage.arrayBuffers;
}

function describeJourney(graph: TransitGraph, journey: Journey): string[] {
  return journey.legs.map((leg) => {
    const from = graph.stopNames[leg.fromStop];
    const to = graph.stopNames[leg.toStop];
    if (leg.kind === 'walk') {
      return `    걷기 ${from} → ${to} ${Math.round(leg.seconds / SECONDS_PER_MINUTE)}분`;
    }
    const route = `${modeOf(graph, leg.pattern)} ${graph.patternRouteNames[leg.pattern]} ${graph.tripLabels[leg.trip]}`;
    const wait =
      leg.headwayMinutes === null
        ? ''
        : ` (배차 ${leg.headwayMinutes}분 — 정류장 ${clock(leg.depart - leg.headwayMinutes)}까지)`;
    return `    ${clock(leg.depart)} ${from} → ${to} ${clock(leg.arrive)}  [${route}] ${leg.timeSource}/${leg.confidence}${wait}`;
  });
}

function graphSizeLine(graph: TransitGraph): string {
  const trips = graph.patternTripOffsets.at(-1) ?? 0;
  return `정류장 ${graph.stopIds.length}, 패턴 ${graph.patternRouteIds.length}, 운행 ${trips}, 시각 ${graph.arrivals.length}, 도보 ${graph.footpathFrom.length}`;
}

async function checkDayType(
  db: ReturnType<typeof createDb>,
  dayType: DayType,
  home: { lat: number; lng: number },
  graphScope: GraphScope,
) {
  console.log(`\n# ${dayType} (${graphScope})`);
  let start = performance.now();
  const input = await loadGraphInput(db, dayType, graphScope);
  console.log(
    `DB 읽기 ${ms(start)} — 정류장 ${input.stops.length}, 운행 ${input.trips.length}, 도보 ${input.footpaths.length}`,
  );

  start = performance.now();
  const report = buildTransitGraph(input);
  console.log(
    `빌드 ${ms(start)} — ${graphSizeLine(report.graph)} (버린 운행 ${report.skippedTrips}, 버린 정차 ${report.droppedStopTimes})`,
  );
  start = performance.now();
  const snapshot = encodeGraphSnapshot(report.graph);
  console.log(`직렬화 ${ms(start)} — gzip ${mb(snapshot.length)}`);

  const before = retainedBytes();
  start = performance.now();
  const graph = decodeGraphSnapshot(snapshot);
  const index = indexGraph(graph);
  const loadTime = ms(start);
  const memory = globalThis.gc ? mb(retainedBytes() - before) : '(--expose-gc 없이 실행 — 생략)';
  console.log(`역직렬화+색인 ${loadTime} — 그래프·색인 메모리 ${memory}`);

  const targets = homeTargets(graph, home, access);
  console.log(
    `집 진입점 ${targets.length}곳: ${targets
      .slice(0, 8)
      .map((t) => graph.stopNames[t.stop])
      .join(', ')}${targets.length > 8 ? ' …' : ''}`,
  );
  start = performance.now();
  const result = reverseRaptor(graph, index, targets, {
    maxRides: options.maxTransfers + 1,
    minTransferMinutes: DEFAULT_MIN_TRANSFER_MINUTES,
    walkTimeFactor,
  });
  console.log(`탐색 ${ms(start)} (최대 ${options.maxTransfers + 1}회 탑승)`);

  for (const name of meetups) {
    const station = graph.stopNames.findIndex(
      (n, i) => n === name && !Number.isNaN(graph.stopLats[i]!),
    );
    if (station < 0) {
      console.log(`\n## ${name}: 역을 찾지 못함`);
      continue;
    }
    const meetup = { lat: graph.stopLats[station]!, lng: graph.stopLngs[station]! };
    start = performance.now();
    const departures = meetupDepartures(graph, result, meetup, {
      ...access,
      safetyMarginMinutes: options.safetyMarginMinutes,
    });
    const best = departures[0];
    const journey = best && reconstructJourney(graph, result, best.stop);
    if (!best || !journey) {
      console.log(`\n## ${name}: 경로 없음`);
      continue;
    }
    console.log(
      `\n## ${name}: 마감 ${clock(best.latestDeparture)} (도보 ${Math.round(best.walkMinutes)}분·여유 ${options.safetyMarginMinutes}분 반영, 질의 ${ms(start)}) — ${graph.stopNames[best.stop]}에 늦어도 ${clock(journey.latestDeparture)}, ${journey.rides}회 탑승`,
    );
    for (const line of describeJourney(graph, journey)) console.log(line);
  }
}

const home = await searchKakaoAddress(kakaoKey, values.home);
if (!home) {
  console.error(`주소를 찾지 못했습니다: ${values.home}`);
  process.exit(1);
}
console.log(`집: ${home.placeName} (${home.lat.toFixed(5)}, ${home.lng.toFixed(5)})`);

const db = createDb(databaseUrl);
try {
  for (const dayType of DAY_TYPES) await checkDayType(db, dayType, home, scope);
} finally {
  await db.$client.end({ timeout: DB_CLOSE_TIMEOUT_SECONDS });
}
