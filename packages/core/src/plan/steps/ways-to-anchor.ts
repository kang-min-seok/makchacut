import type { TransitGraph } from '#graph/transit-graph';
import type { KeyConnection } from '#plan/key-connection';
import {
  type MeetupJourney,
  meetupJourneys,
  type RouteCandidate,
} from '#plan/steps/route-candidates';
import type { PlannedWay, TripPlanInput } from '#plan/trip-plan';
import type { JourneyLeg } from '#raptor/journey';
import { reverseRaptor } from '#raptor/reverse-raptor';

// 4단계: 핵심 연결 승차 정류장까지 가는 방법 (재탐색 · 중복 제거)

export const MAX_WAYS = 3;

function toWay(candidate: MeetupJourney, legs: JourneyLeg[], homeWalkMinutes: number): PlannedWay {
  return {
    latestDeparture: candidate.latestDeparture,
    meetupWalkMinutes: candidate.meetupWalkMinutes,
    legs,
    homeWalkMinutes,
  };
}

// 첫 탑승 노선·정류장이 같은 방법은 마감이 가장 늦은 하나만 남긴다 (걷기만 하는 방법은 하나)
function uniqueByFirstRide(graph: TransitGraph, ways: readonly PlannedWay[]): PlannedWay[] {
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

// 핵심 연결이 없으면 후보 경로를 그대로 방법으로 쓴다
export function distinctWays(
  graph: TransitGraph,
  candidates: readonly RouteCandidate[],
): PlannedWay[] {
  return uniqueByFirstRide(
    graph,
    candidates.map((c) => toWay(c, c.journey.legs, c.homeWalkMinutes)),
  );
}

// 핵심 연결 출발 시각을 목표로 다시 탐색하고 핵심 연결 이후 구간을 붙인다. 방법이 없으면 대표 경로 하나.
export function waysToAnchor(
  input: TripPlanInput,
  main: RouteCandidate,
  key: KeyConnection,
): PlannedWay[] {
  const { graph, index, meetupAccess, options } = input;
  const tail = main.journey.legs.slice(key.legIndex);
  const tailRides = tail.filter((leg) => leg.kind === 'ride').length;
  const result = reverseRaptor(
    graph,
    index,
    [{ stop: key.leg.fromStop, latestArrival: key.leg.depart }],
    {
      maxRides: Math.max(0, options.maxRides - tailRides),
      minTransferMinutes: options.minTransferMinutes,
      walkTimeFactor: options.walkTimeFactor,
      targetTransferMinutes: options.minTransferMinutes,
    },
  );
  const prefixes = meetupJourneys(graph, result, meetupAccess, options.safetyMarginMinutes);
  const ways = uniqueByFirstRide(
    graph,
    prefixes.map((prefix) =>
      toWay(prefix, [...prefix.journey.legs, ...tail], main.homeWalkMinutes),
    ),
  );
  return ways.length > 0 ? ways : [toWay(main, main.journey.legs, main.homeWalkMinutes)];
}
