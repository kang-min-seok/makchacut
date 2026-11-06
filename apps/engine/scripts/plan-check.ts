import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { dayTypeOf } from '@makchacut/core';
import { searchKakaoAddress } from '@makchacut/data';
import { createDb } from '@makchacut/db';
import { isHoliday } from '#jobs/stores/holiday-store';
import { createDbGraphCache } from '#plan/db-graph-cache';
import { createGraphCache } from '#plan/graph-cache';
import { createPlanner } from '#plan/planner';
import { stationPoint } from '#plan/station-point';
import { planLines } from './plan-print';

// /plan 계산을 실데이터로 돌려 응답과 시간(그래프 적재, 집 쪽 탐색 캐시 미적중·적중)을 출력한다.
// DB는 읽기만 한다. 집 주소 좌표는 카카오 주소 검색 1회.
// 그래프: --source db(기본, DB에서 바로 빌드) | snapshot(graph_snapshot 테이블)
// 실행: pnpm --filter @makchacut/engine plan:check -- --home "<집 주소>" --date 2026-11-10 사당 잠실 …

const ENV_FILE = '.env';
const SOURCES = ['db', 'snapshot'] as const;
const DB_CLOSE_TIMEOUT_SECONDS = 5;

const { values, positionals: meetups } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    home: { type: 'string' },
    date: { type: 'string' },
    source: { type: 'string', default: 'db' },
  },
  allowPositionals: true,
});
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const databaseUrl = process.env.DATABASE_URL;
const kakaoKey = process.env.KAKAO_REST_API_KEY;
const source = SOURCES.find((s) => s === values.source);
const { home: homeAddress, date } = values;
if (!databaseUrl || !kakaoKey || !homeAddress || !date || !source || meetups.length === 0) {
  console.error(
    'DATABASE_URL·KAKAO_REST_API_KEY, --home, --date(YYYY-MM-DD), --source(db|snapshot), 약속 역 이름이 필요합니다.',
  );
  process.exit(1);
}

const ms = (start: number) => `${Math.round(performance.now() - start)}ms`;

const home = await searchKakaoAddress(kakaoKey, homeAddress);
if (!home) {
  console.error(`주소를 찾지 못했습니다: ${homeAddress}`);
  process.exit(1);
}
console.log(`집: ${home.placeName}`);

const db = createDb(databaseUrl);
try {
  const graphs = source === 'snapshot' ? createGraphCache(db) : createDbGraphCache(db);
  const planner = createPlanner({ db, graphs });
  const dayType = dayTypeOf(date, (await isHoliday(db, date)) ? new Set([date]) : new Set());
  let start = performance.now();
  const loaded = await graphs.get(dayType);
  if (!loaded) throw new Error(`${dayType} 스냅샷이 없습니다 (compute graph-snapshot 먼저)`);
  console.log(`# ${date} (${dayType}) 그래프 적재(${source}) ${ms(start)}`);

  for (const name of meetups) {
    const meetup = stationPoint(loaded.graph, name);
    if (!meetup) {
      console.log(`\n## ${name}: 역을 찾지 못함`);
      continue;
    }
    start = performance.now();
    const outcome = await planner({ home, meetup, date });
    console.log(`\n## ${name} (${ms(start)})`);
    if (outcome.kind !== 'planned') {
      console.log(`  ${outcome.kind}`);
      continue;
    }
    for (const line of planLines(outcome.response)) console.log(line);
  }
} finally {
  await db.$client.end({ timeout: DB_CLOSE_TIMEOUT_SECONDS });
}
