import { findAnchor } from '#plan/steps/anchor';
import { withinDetour } from '#plan/steps/detour-filter';
import { detourOption } from '#plan/steps/detour-option';
import { routeCandidates } from '#plan/steps/route-candidates';
import { distinctWays, waysToAnchor } from '#plan/steps/ways-to-anchor';
import type { TripPlan, TripPlanInput } from '#plan/trip-plan';

// 약속 장소 질의: 집 쪽 탐색 결과(캐시 가능)로 출발 마감·핵심 연결·연결 방법·돌아가는 막차를 고른다
export function planTrip(input: TripPlanInput): TripPlan | undefined {
  const candidates = routeCandidates(input);
  if (candidates.all.length === 0) return undefined;
  const { layer, detourFallback } = withinDetour(input, candidates);
  const main = layer[0]!;
  const anchor = findAnchor(input.graph, input.index, main.journey);
  const ways = anchor ? waysToAnchor(input, main, anchor) : distinctWays(input.graph, layer);
  // 핵심 연결로 가는 방법은 main보다 늦게 나설 수 있다 — 마감은 그중 가장 늦은 출발
  const deadline = Math.max(main.latestDeparture, ...ways.map((way) => way.latestDeparture));
  return {
    deadline,
    anchor: anchor?.leg,
    ways,
    detour: detourOption(candidates, main, deadline),
    detourFallback,
  };
}
