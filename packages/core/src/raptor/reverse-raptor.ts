import type { GraphIndex } from '#graph/graph-index';
import {
  headwayOf,
  patternStopAt,
  stopCount,
  timeIndex,
  type TransitGraph,
} from '#graph/transit-graph';

// 역방향 RAPTOR: 목적지(집 쪽 정류장)에서 거꾸로, 라운드(= 탄 횟수)마다 각 정류장의
// "늦어도 몇 시에 여기 있어야 목적지에 갈 수 있는가"를 구한다.
//
// 라운드마다 두 값을 둔다.
// - ride: 이 정류장에서 차를 타서(라운드 0은 목적지 자체) 정해진 값 = 그 차의 출발 시각
// - walk: 이 정류장에서 걸어서 ride 값이 있는 정류장으로 가서 정해진 값
// 내린 정류장에서 다음 차로 갈아탈 때만 최소 환승 여유를 뺀다(다른 호선 환승은 도보 간선 시간이 이미 들어 있다).
//
// 배차 간격이 있는 패턴(버스)은 막차 운행을 시각 기반으로 타는 것과 별도로, 막차가 늦어 못 쓰는 경우
// 막차 시각표의 구간 소요로 "내림 한계 − 탑승시간 − 배차간격"(최악 대기)을 쓴다.
//
// 라벨마다 "그 값에 이 정류장에 있으면 목적지(집)에 언제 닿는가"도 함께 둔다. 우회 분리는 정류장별
// 최대 소요(평시 소요 × 배수)를 넘는 라벨을 버린 탐색을 한 번 더 돌려 얻는다.

export type RaptorTarget = {
  stop: number;
  // 목적지에 늦어도 이 시각까지 도착해야 한다 (집이면 제한 없음 = Infinity)
  latestArrival: number;
  // 이 정류장에서 내린 뒤 실제 목적지(집)까지 더 걸리는 분 (기본 0)
  finishMinutes?: number;
};

export type ReverseRaptorOptions = {
  // 탈 수 있는 최대 횟수 (= 최대 환승 + 1)
  maxRides: number;
  minTransferMinutes: number;
  // 도보 간선 시간 배율 (걷는 속도 설정)
  walkTimeFactor: number;
  // 목적지에 차로 내려 거기서 다른 차로 갈아타는 탐색(연결 방법)이면 최소 환승 여유, 집이면 0
  targetTransferMinutes?: number;
  // 정류장별 최대 소요(분): 그 정류장 값에서 목적지 도착까지가 이보다 길면 라벨을 버린다 (우회 제외)
  maxTravelMinutes?: Float64Array;
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
  // 1이면 배차 기반 탑승 (rideTrip은 구간 소요로 쓴 막차 운행)
  rideByHeadway: Uint8Array;
  walkFootpath: Int32Array;
  // 라운드 1부터: 그 값에 이 정류장에 있으면 목적지에 닿는 시각
  rideFinish: Float64Array;
  walkFinish: Float64Array;
};

export type TransferSlack = {
  minTransferMinutes: number;
  targetTransferMinutes: number;
};

export type ReverseRaptorResult = TransferSlack & {
  rounds: RaptorRound[];
  walkTimeFactor: number;
};

function createRound(size: number): RaptorRound {
  return {
    ride: new Float64Array(size).fill(-Infinity),
    walk: new Float64Array(size).fill(-Infinity),
    ridePattern: new Int32Array(size).fill(NONE),
    rideTrip: new Int32Array(size).fill(NONE),
    rideBoardPosition: new Int32Array(size).fill(NONE),
    rideAlightPosition: new Int32Array(size).fill(NONE),
    rideByHeadway: new Uint8Array(size),
    walkFootpath: new Int32Array(size).fill(NONE),
    rideFinish: new Float64Array(size).fill(Infinity),
    walkFinish: new Float64Array(size).fill(Infinity),
  };
}

// 이 라운드의 ride 값에 차로 내려 이어 탈 때 빼는 여유 (라운드 0은 목적지)
export function transferSlackOf(roundNumber: number, slack: TransferSlack): number {
  return roundNumber === 0 ? slack.targetTransferMinutes : slack.minTransferMinutes;
}

// 이 정류장에서 내려도 되는 가장 늦은 도착 시각 (이 라운드 값 기준)
export function alightLimitOf(
  round: RaptorRound,
  roundNumber: number,
  stop: number,
  slack: TransferSlack,
): number {
  return Math.max(round.walk[stop]!, round.ride[stop]! - transferSlackOf(roundNumber, slack));
}

type SearchState = {
  graph: TransitGraph;
  index: GraphIndex;
  bestRide: Float64Array;
  bestWalk: Float64Array;
  // 이전 라운드들까지의 내림 한계 (라운드가 끝날 때 갱신)
  alightLimit: Float64Array;
  // 내림 한계 라벨로 이어 갈 때 목적지 도착: 라운드 0(목적지)은 내린 시각 + finishOffset,
  // 그 뒤 라운드는 이어 탈 차가 정해져 있어 finishFixed (finishOffset은 NaN)
  finishFixed: Float64Array;
  finishOffset: Float64Array;
  // 라운드 0 목적지 라벨의 도착 오프셋 (ride: 목적지 자체, walk: 걸어서 목적지로)
  targetRideOffset: Float64Array;
  targetWalkOffset: Float64Array;
  maxTravel: Float64Array | undefined;
  walkTimeFactor: number;
};

// 이 정류장에 at에 내려 이어 가면 목적지에 닿는 시각
function finishAfterAlight(state: SearchState, stop: number, at: number): number {
  const offset = state.finishOffset[stop]!;
  return Number.isNaN(offset) ? state.finishFixed[stop]! : at + offset;
}

function withinTravel(state: SearchState, stop: number, value: number, finish: number): boolean {
  return state.maxTravel === undefined || finish - value <= state.maxTravel[stop]!;
}

type RideChoice = {
  pattern: number;
  trip: number;
  boardPosition: number;
  alightPosition: number;
  byHeadway: boolean;
};

function recordRide(
  state: SearchState,
  round: RaptorRound,
  stop: number,
  value: number,
  finish: number,
  choice: RideChoice,
  improved: Set<number>,
): void {
  if (value <= state.bestRide[stop]! || !withinTravel(state, stop, value, finish)) return;
  state.bestRide[stop] = value;
  round.ride[stop] = value;
  round.rideFinish[stop] = finish;
  round.ridePattern[stop] = choice.pattern;
  round.rideTrip[stop] = choice.trip;
  round.rideBoardPosition[stop] = choice.boardPosition;
  round.rideAlightPosition[stop] = choice.alightPosition;
  round.rideByHeadway[stop] = choice.byHeadway ? 1 : 0;
  improved.add(stop);
}

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

// 시각 기반: 내릴 수 있는 가장 늦은 운행을 들고 거꾸로 가며 그 운행의 출발 시각으로 탄다
function scanTimedTrips(
  state: SearchState,
  round: RaptorRound,
  pattern: number,
  startPosition: number,
  improved: Set<number>,
): void {
  const { graph, alightLimit } = state;
  let trip = NONE;
  let alightPosition = NONE;
  let finish = Infinity;
  for (let position = startPosition; position >= 0; position -= 1) {
    const stop = patternStopAt(graph, pattern, position);
    if (trip !== NONE) {
      const departure = graph.departures[timeIndex(graph, pattern, trip, position)]!;
      const choice = { pattern, trip, boardPosition: position, alightPosition, byHeadway: false };
      recordRide(state, round, stop, departure, finish, choice, improved);
    }
    const limit = alightLimit[stop]!;
    if (limit === -Infinity) continue;
    const candidate = latestTripArrivingBy(graph, pattern, position, limit);
    if (candidate > trip) {
      trip = candidate;
      alightPosition = position;
      const arrival = graph.arrivals[timeIndex(graph, pattern, trip, position)]!;
      finish = finishAfterAlight(state, stop, arrival);
    }
  }
}

// 배차 기반: 막차 시각표 기준 "내림 한계 − 막차 도착"(음수 = 막차로는 늦음)의 최댓값을 들고 거꾸로 가며
// 탈 정류장의 막차 출발 + 그 값 − 배차간격을 늦어도 있어야 할 시각으로 쓴다
function scanHeadway(
  state: SearchState,
  round: RaptorRound,
  pattern: number,
  startPosition: number,
  headwayMinutes: number,
  improved: Set<number>,
): void {
  const { graph, alightLimit } = state;
  const trip = graph.patternTripOffsets[pattern + 1]! - 1;
  let margin = -Infinity;
  let alightPosition = NONE;
  let finish = Infinity;
  for (let position = startPosition; position >= 0; position -= 1) {
    const stop = patternStopAt(graph, pattern, position);
    const cell = timeIndex(graph, pattern, trip, position);
    // 막차로 갈 수 있으면(margin ≥ 0) 시각 기반 탑승이 이미 더 늦은 값을 준다
    if (margin > -Infinity && margin < 0) {
      const value = graph.departures[cell]! + margin - headwayMinutes;
      const choice = { pattern, trip, boardPosition: position, alightPosition, byHeadway: true };
      recordRide(state, round, stop, value, finish, choice, improved);
    }
    const candidate = alightLimit[stop]! - graph.arrivals[cell]!;
    if (candidate > margin) {
      margin = candidate;
      alightPosition = position;
      // 최악 대기로 탄 차는 내림 한계에 맞춰 내린다
      finish = finishAfterAlight(state, stop, alightLimit[stop]!);
    }
  }
}

function scanPattern(
  state: SearchState,
  round: RaptorRound,
  pattern: number,
  startPosition: number,
  improved: Set<number>,
): void {
  scanTimedTrips(state, round, pattern, startPosition, improved);
  const headway = headwayOf(state.graph, pattern);
  if (headway !== undefined) {
    scanHeadway(state, round, pattern, startPosition, headway, improved);
  }
}

function relaxFootpaths(
  state: SearchState,
  round: RaptorRound,
  roundNumber: number,
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
      const walkMinutes =
        (graph.footpathSeconds[footpath]! * state.walkTimeFactor) / SECONDS_PER_MINUTE;
      const candidate = value - walkMinutes;
      if (candidate <= bestWalk[from]!) continue;
      // 라운드 0은 목적지까지 걸어 가므로 소요가 도보 + 목적지 오프셋으로 정해진다
      const offset = walkMinutes + state.targetRideOffset[to]!;
      const finish = roundNumber === 0 ? candidate + offset : round.rideFinish[to]!;
      if (!withinTravel(state, from, candidate, finish)) continue;
      bestWalk[from] = candidate;
      round.walk[from] = candidate;
      round.walkFootpath[from] = footpath;
      if (roundNumber === 0) state.targetWalkOffset[from] = offset;
      else round.walkFinish[from] = finish;
      walked.add(from);
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
  slack: TransferSlack,
): number[] {
  const marked: number[] = [];
  for (const stop of touched) {
    const limit = alightLimitOf(round, roundNumber, stop, slack);
    if (limit <= state.alightLimit[stop]!) continue;
    state.alightLimit[stop] = limit;
    const byWalk = round.walk[stop]! >= limit;
    if (roundNumber === 0) {
      state.finishOffset[stop] = byWalk
        ? state.targetWalkOffset[stop]!
        : state.targetRideOffset[stop]!;
    } else {
      state.finishOffset[stop] = NaN;
      state.finishFixed[stop] = byWalk ? round.walkFinish[stop]! : round.rideFinish[stop]!;
    }
    marked.push(stop);
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
    finishFixed: new Float64Array(size).fill(Infinity),
    finishOffset: new Float64Array(size).fill(NaN),
    targetRideOffset: new Float64Array(size),
    targetWalkOffset: new Float64Array(size),
    maxTravel: options.maxTravelMinutes,
    walkTimeFactor: options.walkTimeFactor,
  };
  const { walkTimeFactor } = options;
  const slack: TransferSlack = {
    minTransferMinutes: options.minTransferMinutes,
    targetTransferMinutes: options.targetTransferMinutes ?? 0,
  };

  const first = createRound(size);
  const targetStops = new Set<number>();
  for (const target of targets) {
    if (target.latestArrival > first.ride[target.stop]!) {
      first.ride[target.stop] = target.latestArrival;
      state.bestRide[target.stop] = target.latestArrival;
      state.targetRideOffset[target.stop] = target.finishMinutes ?? 0;
      targetStops.add(target.stop);
    }
  }
  const firstWalked = relaxFootpaths(state, first, 0, targetStops);
  const rounds = [first];
  let marked = updateAlightLimits(
    state,
    first,
    0,
    new Set([...targetStops, ...firstWalked]),
    slack,
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
    const walked = relaxFootpaths(state, round, roundNumber, rode);
    rounds.push(round);
    marked = updateAlightLimits(state, round, roundNumber, new Set([...rode, ...walked]), slack);
  }
  return { rounds, ...slack, walkTimeFactor };
}
