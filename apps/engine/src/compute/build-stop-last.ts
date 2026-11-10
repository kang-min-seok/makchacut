import {
  alignStopSequences,
  type ByDayType,
  computeRouteStopLast,
  type DaySchedule,
  type SeoulObservation,
} from '@makchacut/core';
import type {
  BusRoute,
  LoadedRouteStop,
  RouteStopLastRow,
  StopLastInputs,
} from '#compute/stores/stop-last-store';

export type StopLastBuild = {
  rows: RouteStopLastRow[];
  // 정류장 막차를 계산한 경기 노선 / 그중 ptts 없이 거리 추정을 쓴 노선
  gbisRoutes: number;
  distanceRoutes: number;
  // 경기 노선 쪽에 서울 값을 얹어 계산해 따로 계산하지 않은 서울 쪽 노선
  seoulRoutesMergedIntoGbis: number;
};

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

// 서울 API(busRouteId)와 GBIS(routeId)는 서울을 지나는 경기 노선에서 같은 ID를 쓴다 (M0 4108)
const pairKey = (r: BusRoute) => r.sourceRouteId;

// 수집 결과를 노선별 계산 입력으로 묶어 bus_stop_last 행을 만든다.
// 서울을 지나는 경기 노선은 경기 노선 하나에 서울 값을 우선 적용해 계산하고, 같은 노선의 서울 쪽 행은 만들지 않는다(중복 노선 방지).
export function buildStopLast(inputs: StopLastInputs): StopLastBuild {
  const stopsByRoute = groupBy(inputs.routeStops, (s) => s.routeId);
  const schedulesByRoute = groupBy(inputs.schedules, (s) => s.routeId);
  const observationsByRoute = groupBy(inputs.observations, (o) => o.routeId);
  const routesWithStops = inputs.routes.filter((r) => stopsByRoute.has(r.routeId));
  const gbisByKey = new Map(
    routesWithStops.filter((r) => r.source === 'gbis').map((r) => [pairKey(r), r]),
  );
  const seoulByKey = new Map(
    routesWithStops.filter((r) => r.source === 'seoul_bus').map((r) => [pairKey(r), r]),
  );

  const schedulesOf = (routeId: number): ByDayType<DaySchedule> =>
    Object.fromEntries((schedulesByRoute.get(routeId) ?? []).map((s) => [s.dayType, s]));

  const seoulObservationFor = (
    seoulRoute: BusRoute,
    targetStops: readonly LoadedRouteStop[],
  ): SeoulObservation | undefined => {
    const observations = observationsByRoute.get(seoulRoute.routeId);
    const seoulStops = stopsByRoute.get(seoulRoute.routeId);
    if (!observations || !seoulStops) return undefined;
    const observed: ByDayType<Map<number, number>> = {};
    for (const o of observations) {
      const byDay = observed[o.dayType] ?? new Map<number, number>();
      byDay.set(o.seq, o.lastMinutes);
      observed[o.dayType] = byDay;
    }
    const lastAtOrigin: ByDayType<number | null> = Object.fromEntries(
      (schedulesByRoute.get(seoulRoute.routeId) ?? []).map((s) => [s.dayType, s.lastAtOrigin]),
    );
    return {
      stops: seoulStops,
      observed,
      lastAtOrigin,
      seqMap: alignStopSequences(targetStops, seoulStops),
    };
  };

  const build: StopLastBuild = {
    rows: [],
    gbisRoutes: 0,
    distanceRoutes: 0,
    seoulRoutesMergedIntoGbis: 0,
  };
  for (const r of routesWithStops) {
    const stops = stopsByRoute.get(r.routeId) ?? [];
    const seoulRoute = r.source === 'gbis' ? seoulByKey.get(pairKey(r)) : r;
    if (r.source === 'seoul_bus' && gbisByKey.has(pairKey(r))) {
      build.seoulRoutesMergedIntoGbis += 1;
      continue;
    }
    const rows = computeRouteStopLast({
      routeName: r.name,
      stops,
      schedules: schedulesOf(r.routeId),
      holidayFromSunday: r.source === 'seoul_bus',
      seoul: seoulRoute && seoulObservationFor(seoulRoute, stops),
    });
    if (r.source === 'gbis' && rows.length > 0) {
      build.gbisRoutes += 1;
      if (rows.some((row) => row.source === 'distance')) build.distanceRoutes += 1;
    }
    for (const row of rows) build.rows.push({ routeId: r.routeId, ...row });
  }
  return build;
}
