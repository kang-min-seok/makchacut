import { TRANSIT_MODES, type TransitGraph, type TransitMode } from '#graph/transit-graph';

export type GraphStopInput = {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
};

export type GraphStopTimeInput = {
  stopId: number;
  arrival: number | null;
  departure: number | null;
};

export type GraphTripInput = {
  routeId: number;
  routeName: string;
  mode: TransitMode;
  // 결과 설명용 (열차번호·행선지 등)
  label: string;
  stopTimes: readonly GraphStopTimeInput[];
};

export type GraphFootpathInput = {
  fromStopId: number;
  toStopId: number;
  walkSeconds: number;
};

export type GraphBuildInput = {
  stops: readonly GraphStopInput[];
  trips: readonly GraphTripInput[];
  footpaths: readonly GraphFootpathInput[];
};

export type GraphBuildReport = {
  graph: TransitGraph;
  // 정차 정류장이 2곳 미만이라 버린 운행
  skippedTrips: number;
  // 정류장 목록에 없어 버린 정차
  droppedStopTimes: number;
};

type TimedStop = { stop: number; arrival: number; departure: number };
type PreparedTrip = { input: GraphTripInput; stops: TimedStop[] };
type Pattern = { routeId: number; routeName: string; mode: TransitMode; trips: PreparedTrip[] };

const MIN_TRIP_STOPS = 2;

// 시각이 하나만 있으면 다른 쪽에 같은 값을 쓰고, 출발 순으로 정렬해 도착 ≤ 출발, 직전 출발 ≤ 도착을 맞춘다
function prepareTrip(
  trip: GraphTripInput,
  stopIndexById: ReadonlyMap<number, number>,
): { stops: TimedStop[]; dropped: number } {
  const timed: TimedStop[] = [];
  let dropped = 0;
  for (const st of trip.stopTimes) {
    const stop = stopIndexById.get(st.stopId);
    const arrival = st.arrival ?? st.departure;
    const departure = st.departure ?? st.arrival;
    if (stop === undefined || arrival === null || departure === null) {
      dropped += 1;
      continue;
    }
    timed.push({ stop, arrival: Math.min(arrival, departure), departure });
  }
  timed.sort((a, b) => a.departure - b.departure);
  for (let i = 1; i < timed.length; i += 1) {
    const current = timed[i]!;
    current.arrival = Math.max(current.arrival, timed[i - 1]!.departure);
  }
  return { stops: timed, dropped };
}

function overtakes(earlier: PreparedTrip, later: PreparedTrip): boolean {
  return earlier.stops.some(
    (s, i) => s.arrival > later.stops[i]!.arrival || s.departure > later.stops[i]!.departure,
  );
}

// 같은 정차 순서의 운행을 출발 순으로 놓고, 앞 운행을 앞지르는 운행은 다른 패턴으로 나눈다
function splitFifo(trips: PreparedTrip[]): PreparedTrip[][] {
  const sorted = [...trips].sort((a, b) => a.stops[0]!.departure - b.stops[0]!.departure);
  const groups: PreparedTrip[][] = [];
  for (const trip of sorted) {
    const group = groups.find((g) => !overtakes(g[g.length - 1]!, trip));
    if (group) group.push(trip);
    else groups.push([trip]);
  }
  return groups;
}

function groupPatterns(trips: PreparedTrip[]): Pattern[] {
  const byKey = new Map<string, PreparedTrip[]>();
  for (const trip of trips) {
    const key = `${trip.input.routeId}|${trip.stops.map((s) => s.stop).join(',')}`;
    const group = byKey.get(key);
    if (group) group.push(trip);
    else byKey.set(key, [trip]);
  }
  const patterns: Pattern[] = [];
  for (const group of byKey.values()) {
    const { routeId, routeName, mode } = group[0]!.input;
    for (const fifo of splitFifo(group)) patterns.push({ routeId, routeName, mode, trips: fifo });
  }
  return patterns;
}

function usedStopIndexes(
  stops: readonly GraphStopInput[],
  trips: readonly GraphTripInput[],
): GraphStopInput[] {
  const used = new Set<number>();
  for (const trip of trips) for (const st of trip.stopTimes) used.add(st.stopId);
  return stops.filter((s) => used.has(s.id));
}

// 운행이 지나는 정류장만 그래프에 넣는다. 도보 간선은 양 끝이 모두 들어간 것만 남긴다.
export function buildTransitGraph(input: GraphBuildInput): GraphBuildReport {
  const stops = usedStopIndexes(input.stops, input.trips);
  const stopIndexById = new Map(stops.map((s, i) => [s.id, i]));

  let skippedTrips = 0;
  let droppedStopTimes = 0;
  const prepared: PreparedTrip[] = [];
  for (const trip of input.trips) {
    const { stops: timed, dropped } = prepareTrip(trip, stopIndexById);
    droppedStopTimes += dropped;
    if (timed.length < MIN_TRIP_STOPS) skippedTrips += 1;
    else prepared.push({ input: trip, stops: timed });
  }
  const patterns = groupPatterns(prepared);

  const patternStopOffsets = new Int32Array(patterns.length + 1);
  const patternTripOffsets = new Int32Array(patterns.length + 1);
  const patternTimeOffsets = new Int32Array(patterns.length);
  let stopTotal = 0;
  let tripTotal = 0;
  let timeTotal = 0;
  patterns.forEach((p, i) => {
    const length = p.trips[0]!.stops.length;
    patternTimeOffsets[i] = timeTotal;
    stopTotal += length;
    tripTotal += p.trips.length;
    timeTotal += length * p.trips.length;
    patternStopOffsets[i + 1] = stopTotal;
    patternTripOffsets[i + 1] = tripTotal;
  });

  const patternStops = new Int32Array(stopTotal);
  const arrivals = new Float32Array(timeTotal);
  const departures = new Float32Array(timeTotal);
  const tripLabels: string[] = [];
  patterns.forEach((p, i) => {
    p.trips[0]!.stops.forEach((s, j) => {
      patternStops[patternStopOffsets[i]! + j] = s.stop;
    });
    let cursor = patternTimeOffsets[i]!;
    for (const trip of p.trips) {
      tripLabels.push(trip.input.label);
      for (const s of trip.stops) {
        arrivals[cursor] = s.arrival;
        departures[cursor] = s.departure;
        cursor += 1;
      }
    }
  });

  const footpaths = input.footpaths.filter(
    (f) => stopIndexById.has(f.fromStopId) && stopIndexById.has(f.toStopId),
  );

  const graph: TransitGraph = {
    stopIds: Int32Array.from(stops, (s) => s.id),
    stopNames: stops.map((s) => s.name),
    stopLats: Float32Array.from(stops, (s) => s.lat ?? Number.NaN),
    stopLngs: Float32Array.from(stops, (s) => s.lng ?? Number.NaN),
    patternRouteIds: Int32Array.from(patterns, (p) => p.routeId),
    patternRouteNames: patterns.map((p) => p.routeName),
    patternModes: Uint8Array.from(patterns, (p) => TRANSIT_MODES.indexOf(p.mode)),
    patternStopOffsets,
    patternStops,
    patternTripOffsets,
    patternTimeOffsets,
    tripLabels,
    arrivals,
    departures,
    footpathFrom: Int32Array.from(footpaths, (f) => stopIndexById.get(f.fromStopId)!),
    footpathTo: Int32Array.from(footpaths, (f) => stopIndexById.get(f.toStopId)!),
    footpathSeconds: Int32Array.from(footpaths, (f) => f.walkSeconds),
  };
  return { graph, skippedTrips, droppedStopTimes };
}
