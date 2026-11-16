import type { GraphIndex } from '#graph/graph-index';
import { stopCount, type TransitGraph } from '#graph/transit-graph';
import { alightLimitOf, type RaptorRound, type TransferSlack } from '#raptor/round';

// 라운드를 넘어 이어지는 탐색 상태: 정류장별 최선값·내림 한계와, 우회 한도용 목적지 도착 시각 추적

export type SearchState = {
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

export function createSearchState(
  graph: TransitGraph,
  index: GraphIndex,
  maxTravel: Float64Array | undefined,
  walkTimeFactor: number,
): SearchState {
  const size = stopCount(graph);
  return {
    graph,
    index,
    bestRide: new Float64Array(size).fill(-Infinity),
    bestWalk: new Float64Array(size).fill(-Infinity),
    alightLimit: new Float64Array(size).fill(-Infinity),
    finishFixed: new Float64Array(size).fill(Infinity),
    finishOffset: new Float64Array(size).fill(NaN),
    targetRideOffset: new Float64Array(size),
    targetWalkOffset: new Float64Array(size),
    maxTravel,
    walkTimeFactor,
  };
}

// 이 정류장에 at에 내려 이어 가면 목적지에 닿는 시각
export function finishAfterAlight(state: SearchState, stop: number, at: number): number {
  const offset = state.finishOffset[stop]!;
  return Number.isNaN(offset) ? state.finishFixed[stop]! : at + offset;
}

// 소요(분)는 호출하는 쪽이 구한다 — 목적지 라운드는 값이 Infinity라 finish − value가 NaN이 되기 때문
export function withinTravel(state: SearchState, stop: number, travelMinutes: number): boolean {
  return state.maxTravel === undefined || travelMinutes <= state.maxTravel[stop]!;
}

export type RideChoice = {
  pattern: number;
  trip: number;
  boardPosition: number;
  alightPosition: number;
  byHeadway: boolean;
};

export function recordRide(
  state: SearchState,
  round: RaptorRound,
  stop: number,
  value: number,
  finish: number,
  choice: RideChoice,
  improved: Set<number>,
): void {
  if (value <= state.bestRide[stop]! || !withinTravel(state, stop, finish - value)) return;
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

// 라운드 값으로 내림 한계를 올리고, 오른 정류장을 다음 라운드 출발점으로 돌려준다
export function updateAlightLimits(
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
