import { normalizeStopName } from '#transit/stop-name';

export type SequencedStop = {
  seq: number;
  stopId: number;
  name: string;
};

const isSame = (a: SequencedStop, b: SequencedStop) =>
  a.stopId === b.stopId || normalizeStopName(a.name) === normalizeStopName(b.name);

// 같은 노선을 다른 출처에서 받은 정류장 목록을 순서대로 맞춘다(통합 정류장 id 또는 이름이 같으면 같은 정류장).
// 회차 노선처럼 같은 정류장이 두 번 나와도 앞에서부터 차례로 짝짓는다. 반환: other seq → target seq
export function alignStopSequences(
  target: readonly SequencedStop[],
  other: readonly SequencedStop[],
): Map<number, number> {
  const mapping = new Map<number, number>();
  let from = 0;
  for (const stop of other) {
    const found = target.findIndex((t, index) => index >= from && isSame(t, stop));
    const matched = target[found];
    if (!matched) continue;
    mapping.set(stop.seq, matched.seq);
    from = found + 1;
  }
  return mapping;
}
