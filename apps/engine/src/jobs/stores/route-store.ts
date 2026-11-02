import { and, eq, inArray, notInArray } from 'drizzle-orm';
import type { DayType } from '@makchacut/core';
import type { RouteDirection } from '@makchacut/data';
import { busSchedule, type DbExecutor, route, routeStop } from '@makchacut/db';
import { chunk } from '#jobs/stores/chunk';
import { excluded } from '#jobs/stores/excluded';
import type { TransitSource } from '#jobs/stores/stop-store';

export type SourceRoute = {
  sourceRouteId: string;
  name: string;
  routeType: string | null;
};

export type RouteStopRow = {
  seq: number;
  stopId: number;
  direction: RouteDirection;
};

export type BusScheduleRow = {
  routeId: number;
  dayType: DayType;
  firstAtOrigin: number | null;
  lastAtOrigin: number | null;
  firstAtTurn: number | null;
  lastAtTurn: number | null;
  minHeadwayMinutes: number | null;
  maxHeadwayMinutes: number | null;
};

export async function upsertRoutes(
  db: DbExecutor,
  source: TransitSource,
  routes: readonly SourceRoute[],
): Promise<Map<string, number>> {
  const unique = [...new Map(routes.map((r) => [r.sourceRouteId, r])).values()];
  const ids = new Map<string, number>();
  for (const rows of chunk(unique)) {
    const upserted = await db
      .insert(route)
      .values(rows.map((r) => ({ source, ...r })))
      .onConflictDoUpdate({
        target: [route.source, route.sourceRouteId],
        set: { name: excluded(route.name), routeType: excluded(route.routeType) },
      })
      .returning({ id: route.id, sourceRouteId: route.sourceRouteId });
    for (const row of upserted) ids.set(row.sourceRouteId, row.id);
  }
  return ids;
}

export async function findRouteId(
  db: DbExecutor,
  source: TransitSource,
  sourceRouteId: string,
): Promise<number | undefined> {
  const [row] = await db
    .select({ id: route.id })
    .from(route)
    .where(and(eq(route.source, source), eq(route.sourceRouteId, sourceRouteId)));
  return row?.id;
}

export async function findRouteIds(
  db: DbExecutor,
  source: TransitSource,
  sourceRouteIds: readonly string[],
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const keys of chunk(sourceRouteIds)) {
    const rows = await db
      .select({ id: route.id, sourceRouteId: route.sourceRouteId })
      .from(route)
      .where(and(eq(route.source, source), inArray(route.sourceRouteId, keys)));
    for (const row of rows) ids.set(row.sourceRouteId, row.id);
  }
  return ids;
}

// 정류장 목록까지 받은 노선만
export async function listRoutesWithStops(
  db: DbExecutor,
  source: TransitSource,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ sourceRouteId: route.sourceRouteId })
    .from(route)
    .innerJoin(routeStop, eq(routeStop.routeId, route.id))
    .where(eq(route.source, source));
  return rows.map((row) => row.sourceRouteId);
}

// 순번 기준으로 덮어쓰고 없어진 순번은 지운다. 구간 소요(segment_*)는 GBIS 웹 수집이 따로 채우므로 건드리지 않는다.
export async function replaceRouteStops(
  db: DbExecutor,
  routeId: number,
  stops: readonly RouteStopRow[],
): Promise<void> {
  for (const rows of chunk(stops)) {
    await db
      .insert(routeStop)
      .values(rows.map((row) => ({ routeId, ...row })))
      .onConflictDoUpdate({
        target: [routeStop.routeId, routeStop.seq],
        set: { stopId: excluded(routeStop.stopId), direction: excluded(routeStop.direction) },
      });
  }
  const seqs = stops.map((row) => row.seq);
  await db
    .delete(routeStop)
    .where(
      seqs.length > 0
        ? and(eq(routeStop.routeId, routeId), notInArray(routeStop.seq, seqs))
        : eq(routeStop.routeId, routeId),
    );
}

export async function setRouteEndpoints(
  db: DbExecutor,
  routeId: number,
  originStopId: number | null,
  turnStopId: number | null,
): Promise<void> {
  await db.update(route).set({ originStopId, turnStopId }).where(eq(route.id, routeId));
}

export async function upsertBusSchedules(
  db: DbExecutor,
  rows: readonly BusScheduleRow[],
): Promise<void> {
  for (const batch of chunk(rows)) {
    await db
      .insert(busSchedule)
      .values([...batch])
      .onConflictDoUpdate({
        target: [busSchedule.routeId, busSchedule.dayType],
        set: {
          firstAtOrigin: excluded(busSchedule.firstAtOrigin),
          lastAtOrigin: excluded(busSchedule.lastAtOrigin),
          firstAtTurn: excluded(busSchedule.firstAtTurn),
          lastAtTurn: excluded(busSchedule.lastAtTurn),
          minHeadwayMinutes: excluded(busSchedule.minHeadwayMinutes),
          maxHeadwayMinutes: excluded(busSchedule.maxHeadwayMinutes),
        },
      });
  }
}
