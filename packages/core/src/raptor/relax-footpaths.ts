import type { RaptorRound } from '#raptor/round';
import { improves, type SearchState, withinTravel } from '#raptor/search-state';
import { SECONDS_PER_MINUTE } from '#time/units';

// 이번 라운드에 정해진 walk 값의 비교용 도착 (앞 라운드 값이면 -Infinity — 같은 값이면 바꾸지 않는다)
function currentArrival(
  state: SearchState,
  round: RaptorRound,
  roundNumber: number,
  stop: number,
): number {
  if (round.walk[stop] !== state.bestWalk[stop]) return -Infinity;
  return roundNumber === 0 ? state.targetWalkOffset[stop]! : round.walkFinish[stop]!;
}

// 이번 라운드에 ride 값이 생긴 정류장으로 걸어 들어오는 도보 간선으로 walk 값을 채운다
export function relaxFootpaths(
  state: SearchState,
  round: RaptorRound,
  roundNumber: number,
  rideStops: Iterable<number>,
): Set<number> {
  const { graph, index, bestWalk } = state;
  const walked = new Set<number>();
  for (const to of rideStops) {
    const value = round.ride[to]!;
    const end = index.incomingFootpathOffsets[to + 1]!;
    for (let i = index.incomingFootpathOffsets[to]!; i < end; i += 1) {
      const footpath = index.incomingFootpaths[i]!;
      const from = graph.footpathFrom[footpath]!;
      const walkMinutes =
        (graph.footpathSeconds[footpath]! * state.walkTimeFactor) / SECONDS_PER_MINUTE;
      const candidate = value - walkMinutes;
      // 라운드 0은 목적지까지 걸어 가므로 소요가 도보 + 목적지 오프셋으로 정해진다
      const offset = walkMinutes + state.targetRideOffset[to]!;
      const finish = round.rideFinish[to]!;
      // 라운드 0은 값이 Infinity일 수 있어 같은 값끼리는 도착 대신 오프셋으로 비교한다
      const arrival = roundNumber === 0 ? offset : finish;
      if (
        !improves(
          candidate,
          arrival,
          bestWalk[from]!,
          currentArrival(state, round, roundNumber, from),
        )
      ) {
        continue;
      }
      const travel = roundNumber === 0 ? offset : finish - candidate;
      if (!withinTravel(state, from, travel)) continue;
      bestWalk[from] = candidate;
      round.walk[from] = candidate;
      round.walkFootpath[from] = footpath;
      if (roundNumber === 0) state.targetWalkOffset[from] = offset;
      else round.walkFinish[from] = finish;
      walked.add(from);
    }
  }
  return walked;
}
