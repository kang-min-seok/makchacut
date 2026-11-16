import { normalTravelFrom } from '#plan/detour';
import {
  compareCandidates,
  type RouteCandidate,
  type RouteCandidates,
} from '#plan/steps/route-candidates';
import type { TripPlanInput } from '#plan/trip-plan';

// 2단계: 우회 판정 — 총 소요 ≤ 평시 총 소요 × 배수인 후보만 남긴다

export type DetourLayer = {
  // 대표 경로를 고를 후보 (마감 늦은 순). 한도 안 후보가 없으면 전체 후보.
  layer: RouteCandidate[];
  // 우회 한도 안 경로가 없어 돌아가는 경로를 그대로 안내함
  detourFallback: boolean;
};

export function withinDetour(input: TripPlanInput, candidates: RouteCandidates): DetourLayer {
  const { normal, detourMultiplier } = input.homeSearch;
  const normalTravel = normalTravelFrom(normal, input.meetupAccess);
  const travelLimit = normalTravel === undefined ? Infinity : normalTravel * detourMultiplier;
  const accepted = [...candidates.limited, ...candidates.all]
    .filter((c) => c.travelMinutes <= travelLimit)
    .sort(compareCandidates);
  const detourFallback = accepted.length === 0;
  return { layer: detourFallback ? candidates.all : accepted, detourFallback };
}
