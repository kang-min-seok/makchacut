import { performance } from 'node:perf_hooks';
import {
  buildTransitGraph,
  type DayType,
  DEFAULT_MIN_TRANSFER_MINUTES,
  indexGraph,
  type Journey,
  minutesToClock,
  modeOf,
  reconstructJourney,
  reverseRaptor,
  stopsNear,
  type TransitGraph,
} from '@makchacut/core';
import { searchKakaoAddress } from '@makchacut/data';
import { createDb } from '@makchacut/db';
import { decodeGraphSnapshot, encodeGraphSnapshot } from '#graph/graph-snapshot';
import { loadSubwayGraphInput } from '#graph/stores/subway-graph-store';

// 지하철(1~9호선)만으로 그래프를 만들어 크기·시간을 재고, 집 주변 역까지의 역방향 탐색 결과를 출력한다.
// DB는 읽기만 한다. 집 주소 좌표는 카카오 주소 검색 1회.
// 실행: pnpm --filter @makchacut/engine graph:subway-check -- "<집 주소>" 사당 잠실 홍대입구 건대입구

const ENV_FILE = '.env';
const DAY_TYPES: readonly DayType[] = ['weekday', 'sat', 'sun'];
const HOME_RADIUS_METERS = 1000;
const MAX_RIDES = 3;
const BYTES_PER_MB = 1024 * 1024;
const SECONDS_PER_MINUTE = 60;
const DB_CLOSE_TIMEOUT_SECONDS = 5;

process.loadEnvFile(ENV_FILE);
const databaseUrl = process.env.DATABASE_URL;
const kakaoKey = process.env.KAKAO_REST_API_KEY;
const [address, ...meetups] = process.argv.slice(2).filter((arg) => arg !== '--');
if (!databaseUrl || !kakaoKey || !address || meetups.length === 0) {
  console.error('DATABASE_URL·KAKAO_REST_API_KEY와 인자(집 주소, 약속 역 이름…)가 필요합니다.');
  process.exit(1);
}

const ms = (start: number) => `${Math.round(performance.now() - start)}ms`;
const mb = (bytes: number) => `${(bytes / BYTES_PER_MB).toFixed(1)}MB`;

function describeJourney(graph: TransitGraph, journey: Journey): string[] {
  return journey.legs.map((leg) => {
    const from = graph.stopNames[leg.fromStop];
    const to = graph.stopNames[leg.toStop];
    if (leg.kind === 'walk') {
      return `    걷기 ${from} → ${to} ${Math.round(leg.seconds / SECONDS_PER_MINUTE)}분`;
    }
    const route = graph.patternRouteNames[leg.pattern];
    const mode = modeOf(graph, leg.pattern);
    const trip = graph.tripLabels[leg.trip];
    return `    ${minutesToClock(leg.depart)} ${from} → ${to} ${minutesToClock(leg.arrive)}  [${mode} ${route} ${trip}]`;
  });
}

function graphSizeLine(graph: TransitGraph): string {
  const trips = graph.patternTripOffsets[graph.patternTripOffsets.length - 1] ?? 0;
  return `정류장 ${graph.stopIds.length}, 패턴 ${graph.patternRouteIds.length}, 운행 ${trips}, 시각 ${graph.arrivals.length}, 도보 ${graph.footpathFrom.length}`;
}

const home = await searchKakaoAddress(kakaoKey, address);
if (!home) {
  console.error(`주소를 찾지 못했습니다: ${address}`);
  process.exit(1);
}
console.log(`집: ${home.placeName} (${home.lat.toFixed(5)}, ${home.lng.toFixed(5)})`);

const db = createDb(databaseUrl);
try {
  for (const dayType of DAY_TYPES) {
    console.log(`\n# ${dayType}`);
    let start = performance.now();
    const input = await loadSubwayGraphInput(db, dayType);
    console.log(`DB 읽기 ${ms(start)} — 역 ${input.stops.length}, 열차 ${input.trips.length}`);

    const heapBefore = process.memoryUsage().heapUsed;
    start = performance.now();
    const report = buildTransitGraph(input);
    const { graph } = report;
    console.log(
      `빌드 ${ms(start)} — ${graphSizeLine(graph)} (버린 열차 ${report.skippedTrips}, 버린 정차 ${report.droppedStopTimes})`,
    );

    start = performance.now();
    const snapshot = encodeGraphSnapshot(graph);
    console.log(`직렬화 ${ms(start)} — gzip ${mb(snapshot.length)}`);
    start = performance.now();
    const decoded = decodeGraphSnapshot(snapshot);
    const index = indexGraph(decoded);
    console.log(
      `역직렬화+색인 ${ms(start)} — 힙 증가 약 ${mb(process.memoryUsage().heapUsed - heapBefore)}`,
    );

    const targets = stopsNear(decoded, home, HOME_RADIUS_METERS).map((s) => ({
      stop: s.stop,
      latestArrival: Infinity,
    }));
    console.log(
      `집 반경 ${HOME_RADIUS_METERS}m 역: ${targets.map((t) => decoded.stopNames[t.stop]).join(', ') || '없음'}`,
    );
    start = performance.now();
    const result = reverseRaptor(decoded, index, targets, {
      maxRides: MAX_RIDES,
      minTransferMinutes: DEFAULT_MIN_TRANSFER_MINUTES,
    });
    console.log(`탐색 ${ms(start)} (최대 ${MAX_RIDES}회 탑승)`);

    for (const name of meetups) {
      const journeys = decoded.stopNames
        .flatMap((stopName, stop) => (stopName === name ? [stop] : []))
        .flatMap((stop) => reconstructJourney(decoded, result, stop) ?? []);
      const best = journeys.sort((a, b) => b.latestDeparture - a.latestDeparture)[0];
      if (!best) {
        console.log(`\n## ${name}: 경로 없음`);
        continue;
      }
      console.log(
        `\n## ${name}: 늦어도 ${minutesToClock(best.latestDeparture)} 출발 (${best.rides}회 탑승)`,
      );
      for (const line of describeJourney(decoded, best)) console.log(line);
    }
  }
} finally {
  await db.$client.end({ timeout: DB_CLOSE_TIMEOUT_SECONDS });
}
