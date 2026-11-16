import type { Anchor } from '#plan/steps/anchor';
import type { RouteCandidate } from '#plan/steps/route-candidates';
import type { OtherAnchor, TripPlanInput } from '#plan/trip-plan';

// 대표 핵심 연결 말고 집에 데려다 주는 다른 막차들 (출발 마감 늦은 순)

export type OtherAnchorsStep = (
  input: TripPlanInput,
  main: RouteCandidate,
  anchor: Anchor | undefined,
  deadline: number,
) => OtherAnchor[];

// shortcut: 아직 찾지 않는다, 핵심 연결 여러 개(계획 8)에서 대표 노선을 빼고 다시 탐색해 채운다
export const findOtherAnchors: OtherAnchorsStep = () => [];
