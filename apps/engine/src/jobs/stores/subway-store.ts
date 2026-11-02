import { eq } from 'drizzle-orm';
import type { DayType } from '@makchacut/core';
import type { TrainDirection } from '@makchacut/data';
import { type DbExecutor, trainStopTime, trainTrip } from '@makchacut/db';
import { chunk } from '#jobs/stores/chunk';
import { excluded } from '#jobs/stores/excluded';

export type StationDeparture = {
  dayType: DayType;
  direction: TrainDirection;
  trainNo: string;
  destinationStopId: number | null;
  destinationName: string;
  isExpress: boolean;
  arrivalMinutes: number | null;
  departureMinutes: number | null;
};

const tripKey = (dayType: DayType, trainNo: string) => `${dayType}:${trainNo}`;

// 한 역의 모든 요일·방향 시각을 다시 쓴다. 열차(train_trip)는 노선·요일·열차번호로 묶어 여러 역이 공유한다.
export async function replaceStationTimes(
  db: DbExecutor,
  routeId: number,
  stopId: number,
  departures: readonly StationDeparture[],
): Promise<number> {
  const trips = [
    ...new Map(departures.map((d) => [tripKey(d.dayType, d.trainNo), d])).values(),
  ].map((d) => ({
    routeId,
    trainNo: d.trainNo,
    dayType: d.dayType,
    direction: d.direction,
    destinationStopId: d.destinationStopId,
    destinationName: d.destinationName,
    isExpress: d.isExpress,
  }));

  const tripIds = new Map<string, number>();
  for (const rows of chunk(trips)) {
    const upserted = await db
      .insert(trainTrip)
      .values(rows)
      .onConflictDoUpdate({
        target: [trainTrip.routeId, trainTrip.dayType, trainTrip.trainNo],
        set: {
          direction: excluded(trainTrip.direction),
          destinationStopId: excluded(trainTrip.destinationStopId),
          destinationName: excluded(trainTrip.destinationName),
          isExpress: excluded(trainTrip.isExpress),
        },
      })
      .returning({ id: trainTrip.id, dayType: trainTrip.dayType, trainNo: trainTrip.trainNo });
    for (const row of upserted) tripIds.set(tripKey(row.dayType, row.trainNo), row.id);
  }

  await db.delete(trainStopTime).where(eq(trainStopTime.stopId, stopId));
  const times = departures.flatMap((d) => {
    const tripId = tripIds.get(tripKey(d.dayType, d.trainNo));
    return tripId === undefined
      ? []
      : [
          {
            tripId,
            stopId,
            arrivalMinutes: d.arrivalMinutes,
            departureMinutes: d.departureMinutes,
          },
        ];
  });
  for (const rows of chunk(times)) {
    await db.insert(trainStopTime).values(rows);
  }
  return times.length;
}
