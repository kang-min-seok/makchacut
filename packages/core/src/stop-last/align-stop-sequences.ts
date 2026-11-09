import { isPassingStop } from '#transit/passing-stop';
import { normalizeStopName } from '#transit/stop-name';

export type SequencedStop = {
  seq: number;
  stopId: number;
  name: string;
};

// 같은 이름 후보가 여럿이면 통합 정류장 id까지 같은 쪽을 고른다
const SAME_STOP_ID_SCORE = 2;
const SAME_NAME_SCORE = 1;
const NO_MATCH = 0;

function matchScore(a: SequencedStop, b: SequencedStop): number {
  if (a.stopId === b.stopId) return SAME_STOP_ID_SCORE;
  return normalizeStopName(a.name) === normalizeStopName(b.name) ? SAME_NAME_SCORE : NO_MATCH;
}

// 통과 지점은 막차 값을 버리고, 통합되지 않으며 이름 접미사((경유)/(미정차))가 노선마다 달라 짝 기준이 못 된다
const boardable = (stops: readonly SequencedStop[]) =>
  stops.filter((stop) => !isPassingStop(stop.name));

// 같은 노선을 다른 출처에서 받은 정류장 목록을 순서대로 맞춘다(통합 정류장 id 또는 이름이 같으면 같은 정류장).
// 순서를 지키는 짝 중 점수 합이 가장 큰 것(가중 최장 공통 부분수열)을 고르고, 동점이면 앞쪽끼리 짝짓는다.
// 회차 노선처럼 같은 정류장이 두 번 나와도 한 번의 잘못된 짝이 그 사이를 통째로 버리지 않는다. 반환: other seq → target seq
export function alignStopSequences(
  target: readonly SequencedStop[],
  other: readonly SequencedStop[],
): Map<number, number> {
  const targets = boardable(target);
  const others = boardable(other);
  const width = targets.length + 1;
  // best[i * width + j]: others[i..], targets[j..]에서 얻을 수 있는 최대 점수
  const best = new Int32Array((others.length + 1) * width);
  const scoreAt = (i: number, j: number) => matchScore(targets[j]!, others[i]!);
  const at = (i: number, j: number) => best[i * width + j]!;

  for (let i = others.length - 1; i >= 0; i--) {
    for (let j = targets.length - 1; j >= 0; j--) {
      const score = scoreAt(i, j);
      const paired = score === NO_MATCH ? 0 : score + at(i + 1, j + 1);
      best[i * width + j] = Math.max(paired, at(i + 1, j), at(i, j + 1));
    }
  }

  const mapping = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < others.length && j < targets.length) {
    const score = scoreAt(i, j);
    if (score !== NO_MATCH && at(i, j) === score + at(i + 1, j + 1)) {
      mapping.set(others[i]!.seq, targets[j]!.seq);
      i += 1;
      j += 1;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return mapping;
}
