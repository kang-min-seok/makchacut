import type { LatLng, TransitGraph } from '@makchacut/core';

// 이름이 같은 정류장·역 중 좌표가 있는 첫 곳 (점검·골든 스크립트에서 약속 장소를 역 이름으로 받는다)
export function stationPoint(graph: TransitGraph, name: string): LatLng | undefined {
  const stop = graph.stopNames.findIndex((n, i) => n === name && !Number.isNaN(graph.stopLats[i]!));
  return stop < 0 ? undefined : { lat: graph.stopLats[stop]!, lng: graph.stopLngs[stop]! };
}
