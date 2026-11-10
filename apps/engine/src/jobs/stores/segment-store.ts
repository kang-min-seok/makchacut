import { and, asc, eq, sql } from 'drizzle-orm';
import type { RouteStopRef, SegmentMeasure } from '@makchacut/data';
import { type DbExecutor, routeStop, stopSource } from '@makchacut/db';
import type { TransitSource } from '#jobs/stores/stop-store';

// 노선 정류장을 순번 순으로, 원본 정류장 ID 후보와 함께 순번당 한 행씩 돌려준다.
// 통합 정류장에 같은 출처 원본이 둘 이상 묶여 있어도 행이 늘지 않게 묶는다(늘면 웹 구간과 정류장 수가 어긋난다).
export async function loadRouteStopRefs(
  db: DbExecutor,
  routeId: number,
  source: TransitSource,
): Promise<RouteStopRef[]> {
  return db
    .select({
      seq: routeStop.seq,
      sourceStopIds: sql<string[]>`array_agg(${stopSource.sourceStopId})`,
    })
    .from(routeStop)
    .innerJoin(
      stopSource,
      and(eq(stopSource.stopId, routeStop.stopId), eq(stopSource.source, source)),
    )
    .where(eq(routeStop.routeId, routeId))
    .groupBy(routeStop.seq)
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
