import type { GraphIndex } from '#graph/graph-index';
import type { TransitGraph } from '#graph/transit-graph';
import type { AccessStop } from '#plan/access';
import { findKeyConnection } from '#plan/key-connection';
import { type PlanCandidate, planCandidates } from '#plan/plan-candidates';
import type { JourneyLeg, RideLeg } from '#raptor/journey';
import { type ReverseRaptorResult, reverseRaptor } from '#raptor/reverse-raptor';

// 약속 장소 질의: 집 쪽 탐색 결과(캐시 가능)로 출발 마감·핵심 연결·연결 방법·돌아가는 막차를 고른다

export const MAX_WAYS = 3;

export type TripPlanOptions = {
  maxRides: number;
  minTransferMinutes: number;
  walkTimeFactor: number;
  safetyMarginMinutes: number;
};

export type TripPlanInput = {
  graph: TransitGraph;
  index: GraphIndex;
  homeAccess: readonly AccessStop[];
  // 집 진입점 목표(도착 제한 없음)로 돌린 역방향 탐색
  homeResult: ReverseRaptorResult;
  // 같은 탐색에 우회 한도(정류장별 최대 소요)를 건 결과. 우회 제한이 없으면 undefined.
  limitedResult: ReverseRaptorResult | undefined;
  meetupAccess: readonly AccessStop[];
  options: TripPlanOptions;
};

export type PlannedWay = {
  // 약속 장소에서 늦어도 이 시각에 나서야 한다
  latestDeparture: number;
  meetupWalkMinutes: number;
  // 첫 정류장 → 집 쪽 진입점
  legs: JourneyLeg[];
  homeWalkMinutes: number;
};

export type TripPlan = {
  deadline: number;
  anchor: RideLeg | undefined;
  ways: PlannedWay[];
  detour: { deadline: number; extraMinutes: number } | undefined;
  // 우회 한도 안 경로가 없어 돌아가는 경로를 그대로 안내함
  detourFallback: boolean;
};

type HomeCandidate = PlanCandidate & { travelMinutes: number };

function toWay(candidate: PlanCandidate, legs: JourneyLeg[], homeWalkMinutes: number): PlannedWay {
  return {
    latestDeparture: candidate.latestDeparture,
    meetupWalkMinutes: candidate.meetupWalkMinutes,
    legs,
    homeWalkMinutes,
  };
}

// 첫 탑승 노선·정류장이 같은 방법은 마감이 가장 늦은 하나만 남긴다 (걷기만 하는 방법은 하나)
function distinctWays(graph: TransitGraph, ways: readonly PlannedWay[]): PlannedWay[] {
  const seen = new Set<string>();
  return ways
    .filter((way) => {
      const first = way.legs.find((leg) => leg.kind === 'ride');
      const key = first ? `${graph.patternRouteIds[first.pattern]}:${first.fromStop}` : 'walk';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_WAYS);
}

function homeCandidates(
  input: TripPlanInput,
  result: ReverseRaptorResult,
  homeWalk: ReadonlyMap<number, number>,
): HomeCandidate[] {
  const { graph, meetupAccess, options } = input;
  return planCandidates(graph, result, meetupAccess, options.safetyMarginMinutes).map(
    (candidate) => {
      const homeArrival = candidate.endTime + (homeWalk.get(candidate.journey.targetStop) ?? 0);
      return { ...candidate, travelMinutes: homeArrival - candidate.journey.latestDeparture };
    },
  );
}

// 핵심 연결 승차 정류장까지 가는 방법: 그 출발 시각을 목표로 다시 탐색하고 핵심 연결 이후 구간을 붙인다
function waysToAnchor(
  input: TripPlanInput,
  main: HomeCandidate,
  anchorIndex: number,
  homeWalkMinutes: number,
): PlannedWay[] {
  const { graph, index, meetupAccess, options } = input;
  const tail = main.journey.legs.slice(anchorIndex);
  const anchor = tail[0] as RideLeg;
  const tailRides = tail.filter((leg) => leg.kind === 'ride').length;
  const result = reverseRaptor(
    graph,
    index,
    [{ stop: anchor.fromStop, latestArrival: anchor.depart }],
    {
      maxRides: Math.max(0, options.maxRides - tailRides),
      minTransferMinutes: options.minTransferMinutes,
      walkTimeFactor: options.walkTimeFactor,
      targetTransferMinutes: options.minTransferMinutes,
    },
  );
  const prefixes = planCandidates(graph, result, meetupAccess, options.safetyMarginMinutes);
  return distinctWays(
    graph,
    prefixes.map((prefix) => toWay(prefix, [...prefix.journey.legs, ...tail], homeWalkMinutes)),
  );
}

export function planTrip(input: TripPlanInput): TripPlan | undefined {
  const { graph, index } = input;
  const homeWalk = new Map(input.homeAccess.map((s) => [s.stop, s.walkMinutes]));
  const all = homeCandidates(input, input.homeResult, homeWalk);
  if (all.length === 0) return undefined;

  const limited = input.limitedResult ? homeCandidates(input, input.limitedResult, homeWalk) : all;
  const detourFallback = limited.length === 0;
  const layer = detourFallback ? all : limited;
  const main = layer[0]!;
  const best = all[0]!;
  const detour =
    best.latestDeparture > main.latestDeparture
      ? {
          deadline: best.latestDeparture,
          extraMinutes: Math.max(0, Math.round(best.travelMinutes - main.travelMinutes)),
        }
      : undefined;

  const homeWalkMinutes = homeWalk.get(main.journey.targetStop) ?? 0;
  const key = findKeyConnection(graph, index, main.journey);
  const ways = key
    ? waysToAnchor(input, main, key.legIndex, homeWalkMinutes)
    : distinctWays(
        graph,
        layer.map((c) => toWay(c, c.journey.legs, homeWalk.get(c.journey.targetStop) ?? 0)),
      );

  return {
    deadline: main.latestDeparture,
    anchor: key?.leg,
    ways: ways.length > 0 ? ways : [toWay(main, main.journey.legs, homeWalkMinutes)],
    detour,
    detourFallback,
  };
}
