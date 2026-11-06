import {
  TIME_SOURCES,
  type TimeSource,
  TRANSIT_MODES,
  type TransitGraph,
  type TransitMode,
} from '#graph/transit-graph';
import { CONFIDENCE_LEVELS, type Confidence } from '#stop-last/confidence';

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
  source: TimeSource;
  confidence: Confidence;
};

export type GraphTripInput = {
  routeId: number;
  routeName: string;
  mode: TransitMode;
  // 결과 설명용 (열차번호·행선지 등)
  label: string;
  // 정차 순서대로 (빌더는 순서를 바꾸지 않는다)
  stopTimes: readonly GraphStopTimeInput[];
  // 막차 이전을 배차 기반으로 다룰 때의 배차 간격(분). 버스만.
  headwayMinutes: number | null;
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

type TimedStop = {
  stop: number;
  arrival: number;
  departure: number;
  source: TimeSource;
  confidence: Confidence;
};
type PreparedTrip = { input: GraphTripInput; stops: TimedStop[] };
type Pattern = {
  routeId: number;
  routeName: string;
  mode: TransitMode;
  headwayMinutes: number | null;
  trips: PreparedTrip[];
};

const MIN_TRIP_STOPS = 2;

// 시각이 하나만 있으면 다른 쪽에 같은 값을 쓰고, 입력 순서 그대로 도착 ≤ 출발, 직전 출발 ≤ 도착을 맞춘다
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
    const previous = timed.at(-1)?.departure ?? -Infinity;
    const safeDeparture = Math.max(departure, previous);
    timed.push({
      stop,
      arrival: Math.min(Math.max(arrival, previous), safeDeparture),
      departure: safeDeparture,
      source: st.source,
      confidence: st.confidence,
    });
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
    const key = `${trip.input.routeId}|${trip.input.headwayMinutes ?? ''}|${trip.stops.map((s) => s.stop).join(',')}`;
    const group = byKey.get(key);
    if (group) group.push(trip);
    else byKey.set(key, [trip]);
  }
  const patterns: Pattern[] = [];
  for (const group of byKey.values()) {
    const { routeId, routeName, mode, headwayMinutes } = group[0]!.input;
    for (const fifo of splitFifo(group)) {
      patterns.push({ routeId, routeName, mode, headwayMinutes, trips: fifo });
    }
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
  const timeSources = new Uint8Array(timeTotal);
  const timeConfidences = new Uint8Array(timeTotal);
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
        timeSources[cursor] = TIME_SOURCES.indexOf(s.source);
        timeConfidences[cursor] = CONFIDENCE_LEVELS.indexOf(s.confidence);
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
    patternHeadwayMinutes: Float32Array.from(patterns, (p) => p.headwayMinutes ?? Number.NaN),
    tripLabels,
    arrivals,
    departures,
    timeSources,
    timeConfidences,
    footpathFrom: Int32Array.from(footpaths, (f) => stopIndexById.get(f.fromStopId)!),
    footpathTo: Int32Array.from(footpaths, (f) => stopIndexById.get(f.toStopId)!),
    footpathSeconds: Int32Array.from(footpaths, (f) => f.walkSeconds),
  };
  return { graph, skippedTrips, droppedStopTimes };
}
