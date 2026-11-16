import { findAnchor } from '#plan/steps/anchor';
import { chooseMain } from '#plan/steps/choose-main';
import { deadlineOf } from '#plan/steps/deadline';
import { withinDetour } from '#plan/steps/detour-filter';
import { detourOption } from '#plan/steps/detour-option';
import { laterWay } from '#plan/steps/later-way';
import { findOtherAnchors } from '#plan/steps/other-anchors';
import { routeCandidates } from '#plan/steps/route-candidates';
import { distinctWays, waysToAnchor } from '#plan/steps/ways-to-anchor';
import type { TripPlan, TripPlanInput } from '#plan/trip-plan';

// 약속 장소 질의: 집 쪽 탐색 결과(캐시 가능)로 출발 마감·핵심 연결·연결 방법·돌아가는 막차·더 늦은 경로·다른 막차를 고른다
export function planTrip(input: TripPlanInput): TripPlan | undefined {
  const candidates = routeCandidates(input);
  if (candidates.all.length === 0) return undefined;
  const { layer, detourFallback } = withinDetour(input, candidates);
  const main = chooseMain(layer);
  const anchor = findAnchor(input.graph, input.index, main.journey);
  const ways = anchor ? waysToAnchor(input, main, anchor) : distinctWays(input.graph, layer);
  const deadline = deadlineOf(main, ways);
  return {
    deadline,
    anchor: anchor?.leg,
    ways,
    detour: detourOption(candidates, main, deadline),
    detourFallback,
    later: laterWay(input, layer, main, deadline),
    otherAnchors: findOtherAnchors(input, main, anchor, deadline),
  };
}
