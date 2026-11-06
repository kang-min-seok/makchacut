import { eq } from 'drizzle-orm';
import type { DayType, GraphBuildInput } from '@makchacut/core';
import { type DbExecutor, footpath, stop } from '@makchacut/db';
import { loadBusTrips } from '#graph/stores/bus-trip-store';
import { loadSubwayTrips } from '#graph/stores/subway-trip-store';

export const GRAPH_SCOPES = ['all', 'subway'] as const;
export type GraphScope = (typeof GRAPH_SCOPES)[number];

// 그래프 입력: 정류장·도보 간선 전체 + 그 요일 유형의 지하철 열차(+ 버스 막차 운행).
// 운행이 지나지 않는 정류장과 그 도보 간선은 그래프 빌더가 거른다.
export async function loadGraphInput(
  db: DbExecutor,
  dayType: DayType,
  scope: GraphScope = 'all',
): Promise<GraphBuildInput> {
  const stopQuery = db
    .select({ id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng })
    .from(stop);
  const stops = await (scope === 'subway' ? stopQuery.where(eq(stop.mode, 'subway')) : stopQuery);
  const subwayTrips = await loadSubwayTrips(db, dayType);
  const busTrips = scope === 'all' ? await loadBusTrips(db, dayType) : [];
  const footpaths = await db
    .select({
      fromStopId: footpath.fromStopId,
      toStopId: footpath.toStopId,
      walkSeconds: footpath.walkSeconds,
    })
    .from(footpath);
  return { stops, trips: [...subwayTrips, ...busTrips], footpaths };
}
