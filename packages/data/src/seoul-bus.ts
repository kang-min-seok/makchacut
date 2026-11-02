// 서울 버스(ws.bus.go.kr, data.go.kr 키). 서울을 지나는 경기 노선도 "<번호><지역>"(예: 4108화성)으로 들어 있다.

const SEOUL_BUS_BASE = 'http://ws.bus.go.kr/api/rest';
const REQUEST_TIMEOUT_MS = 10_000;

export type SeoulBusRoute = {
  busRouteId: string;
  busRouteName: string;
  busRouteAbbr: string;
  startStationName: string;
  endStationName: string;
  corpName: string;
  // 원본 노선 유형 코드 (1 공항, 2 마을, 3 간선, 4 지선, 5 순환, 6 광역, 7 인천, 8 경기, 9 폐지, 0 공용)
  routeType: string;
  // 조회 당일의 기점 첫차·막차 "YYYYMMDDHHMMSS"(없으면 빈 값), 배차 분(0이면 정보 없음)
  firstBusAt: string;
  lastBusAt: string;
  headwayMinutes: number;
};

export type SeoulRouteStation = {
  seq: number;
  stationId: string;
  arsId: string;
  stationName: string;
  direction: string;
  lat: number;
  lng: number;
  // 회차 정류장 ID (노선 전체에 같은 값)
  turnStationId: string;
  // "HH:MM" 또는 빈 값
  beginTime: string;
  lastTime: string;
  isTransfer: boolean;
};

export type SeoulBusItem = Record<string, unknown>;

async function call(path: string, key: string, params: Record<string, string>) {
  const query = new URLSearchParams({ serviceKey: key, resultType: 'json', ...params });
  const res = await fetch(`${SEOUL_BUS_BASE}/${path}?${query.toString()}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`서울 버스 ${path} HTTP ${res.status}`);
  const json = (await res.json()) as {
    msgHeader?: { headerCd?: string; headerMsg?: string };
    msgBody?: { itemList?: SeoulBusItem[] | null };
  };
  if (json.msgHeader?.headerCd !== '0') {
    throw new Error(`서울 버스 ${path}: ${json.msgHeader?.headerMsg ?? '알 수 없는 오류'}`);
  }
  return json.msgBody?.itemList ?? [];
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export async function searchSeoulBusRoutes(key: string, keyword: string): Promise<SeoulBusRoute[]> {
  const items = await call('busRouteInfo/getBusRouteList', key, { strSrch: keyword });
  return items.map((item) => ({
    busRouteId: text(item.busRouteId),
    busRouteName: text(item.busRouteNm),
    busRouteAbbr: text(item.busRouteAbrv),
    startStationName: text(item.stStationNm),
    endStationName: text(item.edStationNm),
    corpName: text(item.corpNm),
    routeType: text(item.routeType),
    firstBusAt: text(item.firstBusTm),
    lastBusAt: text(item.lastBusTm),
    headwayMinutes: Number(item.term) || 0,
  }));
}

export async function fetchSeoulRouteStations(
  key: string,
  busRouteId: string,
): Promise<SeoulRouteStation[]> {
  const items = await call('busRouteInfo/getStaionByRoute', key, { busRouteId });
  return items.map((item) => ({
    seq: Number(item.seq),
    stationId: text(item.station),
    arsId: text(item.arsId),
    stationName: text(item.stationNm),
    direction: text(item.direction),
    lat: Number(item.gpsY),
    lng: Number(item.gpsX),
    turnStationId: text(item.trnstnid),
    beginTime: text(item.beginTm).replace(/^:$/, ''),
    lastTime: text(item.lastTm).replace(/^:$/, ''),
    isTransfer: item.transYn === 'Y',
  }));
}

// 노선 전체 정류장의 도착 예정. 응답 필드(isLast1 등)를 확인하는 단계라 원본 항목을 그대로 돌려준다.
export async function fetchSeoulRouteArrivalsRaw(
  key: string,
  busRouteId: string,
): Promise<SeoulBusItem[]> {
  return call('arrive/getArrInfoByRouteAll', key, { busRouteId });
}
