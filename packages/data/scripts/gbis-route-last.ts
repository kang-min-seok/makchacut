import { DAY_TYPES, type DayType, minutesToClock, toServiceMinutes } from '@makchacut/core';
import { loadDataKeys } from '#env';
import {
  fetchGbisRouteLastTimes,
  fetchGbisRouteStations,
  fetchGbisWebSegments,
  type GbisRouteStation,
  searchGbisRoutes,
} from '#gbis';

// 경기 노선의 정류장별 막차 추정을 출력한다.
//   회차 전 구간: 기점 막차(up) + 기점부터 누적 소요
//   회차 후 구간: 회차점 막차(down) + 회차점부터 누적 소요
// 누적 소요는 두 방식으로 나란히 낸다: GBIS 웹 ptts(비공식) / 공식 좌표 직선거리 ÷ 25km/h.
// 사용: node scripts/gbis-route-last.ts <노선번호> [노선ID]

const NIGHT_SPEED_KMH = 25;
const EARTH_RADIUS_M = 6_371_000;
const SKIPPED_STATION_PATTERN = /\((경유|미정차)\)/;
const DAY_LABEL: Record<DayType, string> = {
  weekday: '평일',
  sat: '토',
  sun: '일',
  holiday: '공휴일',
};

function distanceMeters(a: GbisRouteStation, b: GbisRouteStation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const [routeName, routeIdArg] = process.argv.slice(2);
if (!routeName) {
  console.error('사용: node scripts/gbis-route-last.ts <노선번호> [노선ID]');
  process.exit(1);
}

const key = loadDataKeys().DATA_GO_KR_SERVICE_KEY;
if (!key) {
  console.error('DATA_GO_KR_SERVICE_KEY가 없습니다.');
  process.exit(1);
}

const candidates = await searchGbisRoutes(key, routeName);
const route = routeIdArg
  ? candidates.find((r) => r.routeId === routeIdArg)
  : candidates.find((r) => r.routeName === routeName);
if (!route) {
  console.error(
    `노선을 찾지 못했습니다. 후보: ${candidates.map((r) => `${r.routeName}(${r.routeId})`).join(', ')}`,
  );
  process.exit(1);
}

const [lastTimes, stations, webSegments] = await Promise.all([
  fetchGbisRouteLastTimes(key, route.routeId),
  fetchGbisRouteStations(key, route.routeId),
  fetchGbisWebSegments(route.routeId).catch((error: unknown) => {
    console.warn(`GBIS 웹 ptts 조회 실패 — 거리 추정만 출력: ${String(error)}`);
    return [];
  }),
]);

const pttsBySeq = new Map(webSegments.map((s) => [s.seq, s.ptts]));
const turnIndex = stations.findIndex((s) => s.isTurn);

console.log(`# ${route.routeName} (${route.routeTypeName}, routeId ${route.routeId})`);
console.log(`${route.startStationName} → 회차 ${lastTimes.turnStationName}`);
for (const day of DAY_TYPES) {
  console.log(
    `- ${DAY_LABEL[day]}: 기점 막차 ${lastTimes.upLast[day]} / 회차점 막차 ${lastTimes.downLast[day]}`,
  );
}
console.log('');
console.log(
  `| 순번 | 정류장 | 구간 | +분(ptts) | +분(거리) | ${DAY_TYPES.map((d) => DAY_LABEL[d]).join(' | ')} |`,
);
console.log(`|---|---|---|---|---|${DAY_TYPES.map(() => '---').join('|')}|`);

let pttsSeconds = 0;
let meters = 0;
stations.forEach((station, index) => {
  const afterTurn = turnIndex >= 0 && index >= turnIndex;
  const segmentStart = afterTurn && index === turnIndex;
  if (index === 0 || segmentStart) {
    pttsSeconds = 0;
    meters = 0;
  } else {
    const previous = stations[index - 1];
    pttsSeconds += pttsBySeq.get(station.seq) ?? 0;
    if (previous) meters += distanceMeters(previous, station);
  }
  if (SKIPPED_STATION_PATTERN.test(station.stationName)) return;

  const pttsMinutes = pttsSeconds / 60;
  const distanceMinutes = (meters / 1000 / NIGHT_SPEED_KMH) * 60;
  const base = afterTurn ? lastTimes.downLast : lastTimes.upLast;
  const offset = webSegments.length > 0 ? pttsMinutes : distanceMinutes;
  const clocks = DAY_TYPES.map((day) => {
    const start = toServiceMinutes(base[day]);
    return start === undefined ? '-' : minutesToClock(start + offset);
  });
  const label = station.isTurn ? `**${station.stationName}** (회차)` : station.stationName;
  console.log(
    `| ${station.seq} | ${label} | ${afterTurn ? '회차 후' : '회차 전'} | ${webSegments.length > 0 ? pttsMinutes.toFixed(0) : '-'} | ${distanceMinutes.toFixed(0)} | ${clocks.join(' | ')} |`,
  );
});
