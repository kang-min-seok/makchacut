import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { DayType, StopLastRow } from '@makchacut/core';
import {
  busSchedule,
  busStopLast,
  type DbExecutor,
  route,
  routeStop,
  seoulStopLast,
  stop,
  stopSource,
} from '@makchacut/db';
import { chunk } from '#jobs/stores/chunk';
import { pgArray, UNNEST_CHUNK_SIZE, unnestColumns } from '#compute/stores/pg-array';

const BUS_SOURCES = ['seoul_bus', 'gbis'] as const;
export type BusSource = (typeof BUS_SOURCES)[number];

export type BusRoute = {
  routeId: number;
  source: BusSource;
  sourceRouteId: string;
};

export type LoadedRouteStop = {
  routeId: number;
  seq: number;
  stopId: number;
  direction: 'outbound' | 'inbound';
  // 그 노선 출처의 원본 정류장 이름 ((경유)/(미정차) 판별용)
  name: string;
  lat: number | null;
  lng: number | null;
  segmentSeconds: number | null;
  segmentMeters: number | null;
};

export type LoadedSchedule = {
  routeId: number;
  dayType: DayType;
  lastAtOrigin: number | null;
  lastAtTurn: number | null;
};

export type LoadedObservation = {
  routeId: number;
  seq: number;
  dayType: DayType;
  lastMinutes: number;
};

export type StopLastInputs = {
  routes: BusRoute[];
  routeStops: LoadedRouteStop[];
  schedules: LoadedSchedule[];
  observations: LoadedObservation[];
};

export async function loadStopLastInputs(db: DbExecutor): Promise<StopLastInputs> {
  const routes = (await db
    .select({ routeId: route.id, source: route.source, sourceRouteId: route.sourceRouteId })
    .from(route)
    .where(inArray(route.source, [...BUS_SOURCES]))) as BusRoute[];

  const sourceName = sql<string>`coalesce((
    select ${stopSource.name} from ${stopSource}
    where ${stopSource.stopId} = ${routeStop.stopId} and ${stopSource.source} = ${route.source}
    limit 1
  ), ${stop.name})`;
  const routeStops = await db
    .select({
      routeId: routeStop.routeId,
      seq: routeStop.seq,
      stopId: routeStop.stopId,
      direction: routeStop.direction,
      name: sourceName,
      lat: stop.lat,
      lng: stop.lng,
      segmentSeconds: routeStop.segmentSeconds,
      segmentMeters: routeStop.segmentMeters,
    })
    .from(routeStop)
    .innerJoin(route, eq(route.id, routeStop.routeId))
    .innerJoin(stop, eq(stop.id, routeStop.stopId))
    .where(inArray(route.source, [...BUS_SOURCES]))
    .orderBy(asc(routeStop.routeId), asc(routeStop.seq));

  const schedules = await db
    .select({
      routeId: busSchedule.routeId,
      dayType: busSchedule.dayType,
      lastAtOrigin: busSchedule.lastAtOrigin,
      lastAtTurn: busSchedule.lastAtTurn,
    })
    .from(busSchedule);

  const observations = await db
    .select({
      routeId: seoulStopLast.routeId,
      seq: seoulStopLast.seq,
      dayType: seoulStopLast.dayType,
      lastMinutes: seoulStopLast.lastMinutes,
    })
    .from(seoulStopLast);

  return { routes, routeStops, schedules, observations };
}

export async function countStopLast(db: DbExecutor): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(busStopLast);
  return row?.count ?? 0;
}

export type RouteStopLastRow = StopLastRow & { routeId: number };

// 전체를 다시 쓴다 (트랜잭션 안에서 부른다)
export async function replaceStopLast(
  db: DbExecutor,
  rows: readonly RouteStopLastRow[],
): Promise<void> {
  await db.delete(busStopLast);
  for (const batch of chunk(rows, UNNEST_CHUNK_SIZE)) {
    const columns = unnestColumns([
      { values: pgArray(batch.map((r) => r.routeId)), type: 'int' },
      { values: pgArray(batch.map((r) => r.seq)), type: 'int' },
      { values: pgArray(batch.map((r) => r.dayType)), type: 'day_type' },
      { values: pgArray(batch.map((r) => r.lastMinutes)), type: 'real' },
      { values: pgArray(batch.map((r) => r.source)), type: 'last_time_source' },
      { values: pgArray(batch.map((r) => r.confidence)), type: 'confidence' },
    ]);
    await db.execute(sql`
      insert into ${busStopLast} (route_id, seq, day_type, last_minutes, source, confidence)
      select * from unnest(${columns})
    `);
  }
}
