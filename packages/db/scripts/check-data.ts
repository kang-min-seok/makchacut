import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { distanceMeters, minutesToClock } from '@makchacut/core';

// 데이터 점검: 6003·4108·8501·1551 정류장별 막차, 판교역·모란역 주변 정류장과 도보 간선, 수집 진행률을 출력한다.
// 읽기만 한다. 실행: pnpm --filter @makchacut/db db:check-data

const ENV_FILE = '.env';
const CONNECT_TIMEOUT_SECONDS = 10;
const FOOTPATH_RADIUS_METERS = 400;
const METERS_PER_DEGREE_LAT = 111_320;
const DEGREES_TO_RADIANS = Math.PI / 180;

// 경기 routeId (서울을 지나는 노선은 서울 busRouteId도 같다)
const CHECK_ROUTES = [
  { name: '6003', routeId: '233000266', stopPattern: '%판교%' },
  { name: '4108', routeId: '233000270', stopPattern: '%명동%' },
  { name: '8501', routeId: '233000135', stopPattern: '%강남역우리은행%' },
  { name: '1551', routeId: '234001138', stopPattern: '%강남역우리은행%' },
];

// 역 출구 사이 대략 중심 (카카오 지도 기준)
const CHECK_PLACES = [
  { name: '판교역', lat: 37.3948, lng: 127.1112 },
  { name: '모란역', lat: 37.4321, lng: 127.1292 },
];

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL이 없습니다.');
  process.exit(1);
}
const sql = postgres(databaseUrl, {
  prepare: false,
  connect_timeout: CONNECT_TIMEOUT_SECONDS,
  max: 1,
});

const clock = (minutes: number | null) => (minutes === null ? '-' : minutesToClock(minutes));

async function printRouteStopLast(check: (typeof CHECK_ROUTES)[number]) {
  const rows = await sql<
    {
      source: string;
      seq: number;
      name: string;
      dayType: string;
      lastMinutes: number | null;
      lastSource: string | null;
      confidence: string | null;
    }[]
  >`
    select r.source, rs.seq, ss.name, b.day_type as "dayType", b.last_minutes as "lastMinutes",
           b.source as "lastSource", b.confidence
    from route r
    join route_stop rs on rs.route_id = r.id
    join lateral (
      select name from stop_source where stop_id = rs.stop_id and source = r.source limit 1
    ) ss on true
    left join bus_stop_last b on b.route_id = rs.route_id and b.seq = rs.seq
    where r.source_route_id = ${check.routeId} and ss.name like ${check.stopPattern}
    order by r.source, rs.seq, b.day_type
  `;
  console.log(`\n## ${check.name} (${check.routeId}) — ${check.stopPattern}`);
  if (rows.length === 0) {
    console.log('  정류장 없음 (아직 수집되지 않음)');
    return;
  }
  for (const row of rows) {
    console.log(
      `  [${row.source}] #${row.seq} ${row.name} ${row.dayType ?? '-'} ${clock(row.lastMinutes)} ${row.lastSource ?? '(bus_stop_last 없음)'} ${row.confidence ?? ''}`,
    );
  }
}

// 도보 간선을 무향 그래프로 보고 연결 요소 수를 센다 (1이면 모두 이어져 있다)
function countComponents(
  ids: readonly number[],
  paths: readonly { fromId: number; toId: number }[],
) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id: number): number => {
    const p = parent.get(id) ?? id;
    return p === id ? id : find(p);
  };
  for (const p of paths) parent.set(find(p.fromId), find(p.toId));
  return new Set(ids.map(find)).size;
}

async function printPlace(place: (typeof CHECK_PLACES)[number]) {
  const dLat = FOOTPATH_RADIUS_METERS / METERS_PER_DEGREE_LAT;
  const dLng = dLat / Math.cos(place.lat * DEGREES_TO_RADIANS);
  const candidates = await sql<
    { id: number; mode: string; name: string; stopNo: string | null; lat: number; lng: number }[]
  >`
    select id, mode, name, stop_no as "stopNo", lat, lng from stop
    where lat between ${place.lat - dLat} and ${place.lat + dLat}
      and lng between ${place.lng - dLng} and ${place.lng + dLng}
  `;
  const stops = candidates
    .map((s) => ({ ...s, meters: Math.round(distanceMeters(place, s)) }))
    .filter((s) => s.meters <= FOOTPATH_RADIUS_METERS)
    .sort((a, b) => a.meters - b.meters);
  console.log(`
## ${place.name} 반경 ${FOOTPATH_RADIUS_METERS}m 정류장·역 ${stops.length}곳`);
  const ids = stops.map((s) => s.id);
  const paths =
    ids.length === 0
      ? []
      : await sql<{ fromId: number; toId: number; walkSeconds: number }[]>`
          select from_stop_id as "fromId", to_stop_id as "toId", walk_seconds as "walkSeconds"
          from footpath where from_stop_id in ${sql(ids)} and to_stop_id in ${sql(ids)}
        `;
  const degree = new Map<number, number>();
  for (const p of paths) degree.set(p.fromId, (degree.get(p.fromId) ?? 0) + 1);
  for (const s of stops) {
    console.log(
      `  ${s.mode} ${s.name} ${s.stopNo ?? ''} ${s.meters}m — 이 안의 도보 간선 ${degree.get(s.id) ?? 0}개`,
    );
  }
  console.log(
    `  도보 간선 ${paths.length}개(방향별), 연결 요소 ${countComponents(ids, paths)}개 (1이면 모두 이어짐)`,
  );
}

async function printMoranLastTrains() {
  const rows = await sql<
    { line: string; dayType: string; direction: string; last: number | null }[]
  >`
    select r.name as line, t.day_type as "dayType", t.direction, max(st.departure_minutes) as last
    from stop s
    join train_stop_time st on st.stop_id = s.id
    join train_trip t on t.id = st.trip_id
    join route r on r.id = t.route_id
    where s.mode = 'subway' and s.name = '모란'
    group by 1, 2, 3 order by 1, 2, 3
  `;
  console.log('\n## 모란역 막차 출발 (train_stop_time)');
  if (rows.length === 0) console.log('  시간표 없음');
  for (const row of rows)
    console.log(`  ${row.line} ${row.dayType} ${row.direction} ${clock(row.last)}`);
}

async function printProgress() {
  const rows = await sql<{ source: string; done: number; total: number }[]>`
    select source, count(*) filter (where last_success_at is not null)::int as done, count(*)::int as total
    from ingest_target where removed_at is null group by 1 order by 1
  `;
  console.log('\n## 수집 진행 (성공한 대상 / 전체)');
  for (const row of rows) console.log(`  ${row.source} ${row.done}/${row.total}`);
  const [counts] = await sql<
    { stops: number; merged: number; stopLast: number; footpaths: number; noCoords: number }[]
  >`
    select (select count(*)::int from stop) as stops,
           (select count(*)::int from (select stop_id from stop_source group by 1 having count(*) > 1) m) as merged,
           (select count(*)::int from bus_stop_last) as "stopLast",
           (select count(*)::int from footpath) as footpaths,
           (select count(*)::int from stop where lat is null) as "noCoords"
  `;
  console.log(
    `  정류장 ${counts?.stops} (통합 ${counts?.merged}, 좌표 없음 ${counts?.noCoords}) · bus_stop_last ${counts?.stopLast} · footpath ${counts?.footpaths}`,
  );
}

try {
  for (const check of CHECK_ROUTES) await printRouteStopLast(check);
  for (const place of CHECK_PLACES) await printPlace(place);
  await printMoranLastTrains();
  await printProgress();
} finally {
  await sql.end({ timeout: 1 });
}
