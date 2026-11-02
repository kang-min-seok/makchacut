import { distanceMeters, type LatLng } from '#geo/distance';

export type IdPoint = LatLng & { id: number };

export type NearbyPair = {
  fromId: number;
  toId: number;
  meters: number;
};

const METERS_PER_DEGREE_LAT = 111_320;
const DEGREES_TO_RADIANS = Math.PI / 180;

// 반경 안의 모든 점 쌍을 양방향으로 돌려준다. 반경 크기의 격자에 나눠 이웃 칸만 비교한다.
export function nearbyPairs(points: readonly IdPoint[], radiusMeters: number): NearbyPair[] {
  if (points.length === 0) return [];
  const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const cellLat = radiusMeters / METERS_PER_DEGREE_LAT;
  const cellLng = cellLat / Math.cos(meanLat * DEGREES_TO_RADIANS);
  const cellOf = (p: LatLng) => [Math.floor(p.lat / cellLat), Math.floor(p.lng / cellLng)] as const;

  const grid = new Map<string, IdPoint[]>();
  for (const point of points) {
    const [row, col] = cellOf(point);
    const key = `${row}:${col}`;
    const cell = grid.get(key);
    if (cell) cell.push(point);
    else grid.set(key, [point]);
  }

  const pairs: NearbyPair[] = [];
  for (const point of points) {
    const [row, col] = cellOf(point);
    for (let dRow = -1; dRow <= 1; dRow += 1) {
      for (let dCol = -1; dCol <= 1; dCol += 1) {
        for (const other of grid.get(`${row + dRow}:${col + dCol}`) ?? []) {
          if (other.id === point.id) continue;
          const meters = distanceMeters(point, other);
          if (meters <= radiusMeters) pairs.push({ fromId: point.id, toId: other.id, meters });
        }
      }
    }
  }
  return pairs;
}
