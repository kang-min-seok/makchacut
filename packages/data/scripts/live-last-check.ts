import { loadDataKeys } from '#env';
import {
  fetchGbisBusLocationsRaw,
  fetchGbisRouteStations,
  fetchGbisStationArrivalsRaw,
  searchGbisRoutes,
} from '#gbis';
import { fetchSeoulRouteArrivalsRaw, searchSeoulBusRoutes } from '#seoul-bus';

// 막차 시간대(23시 이후)에 실행해 실시간 응답이 막차를 어떻게 표시하는지 확인한다.
//   서울: getArrInfoByRouteAll 의 isLast1/isLast2 가 실제로 1이 되는 정류장
//   경기: 회차점 도착 예정(getBusArrivalListv2)과 운행 차량 위치(getBusLocationListv2) 원본 필드
// 사용: node scripts/live-last-check.ts [서울 노선번호=4108] [경기 노선번호=6003]

const DEFAULT_SEOUL_ROUTE = '4108';
const DEFAULT_GBIS_ROUTE = '6003';
const LAST_FLAG = '1';

function printRaw(label: string, items: Record<string, unknown>[]): void {
  console.log(`\n### ${label} (${items.length}건)`);
  for (const item of items) console.log(JSON.stringify(item));
}

const [seoulRouteNumber = DEFAULT_SEOUL_ROUTE, gbisRouteNumber = DEFAULT_GBIS_ROUTE] =
  process.argv.slice(2);

const key = loadDataKeys().DATA_GO_KR_SERVICE_KEY;
if (!key) {
  console.error('DATA_GO_KR_SERVICE_KEY가 없습니다.');
  process.exit(1);
}

console.log(`조회 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);

const seoulRoute = (await searchSeoulBusRoutes(key, seoulRouteNumber)).find(
  (r) => r.busRouteAbbr === seoulRouteNumber,
);
if (seoulRoute) {
  const arrivals = await fetchSeoulRouteArrivalsRaw(key, seoulRoute.busRouteId);
  const lastFlagged = arrivals.filter(
    (a) => String(a.isLast1) === LAST_FLAG || String(a.isLast2) === LAST_FLAG,
  );
  console.log(`\n## 서울 ${seoulRoute.busRouteName} (busRouteId ${seoulRoute.busRouteId})`);
  console.log(`정류장 ${arrivals.length}개 중 isLast1/isLast2 = 1: ${lastFlagged.length}개`);
  printRaw('isLast 표시된 정류장', lastFlagged);
  printRaw('첫 정류장 원본 (필드 확인용)', arrivals.slice(0, 1));
} else {
  console.log(`\n서울 노선 ${seoulRouteNumber}를 찾지 못했습니다.`);
}

const gbisRoute = (await searchGbisRoutes(key, gbisRouteNumber)).find(
  (r) => r.routeName === gbisRouteNumber,
);
if (gbisRoute) {
  console.log(`\n## 경기 ${gbisRoute.routeName} (routeId ${gbisRoute.routeId})`);
  const stations = await fetchGbisRouteStations(key, gbisRoute.routeId);
  const turn = stations.find((s) => s.isTurn);
  if (turn) {
    const arrivals = await fetchGbisStationArrivalsRaw(key, turn.stationId);
    printRaw(
      `회차점 ${turn.stationName}(${turn.stationId}) 도착 예정 — 이 노선만`,
      arrivals.filter((a) => String(a.routeId) === gbisRoute.routeId),
    );
  }
  printRaw('운행 차량 위치', await fetchGbisBusLocationsRaw(key, gbisRoute.routeId));
} else {
  console.log(`\n경기 노선 ${gbisRouteNumber}를 찾지 못했습니다.`);
}
