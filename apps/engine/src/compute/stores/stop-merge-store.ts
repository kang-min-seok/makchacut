import { inArray, sql } from 'drizzle-orm';
import type { SourceStopPoint } from '@makchacut/core';
import { type DbExecutor, stop, stopSource } from '@makchacut/db';
import { chunk } from '#jobs/stores/chunk';

const MERGEABLE_SOURCES = ['seoul_bus', 'gbis'] as const;

export async function loadBusSourcePoints(db: DbExecutor): Promise<SourceStopPoint[]> {
  return db
    .select({
      stopId: stopSource.stopId,
      name: stopSource.name,
      lat: stopSource.lat,
      lng: stopSource.lng,
      stopNo: stopSource.stopNo,
    })
    .from(stopSource)
    .where(inArray(stopSource.source, [...MERGEABLE_SOURCES]));
}

// 통합 정류장 id를 참조하는 모든 컬럼
const STOP_REFERENCES = [
  { table: 'stop_source', column: 'stop_id' },
  { table: 'route_stop', column: 'stop_id' },
  { table: 'route', column: 'origin_stop_id' },
  { table: 'route', column: 'turn_stop_id' },
  { table: 'train_trip', column: 'destination_stop_id' },
  { table: 'train_stop_time', column: 'stop_id' },
] as const;

// 합쳐질 정류장을 참조하는 행을 남길 정류장으로 옮기고, 비게 된 정류장을 지운다(도보 간선은 cascade로 지워지고 다음 계산에서 다시 만든다).
export async function applyStopMerges(
  db: DbExecutor,
  merges: ReadonlyMap<number, number>,
): Promise<void> {
  for (const batch of chunk([...merges])) {
    const values = sql.join(
      batch.map(([from, to]) => sql`(${from}::int, ${to}::int)`),
      sql`, `,
    );
    for (const ref of STOP_REFERENCES) {
      await db.execute(sql`
        update ${sql.identifier(ref.table)} as t
        set ${sql.identifier(ref.column)} = m.to_id
        from (values ${values}) as m(from_id, to_id)
        where t.${sql.identifier(ref.column)} = m.from_id
      `);
    }
    await db.delete(stop).where(
      inArray(
        stop.id,
        batch.map(([from]) => from),
      ),
    );
  }
}
