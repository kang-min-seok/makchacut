import type { RouteCandidate, RouteCandidates } from '#plan/steps/route-candidates';
import type { TripPlan } from '#plan/trip-plan';

// 5단계: 돌아가는 막차 — 우회 한도 밖 가장 늦은 경로가 마감과 한도 안 가장 늦은 경로보다 늦으면 그 마감과 더 걸리는 시간
// (한도 안 경로가 마감보다 늦은 건 단순한 경로를 대표로 골라서다 — 돌아가는 길이 아니다)

export function detourOption(
  candidates: RouteCandidates,
  layer: readonly RouteCandidate[],
  main: RouteCandidate,
  deadline: number,
): TripPlan['detour'] {
  const best = candidates.all[0]!;
  if (best.latestDeparture <= Math.max(deadline, layer[0]!.latestDeparture)) return undefined;
  // 핵심 연결로 가는 방법은 집 도착이 같아 main보다 늦게 나서면 덜 걸린다
  const mainTravel = main.travelMinutes - (deadline - main.latestDeparture);
  return {
    deadline: best.latestDeparture,
    extraMinutes: Math.max(0, Math.round(best.travelMinutes - mainTravel)),
  };
}
