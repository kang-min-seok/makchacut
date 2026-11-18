import type { RouteCandidate } from '#plan/steps/route-candidates';
import { TIME_EPSILON } from '#time/units';

// 3단계 대표 경로: 우회 판정을 통과한 후보(출발 마감 늦은 순, 같으면 덜 타는 순)에서 고른다.
// 가장 늦은 후보보다 덜 타면서 마감 차이가 줄인 환승 1번당 이 분 이내면 덜 타는 쪽이 대표다
// (환승이 늘면 연결 하나만 어긋나도 집에 못 간다)

export const SIMPLER_ROUTE_MINUTES_PER_TRANSFER = 5;

function isSimplerEnough(candidate: RouteCandidate, latest: RouteCandidate): boolean {
  const fewerRides = latest.journey.rides - candidate.journey.rides;
  if (fewerRides <= 0) return false;
  const lostMinutes = latest.latestDeparture - candidate.latestDeparture;
  return lostMinutes <= SIMPLER_ROUTE_MINUTES_PER_TRANSFER * fewerRides + TIME_EPSILON;
}

// 그런 후보 중 탑승이 가장 적은 것, 같으면 가장 늦은 것
export function chooseMain(layer: readonly RouteCandidate[]): RouteCandidate {
  const latest = layer[0]!;
  return layer
    .filter((candidate) => isSimplerEnough(candidate, latest))
    .reduce((best, c) => (c.journey.rides < best.journey.rides ? c : best), latest);
}
