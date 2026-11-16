import type { RouteCandidate } from '#plan/steps/route-candidates';
import type { LaterWay, TripPlanInput } from '#plan/trip-plan';

// 대표보다 늦게 나설 수 있는 경로(환승이 더 많음)

export type LaterWayStep = (
  input: TripPlanInput,
  layer: readonly RouteCandidate[],
  main: RouteCandidate,
  deadline: number,
) => LaterWay | undefined;

// shortcut: 대표가 늘 가장 늦은 후보라 아직 없다, 단순한 경로 우선(계획 7)에서 채운다
export const laterWay: LaterWayStep = () => undefined;
