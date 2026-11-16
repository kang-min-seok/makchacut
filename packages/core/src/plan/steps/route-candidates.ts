import type { TransitGraph } from '#graph/transit-graph';
import type { AccessStop } from '#plan/access';
import type { TripPlanInput } from '#plan/trip-plan';
import { type Journey, reconstructJourney } from '#raptor/journey';
import { labelsAt } from '#raptor/labels';
import type { ReverseRaptorResult } from '#raptor/reverse-raptor';
import { SECONDS_PER_MINUTE } from '#time/units';

// 1단계: 약속 장소 → 집 경로 후보 (경로 + 출발 마감 + 총 소요)

// 약속 장소 주변 정류장 하나에서 출발하는 경로 하나 (탄 횟수별)
export type MeetupJourney = {
  meetupWalkMinutes: number;
  journey: Journey;
  // 약속 장소에서 늦어도 이 시각에 나서야 한다 (도보·안전 여유 반영)
  latestDeparture: number;
  // 마지막 정류장(목적지 쪽 진입점)에 닿는 시각
  endTime: number;
};

// 집까지 가는 경로 후보
export type RouteCandidate = MeetupJourney & {
  // 마지막 정류장 → 집 도보
  homeWalkMinutes: number;
  // 약속 장소를 나서서(안전 여유 제외) 집에 닿기까지 총 소요
  travelMinutes: number;
};

export type RouteCandidates = {
  // 제한 없는 집 쪽 탐색의 후보 (마감 늦은 순)
  all: RouteCandidate[];
  // 우회 한도를 건 탐색의 후보 (우회 제한이 없으면 빈 배열)
  limited: RouteCandidate[];
};

// 출발 정류장 시각에서 구간을 따라가 마지막 정류장에 닿는 시각
export function journeyEndTime(journey: Journey): number {
  let time = journey.latestDeparture;
  for (const leg of journey.legs) {
    time = leg.kind === 'walk' ? time + leg.seconds / SECONDS_PER_MINUTE : leg.arrive;
  }
  return time;
}

// 마감이 늦은 순, 같으면 덜 타는 순
export function compareCandidates(a: MeetupJourney, b: MeetupJourney): number {
  return b.latestDeparture - a.latestDeparture || a.journey.rides - b.journey.rides;
}

// 약속 장소 주변 정류장마다 라운드별 값(탄 횟수와 마감의 파레토 집합)을 경로로 복원한다
export function meetupJourneys(
  graph: TransitGraph,
  result: ReverseRaptorResult,
  meetupAccess: readonly AccessStop[],
  safetyMarginMinutes: number,
): MeetupJourney[] {
  const journeys: MeetupJourney[] = [];
  for (const access of meetupAccess) {
    for (const label of labelsAt(result, access.stop)) {
      // 목적지 자체(집 진입점)는 마감이 없다
      if (!Number.isFinite(label.value)) continue;
      const journey = reconstructJourney(graph, result, access.stop, label);
      if (!journey) continue;
      journeys.push({
        meetupWalkMinutes: access.walkMinutes,
        journey,
        latestDeparture: label.value - access.walkMinutes - safetyMarginMinutes,
        endTime: journeyEndTime(journey),
      });
    }
  }
  return journeys.sort(compareCandidates);
}

function candidatesFrom(
  input: TripPlanInput,
  result: ReverseRaptorResult,
  homeWalk: ReadonlyMap<number, number>,
): RouteCandidate[] {
  const { graph, meetupAccess, options } = input;
  return meetupJourneys(graph, result, meetupAccess, options.safetyMarginMinutes).map(
    (candidate) => {
      const homeWalkMinutes = homeWalk.get(candidate.journey.targetStop) ?? 0;
      const homeArrival = candidate.endTime + homeWalkMinutes;
      const leaveMeetup = candidate.latestDeparture + options.safetyMarginMinutes;
      return { ...candidate, homeWalkMinutes, travelMinutes: homeArrival - leaveMeetup };
    },
  );
}

export function routeCandidates(input: TripPlanInput): RouteCandidates {
  const homeWalk = new Map(input.homeAccess.map((s) => [s.stop, s.walkMinutes]));
  const { free, limited } = input.homeSearch;
  return {
    all: candidatesFrom(input, free, homeWalk),
    limited: limited ? candidatesFrom(input, limited, homeWalk) : [],
  };
}
