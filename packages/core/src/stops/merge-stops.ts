import { hasCoordinates } from '#geo/distance';
import { nearbyPairs } from '#geo/nearby-pairs';
import { isPassingStop } from '#transit/passing-stop';
import { normalizeStopName } from '#transit/stop-name';

export type SourceStopPoint = {
  // 지금 묶여 있는 통합 정류장
  stopId: number;
  name: string;
  lat: number | null;
  lng: number | null;
  // 정류장 번호(서울 arsId, 경기 mobileNo). GBIS는 서울 쪽 정류장 번호를 주지 않는다.
  stopNo: string | null;
};

// 같은 정류장으로 보는 최대 거리
export const MERGE_RADIUS_METERS = 30;

class UnionFind {
  readonly #parent = new Map<number, number>();

  find(id: number): number {
    const parent = this.#parent.get(id) ?? id;
    if (parent === id) return id;
    const root = this.find(parent);
    this.#parent.set(id, root);
    return root;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    // 작은 id를 대표로 둬서 재실행해도 같은 결과가 나오게 한다
    if (rootA < rootB) this.#parent.set(rootB, rootA);
    else if (rootB < rootA) this.#parent.set(rootA, rootB);
  }
}

const normalizeStopNo = (stopNo: string | null) => stopNo?.trim() || undefined;

// 30m 안의 두 원본 정류장이 같은 정류장인가: 번호가 둘 다 있으면 번호로, 한쪽이라도 없으면 이름으로 본다.
// 통과 지점((경유)/(미정차))은 탈 수 없어 묶지 않는다.
function isSameStop(a: SourceStopPoint, b: SourceStopPoint): boolean {
  if (isPassingStop(a.name) || isPassingStop(b.name)) return false;
  const noA = normalizeStopNo(a.stopNo);
  const noB = normalizeStopNo(b.stopNo);
  if (noA && noB) return noA === noB;
  const nameA = normalizeStopName(a.name);
  return nameA !== '' && nameA === normalizeStopName(b.name);
}

// 서울·경기에 따로 있는 같은 정류장을 묶는다.
// 반환은 합쳐져 사라질 통합 정류장 id → 남길 id(묶음에서 가장 작은 id). 이미 묶인 정류장은 그대로 둔다.
export function planStopMerges(
  points: readonly SourceStopPoint[],
  radiusMeters = MERGE_RADIUS_METERS,
): Map<number, number> {
  const unionFind = new UnionFind();
  const located = points.flatMap((point, index) =>
    hasCoordinates(point) ? [{ id: index, lat: point.lat, lng: point.lng }] : [],
  );
  for (const pair of nearbyPairs(located, radiusMeters)) {
    const a = points[pair.fromId];
    const b = points[pair.toId];
    if (!a || !b || pair.fromId > pair.toId || a.stopId === b.stopId) continue;
    if (isSameStop(a, b)) unionFind.union(a.stopId, b.stopId);
  }
  const merges = new Map<number, number>();
  for (const stopId of new Set(points.map((point) => point.stopId))) {
    const root = unionFind.find(stopId);
    if (root !== stopId) merges.set(stopId, root);
  }
  return merges;
}
