import type { Confidence, GraphStopTimeInput, GraphTripInput, LastTimeSource } from '@makchacut/core';

export type BusStopLastRow = {
  routeId: number;
  routeName: string;
  seq: number;
  stopId: number;
  direction: 'outbound' | 'inbound';
  lastMinutes: number;
  source: LastTimeSource;
  confidence: Confidence;
  headwayMinutes: number | null;
};

const LAST_RUN_LABEL = '막차';

function toStopTime(row: BusStopLastRow): GraphStopTimeInput {
  return {
    stopId: row.stopId,
    arrival: row.lastMinutes,
    departure: row.lastMinutes,
    source: row.source,
    confidence: row.confidence,
  };
}

function toTrip(rows: readonly BusStopLastRow[]): GraphTripInput {
  const first = rows[0]!;
  return {
    routeId: first.routeId,
    routeName: first.routeName,
    mode: 'bus',
    label: LAST_RUN_LABEL,
    headwayMinutes: first.headwayMinutes,
    stopTimes: rows.map(toStopTime),
  };
}

// 노선별(순번순) 정류장 막차를 회차 전·후 두 막차 운행으로 나눈다.
// 회차점(마지막 회차 전 정류장)은 회차 후 운행의 첫 정류장으로도 넣어 거기서 탈 수 있게 한다.
// 회차 전 막차가 회차점에 늦게 닿아도 회차 후 시각이 밀리지 않게 하려는 것(회차점 통과 승차는 같은 정류장 환승이 된다).
export function busLastRunTrips(rows: readonly BusStopLastRow[]): GraphTripInput[] {
  const byRoute = new Map<number, BusStopLastRow[]>();
  for (const row of rows) {
    const list = byRoute.get(row.routeId);
    if (list) list.push(row);
    else byRoute.set(row.routeId, [row]);
  }
  const trips: GraphTripInput[] = [];
  for (const list of byRoute.values()) {
    const sorted = [...list].sort((a, b) => a.seq - b.seq);
    const outbound = sorted.filter((r) => r.direction === 'outbound');
    const inbound = sorted.filter((r) => r.direction === 'inbound');
    const turn = outbound.at(-1);
    if (outbound.length > 0) trips.push(toTrip(outbound));
    if (inbound.length > 0) trips.push(toTrip(turn ? [turn, ...inbound] : inbound));
  }
  return trips;
}
