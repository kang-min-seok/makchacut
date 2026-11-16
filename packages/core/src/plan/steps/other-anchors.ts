import type { GraphIndex } from '#graph/graph-index';
import { stopCount, type TransitGraph } from '#graph/transit-graph';
import { type AccessStop, arrivalTargets } from '#plan/access';
import { type DetourLevel, detourTravelLimits } from '#plan/detour';
import type { HomeSearch } from '#plan/home-search';
import { type Anchor, findAnchor } from '#plan/steps/anchor';
import { withinDetour } from '#plan/steps/detour-filter';
import { type RouteCandidate, routeCandidates } from '#plan/steps/route-candidates';
import type { OtherAnchor, TripPlanInput } from '#plan/trip-plan';
import {
  type ReverseRaptorOptions,
  type ReverseRaptorResult,
  reverseRaptor,
} from '#raptor/reverse-raptor';

// 대표 핵심 연결 말고 집에 데려다 주는 다른 막차들 (출발 마감 늦은 순)
// 찾은 막차의 노선을 빼고 집 쪽 탐색을 다시 해, 남은 경로 중 가장 늦은 것의 핵심 연결을 다음 막차로 삼는다.

export type OtherAnchorsStep = (
  input: TripPlanInput,
  main: RouteCandidate,
  anchor: Anchor | undefined,
  deadline: number,
) => OtherAnchor[];

export const MAX_OTHER_ANCHORS = 7;
// 대표 출발 마감보다 이만큼(분) 넘게 이른 막차는 목록에 넣지 않는다
export const OTHER_ANCHOR_WINDOW_MINUTES = 120;
// 이름이 같은 노선(서울·경기 중복 등록)만 계속 나와도 다시 탐색하는 횟수는 여기까지
const MAX_EXCLUDED_SEARCHES = MAX_OTHER_ANCHORS * 2;

// 제외 탐색: '집에만 가면 됨'이면 제한 없는 탐색, 아니면 정류장별 우회 한도 탐색 한 번 (대표처럼 둘을 합치지 않는 근사)
export function searchHomeExcluding(
  graph: TransitGraph,
  index: GraphIndex,
  homeAccess: readonly AccessStop[],
  options: ReverseRaptorOptions,
  homeSearch: HomeSearch,
  detour: DetourLevel,
  excludedRoutes: ReadonlySet<number>,
): ReverseRaptorResult {
  const maxTravelMinutes = detourTravelLimits(homeSearch.normal, stopCount(graph), detour);
  return reverseRaptor(graph, index, arrivalTargets(homeAccess), {
    ...options,
    maxTravelMinutes,
    excludedRoutes,
  });
}

type NextAnchor = { anchor: Anchor; candidate: RouteCandidate };

// 제외 탐색 결과에서 우회 한도 안 가장 늦은 경로와 그 핵심 연결
function nextAnchor(input: TripPlanInput, result: ReverseRaptorResult): NextAnchor | undefined {
  const searchInput = {
    ...input,
    homeSearch: { ...input.homeSearch, free: result, limited: undefined },
  };
  const candidates = routeCandidates(searchInput);
  if (candidates.all.length === 0) return undefined;
  const { layer, detourFallback } = withinDetour(searchInput, candidates);
  if (detourFallback) return undefined;
  const candidate = layer[0]!;
  const anchor = findAnchor(input.graph, input.index, candidate.journey);
  return anchor && { anchor, candidate };
}

function toOtherAnchor({ anchor, candidate }: NextAnchor): OtherAnchor {
  return {
    anchor: anchor.leg,
    deadline: candidate.latestDeparture,
    way: {
      latestDeparture: candidate.latestDeparture,
      meetupWalkMinutes: candidate.meetupWalkMinutes,
      legs: candidate.journey.legs,
      homeWalkMinutes: candidate.homeWalkMinutes,
    },
  };
}

export const findOtherAnchors: OtherAnchorsStep = (input, main, anchor, deadline) => {
  const { graph, searchExcluding } = input;
  if (!anchor || !searchExcluding) return [];
  const excluded = new Set([graph.patternRouteIds[anchor.leg.pattern]!]);
  const seenNames = new Set([graph.patternRouteNames[anchor.leg.pattern]!]);
  const others: OtherAnchor[] = [];
  for (
    let searches = 0;
    searches < MAX_EXCLUDED_SEARCHES && others.length < MAX_OTHER_ANCHORS;
    searches += 1
  ) {
    const next = nextAnchor(input, searchExcluding(excluded));
    if (!next) break;
    if (next.candidate.latestDeparture < deadline - OTHER_ANCHOR_WINDOW_MINUTES) break;
    const { pattern } = next.anchor.leg;
    excluded.add(graph.patternRouteIds[pattern]!);
    const name = graph.patternRouteNames[pattern]!;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    others.push(toOtherAnchor(next));
  }
  return others.sort((a, b) => b.deadline - a.deadline);
};
