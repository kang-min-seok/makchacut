import type { LatLng } from '#geo/distance';
import { stopsNear } from '#graph/stops-near';
import type { TransitGraph } from '#graph/transit-graph';
import { bestLabelAt } from '#raptor/journey';
import type { RaptorTarget, ReverseRaptorResult } from '#raptor/reverse-raptor';

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
const SECONDS_PER_MINUTE = 60;

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

// 집에 늦게 도착해도 되므로 진입점은 도착 제한이 없다(도보 시간은 반경·최대 도보로만 거른다)
export function homeTargets(
  graph: TransitGraph,
  home: LatLng,
  options: AccessOptions,
): RaptorTarget[] {
  return accessStops(graph, home, options).map((s) => ({ stop: s.stop, latestArrival: Infinity }));
}

export type MeetupDeparture = {
  stop: number;
  walkMinutes: number;
  // 약속 장소에서 늦어도 이 시각에 나서야 한다 (도보·안전 여유 반영)
  latestDeparture: number;
};

// 약속 장소 주변 정류장마다 L(s) − 도보 − 안전 여유. 늦은 순.
export function meetupDepartures(
  graph: TransitGraph,
  result: ReverseRaptorResult,
  meetup: LatLng,
  options: AccessOptions & { safetyMarginMinutes: number },
): MeetupDeparture[] {
  return accessStops(graph, meetup, options)
    .flatMap((s) => {
      const label = bestLabelAt(result, s.stop);
      if (!label) return [];
      const latestDeparture = label.value - s.walkMinutes - options.safetyMarginMinutes;
      return [{ stop: s.stop, walkMinutes: s.walkMinutes, latestDeparture }];
    })
    .sort((a, b) => b.latestDeparture - a.latestDeparture);
}
