import type { RouteCandidate } from '#plan/steps/route-candidates';

// 3단계 대표 경로: 우회 판정을 통과한 후보(출발 마감 늦은 순, 같으면 덜 타는 순)에서 고른다

export function chooseMain(layer: readonly RouteCandidate[]): RouteCandidate {
  return layer[0]!;
}
