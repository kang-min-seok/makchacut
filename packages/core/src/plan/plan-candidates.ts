import type { TransitGraph } from '#graph/transit-graph';
import type { AccessStop } from '#plan/access';
import { type Journey, labelsAt, reconstructJourney } from '#raptor/journey';
import type { ReverseRaptorResult } from '#raptor/reverse-raptor';

const SECONDS_PER_MINUTE = 60;

// 약속 장소 주변 정류장 하나에서 출발하는 경로 하나 (탄 횟수별)
export type PlanCandidate = {
  meetupWalkMinutes: number;
  journey: Journey;
  // 약속 장소에서 늦어도 이 시각에 나서야 한다 (도보·안전 여유 반영)
  latestDeparture: number;
  // 마지막 정류장(목적지 쪽 진입점)에 닿는 시각
  endTime: number;
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
export function compareCandidates(a: PlanCandidate, b: PlanCandidate): number {
  return b.latestDeparture - a.latestDeparture || a.journey.rides - b.journey.rides;
}

// 약속 장소 주변 정류장마다 라운드별 값(탄 횟수와 마감의 파레토 집합)을 경로로 복원한다
export function planCandidates(
  graph: TransitGraph,
  result: ReverseRaptorResult,
  meetupAccess: readonly AccessStop[],
  safetyMarginMinutes: number,
): PlanCandidate[] {
  const candidates: PlanCandidate[] = [];
  for (const access of meetupAccess) {
    for (const label of labelsAt(result, access.stop)) {
      // 목적지 자체(집 진입점)는 마감이 없다
      if (!Number.isFinite(label.value)) continue;
      const journey = reconstructJourney(graph, result, access.stop, label);
      if (!journey) continue;
      candidates.push({
        meetupWalkMinutes: access.walkMinutes,
        journey,
        latestDeparture: label.value - access.walkMinutes - safetyMarginMinutes,
        endTime: journeyEndTime(journey),
      });
    }
  }
  return candidates.sort(compareCandidates);
}
