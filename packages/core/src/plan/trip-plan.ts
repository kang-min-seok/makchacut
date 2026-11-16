import type { GraphIndex } from '#graph/graph-index';
import type { TransitGraph } from '#graph/transit-graph';
import type { AccessStop } from '#plan/access';
import type { HomeSearch } from '#plan/home-search';
import type { JourneyLeg, RideLeg } from '#raptor/journey';
import type { ReverseRaptorResult } from '#raptor/reverse-raptor';

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
  // 이 노선들을 빼고 다시 한 집 쪽 탐색 (다른 막차 찾기, 엔진이 캐시한다). 없으면 다른 막차를 찾지 않는다.
  searchExcluding?: (excluded: ReadonlySet<number>) => ReverseRaptorResult;
};

export type PlannedWay = {
  // 약속 장소에서 늦어도 이 시각에 나서야 한다
  latestDeparture: number;
  meetupWalkMinutes: number;
  // 첫 정류장 → 집 쪽 진입점
  legs: JourneyLeg[];
  homeWalkMinutes: number;
};

// 환승을 더 하면 대표보다 늦게 나설 수 있는 경로
export type LaterWay = {
  way: PlannedWay;
  // 대표 경로보다 더 타는 횟수
  extraRides: number;
};

// 대표가 아닌 다른 핵심 연결(막차)과 그 막차 기준 가장 늦은 경로
export type OtherAnchor = {
  anchor: RideLeg;
  // 이 막차를 타려면 약속 장소에서 늦어도 이 시각에 나서야 한다
  deadline: number;
  way: PlannedWay;
};

export type TripPlan = {
  deadline: number;
  anchor: RideLeg | undefined;
  ways: PlannedWay[];
  detour: { deadline: number; extraMinutes: number } | undefined;
  // 우회 한도 안 경로가 없어 돌아가는 경로를 그대로 안내함
  detourFallback: boolean;
  later: LaterWay | undefined;
  // 출발 마감 늦은 순
  otherAnchors: OtherAnchor[];
};
