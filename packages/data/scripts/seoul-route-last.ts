import { loadDataKeys } from '#env';
import { fetchSeoulRouteStations, searchSeoulBusRoutes } from '#seoul-bus';
import { toServiceMinutes } from '#service-day';

// 서울 버스 API의 정류장별 막차(lastTm)를 출력한다. 경기 노선이라도 서울을 지나면 전 구간이 나온다.
// 앞 정류장보다 이른 막차(역전)는 "⚠"로 표시한다 — 원본 값에 섞인 이상치 확인용.
// 사용: node scripts/seoul-route-last.ts <노선번호> [busRouteId]

const SKIPPED_STATION_PATTERN = /\((경유|미정차)\)/;

const [routeNumber, routeIdArg] = process.argv.slice(2);
if (!routeNumber) {
  console.error('사용: node scripts/seoul-route-last.ts <노선번호> [busRouteId]');
  process.exit(1);
}

const key = loadDataKeys().DATA_GO_KR_SERVICE_KEY;
if (!key) {
  console.error('DATA_GO_KR_SERVICE_KEY가 없습니다.');
  process.exit(1);
}

const candidates = await searchSeoulBusRoutes(key, routeNumber);
const route = routeIdArg
  ? candidates.find((r) => r.busRouteId === routeIdArg)
  : candidates.find((r) => r.busRouteAbbr === routeNumber);
if (!route) {
  console.error(
    `노선을 찾지 못했습니다. 후보: ${candidates.map((r) => `${r.busRouteName}(${r.busRouteId})`).join(', ')}`,
  );
  process.exit(1);
}

const stations = await fetchSeoulRouteStations(key, route.busRouteId);

console.log(`# ${route.busRouteName} (busRouteId ${route.busRouteId}, ${route.corpName})`);
console.log(`${route.startStationName} → ${route.endStationName}`);
console.log('');
console.log('| 순번 | 정류장 | ARS | 방향 | 첫차 | 막차 | 비고 |');
console.log('|---|---|---|---|---|---|---|');

let previousLast: number | undefined;
for (const station of stations) {
  const last = toServiceMinutes(station.lastTime);
  const reversed = last !== undefined && previousLast !== undefined && last < previousLast;
  if (last !== undefined) previousLast = last;
  if (SKIPPED_STATION_PATTERN.test(station.stationName)) continue;

  const notes = [station.isTransfer ? '회차' : '', reversed ? '⚠ 앞 정류장보다 이름' : '']
    .filter(Boolean)
    .join(', ');
  console.log(
    `| ${station.seq} | ${station.stationName} | ${station.arsId} | ${station.direction} | ${station.beginTime || '-'} | ${station.lastTime || '-'} | ${notes} |`,
  );
}
