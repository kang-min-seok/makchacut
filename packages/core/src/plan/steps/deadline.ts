import type { RouteCandidate } from '#plan/steps/route-candidates';
import type { PlannedWay } from '#plan/trip-plan';

// 출발 마감: 핵심 연결로 가는 방법은 대표 경로보다 늦게 나설 수 있다 — 그중 가장 늦은 출발

export function deadlineOf(main: RouteCandidate, ways: readonly PlannedWay[]): number {
  return Math.max(main.latestDeparture, ...ways.map((way) => way.latestDeparture));
}
