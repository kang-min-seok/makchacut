import type { ReverseRaptorResult } from '#raptor/reverse-raptor';

export type LabelKind = 'ride' | 'walk';
export type Label = { round: number; kind: LabelKind; value: number };

// 이 정류장의 라운드(탄 횟수)별 값. 라운드는 앞 라운드보다 나아진 값만 남기므로 탄 횟수와 마감의 파레토 집합이다.
export function labelsAt(result: ReverseRaptorResult, stop: number): Label[] {
  const labels: Label[] = [];
  result.rounds.forEach((round, roundNumber) => {
    const ride = round.ride[stop]!;
    const walk = round.walk[stop]!;
    if (ride === -Infinity && walk === -Infinity) return;
    // 같은 라운드면 ride(그 자리에서 타기)가 구간이 적다
    const kind: LabelKind = ride >= walk ? 'ride' : 'walk';
    labels.push({ round: roundNumber, kind, value: Math.max(ride, walk) });
  });
  return labels;
}

// 이 정류장의 가장 늦은 값. 같으면 덜 타는 쪽.
export function bestLabelAt(result: ReverseRaptorResult, stop: number): Label | undefined {
  let best: Label | undefined;
  for (const label of labelsAt(result, stop)) {
    if (!best || label.value > best.value) best = label;
  }
  return best;
}
