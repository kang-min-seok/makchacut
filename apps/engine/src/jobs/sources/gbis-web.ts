import { alignGbisSegments, fetchGbisWebSegments } from '@makchacut/data';
import type { IngestContext, SourceIngester } from '#jobs/sources/source-ingester';
import { findRouteId, listRoutesWithStops } from '#jobs/stores/route-store';
import { loadRouteStopRefs, updateSegments } from '#jobs/stores/segment-store';

// 비공식 엔드포인트라 공식 한도는 없다. 노선당 하루 1회 이하, 하루 전체도 이만큼으로 묶는다(ADR 1항).
const DAILY_QUOTA = 1000;
const LIST_REFRESH_HOURS = 20;
const TARGET_REFRESH_HOURS = 24;

// gbis 수집으로 정류장 목록까지 받은 노선이 대상이다 — 외부 호출 없음.
// 아직 정류장이 없는 노선을 넣으면 매 실행 수천 건을 실패로 훑게 된다.
async function listTargets(ctx: IngestContext) {
  const routeIds = await listRoutesWithStops(ctx.db, 'gbis');
  return routeIds.map((targetId) => ({ targetId, dayType: null }));
}

async function ingestTarget(ctx: IngestContext, target: { targetId: string }) {
  const gbisRouteId = target.targetId;
  const routeId = await findRouteId(ctx.db, 'gbis', gbisRouteId);
  const stops = routeId === undefined ? [] : await loadRouteStopRefs(ctx.db, routeId, 'gbis');
  if (routeId === undefined || stops.length === 0) {
    throw new Error('경기 노선 정류장 목록이 아직 없습니다');
  }
  const segments = await ctx.budget.call(() => fetchGbisWebSegments(gbisRouteId));
  const aligned = alignGbisSegments(stops, segments);
  if (!aligned) {
    // 거리 추정으로 대체된다(ADR 2항). 실패로 남겨 대체 비율을 볼 수 있게 한다.
    throw new Error(
      `GBIS 웹 구간이 공식 정류장 순번과 맞지 않습니다 (공식 ${stops.length}, 웹 ${segments.length})`,
    );
  }
  await updateSegments(ctx.db, routeId, aligned);
  return aligned.size;
}

export const gbisWebIngester: SourceIngester = {
  source: 'gbis_web',
  dailyQuota: DAILY_QUOTA,
  listRefreshHours: LIST_REFRESH_HOURS,
  targetRefreshHours: TARGET_REFRESH_HOURS,
  listTargets,
  ingestTarget,
};
