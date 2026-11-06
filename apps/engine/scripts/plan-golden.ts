import { existsSync, readFileSync } from 'node:fs';
import { dayTypeOf } from '@makchacut/core';
import { searchKakaoAddress } from '@makchacut/data';
import { createDb } from '@makchacut/db';
import { type LatLng, LatLngSchema, type PlanResponse } from '@makchacut/shared';
import { z } from 'zod';
import { isHoliday } from '#jobs/stores/holiday-store';
import { createDbGraphCache } from '#plan/db-graph-cache';
import { createPlanner } from '#plan/planner';
import { stationPoint } from '#plan/station-point';
import { clockOf, planLines } from './plan-print';

// 골든 케이스: golden/cases.json의 기대값(지도 앱·실탑승으로 사용자가 채움)과 엔진 결과를 비교한다.
// 집 좌표는 공개 저장소에 두지 않고 golden/homes.local.json(커밋 안 함)에서 읽는다 — 주소면 카카오 검색.
// DB는 읽기만 한다. 실행: pnpm --filter @makchacut/engine plan:golden [-- 케이스id…]

const ENV_FILE = '.env';
const CASES_FILE = 'golden/cases.json';
const HOMES_FILE = 'golden/homes.local.json';
const DB_CLOSE_TIMEOUT_SECONDS = 5;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
// 04시 전은 전날 서비스 일자로 본다 (00:40 → 24:40)
const SERVICE_DAY_CUTOFF_MINUTES = 4 * MINUTES_PER_HOUR;
const CLOCK_PATTERN = /^\d{2}:\d{2}$/;

const ExpectSchema = z.object({
  deadline: z.string().regex(CLOCK_PATTERN).optional(),
  anchorRoutes: z.array(z.string()).optional(),
  anchorStop: z.string().optional(),
  anchorTime: z.string().regex(CLOCK_PATTERN).optional(),
});
const CaseSchema = z.object({
  id: z.string(),
  home: z.string(),
  meetup: z.string(),
  date: z.iso.date(),
  toleranceMinutes: z.number().nonnegative(),
  expect: ExpectSchema,
  note: z.string().optional(),
});
const CasesSchema = z.object({ cases: z.array(CaseSchema) });
const HomesSchema = z.record(z.string(), z.union([z.string(), LatLngSchema]));

type GoldenCase = z.infer<typeof CaseSchema>;
type Verdict = 'PASS' | 'FAIL' | 'TODO';

function serviceMinutes(clock: string): number {
  const minutes = Number(clock.slice(0, 2)) * MINUTES_PER_HOUR + Number(clock.slice(3, 5));
  return minutes < SERVICE_DAY_CUTOFF_MINUTES ? minutes + MINUTES_PER_DAY : minutes;
}

function closeEnough(actual: string, expected: string, tolerance: number): boolean {
  return Math.abs(serviceMinutes(actual) - serviceMinutes(expected)) <= tolerance;
}

// 기대값 항목마다 맞는지 본다. 기대값이 하나도 없으면 TODO.
function judge(c: GoldenCase, response: PlanResponse): { verdict: Verdict; misses: string[] } {
  const { expect, toleranceMinutes } = c;
  const misses: string[] = [];
  const { anchor } = response;
  if (
    expect.deadline &&
    !closeEnough(clockOf(response.deadline), expect.deadline, toleranceMinutes)
  ) {
    misses.push(`마감 ${clockOf(response.deadline)} ≠ ${expect.deadline}`);
  }
  if (expect.anchorRoutes && !expect.anchorRoutes.some((r) => anchor?.routeName.includes(r))) {
    misses.push(`핵심 노선 ${anchor?.routeName ?? '없음'} ∉ ${expect.anchorRoutes.join('/')}`);
  }
  if (expect.anchorStop && !anchor?.stopName.includes(expect.anchorStop)) {
    misses.push(`핵심 정류장 ${anchor?.stopName ?? '없음'} ≠ ${expect.anchorStop}`);
  }
  if (
    expect.anchorTime &&
    !(anchor && closeEnough(clockOf(anchor.time), expect.anchorTime, toleranceMinutes))
  ) {
    misses.push(`핵심 시각 ${anchor ? clockOf(anchor.time) : '없음'} ≠ ${expect.anchorTime}`);
  }
  const hasExpectation = Object.values(expect).some((v) => v !== undefined);
  if (!hasExpectation) return { verdict: 'TODO', misses };
  return { verdict: misses.length === 0 ? 'PASS' : 'FAIL', misses };
}

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const databaseUrl = process.env.DATABASE_URL;
const kakaoKey = process.env.KAKAO_REST_API_KEY;
if (!databaseUrl || !existsSync(HOMES_FILE)) {
  console.error(`DATABASE_URL과 ${HOMES_FILE}(집 이름 → 주소 또는 {lat,lng})이 필요합니다.`);
  process.exit(1);
}
const only = new Set(process.argv.slice(2).filter((arg) => arg !== '--'));
const { cases } = CasesSchema.parse(JSON.parse(readFileSync(CASES_FILE, 'utf8')));
const homes = HomesSchema.parse(JSON.parse(readFileSync(HOMES_FILE, 'utf8')));

const homePoints = new Map<string, LatLng>();
async function homePoint(key: string): Promise<LatLng> {
  const cached = homePoints.get(key);
  if (cached) return cached;
  const entry = homes[key];
  if (entry === undefined) throw new Error(`${HOMES_FILE}에 집 '${key}'가 없습니다`);
  if (typeof entry !== 'string') return entry;
  if (!kakaoKey) throw new Error('주소로 적은 집은 KAKAO_REST_API_KEY가 필요합니다');
  const place = await searchKakaoAddress(kakaoKey, entry);
  if (!place) throw new Error(`주소를 찾지 못했습니다: ${key}`);
  homePoints.set(key, place);
  return place;
}

const db = createDb(databaseUrl);
const counts: Record<Verdict, number> = { PASS: 0, FAIL: 0, TODO: 0 };
try {
  const graphs = createDbGraphCache(db);
  const planner = createPlanner({ db, graphs });
  for (const c of cases.filter((g) => only.size === 0 || only.has(g.id))) {
    const home = await homePoint(c.home);
    const holidays = (await isHoliday(db, c.date)) ? new Set([c.date]) : new Set<string>();
    const loaded = await graphs.get(dayTypeOf(c.date, holidays));
    const meetup = loaded && stationPoint(loaded.graph, c.meetup);
    if (!meetup) {
      console.log(`\n[FAIL] ${c.id}: 약속 역 '${c.meetup}'을 찾지 못함`);
      counts.FAIL += 1;
      continue;
    }
    const result = await planner({ home, meetup, date: c.date });
    if (result.kind !== 'planned') {
      console.log(`\n[FAIL] ${c.id}: ${result.kind}`);
      counts.FAIL += 1;
      continue;
    }
    const { verdict, misses } = judge(c, result.response);
    counts[verdict] += 1;
    console.log(
      `\n[${verdict}] ${c.id} — ${c.meetup} → ${c.home} ${c.date}${c.note ? ` (${c.note})` : ''}`,
    );
    for (const miss of misses) console.log(`  ✗ ${miss}`);
    for (const line of planLines(result.response)) console.log(line);
  }
} finally {
  await db.$client.end({ timeout: DB_CLOSE_TIMEOUT_SECONDS });
}
console.log(`\n합계: PASS ${counts.PASS}, FAIL ${counts.FAIL}, TODO ${counts.TODO}`);
if (counts.FAIL > 0) process.exitCode = 1;
