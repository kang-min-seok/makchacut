import type { LabelKind } from '#raptor/labels';
import { type RaptorRound, type TransferSlack, transferSlackOf } from '#raptor/round';
import { TIME_EPSILON } from '#time/units';

// 탐색(하차 정류장 고르기)과 경로 복원이 같은 이어 가기를 쓰도록 둘 다 이 함수로 고른다

export type ContinuationSource = TransferSlack & {
  rounds: readonly RaptorRound[];
  // 라운드 0 목적지 라벨의 도착 오프셋 (ride: 목적지 자체, walk: 걸어서 목적지로)
  targetRideOffset: Float64Array;
  targetWalkOffset: Float64Array;
};

export type Continuation = { round: number; kind: LabelKind; finish: number };

// 이 시각에 내려 이어 갈 수 있는 가장 적게 타는 라운드에서, 탈 수 있는 쪽 중 목적지에 먼저 닿는 쪽 (같으면 바로 타는 쪽)
export function continuationAt(
  source: ContinuationSource,
  stop: number,
  arrival: number,
  beforeRound: number,
): Continuation | undefined {
  for (let roundNumber = 0; roundNumber < beforeRound; roundNumber += 1) {
    const round = source.rounds[roundNumber]!;
    const rideLimit = round.ride[stop]! - transferSlackOf(roundNumber, source);
    const rideFits = arrival <= rideLimit + TIME_EPSILON;
    const walkFits = arrival <= round.walk[stop]! + TIME_EPSILON;
    if (!rideFits && !walkFits) continue;
    // 라운드 0은 값이 Infinity일 수 있어 내린 시각 + 오프셋으로 도착을 구한다
    const rideFinish =
      roundNumber === 0 ? arrival + source.targetRideOffset[stop]! : round.rideFinish[stop]!;
    const walkFinish =
      roundNumber === 0 ? arrival + source.targetWalkOffset[stop]! : round.walkFinish[stop]!;
    const byWalk = walkFits && (!rideFits || walkFinish < rideFinish - TIME_EPSILON);
    return byWalk
      ? { round: roundNumber, kind: 'walk', finish: walkFinish }
      : { round: roundNumber, kind: 'ride', finish: rideFinish };
  }
  return undefined;
}
