import { and, eq } from 'drizzle-orm';
import type { DayType } from '@makchacut/core';
import { type DbExecutor, seoulStopLast } from '@makchacut/db';
import { chunk } from '#jobs/stores/chunk';

export type StopLastRow = {
  seq: number;
  lastMinutes: number;
};

// 노선·요일 유형 단위로 서울 API 막차 원본을 다시 쓴다
export async function replaceSeoulStopLast(
  db: DbExecutor,
  routeId: number,
  dayType: DayType,
  observedOn: string,
  rows: readonly StopLastRow[],
): Promise<void> {
  await db
    .delete(seoulStopLast)
    .where(and(eq(seoulStopLast.routeId, routeId), eq(seoulStopLast.dayType, dayType)));
  for (const batch of chunk(rows)) {
    await db
      .insert(seoulStopLast)
      .values(batch.map((row) => ({ routeId, dayType, observedOn, ...row })));
  }
}
