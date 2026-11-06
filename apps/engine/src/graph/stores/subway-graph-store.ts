import { and, asc, eq, inArray } from 'drizzle-orm';
import type {
  DayType,
  GraphFootpathInput,
  GraphStopInput,
  GraphStopTimeInput,
  GraphTripInput,
} from '@makchacut/core';
import { type DbExecutor, footpath, route, stop, trainStopTime, trainTrip } from '@makchacut/db';

const SUBWAY_MODE = 'subway';

export type SubwayGraphInput = {
  stops: GraphStopInput[];
  trips: GraphTripInput[];
  footpaths: GraphFootpathInput[];
};

async function loadSubwayStops(db: DbExecutor): Promise<GraphStopInput[]> {
  return db
    .select({ id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng })
    .from(stop)
    .where(eq(stop.mode, SUBWAY_MODE));
}

type StopTimeRow = {
  tripId: number;
  routeId: number;
  routeName: string;
  trainNo: string;
  destinationName: string | null;
  isExpress: boolean;
  stopId: number;
  arrival: number | null;
  departure: number | null;
};

function tripLabel(row: StopTimeRow): string {
  const express = row.isExpress ? ' 급행' : '';
  return `${row.trainNo} ${row.destinationName ?? ''}행${express}`.trim();
}

// 열차번호별 정차 시각을 운행으로 묶는다 (순서는 그래프 빌더가 시각으로 정한다)
function groupTrips(rows: readonly StopTimeRow[]): GraphTripInput[] {
  const trips = new Map<number, { first: StopTimeRow; stopTimes: GraphStopTimeInput[] }>();
  for (const row of rows) {
    const stopTime = { stopId: row.stopId, arrival: row.arrival, departure: row.departure };
    const trip = trips.get(row.tripId);
    if (trip) trip.stopTimes.push(stopTime);
    else trips.set(row.tripId, { first: row, stopTimes: [stopTime] });
  }
  return [...trips.values()].map(({ first, stopTimes }) => ({
    routeId: first.routeId,
    routeName: first.routeName,
    mode: SUBWAY_MODE,
    label: tripLabel(first),
    stopTimes,
  }));
}

async function loadSubwayTrips(db: DbExecutor, dayType: DayType): Promise<GraphTripInput[]> {
  const rows = await db
    .select({
      tripId: trainTrip.id,
      routeId: route.id,
      routeName: route.name,
      trainNo: trainTrip.trainNo,
      destinationName: trainTrip.destinationName,
      isExpress: trainTrip.isExpress,
      stopId: trainStopTime.stopId,
      arrival: trainStopTime.arrivalMinutes,
      departure: trainStopTime.departureMinutes,
    })
    .from(trainStopTime)
    .innerJoin(trainTrip, eq(trainTrip.id, trainStopTime.tripId))
    .innerJoin(route, eq(route.id, trainTrip.routeId))
    .where(eq(trainTrip.dayType, dayType))
    .orderBy(asc(trainStopTime.tripId));
  return groupTrips(rows);
}

async function loadFootpathsBetween(
  db: DbExecutor,
  stopIds: readonly number[],
): Promise<GraphFootpathInput[]> {
  if (stopIds.length === 0) return [];
  return db
    .select({
      fromStopId: footpath.fromStopId,
      toStopId: footpath.toStopId,
      walkSeconds: footpath.walkSeconds,
    })
    .from(footpath)
    .where(
      and(inArray(footpath.fromStopId, [...stopIds]), inArray(footpath.toStopId, [...stopIds])),
    );
}

// 지하철(1~9호선)만으로 된 그래프 입력: 역, 그 요일 유형의 열차별 시각, 역 사이 도보·환승 간선
export async function loadSubwayGraphInput(
  db: DbExecutor,
  dayType: DayType,
): Promise<SubwayGraphInput> {
  const stops = await loadSubwayStops(db);
  const trips = await loadSubwayTrips(db, dayType);
  const footpaths = await loadFootpathsBetween(
    db,
    stops.map((s) => s.id),
  );
  return { stops, trips, footpaths };
}
