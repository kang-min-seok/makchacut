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
};

export type SeoulRouteStation = {
  seq: number;
  stationId: string;
  arsId: string;
  stationName: string;
  direction: string;
  // "HH:MM" 또는 빈 값
  beginTime: string;
  lastTime: string;
  isTransfer: boolean;
};

type SeoulBusItem = Record<string, unknown>;

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
    beginTime: text(item.beginTm).replace(/^:$/, ''),
    lastTime: text(item.lastTm).replace(/^:$/, ''),
    isTransfer: item.transYn === 'Y',
  }));
}
