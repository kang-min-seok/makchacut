import type { GbisWebSegment } from '#gbis';

export type RouteStopRef = {
  seq: number;
  sourceStopId: string;
};

export type SegmentMeasure = {
  seconds: number;
  meters: number | null;
};

// GBIS 웹 구간 값을 공식 정류장 순번에 맞춘다. 순번·정류장이 하나라도 어긋나거나 ptts가 숫자가 아니면 undefined.
// 웹 응답의 ptts는 "이 정류장 → 다음 정류장"(마지막 정류장은 항상 0), length는 "직전 → 이 정류장"(첫 정류장은 항상 0)이다.
// 둘 다 "직전 → 이 정류장"으로 맞춰 돌려준다: 정류장 k의 초 = 정류장 k-1의 ptts, 첫 정류장은 0.
export function alignGbisSegments(
  stops: readonly RouteStopRef[],
  segments: readonly GbisWebSegment[],
): Map<number, SegmentMeasure> | undefined {
  if (stops.length === 0 || stops.length !== segments.length) return undefined;
  const bySeq = new Map(segments.map((segment) => [segment.seq, segment]));
  const aligned = new Map<number, SegmentMeasure>();
  let secondsFromPrevious = 0;
  for (const stop of stops) {
    const segment = bySeq.get(stop.seq);
    if (!segment || segment.stationId !== stop.sourceStopId || !Number.isFinite(segment.ptts)) {
      return undefined;
    }
    aligned.set(stop.seq, {
      seconds: secondsFromPrevious,
      meters: Number.isFinite(segment.lengthMeters) ? segment.lengthMeters : null,
    });
    secondsFromPrevious = segment.ptts;
  }
  return aligned;
}
