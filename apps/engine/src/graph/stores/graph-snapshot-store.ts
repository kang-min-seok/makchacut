import { eq } from 'drizzle-orm';
import type { DayType } from '@makchacut/core';
import { type DbExecutor, graphSnapshot } from '@makchacut/db';

export type SnapshotRow = {
  dayType: DayType;
  data: Buffer;
  stopCount: number;
  patternCount: number;
  tripCount: number;
};

export type StoredSnapshot = { data: Buffer; builtAt: Date };

export async function saveGraphSnapshot(db: DbExecutor, row: SnapshotRow): Promise<void> {
  const values = { ...row, byteSize: row.data.length, builtAt: new Date() };
  await db
    .insert(graphSnapshot)
    .values(values)
    .onConflictDoUpdate({ target: graphSnapshot.dayType, set: values });
}

export async function loadGraphSnapshot(
  db: DbExecutor,
  dayType: DayType,
): Promise<StoredSnapshot | undefined> {
  const [row] = await db
    .select({ data: graphSnapshot.data, builtAt: graphSnapshot.builtAt })
    .from(graphSnapshot)
    .where(eq(graphSnapshot.dayType, dayType));
  return row;
}

// 스냅샷 본문을 읽지 않고 만든 시각만 본다 (메모리 캐시가 최신인지 확인)
export async function loadGraphSnapshotBuiltAt(
  db: DbExecutor,
  dayType: DayType,
): Promise<Date | undefined> {
  const [row] = await db
    .select({ builtAt: graphSnapshot.builtAt })
    .from(graphSnapshot)
    .where(eq(graphSnapshot.dayType, dayType));
  return row?.builtAt;
}
