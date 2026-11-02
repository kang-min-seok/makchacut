import { and, eq, isNull, sql } from 'drizzle-orm';
import { type DbExecutor, stop, stopSource } from '@makchacut/db';

export type SubwayStopWithoutCoords = {
  stopId: number;
  stationCode: string;
  name: string;
};

export type StopCoords = {
  stopId: number;
  lat: number;
  lng: number;
};

export async function loadSubwayStopsWithoutCoords(
  db: DbExecutor,
): Promise<SubwayStopWithoutCoords[]> {
  return db
    .select({ stopId: stop.id, stationCode: stopSource.sourceStopId, name: stop.name })
    .from(stop)
    .innerJoin(
      stopSource,
      and(eq(stopSource.stopId, stop.id), eq(stopSource.source, 'seoul_subway')),
    )
    .where(and(eq(stop.mode, 'subway'), isNull(stop.lat)));
}

// 통합 정류장 좌표만 채운다. 원본(stop_source)은 API 값(없음) 그대로 둔다.
export async function updateStopCoords(db: DbExecutor, rows: readonly StopCoords[]): Promise<void> {
  if (rows.length === 0) return;
  const values = sql.join(
    rows.map((row) => sql`(${row.stopId}::int, ${row.lat}::float8, ${row.lng}::float8)`),
    sql`, `,
  );
  await db.execute(sql`
    update ${stop} as s
    set lat = v.lat, lng = v.lng
    from (values ${values}) as v(id, lat, lng)
    where s.id = v.id
  `);
}
