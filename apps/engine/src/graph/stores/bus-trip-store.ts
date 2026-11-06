import { and, eq, sql } from 'drizzle-orm';
import type { DayType, GraphTripInput } from '@makchacut/core';
import { busSchedule, busStopLast, type DbExecutor, route, routeStop } from '@makchacut/db';
import { usableBusStopLast } from '#graph/bus-last-rules';
import { type BusStopLastRow, busLastRunTrips } from '#graph/bus-trips';

// 그 요일 유형의 버스 막차 운행(정류장별 막차 시각)과 배차 간격(최악 대기 = 최대 배차, 없으면 최소).
// 믿기 어려운 막차는 usableBusStopLast가 거른다.
export async function loadBusTrips(db: DbExecutor, dayType: DayType): Promise<GraphTripInput[]> {
  const rows: BusStopLastRow[] = await db
    .select({
      routeId: busStopLast.routeId,
      routeName: route.name,
      seq: busStopLast.seq,
      stopId: routeStop.stopId,
      direction: routeStop.direction,
      lastMinutes: busStopLast.lastMinutes,
      source: busStopLast.source,
      confidence: busStopLast.confidence,
      headwayMinutes: sql<
        number | null
      >`coalesce(${busSchedule.maxHeadwayMinutes}, ${busSchedule.minHeadwayMinutes})`,
      routeSource: sql<BusStopLastRow['routeSource']>`${route.source}`,
      hasDaySchedule: sql<boolean>`${busSchedule.routeId} is not null`,
    })
    .from(busStopLast)
    .innerJoin(
      routeStop,
      and(eq(routeStop.routeId, busStopLast.routeId), eq(routeStop.seq, busStopLast.seq)),
    )
    .innerJoin(route, eq(route.id, busStopLast.routeId))
    .leftJoin(
      busSchedule,
      and(eq(busSchedule.routeId, busStopLast.routeId), eq(busSchedule.dayType, dayType)),
    )
    .where(eq(busStopLast.dayType, dayType));
  return busLastRunTrips(usableBusStopLast(rows));
}
