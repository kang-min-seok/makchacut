import { and, desc, eq, gte, ne, sql } from 'drizzle-orm';
import { todayInKorea } from '@makchacut/core';
import { type DbExecutor, ingestRun } from '@makchacut/db';

const KOREA_OFFSET = '+09:00';
// 이보다 오래 running인 기록은 중단된 실행으로 본다(함수 최대 실행 300초 + 여유)
const STALE_RUN_MS = 6 * 60 * 1000;

export type RunResult = {
  status: 'succeeded' | 'failed';
  rowCount: number;
  apiCalls: number;
  errorMessage: string | null;
};

function startOfKoreaDay(now: Date): Date {
  return new Date(`${todayInKorea(now)}T00:00:00${KOREA_OFFSET}`);
}

export async function todayApiCalls(db: DbExecutor, source: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${ingestRun.apiCalls}), 0)::int` })
    .from(ingestRun)
    .where(and(eq(ingestRun.source, source), gte(ingestRun.startedAt, startOfKoreaDay(now))));
  return row?.total ?? 0;
}

export async function hasActiveRun(db: DbExecutor, source: string, now: Date): Promise<boolean> {
  const rows = await db
    .select({ id: ingestRun.id })
    .from(ingestRun)
    .where(
      and(
        eq(ingestRun.source, source),
        eq(ingestRun.status, 'running'),
        gte(ingestRun.startedAt, new Date(now.getTime() - STALE_RUN_MS)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// 오늘 이 출처에서 가장 최근에 끝난 실행의 error_message (없으면 undefined)
export async function lastFinishedRunMessage(
  db: DbExecutor,
  source: string,
  now: Date,
): Promise<string | null | undefined> {
  const [row] = await db
    .select({ errorMessage: ingestRun.errorMessage })
    .from(ingestRun)
    .where(
      and(
        eq(ingestRun.source, source),
        ne(ingestRun.status, 'running'),
        gte(ingestRun.startedAt, startOfKoreaDay(now)),
      ),
    )
    .orderBy(desc(ingestRun.startedAt))
    .limit(1);
  return row?.errorMessage;
}

export async function startRun(db: DbExecutor, source: string): Promise<number> {
  const [row] = await db.insert(ingestRun).values({ source }).returning({ id: ingestRun.id });
  if (!row) throw new Error('ingest_run 기록을 만들지 못했습니다');
  return row.id;
}

export async function finishRun(db: DbExecutor, runId: number, result: RunResult): Promise<void> {
  await db
    .update(ingestRun)
    .set({ ...result, finishedAt: new Date() })
    .where(eq(ingestRun.id, runId));
}
