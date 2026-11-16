import type { LatLng } from '#geo/distance';
import { stopsNear } from '#graph/stops-near';
import type { TransitGraph } from '#graph/transit-graph';
import type { RaptorTarget } from '#raptor/reverse-raptor';
import { SECONDS_PER_MINUTE } from '#time/units';

// 집 진입점·약속 장소 출구: 좌표 반경 안 정류장과 도보 시간

export const WALK_SPEEDS = ['slow', 'normal', 'fast'] as const;
export type WalkSpeed = (typeof WALK_SPEEDS)[number];

// 도보 간선은 4.5km/h 기준이다. 느림 3.6km/h, 빠름 5.4km/h.
export const WALK_TIME_FACTORS: Readonly<Record<WalkSpeed, number>> = {
  slow: 4.5 / 3.6,
  normal: 1,
  fast: 4.5 / 5.4,
};

export const ACCESS_RADIUS_METERS = 1000;

export type AccessOptions = {
  maxWalkMinutes: number;
  walkTimeFactor: number;
  radiusMeters?: number;
};

export type AccessStop = {
  stop: number;
  walkMinutes: number;
};

export function accessStops(
  graph: TransitGraph,
  point: LatLng,
  options: AccessOptions,
): AccessStop[] {
  return stopsNear(graph, point, options.radiusMeters ?? ACCESS_RADIUS_METERS)
    .map((s) => ({
      stop: s.stop,
      walkMinutes: (s.walkSeconds * options.walkTimeFactor) / SECONDS_PER_MINUTE,
    }))
    .filter((s) => s.walkMinutes <= options.maxWalkMinutes);
}

// 집에 이 시각까지 도착하려면 진입점마다 늦어도 언제 내려야 하는가 (기본: 제한 없음)
export function arrivalTargets(
  access: readonly AccessStop[],
  arriveBy: number = Infinity,
): RaptorTarget[] {
  return access.map((s) => ({
    stop: s.stop,
    latestArrival: arriveBy - s.walkMinutes,
    finishMinutes: s.walkMinutes,
  }));
}
