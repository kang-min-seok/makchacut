import { asc, eq, sql } from 'drizzle-orm';
import type { DayType, GraphStopTimeInput, GraphTripInput } from '@makchacut/core';
import { type DbExecutor, route, trainStopTime, trainTrip } from '@makchacut/db';

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

// 열차번호별 정차 시각(시각순으로 읽은 것)을 운행으로 묶는다
function groupTrips(rows: readonly StopTimeRow[]): GraphTripInput[] {
  const trips = new Map<number, { first: StopTimeRow; stopTimes: GraphStopTimeInput[] }>();
  for (const row of rows) {
    const stopTime: GraphStopTimeInput = {
      stopId: row.stopId,
      arrival: row.arrival,
      departure: row.departure,
      source: 'timetable',
      confidence: 'high',
    };
    const trip = trips.get(row.tripId);
    if (trip) trip.stopTimes.push(stopTime);
    else trips.set(row.tripId, { first: row, stopTimes: [stopTime] });
  }
  return [...trips.values()].map(({ first, stopTimes }) => ({
    routeId: first.routeId,
    routeName: first.routeName,
    mode: 'subway',
    label: tripLabel(first),
    headwayMinutes: null,
    stopTimes,
  }));
}

// 그 요일 유형의 지하철 열차별 정차 시각 (열차 안에서는 시각순)
export async function loadSubwayTrips(db: DbExecutor, dayType: DayType): Promise<GraphTripInput[]> {
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
    .orderBy(
      asc(trainStopTime.tripId),
      sql`coalesce(${trainStopTime.departureMinutes}, ${trainStopTime.arrivalMinutes})`,
    );
  return groupTrips(rows);
}
