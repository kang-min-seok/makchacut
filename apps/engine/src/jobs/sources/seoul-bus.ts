import { toServiceMinutes } from '@makchacut/core';
import {
  directionsByTurn,
  fetchSeoulRouteStations,
  searchSeoulBusRoutes,
  seoulTimestampMinutes,
} from '@makchacut/data';
import type { IngestContext, SourceIngester } from '#jobs/sources/source-ingester';
import {
  findRouteId,
  replaceRouteStops,
  setRouteEndpoints,
  upsertBusSchedules,
  upsertRoutes,
} from '#jobs/stores/route-store';
import { replaceSeoulStopLast } from '#jobs/stores/seoul-stop-last-store';
import { ensureStops } from '#jobs/stores/stop-store';
import { TargetDataError } from '#jobs/target-data-error';

// 개발계정 1,000건/일에서 수동 확인 스크립트 몫을 남긴다
const DAILY_QUOTA = 950;
// 노선 목록 한 번에 전 노선의 "오늘" 첫차·막차·배차가 오므로 매일 받는다
const LIST_REFRESH_HOURS = 20;
const TARGET_REFRESH_HOURS = 20;
// 전체 노선을 받는 검색어
const ALL_ROUTES_KEYWORD = '';
const NO_ARS_ID = '0';

async function listTargets(ctx: IngestContext) {
  const routes = await ctx.budget.call(() =>
    searchSeoulBusRoutes(ctx.keys.dataGoKr, ALL_ROUTES_KEYWORD),
  );
  const routeIds = await upsertRoutes(
    ctx.db,
    'seoul_bus',
    routes.map((r) => ({
      sourceRouteId: r.busRouteId,
      name: r.busRouteName,
      routeType: r.routeType || null,
    })),
  );
  await upsertBusSchedules(
    ctx.db,
    routes.flatMap((r) => {
      const routeId = routeIds.get(r.busRouteId);
      if (routeId === undefined) return [];
      const headway = r.headwayMinutes > 0 ? r.headwayMinutes : null;
      return [
        {
          routeId,
          dayType: ctx.todayType,
          firstAtOrigin: seoulTimestampMinutes(r.firstBusAt) ?? null,
          lastAtOrigin: seoulTimestampMinutes(r.lastBusAt) ?? null,
          firstAtTurn: null,
          lastAtTurn: null,
          minHeadwayMinutes: headway,
          maxHeadwayMinutes: headway,
        },
      ];
    }),
  );
  return routes.map((r) => ({ targetId: r.busRouteId, dayType: null }));
}

async function ingestTarget(ctx: IngestContext, target: { targetId: string }) {
  const busRouteId = target.targetId;
  const stations = await ctx.budget.call(() =>
    fetchSeoulRouteStations(ctx.keys.dataGoKr, busRouteId),
  );
  const routeId = await findRouteId(ctx.db, 'seoul_bus', busRouteId);
  if (routeId === undefined) throw new TargetDataError(`노선 ${busRouteId}이 목록에 없습니다`);

  const turnStationId = stations[0]?.turnStationId ?? '';
  const turnIndex = stations.findIndex((s) => s.stationId === turnStationId);
  const directions = directionsByTurn(stations.length, turnIndex);

  return ctx.db.transaction(async (tx) => {
    const stopIds = await ensureStops(
      tx,
      'seoul_bus',
      'bus',
      stations.map((s) => ({
        sourceStopId: s.stationId,
        name: s.stationName,
        lat: Number.isFinite(s.lat) ? s.lat : null,
        lng: Number.isFinite(s.lng) ? s.lng : null,
        stopNo: s.arsId && s.arsId !== NO_ARS_ID ? s.arsId : null,
      })),
    );
    const routeStops = stations.flatMap((s, index) => {
      const stopId = stopIds.get(s.stationId);
      const direction = directions[index];
      return stopId === undefined || !direction ? [] : [{ seq: s.seq, stopId, direction }];
    });
    await replaceRouteStops(tx, routeId, routeStops);
    await setRouteEndpoints(
      tx,
      routeId,
      routeStops[0]?.stopId ?? null,
      turnIndex >= 0 ? (stopIds.get(turnStationId) ?? null) : null,
    );
    const lastTimes = stations.flatMap((s) => {
      const lastMinutes = s.lastTime ? toServiceMinutes(s.lastTime) : undefined;
      return lastMinutes === undefined ? [] : [{ seq: s.seq, lastMinutes }];
    });
    await replaceSeoulStopLast(tx, routeId, ctx.todayType, ctx.today, lastTimes);
    return routeStops.length + lastTimes.length;
  });
}

export const seoulBusIngester: SourceIngester = {
  source: 'seoul_bus',
  dailyQuota: DAILY_QUOTA,
  listRefreshHours: LIST_REFRESH_HOURS,
  targetRefreshHours: TARGET_REFRESH_HOURS,
  listTargets,
  ingestTarget,
};
