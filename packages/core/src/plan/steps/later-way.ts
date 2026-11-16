import type { RouteCandidate } from '#plan/steps/route-candidates';
import { toWay } from '#plan/steps/ways-to-anchor';
import type { LaterWay, TripPlanInput } from '#plan/trip-plan';
import { TIME_EPSILON } from '#time/units';

// 대표보다 늦게 나설 수 있는 경로(환승이 더 많음): 우회 판정을 통과한 가장 늦은 후보가 마감보다 늦고 더 타면 그것

export type LaterWayStep = (
  input: TripPlanInput,
  layer: readonly RouteCandidate[],
  main: RouteCandidate,
  deadline: number,
) => LaterWay | undefined;

export const laterWay: LaterWayStep = (_input, layer, main, deadline) => {
  const latest = layer[0]!;
  const extraRides = latest.journey.rides - main.journey.rides;
  if (extraRides <= 0 || latest.latestDeparture <= deadline + TIME_EPSILON) return undefined;
  return { way: toWay(latest, latest.journey.legs, latest.homeWalkMinutes), extraRides };
};
