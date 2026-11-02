import { and, eq, inArray } from 'drizzle-orm';
import { type DbExecutor, stop, stopSource } from '@makchacut/db';
import { chunk } from '#jobs/stores/chunk';
import { excluded } from '#jobs/stores/excluded';

export type TransitSource = (typeof stopSource.source.enumValues)[number];
export type StopMode = (typeof stop.mode.enumValues)[number];

export type SourceStop = {
  sourceStopId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  stopNo: string | null;
};

async function findStopIds(
  db: DbExecutor,
  source: TransitSource,
  sourceStopIds: readonly string[],
): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  for (const ids of chunk(sourceStopIds)) {
    const rows = await db
      .select({ sourceStopId: stopSource.sourceStopId, stopId: stopSource.stopId })
      .from(stopSource)
      .where(and(eq(stopSource.source, source), inArray(stopSource.sourceStopId, ids)));
    for (const row of rows) found.set(row.sourceStopId, row.stopId);
  }
  return found;
}

// 원본 정류장마다 통합 정류장 id를 돌려준다. 처음 보는 원본은 통합 정류장을 새로 만든다(서울↔경기 통합은 3단계에서).
export async function ensureStops(
  db: DbExecutor,
  source: TransitSource,
  mode: StopMode,
  records: readonly SourceStop[],
): Promise<Map<string, number>> {
  const unique = [...new Map(records.map((record) => [record.sourceStopId, record])).values()];
  const stopIds = await findStopIds(
    db,
    source,
    unique.map((record) => record.sourceStopId),
  );

  const missing = unique.filter((record) => !stopIds.has(record.sourceStopId));
  for (const rows of chunk(missing)) {
    const inserted = await db
      .insert(stop)
      .values(rows.map(({ name, lat, lng, stopNo }) => ({ mode, name, lat, lng, stopNo })))
      .returning({ id: stop.id });
    rows.forEach((record, index) => {
      const id = inserted[index]?.id;
      if (id !== undefined) stopIds.set(record.sourceStopId, id);
    });
  }

  for (const rows of chunk(unique)) {
    await db
      .insert(stopSource)
      .values(
        rows.flatMap((record) => {
          const stopId = stopIds.get(record.sourceStopId);
          return stopId === undefined ? [] : [{ source, ...record, stopId }];
        }),
      )
      .onConflictDoUpdate({
        target: [stopSource.source, stopSource.sourceStopId],
        set: {
          name: excluded(stopSource.name),
          lat: excluded(stopSource.lat),
          lng: excluded(stopSource.lng),
          stopNo: excluded(stopSource.stopNo),
        },
      });
  }
  return stopIds;
}
