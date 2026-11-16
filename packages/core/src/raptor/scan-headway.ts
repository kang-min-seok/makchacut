import { patternStopAt, timeIndex } from '#graph/transit-graph';
import { NONE, type RaptorRound } from '#raptor/round';
import { finishAfterAlight, improves, recordRide, type SearchState } from '#raptor/search-state';

// 배차 기반: 막차 시각표 기준 "내림 한계 − 막차 도착"(음수 = 막차로는 늦음)의 최댓값을 들고 거꾸로 가며
// 탈 정류장의 막차 출발 + 그 값 − 배차간격을 늦어도 있어야 할 시각으로 쓴다
export function scanHeadway(
  state: SearchState,
  round: RaptorRound,
  pattern: number,
  startPosition: number,
  headwayMinutes: number,
  improved: Set<number>,
): void {
  const { graph, alightLimit } = state;
  const trip = graph.patternTripOffsets[pattern + 1]! - 1;
  let margin = -Infinity;
  let alightPosition = NONE;
  let finish = Infinity;
  for (let position = startPosition; position >= 0; position -= 1) {
    const stop = patternStopAt(graph, pattern, position);
    const cell = timeIndex(graph, pattern, trip, position);
    // 막차로 갈 수 있으면(margin ≥ 0) 시각 기반 탑승이 이미 더 늦은 값을 준다
    if (margin > -Infinity && margin < 0) {
      const value = graph.departures[cell]! + margin - headwayMinutes;
      const choice = { pattern, trip, boardPosition: position, alightPosition, byHeadway: true };
      recordRide(state, round, stop, value, finish, choice, improved);
    }
    const limit = alightLimit[stop]!;
    if (limit === -Infinity) continue;
    const candidate = limit - graph.arrivals[cell]!;
    // 최악 대기로 탄 차는 내림 한계에 맞춰 내린다
    const candidateFinish = finishAfterAlight(state, stop, limit);
    if (!improves(candidate, candidateFinish, margin, finish)) continue;
    margin = candidate;
    alightPosition = position;
    finish = candidateFinish;
  }
}
