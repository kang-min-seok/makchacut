import {
  patternCount,
  patternLength,
  patternStopAt,
  stopCount,
  type TransitGraph,
} from '#graph/transit-graph';

// 그래프에서 다시 만들 수 있는 조회용 색인 (스냅샷에 넣지 않는다)
export type GraphIndex = {
  stopIndexById: ReadonlyMap<number, number>;
  // 정류장 → (패턴, 그 패턴 안 위치). 한 패턴에 같은 정류장이 두 번 나오면 두 번 들어간다.
  stopPatternOffsets: Int32Array;
  stopPatterns: Int32Array;
  stopPatternPositions: Int32Array;
  // 정류장으로 들어오는 도보 간선 (footpath 배열 인덱스)
  incomingFootpathOffsets: Int32Array;
  incomingFootpaths: Int32Array;
};

function countingOffsets(size: number, keys: ArrayLike<number>): Int32Array {
  const offsets = new Int32Array(size + 1);
  for (let i = 0; i < keys.length; i += 1) offsets[keys[i]! + 1]! += 1;
  for (let i = 0; i < size; i += 1) offsets[i + 1]! += offsets[i]!;
  return offsets;
}

function indexStopPatterns(graph: TransitGraph) {
  const stops = stopCount(graph);
  const stopPatternOffsets = countingOffsets(stops, graph.patternStops);
  const total = graph.patternStops.length;
  const stopPatterns = new Int32Array(total);
  const stopPatternPositions = new Int32Array(total);
  const cursor = stopPatternOffsets.slice(0, stops);
  for (let p = 0; p < patternCount(graph); p += 1) {
    for (let pos = 0; pos < patternLength(graph, p); pos += 1) {
      const stop = patternStopAt(graph, p, pos);
      const at = cursor[stop]!;
      stopPatterns[at] = p;
      stopPatternPositions[at] = pos;
      cursor[stop] = at + 1;
    }
  }
  return { stopPatternOffsets, stopPatterns, stopPatternPositions };
}

function indexIncomingFootpaths(graph: TransitGraph) {
  const stops = stopCount(graph);
  const incomingFootpathOffsets = countingOffsets(stops, graph.footpathTo);
  const incomingFootpaths = new Int32Array(graph.footpathTo.length);
  const cursor = incomingFootpathOffsets.slice(0, stops);
  for (let f = 0; f < graph.footpathTo.length; f += 1) {
    const to = graph.footpathTo[f]!;
    incomingFootpaths[cursor[to]!] = f;
    cursor[to]! += 1;
  }
  return { incomingFootpathOffsets, incomingFootpaths };
}

export function indexGraph(graph: TransitGraph): GraphIndex {
  return {
    stopIndexById: new Map(Array.from(graph.stopIds, (id, i) => [id, i])),
    ...indexStopPatterns(graph),
    ...indexIncomingFootpaths(graph),
  };
}
