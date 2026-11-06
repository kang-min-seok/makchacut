// 탐색용 메모리 그래프. 정류장·패턴·운행을 정수 인덱스와 타입 배열로 둔다(스냅샷으로 그대로 직렬화한다).
// 시각은 서비스 일자 기준 분(DB real과 같은 정밀도라 Float32Array).
//
// 패턴: 정차 정류장 순서가 같은 운행 묶음. 패턴 안의 운행은 모든 정류장에서 앞지르지 않는 순서(FIFO)로 정렬돼 있다.
// 운행 i의 j번째 정류장 시각은 times[patternTimeOffsets[p] + (i - patternTripOffsets[p]) * 정류장 수 + j].

export const TRANSIT_MODES = ['bus', 'subway'] as const;
export type TransitMode = (typeof TRANSIT_MODES)[number];

export type TransitGraph = {
  // 정류장 (인덱스 = 그래프 안 번호)
  stopIds: Int32Array;
  stopNames: string[];
  stopLats: Float32Array;
  stopLngs: Float32Array;

  // 패턴
  patternRouteIds: Int32Array;
  patternRouteNames: string[];
  // TRANSIT_MODES 인덱스
  patternModes: Uint8Array;
  // 길이 패턴 수 + 1
  patternStopOffsets: Int32Array;
  patternStops: Int32Array;
  // 길이 패턴 수 + 1 (운행 인덱스 범위)
  patternTripOffsets: Int32Array;
  // 길이 패턴 수 (시각 배열 시작 위치)
  patternTimeOffsets: Int32Array;

  // 운행
  tripLabels: string[];
  arrivals: Float32Array;
  departures: Float32Array;

  // 도보 간선 (방향 있음, 초)
  footpathFrom: Int32Array;
  footpathTo: Int32Array;
  footpathSeconds: Int32Array;
};

export function stopCount(graph: TransitGraph): number {
  return graph.stopIds.length;
}

export function patternCount(graph: TransitGraph): number {
  return graph.patternRouteIds.length;
}

export function patternLength(graph: TransitGraph, pattern: number): number {
  return graph.patternStopOffsets[pattern + 1]! - graph.patternStopOffsets[pattern]!;
}

export function patternStopAt(graph: TransitGraph, pattern: number, position: number): number {
  return graph.patternStops[graph.patternStopOffsets[pattern]! + position]!;
}

export function timeIndex(
  graph: TransitGraph,
  pattern: number,
  trip: number,
  position: number,
): number {
  const tripInPattern = trip - graph.patternTripOffsets[pattern]!;
  return (
    graph.patternTimeOffsets[pattern]! + tripInPattern * patternLength(graph, pattern) + position
  );
}

export function modeOf(graph: TransitGraph, pattern: number): TransitMode {
  return TRANSIT_MODES[graph.patternModes[pattern]!] ?? 'bus';
}
