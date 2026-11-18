import type { GraphIndex } from '#graph/graph-index';
import { headwayOf, stopCount, type TransitGraph } from '#graph/transit-graph';
import type { ContinuationSource } from '#raptor/continuation';
import { relaxFootpaths } from '#raptor/relax-footpaths';
import { createRound, NONE, type RaptorRound, type TransferSlack } from '#raptor/round';
import { scanHeadway } from '#raptor/scan-headway';
import { scanTimedTrips } from '#raptor/scan-timed';
import { createSearchState, type SearchState, updateAlightLimits } from '#raptor/search-state';

// 역방향 RAPTOR: 목적지(집 쪽 정류장)에서 거꾸로, 라운드(= 탄 횟수)마다 각 정류장의
// "늦어도 몇 시에 여기 있어야 목적지에 갈 수 있는가"를 구한다.
//
// 라운드마다 ride(그 자리에서 타기)·walk(걸어서 탈 정류장으로) 두 값을 둔다(round.ts).
// 내린 정류장에서 다음 차로 갈아탈 때만 최소 환승 여유를 뺀다(다른 호선 환승은 도보 간선 시간이 이미 들어 있다).
//
// 배차 간격이 있는 패턴(버스)은 막차 운행을 시각 기반으로 타는 것(scan-timed.ts)과 별도로, 막차가 늦어 못 쓰는 경우
// 막차 시각표의 구간 소요로 "내림 한계 − 탑승시간 − 배차간격"(최악 대기)을 쓴다(scan-headway.ts).
//
// 라벨마다 "그 값에 이 정류장에 있으면 목적지(집)에 언제 닿는가"도 함께 둔다(search-state.ts). 우회 분리는 정류장별
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

export type ReverseRaptorResult = ContinuationSource & {
  rounds: RaptorRound[];
  walkTimeFactor: number;
};

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
  const { walkTimeFactor } = options;
  const slack: TransferSlack = {
    minTransferMinutes: options.minTransferMinutes,
    targetTransferMinutes: options.targetTransferMinutes ?? 0,
  };
  const state = createSearchState(graph, index, options.maxTravelMinutes, walkTimeFactor, slack);
  const { rounds } = state;

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
  rounds.push(first);
  let marked = updateAlightLimits(state, first, 0, new Set([...targetStops, ...firstWalked]));

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
    marked = updateAlightLimits(state, round, roundNumber, new Set([...rode, ...walked]));
  }
  return {
    rounds,
    ...slack,
    targetRideOffset: state.targetRideOffset,
    targetWalkOffset: state.targetWalkOffset,
    walkTimeFactor,
  };
}
