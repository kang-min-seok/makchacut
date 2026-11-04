import { and, asc, eq, inArray, isNull, lt, ne, notInArray, or, sql } from 'drizzle-orm';
import type { DayType } from '@makchacut/core';
import { type DbExecutor, ingestTarget } from '@makchacut/db';
import { chunk } from '#jobs/stores/chunk';

// 목록 API 호출 자체를 하나의 대상으로 두고 같은 방식으로 갱신 주기를 관리한다
export const LIST_TARGET_ID = '*';
const MS_PER_HOUR = 60 * 60 * 1000;
const MAX_ERROR_LENGTH = 500;
// 이만큼 연달아 실패한 대상은 다른 대상을 다 처리한 뒤로 미룬다
const REPEATED_FAILURE_COUNT = 3;

export type IngestSource = (typeof ingestTarget.source.enumValues)[number];

export type TargetKey = {
  targetId: string;
  dayType: DayType | null;
};

export type IngestTargetRow = typeof ingestTarget.$inferSelect;

function hoursAgo(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * MS_PER_HOUR);
}

export async function ensureListTarget(
  db: DbExecutor,
  source: IngestSource,
): Promise<IngestTargetRow> {
  await db.insert(ingestTarget).values({ source, targetId: LIST_TARGET_ID }).onConflictDoNothing();
  const [row] = await db
    .select()
    .from(ingestTarget)
    .where(
      and(
        eq(ingestTarget.source, source),
        eq(ingestTarget.targetId, LIST_TARGET_ID),
        isNull(ingestTarget.dayType),
      ),
    );
  if (!row) throw new Error(`${source} 목록 대상을 만들지 못했습니다`);
  return row;
}

export function isDue(target: IngestTargetRow, refreshHours: number, now: Date): boolean {
  return !target.lastSuccessAt || target.lastSuccessAt < hoursAgo(now, refreshHours);
}

// 목록에 있는 대상은 추가·복원하고, 목록에서 사라진 대상은 removed_at을 찍는다
export async function syncTargets(
  db: DbExecutor,
  source: IngestSource,
  targets: readonly TargetKey[],
  now: Date,
): Promise<void> {
  for (const rows of chunk(targets)) {
    await db
      .insert(ingestTarget)
      .values(rows.map((target) => ({ source, ...target })))
      .onConflictDoUpdate({
        target: [ingestTarget.source, ingestTarget.targetId, ingestTarget.dayType],
        set: { removedAt: null },
      });
  }
  const listedIds = [...new Set(targets.map((target) => target.targetId)), LIST_TARGET_ID];
  await db
    .update(ingestTarget)
    .set({ removedAt: now })
    .where(
      and(
        eq(ingestTarget.source, source),
        isNull(ingestTarget.removedAt),
        notInArray(ingestTarget.targetId, listedIds),
      ),
    );
}

// 한 번도 성공하지 못한 대상, 오래전에 성공한 대상 순. 같은 순위면 최근에 시도하지 않은 것부터.
// 계속 실패하는 대상(데이터 불일치 등)이 맨 앞을 막아 갱신이 멈추지 않게 반복 실패 대상은 맨 뒤로 보낸다.
export async function pickDueTargets(
  db: DbExecutor,
  source: IngestSource,
  refreshHours: number,
  limit: number,
  now: Date,
): Promise<IngestTargetRow[]> {
  return db
    .select()
    .from(ingestTarget)
    .where(
      and(
        eq(ingestTarget.source, source),
        ne(ingestTarget.targetId, LIST_TARGET_ID),
        isNull(ingestTarget.removedAt),
        or(
          isNull(ingestTarget.lastSuccessAt),
          lt(ingestTarget.lastSuccessAt, hoursAgo(now, refreshHours)),
        ),
      ),
    )
    .orderBy(
      sql`(${ingestTarget.failCount} >= ${REPEATED_FAILURE_COUNT}) asc`,
      sql`${ingestTarget.lastSuccessAt} asc nulls first`,
      sql`${ingestTarget.lastAttemptAt} asc nulls first`,
      asc(ingestTarget.id),
    )
    .limit(limit);
}

// 수동 지정 대상(점검 노선 먼저 받기 등). 갱신 주기와 무관하게 고르고, 아직 목록에 없으면 대상 행을 만든다.
export async function findTargets(
  db: DbExecutor,
  source: IngestSource,
  targetIds: readonly string[],
): Promise<IngestTargetRow[]> {
  if (targetIds.length === 0) return [];
  await db
    .insert(ingestTarget)
    .values(targetIds.map((targetId) => ({ source, targetId })))
    .onConflictDoNothing();
  return db
    .select()
    .from(ingestTarget)
    .where(
      and(
        eq(ingestTarget.source, source),
        inArray(ingestTarget.targetId, [...targetIds]),
        isNull(ingestTarget.removedAt),
      ),
    )
    .orderBy(asc(ingestTarget.id));
}

export async function markSuccess(db: DbExecutor, id: number, now: Date): Promise<void> {
  await db
    .update(ingestTarget)
    .set({ lastSuccessAt: now, lastAttemptAt: now, lastError: null, failCount: 0 })
    .where(eq(ingestTarget.id, id));
}

export async function markFailure(
  db: DbExecutor,
  id: number,
  error: unknown,
  now: Date,
): Promise<void> {
  await db
    .update(ingestTarget)
    .set({
      lastAttemptAt: now,
      lastError: String(error).slice(0, MAX_ERROR_LENGTH),
      failCount: sql`${ingestTarget.failCount} + 1`,
    })
    .where(eq(ingestTarget.id, id));
}
