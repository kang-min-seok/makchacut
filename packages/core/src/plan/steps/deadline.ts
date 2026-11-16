import type { RouteCandidate } from '#plan/steps/route-candidates';
import type { PlannedWay } from '#plan/trip-plan';

// 출발 마감: 핵심 연결로 가는 방법은 대표 경로보다 늦게 나설 수 있다 — 대표 경로보다 더 타지 않는 방법 중 가장 늦은 출발
// (환승을 더 해서 늦게 나서는 경로는 마감이 아니라 더 늦은 경로로 따로 안내한다)

export function ridesOf(way: PlannedWay): number {
  return way.legs.filter((leg) => leg.kind === 'ride').length;
}

export function deadlineOf(main: RouteCandidate, ways: readonly PlannedWay[]): number {
  const simpleWays = ways.filter((way) => ridesOf(way) <= main.journey.rides);
  return Math.max(main.latestDeparture, ...simpleWays.map((way) => way.latestDeparture));
}
