import { DAY_TYPES, toServiceMinutes } from '@makchacut/core';
import {
  directionsByTurn,
  fetchGbisRouteInfo,
  fetchGbisRouteStations,
  type GbisRoute,
  headwayRange,
  searchGbisRoutes,
} from '@makchacut/data';
import type { IngestContext, SourceIngester } from '#jobs/sources/source-ingester';
import {
  findRouteId,
  replaceRouteStops,
  setRouteEndpoints,
  upsertBusSchedules,
  upsertRoutes,
} from '#jobs/stores/route-store';
import { ensureStops } from '#jobs/stores/stop-store';

// 개발계정 1,000건/일에서 수동 확인 스크립트 몫을 남긴다
const DAILY_QUOTA = 950;
const LIST_REFRESH_HOURS = 24 * 7;
const TARGET_REFRESH_HOURS = 20;
// 목록 API는 검색어가 필수라 숫자 0~9로 돌려 합친다
const ROUTE_KEYWORDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const minutesOrNull = (clock: string) => toServiceMinutes(clock) ?? null;

async function listTargets(ctx: IngestContext) {
  const byId = new Map<string, GbisRoute>();
  for (const keyword of ROUTE_KEYWORDS) {
    const routes = await ctx.budget.call(() => searchGbisRoutes(ctx.keys.dataGoKr, keyword));
    for (const r of routes) byId.set(r.routeId, r);
  }
  const routes = [...byId.values()];
  await upsertRoutes(
    ctx.db,
    'gbis',
    routes.map((r) => ({
      sourceRouteId: r.routeId,
      name: r.routeName,
      routeType: r.routeTypeName || null,
    })),
  );
  return routes.map((r) => ({ targetId: r.routeId, dayType: null }));
}

async function ingestTarget(ctx: IngestContext, target: { targetId: string }) {
  const gbisRouteId = target.targetId;
  const stations = await ctx.budget.call(() =>
    fetchGbisRouteStations(ctx.keys.dataGoKr, gbisRouteId),
  );
  const info = await ctx.budget.call(() => fetchGbisRouteInfo(ctx.keys.dataGoKr, gbisRouteId));
  const routeId = await findRouteId(ctx.db, 'gbis', gbisRouteId);
  if (routeId === undefined) throw new Error(`노선 ${gbisRouteId}이 목록에 없습니다`);

  const turnIndex = stations.findIndex((s) => s.isTurn);
  const directions = directionsByTurn(stations.length, turnIndex);

  return ctx.db.transaction(async (tx) => {
    const stopIds = await ensureStops(
      tx,
      'gbis',
      'bus',
      stations.map((s) => ({
        sourceStopId: s.stationId,
        name: s.stationName,
        lat: Number.isFinite(s.lat) ? s.lat : null,
        lng: Number.isFinite(s.lng) ? s.lng : null,
        stopNo: s.stopNo || null,
      })),
    );
    const routeStops = stations.flatMap((s, index) => {
      const stopId = stopIds.get(s.stationId);
      const direction = directions[index];
      return stopId === undefined || !direction ? [] : [{ seq: s.seq, stopId, direction }];
    });
    await replaceRouteStops(tx, routeId, routeStops);
    const turnStation = turnIndex >= 0 ? stations[turnIndex] : undefined;
    await setRouteEndpoints(
      tx,
      routeId,
      routeStops[0]?.stopId ?? null,
      turnStation ? (stopIds.get(turnStation.stationId) ?? null) : null,
    );
    await upsertBusSchedules(
      tx,
      DAY_TYPES.map((dayType) => {
        const headway = headwayRange([info.peakHeadway[dayType], info.offPeakHeadway[dayType]]);
        return {
          routeId,
          dayType,
          firstAtOrigin: minutesOrNull(info.upFirst[dayType]),
          lastAtOrigin: minutesOrNull(info.upLast[dayType]),
          firstAtTurn: minutesOrNull(info.downFirst[dayType]),
          lastAtTurn: minutesOrNull(info.downLast[dayType]),
          minHeadwayMinutes: headway?.min ?? null,
          maxHeadwayMinutes: headway?.max ?? null,
        };
      }),
    );
    return routeStops.length + DAY_TYPES.length;
  });
}

export const gbisIngester: SourceIngester = {
  source: 'gbis',
  dailyQuota: DAILY_QUOTA,
  listRefreshHours: LIST_REFRESH_HOURS,
  targetRefreshHours: TARGET_REFRESH_HOURS,
  listTargets,
  ingestTarget,
};
