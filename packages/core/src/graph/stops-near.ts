import { distanceMeters, type LatLng } from '#geo/distance';
import { walkSecondsFor } from '#stops/footpaths';
import { stopCount, type TransitGraph } from '#graph/transit-graph';

export type NearbyStop = {
  stop: number;
  meters: number;
  walkSeconds: number;
};

// 좌표 반경 안의 그래프 정류장 (가까운 순). 집 진입점·약속 장소 출구 후보.
export function stopsNear(graph: TransitGraph, point: LatLng, radiusMeters: number): NearbyStop[] {
  const found: NearbyStop[] = [];
  for (let stop = 0; stop < stopCount(graph); stop += 1) {
    const lat = graph.stopLats[stop]!;
    const lng = graph.stopLngs[stop]!;
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const meters = distanceMeters(point, { lat, lng });
    if (meters <= radiusMeters) found.push({ stop, meters, walkSeconds: walkSecondsFor(meters) });
  }
  return found.sort((a, b) => a.meters - b.meters);
}
