import type { GraphIndex } from '#graph/graph-index';
import { patternStopAt, stopCount, timeIndex, type TransitGraph } from '#graph/transit-graph';

// 역방향 RAPTOR: 목적지(집 쪽 정류장)에서 거꾸로, 라운드(= 탄 횟수)마다 각 정류장의
// "늦어도 몇 시에 여기 있어야 목적지에 갈 수 있는가"를 구한다.
//
// 라운드마다 두 값을 둔다.
// - ride: 이 정류장에서 차를 타서(라운드 0은 목적지 자체) 정해진 값 = 그 차의 출발 시각
// - walk: 이 정류장에서 걸어서 ride 값이 있는 정류장으로 가서 정해진 값
// 내린 정류장에서 다음 차로 갈아탈 때만 최소 환승 여유를 뺀다(다른 호선 환승은 도보 간선 시간이 이미 들어 있다).

export type RaptorTarget = {
  stop: number;
  // 목적지에 늦어도 이 시각까지 도착해야 한다 (집이면 제한 없음 = Infinity)
  latestArrival: number;
};

export type ReverseRaptorOptions = {
  // 탈 수 있는 최대 횟수 (= 최대 환승 + 1)
  maxRides: number;
  minTransferMinutes: number;
};

export const DEFAULT_MIN_TRANSFER_MINUTES = 1;
const SECONDS_PER_MINUTE = 60;
const NONE = -1;

export type RaptorRound = {
  ride: Float64Array;
  walk: Float64Array;
  ridePattern: Int32Array;
  rideTrip: Int32Array;
  rideBoardPosition: Int32Array;
  rideAlightPosition: Int32Array;
  walkFootpath: Int32Array;
};

export type ReverseRaptorResult = {
  rounds: RaptorRound[];
  minTransferMinutes: number;
};

function createRound(size: number): RaptorRound {
  return {
    ride: new Float64Array(size).fill(-Infinity),
    walk: new Float64Array(size).fill(-Infinity),
    ridePattern: new Int32Array(size).fill(NONE),
    rideTrip: new Int32Array(size).fill(NONE),
    rideBoardPosition: new Int32Array(size).fill(NONE),
    rideAlightPosition: new Int32Array(size).fill(NONE),
    walkFootpath: new Int32Array(size).fill(NONE),
  };
}

// 이 정류장에서 내려도 되는 가장 늦은 도착 시각 (이 라운드 값 기준)
export function alightLimitOf(
  round: RaptorRound,
  roundNumber: number,
  stop: number,
  minTransferMinutes: number,
): number {
  const slack = roundNumber === 0 ? 0 : minTransferMinutes;
  return Math.max(round.walk[stop]!, round.ride[stop]! - slack);
}

type SearchState = {
  graph: TransitGraph;
  index: GraphIndex;
  bestRide: Float64Array;
  bestWalk: Float64Array;
  // 이전 라운드들까지의 내림 한계 (라운드가 끝날 때 갱신)
  alightLimit: Float64Array;
};

// 패턴 안에서 position 정류장 도착이 limit 이하인 가장 늦은 운행 (FIFO라 도착이 운행 순서대로 증가)
function latestTripArrivingBy(
  graph: TransitGraph,
  pattern: number,
  position: number,
  limit: number,
): number {
  let low = graph.patternTripOffsets[pattern]!;
  let high = graph.patternTripOffsets[pattern + 1]! - 1;
  let found = NONE;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (graph.arrivals[timeIndex(graph, pattern, mid, position)]! <= limit) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

function scanPattern(
  state: SearchState,
  round: RaptorRound,
  pattern: number,
  startPosition: number,
  improved: Set<number>,
): void {
  const { graph, bestRide, alightLimit } = state;
  let trip = NONE;
  let alightPosition = NONE;
  for (let position = startPosition; position >= 0; position -= 1) {
    const stop = patternStopAt(graph, pattern, position);
    if (trip !== NONE) {
      const departure = graph.departures[timeIndex(graph, pattern, trip, position)]!;
      if (departure > bestRide[stop]!) {
        bestRide[stop] = departure;
        round.ride[stop] = departure;
        round.ridePattern[stop] = pattern;
        round.rideTrip[stop] = trip;
        round.rideBoardPosition[stop] = position;
        round.rideAlightPosition[stop] = alightPosition;
        improved.add(stop);
      }
    }
    const limit = alightLimit[stop]!;
    if (limit === -Infinity) continue;
    const candidate = latestTripArrivingBy(graph, pattern, position, limit);
    if (candidate > trip) {
      trip = candidate;
      alightPosition = position;
    }
  }
}

function relaxFootpaths(
  state: SearchState,
  round: RaptorRound,
  rideStops: Iterable<number>,
): Set<number> {
  const { graph, index, bestWalk } = state;
  const walked = new Set<number>();
  for (const to of rideStops) {
    const value = round.ride[to]!;
    const end = index.incomingFootpathOffsets[to + 1]!;
    for (let i = index.incomingFootpathOffsets[to]!; i < end; i += 1) {
      const footpath = index.incomingFootpaths[i]!;
      const from = graph.footpathFrom[footpath]!;
      const candidate = value - graph.footpathSeconds[footpath]! / SECONDS_PER_MINUTE;
      if (candidate > bestWalk[from]!) {
        bestWalk[from] = candidate;
        round.walk[from] = candidate;
        round.walkFootpath[from] = footpath;
        walked.add(from);
      }
    }
  }
  return walked;
}

// 라운드 값으로 내림 한계를 올리고, 오른 정류장을 다음 라운드 출발점으로 돌려준다
function updateAlightLimits(
  state: SearchState,
  round: RaptorRound,
  roundNumber: number,
  touched: Iterable<number>,
  minTransferMinutes: number,
): number[] {
  const marked: number[] = [];
  for (const stop of touched) {
    const limit = alightLimitOf(round, roundNumber, stop, minTransferMinutes);
    if (limit > state.alightLimit[stop]!) {
      state.alightLimit[stop] = limit;
      marked.push(stop);
    }
  }
  return marked;
}

// 표시된 정류장을 지나는 패턴마다, 표시된 정류장 중 가장 뒤 위치부터 거꾸로 훑는다
function patternsToScan(state: SearchState, marked: readonly number[]): Map<number, number> {
  const { index } = state;
  const starts = new Map<number, number>();
  for (const stop of marked) {
    const end = index.stopPatternOffsets[stop + 1]!;
    for (let i = index.stopPatternOffsets[stop]!; i < end; i += 1) {
      const pattern = index.stopPatterns[i]!;
      const position = index.stopPatternPositions[i]!;
      if (position > (starts.get(pattern) ?? NONE)) starts.set(pattern, position);
    }
  }
  return starts;
}

export function reverseRaptor(
  graph: TransitGraph,
  index: GraphIndex,
  targets: readonly RaptorTarget[],
  options: ReverseRaptorOptions,
): ReverseRaptorResult {
  const size = stopCount(graph);
  const state: SearchState = {
    graph,
    index,
    bestRide: new Float64Array(size).fill(-Infinity),
    bestWalk: new Float64Array(size).fill(-Infinity),
    alightLimit: new Float64Array(size).fill(-Infinity),
  };
  const { minTransferMinutes } = options;

  const first = createRound(size);
  const targetStops = new Set<number>();
  for (const target of targets) {
    if (target.latestArrival > first.ride[target.stop]!) {
      first.ride[target.stop] = target.latestArrival;
      state.bestRide[target.stop] = target.latestArrival;
      targetStops.add(target.stop);
    }
  }
  const firstWalked = relaxFootpaths(state, first, targetStops);
  const rounds = [first];
  let marked = updateAlightLimits(
    state,
    first,
    0,
    new Set([...targetStops, ...firstWalked]),
    minTransferMinutes,
  );

  for (
    let roundNumber = 1;
    roundNumber <= options.maxRides && marked.length > 0;
    roundNumber += 1
  ) {
    const round = createRound(size);
    const rode = new Set<number>();
    for (const [pattern, start] of patternsToScan(state, marked)) {
      scanPattern(state, round, pattern, start, rode);
    }
    const walked = relaxFootpaths(state, round, rode);
    rounds.push(round);
    marked = updateAlightLimits(
      state,
      round,
      roundNumber,
      new Set([...rode, ...walked]),
      minTransferMinutes,
    );
  }
  return { rounds, minTransferMinutes };
}
