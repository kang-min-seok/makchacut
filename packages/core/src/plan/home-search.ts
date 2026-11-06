import type { GraphIndex } from '#graph/graph-index';
import { stopCount, type TransitGraph } from '#graph/transit-graph';
import { type AccessStop, arrivalTargets } from '#plan/access';
import { type DetourLevel, detourTravelLimits, NORMAL_HOME_ARRIVAL_MINUTES } from '#plan/detour';
import {
  type ReverseRaptorOptions,
  type ReverseRaptorResult,
  reverseRaptor,
} from '#raptor/reverse-raptor';

// 집 쪽 탐색: 약속 장소와 무관해 같은 집·요일·설정이면 결과를 재사용(캐시)할 수 있다

export type HomeSearch = {
  homeResult: ReverseRaptorResult;
  // 우회 한도를 건 결과. 'any'면 undefined.
  limitedResult: ReverseRaptorResult | undefined;
};

export function searchHome(
  graph: TransitGraph,
  index: GraphIndex,
  homeAccess: readonly AccessStop[],
  options: ReverseRaptorOptions,
  detour: DetourLevel,
): HomeSearch {
  const homeResult = reverseRaptor(graph, index, arrivalTargets(homeAccess), options);
  const normalResult = reverseRaptor(
    graph,
    index,
    arrivalTargets(homeAccess, NORMAL_HOME_ARRIVAL_MINUTES),
    options,
  );
  const limits = detourTravelLimits(normalResult, stopCount(graph), detour);
  const limitedResult = limits
    ? reverseRaptor(graph, index, arrivalTargets(homeAccess), {
        ...options,
        maxTravelMinutes: limits,
      })
    : undefined;
  return { homeResult, limitedResult };
}
