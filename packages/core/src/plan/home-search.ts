import type { GraphIndex } from '#graph/graph-index';
import { stopCount, type TransitGraph } from '#graph/transit-graph';
import { type AccessStop, arrivalTargets } from '#plan/access';
import {
  DETOUR_MULTIPLIERS,
  type DetourLevel,
  detourTravelLimits,
  NORMAL_HOME_ARRIVAL_MINUTES,
} from '#plan/detour';
import {
  type ReverseRaptorOptions,
  type ReverseRaptorResult,
  reverseRaptor,
} from '#raptor/reverse-raptor';

// 집 쪽 탐색: 약속 장소와 무관해 같은 집·요일·설정이면 결과를 재사용(캐시)할 수 있다

export type HomeSearch = {
  // 집 진입점 목표(도착 제한 없음)로 돌린 역방향 탐색
  free: ReverseRaptorResult;
  // 정류장별 우회 한도를 건 결과(짧은 경로 후보 모으기용). 'any'면 undefined.
  limited: ReverseRaptorResult | undefined;
  // 평시(22시 집 도착) 탐색 — 약속 장소별 평시 총 소요를 구한다
  normal: ReverseRaptorResult;
  detourMultiplier: number;
};

export function searchHome(
  graph: TransitGraph,
  index: GraphIndex,
  homeAccess: readonly AccessStop[],
  options: ReverseRaptorOptions,
  detour: DetourLevel,
): HomeSearch {
  const free = reverseRaptor(graph, index, arrivalTargets(homeAccess), options);
  const normal = reverseRaptor(
    graph,
    index,
    arrivalTargets(homeAccess, NORMAL_HOME_ARRIVAL_MINUTES),
    options,
  );
  const limits = detourTravelLimits(normal, stopCount(graph), detour);
  const limited = limits
    ? reverseRaptor(graph, index, arrivalTargets(homeAccess), {
        ...options,
        maxTravelMinutes: limits,
      })
    : undefined;
  return { free, limited, normal, detourMultiplier: DETOUR_MULTIPLIERS[detour] };
}
