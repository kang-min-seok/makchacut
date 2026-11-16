import { patternStopAt, timeIndex, type TransitGraph } from '#graph/transit-graph';
import { NONE, type RaptorRound } from '#raptor/round';
import { finishAfterAlight, recordRide, type SearchState } from '#raptor/search-state';

// 패턴 안에서 position 정류장 도착이 limit 이하인 가장 늦은 운행 (FIFO라 도착이 운행 순서대로 증가)
function latestTripArrivingBy(
  graph: TransitGraph,
  pattern: number,
  position: number,
  limit: number,
): number {
  let low = graph.patternTripOffsets[pattern]!;
  let high = graph.patternTripOffsets[pattern + 1]! - 1;
  let found = NONE;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (graph.arrivals[timeIndex(graph, pattern, mid, position)]! <= limit) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

// 시각 기반: 내릴 수 있는 가장 늦은 운행을 들고 거꾸로 가며 그 운행의 출발 시각으로 탄다
export function scanTimedTrips(
  state: SearchState,
  round: RaptorRound,
  pattern: number,
  startPosition: number,
  improved: Set<number>,
): void {
  const { graph, alightLimit } = state;
  let trip = NONE;
  let alightPosition = NONE;
  let finish = Infinity;
  for (let position = startPosition; position >= 0; position -= 1) {
    const stop = patternStopAt(graph, pattern, position);
    if (trip !== NONE) {
      const departure = graph.departures[timeIndex(graph, pattern, trip, position)]!;
      const choice = { pattern, trip, boardPosition: position, alightPosition, byHeadway: false };
      recordRide(state, round, stop, departure, finish, choice, improved);
    }
    const limit = alightLimit[stop]!;
    if (limit === -Infinity) continue;
    const candidate = latestTripArrivingBy(graph, pattern, position, limit);
    if (candidate > trip) {
      trip = candidate;
      alightPosition = position;
      const arrival = graph.arrivals[timeIndex(graph, pattern, trip, position)]!;
      finish = finishAfterAlight(state, stop, arrival);
    }
  }
}
