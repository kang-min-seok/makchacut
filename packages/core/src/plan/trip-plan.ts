import type { GraphIndex } from '#graph/graph-index';
import type { TransitGraph } from '#graph/transit-graph';
import type { AccessStop } from '#plan/access';
import type { HomeSearch } from '#plan/home-search';
import type { JourneyLeg, RideLeg } from '#raptor/journey';

export type TripPlanOptions = {
  maxRides: number;
  minTransferMinutes: number;
  walkTimeFactor: number;
  safetyMarginMinutes: number;
};

export type TripPlanInput = {
  graph: TransitGraph;
  index: GraphIndex;
  homeAccess: readonly AccessStop[];
  // 집 쪽 탐색 결과 (집·요일·설정 단위로 캐시된다)
  homeSearch: HomeSearch;
  meetupAccess: readonly AccessStop[];
  options: TripPlanOptions;
};

export type PlannedWay = {
  // 약속 장소에서 늦어도 이 시각에 나서야 한다
  latestDeparture: number;
  meetupWalkMinutes: number;
  // 첫 정류장 → 집 쪽 진입점
  legs: JourneyLeg[];
  homeWalkMinutes: number;
};

export type TripPlan = {
  deadline: number;
  anchor: RideLeg | undefined;
  ways: PlannedWay[];
  detour: { deadline: number; extraMinutes: number } | undefined;
  // 우회 한도 안 경로가 없어 돌아가는 경로를 그대로 안내함
  detourFallback: boolean;
};
