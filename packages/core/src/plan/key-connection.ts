import type { GraphIndex } from '#graph/graph-index';
import { patternStopAt, timeIndex, type TransitGraph } from '#graph/transit-graph';
import type { Journey, RideLeg } from '#raptor/journey';

// 핵심 연결: 경로의 막차(같은 노선의 한 대 늦은 차로는 그 하차 정류장까지 못 가는 시각 기반 구간) 중
// 집에 가장 가까운 것 (판교 6003, 양재 8501처럼 귀가 노선 막차)

const TIME_EPSILON = 1e-6;

export type KeyConnection = {
  legIndex: number;
  leg: RideLeg;
};

// 같은 노선에서 leg보다 늦게 출발해 같은 하차 정류장까지 가는 운행이 있는가
function hasLaterTrip(graph: TransitGraph, index: GraphIndex, leg: RideLeg): boolean {
  const routeId = graph.patternRouteIds[leg.pattern]!;
  const end = index.stopPatternOffsets[leg.fromStop + 1]!;
  for (let i = index.stopPatternOffsets[leg.fromStop]!; i < end; i += 1) {
    const pattern = index.stopPatterns[i]!;
    if (graph.patternRouteIds[pattern] !== routeId) continue;
    const board = index.stopPatternPositions[i]!;
    const length = graph.patternStopOffsets[pattern + 1]! - graph.patternStopOffsets[pattern]!;
    let alight = -1;
    for (let position = board + 1; position < length; position += 1) {
      if (patternStopAt(graph, pattern, position) === leg.toStop) {
        alight = position;
        break;
      }
    }
    if (alight < 0) continue;
    const tripEnd = graph.patternTripOffsets[pattern + 1]!;
    for (let trip = graph.patternTripOffsets[pattern]!; trip < tripEnd; trip += 1) {
      const departure = graph.departures[timeIndex(graph, pattern, trip, board)]!;
      if (departure > leg.depart + TIME_EPSILON) return true;
    }
  }
  return false;
}

export function isLastRun(graph: TransitGraph, index: GraphIndex, leg: RideLeg): boolean {
  return leg.headwayMinutes === null && !hasLaterTrip(graph, index, leg);
}

export function findKeyConnection(
  graph: TransitGraph,
  index: GraphIndex,
  journey: Journey,
): KeyConnection | undefined {
  for (let legIndex = journey.legs.length - 1; legIndex >= 0; legIndex -= 1) {
    const leg = journey.legs[legIndex]!;
    if (leg.kind === 'ride' && isLastRun(graph, index, leg)) return { legIndex, leg };
  }
  return undefined;
}
