import type { TimedStop } from '#graph/timed-stop';

// 정류장(그래프 인덱스) from → to 사이 최소 소요(분)
export type SegmentMinMinutes = (from: number, to: number) => number;

// 어느 시각이 틀렸는지 모르므로 손해가 「조금 일찍 나섬」이 되게 고친다:
// 타는 시각은 뒤에서 앞으로 당기고, 내리는 시각은 앞에서 뒤로 민다. 고친 정차 수를 돌려준다.
export function alignTripTimes(stops: TimedStop[], minMinutes: SegmentMinMinutes): number {
  const gaps = stops.slice(1).map((s, i) => minMinutes(stops[i]!.stop, s.stop));
  const originalDepartures = stops.map((s) => s.departure);
  const adjusted = new Set<number>();
  for (let j = stops.length - 2; j >= 0; j -= 1) {
    const latest = stops[j + 1]!.departure - gaps[j]!;
    if (stops[j]!.departure > latest) {
      stops[j]!.departure = latest;
      adjusted.add(j);
    }
  }
  for (let j = 1; j < stops.length; j += 1) {
    const earliest = Math.max(stops[j - 1]!.arrival, originalDepartures[j - 1]!) + gaps[j - 1]!;
    if (stops[j]!.arrival < earliest) {
      stops[j]!.arrival = earliest;
      adjusted.add(j);
    }
  }
  return adjusted.size;
}
