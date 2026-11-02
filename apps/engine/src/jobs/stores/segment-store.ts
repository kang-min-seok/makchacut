import { and, asc, eq, sql } from 'drizzle-orm';
import type { RouteStopRef, SegmentMeasure } from '@makchacut/data';
import { type DbExecutor, routeStop, stopSource } from '@makchacut/db';
import type { TransitSource } from '#jobs/stores/stop-store';

// 노선 정류장을 순번 순으로, 원본 정류장 ID와 함께 돌려준다
export async function loadRouteStopRefs(
  db: DbExecutor,
  routeId: number,
  source: TransitSource,
): Promise<RouteStopRef[]> {
  return db
    .select({ seq: routeStop.seq, sourceStopId: stopSource.sourceStopId })
    .from(routeStop)
    .innerJoin(
      stopSource,
      and(eq(stopSource.stopId, routeStop.stopId), eq(stopSource.source, source)),
    )
    .where(eq(routeStop.routeId, routeId))
    .orderBy(asc(routeStop.seq));
}

export async function updateSegments(
  db: DbExecutor,
  routeId: number,
  segments: ReadonlyMap<number, SegmentMeasure>,
): Promise<void> {
  if (segments.size === 0) return;
  const values = sql.join(
    [...segments].map(
      ([seq, measure]) => sql`(${seq}::int, ${measure.seconds}::int, ${measure.meters}::int)`,
    ),
    sql`, `,
  );
  await db.execute(sql`
    update ${routeStop} as rs
    set segment_seconds = v.seconds, segment_meters = v.meters
    from (values ${values}) as v(seq, seconds, meters)
    where rs.route_id = ${routeId} and rs.seq = v.seq
  `);
}
