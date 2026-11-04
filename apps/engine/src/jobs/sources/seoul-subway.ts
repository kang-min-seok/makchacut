import { and, eq, inArray } from 'drizzle-orm';
import {
  fetchSeoulSubwayStations,
  fetchSeoulSubwayTimetable,
  SEOUL_INOUT_DIRECTION,
  SEOUL_SUBWAY_INOUT_TAGS,
  SEOUL_SUBWAY_WEEK_TAGS,
  SEOUL_WEEK_TAG_DAY_TYPES,
  toSubwayStopTime,
} from '@makchacut/data';
import { stopSource } from '@makchacut/db';
import type { DbExecutor } from '@makchacut/db';
import type { IngestContext, SourceIngester } from '#jobs/sources/source-ingester';
import { findRouteId, upsertRoutes } from '#jobs/stores/route-store';
import { ensureStops } from '#jobs/stores/stop-store';
import { replaceStationTimes, type StationDeparture } from '#jobs/stores/subway-store';
import { TargetDataError } from '#jobs/target-data-error';

// 서울교통공사 시간표가 있는 노선. 신분당·수인분당·GTX-A 등은 목록에만 있고 시간표가 없다(M5에서 TAGO로).
const SEOUL_METRO_LINES = new Set([
  '01호선',
  '02호선',
  '03호선',
  '04호선',
  '05호선',
  '06호선',
  '07호선',
  '08호선',
  '09호선',
]);
const SUBWAY_ROUTE_TYPE = 'subway';
// 서울 열린데이터 일일 한도는 확인 전이라 보수적으로 잡는다
const DAILY_QUOTA = 1000;
const LIST_REFRESH_HOURS = 24 * 7;
const TARGET_REFRESH_HOURS = 20;

async function findSubwayStopIds(
  db: DbExecutor,
  stationCodes: readonly string[],
): Promise<Map<string, number>> {
  if (stationCodes.length === 0) return new Map();
  const rows = await db
    .select({ code: stopSource.sourceStopId, stopId: stopSource.stopId })
    .from(stopSource)
    .where(
      and(eq(stopSource.source, 'seoul_subway'), inArray(stopSource.sourceStopId, stationCodes)),
    );
  return new Map(rows.map((row) => [row.code, row.stopId]));
}

async function listTargets(ctx: IngestContext) {
  const stations = (
    await ctx.budget.call(() => fetchSeoulSubwayStations(ctx.keys.seoulOpenData))
  ).filter((station) => SEOUL_METRO_LINES.has(station.lineName));
  await upsertRoutes(
    ctx.db,
    'seoul_subway',
    [...new Set(stations.map((s) => s.lineName))].map((line) => ({
      sourceRouteId: line,
      name: line,
      routeType: SUBWAY_ROUTE_TYPE,
    })),
  );
  // 역 좌표는 이 API에 없다 → 3단계에서 보완
  await ensureStops(
    ctx.db,
    'seoul_subway',
    'subway',
    stations.map((s) => ({
      sourceStopId: s.stationCode,
      name: s.stationName,
      lat: null,
      lng: null,
      stopNo: null,
    })),
  );
  return stations.map((s) => ({ targetId: s.stationCode, dayType: null }));
}

async function ingestTarget(ctx: IngestContext, target: { targetId: string }) {
  const stationCode = target.targetId;
  const tables = [];
  for (const weekTag of SEOUL_SUBWAY_WEEK_TAGS) {
    for (const inoutTag of SEOUL_SUBWAY_INOUT_TAGS) {
      const rows = await ctx.budget.call(() =>
        fetchSeoulSubwayTimetable(ctx.keys.seoulOpenData, stationCode, weekTag, inoutTag),
      );
      tables.push({ weekTag, inoutTag, rows });
    }
  }
  const allRows = tables.flatMap((table) => table.rows);
  const lineName = allRows[0]?.lineName;
  if (!lineName) return 0;

  const routeId = await findRouteId(ctx.db, 'seoul_subway', lineName);
  const stopIds = await findSubwayStopIds(ctx.db, [
    stationCode,
    ...new Set(allRows.map((row) => row.destinationCode)),
  ]);
  const stopId = stopIds.get(stationCode);
  if (routeId === undefined || stopId === undefined) {
    throw new TargetDataError(`노선(${lineName}) 또는 역(${stationCode})이 목록에 없습니다`);
  }

  const departures: StationDeparture[] = tables.flatMap(({ weekTag, inoutTag, rows }) =>
    rows.flatMap((row) => {
      const time = toSubwayStopTime(row);
      return SEOUL_WEEK_TAG_DAY_TYPES[weekTag].map((dayType) => ({
        dayType,
        direction: SEOUL_INOUT_DIRECTION[inoutTag],
        trainNo: time.trainNo,
        destinationStopId: stopIds.get(time.destinationCode) ?? null,
        destinationName: time.destinationName,
        isExpress: time.isExpress,
        arrivalMinutes: time.arrivalMinutes,
        departureMinutes: time.departureMinutes,
      }));
    }),
  );
  return ctx.db.transaction((tx) => replaceStationTimes(tx, routeId, stopId, departures));
}

export const seoulSubwayIngester: SourceIngester = {
  source: 'seoul_subway',
  dailyQuota: DAILY_QUOTA,
  listRefreshHours: LIST_REFRESH_HOURS,
  targetRefreshHours: TARGET_REFRESH_HOURS,
  listTargets,
  ingestTarget,
};
