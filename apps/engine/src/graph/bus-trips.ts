import type {
  Confidence,
  GraphStopTimeInput,
  GraphTripInput,
  LastTimeSource,
} from '@makchacut/core';

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

// 추정 막차는 일찍 지나갈 수 있어 신뢰도가 낮을수록 그만큼 일찍 떠난다고 본다(분)
export const CONFIDENCE_MARGIN_MINUTES: Readonly<Record<Confidence, number>> = {
  high: 0,
  medium: 5,
  low: 10,
};

function toStopTime(row: BusStopLastRow): GraphStopTimeInput {
  const minutes = row.lastMinutes - CONFIDENCE_MARGIN_MINUTES[row.confidence];
  return {
    stopId: row.stopId,
    arrival: minutes,
    departure: minutes,
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
    // 회차점 막차가 회차 전 직전 정류장보다 이르면 회차점에서 따로 출발하는 차다(1336) — 회차 전 운행의 회차점 도착 시각을
    // 모르므로 회차 전 운행에서 뺀다. 넣으면 빌더가 시각을 맞추느라 마지막 구간이 0분이 된다.
    const departsSeparately =
      turn !== undefined && (outbound.at(-2)?.lastMinutes ?? -Infinity) > turn.lastMinutes;
    const outboundRun = departsSeparately ? outbound.slice(0, -1) : outbound;
    if (outboundRun.length > 0) trips.push(toTrip(outboundRun));
    if (inbound.length > 0) trips.push(toTrip(turn ? [turn, ...inbound] : inbound));
  }
  return trips;
}
