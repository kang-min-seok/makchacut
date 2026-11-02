import { DAY_TYPES, type DayType } from '@makchacut/core';

// 경기 버스(GBIS) 조회. 공식 API(data.go.kr v2)와, 정류장 구간 소요를 주는 GBIS 웹 엔드포인트(비공식)를 함께 다룬다.

const GBIS_API_BASE = 'https://apis.data.go.kr/6410000';
const GBIS_WEB_ENDPOINT = 'https://www.gbis.go.kr/gbis2014/schBusAPI.action';
const REQUEST_TIMEOUT_MS = 10_000;

// 공식 v2 필드 접두사: 없음=평일, sat, sun, we=공휴일 (data.go.kr 15080662 Swagger 기준)
const DAY_FIELD_PREFIX: Record<DayType, string> = {
  weekday: '',
  sat: 'sat',
  sun: 'sun',
  holiday: 'we',
};

export type GbisRoute = {
  routeId: string;
  routeName: string;
  routeTypeName: string;
  startStationName: string;
  endStationName: string;
};

export type GbisRouteLastTimes = {
  turnStationName: string;
  // 기점 막차(up) / 회차점 막차(down), "HH:MM"
  upLast: Record<DayType, string>;
  downLast: Record<DayType, string>;
};

export type GbisRouteStation = {
  seq: number;
  stationId: string;
  stationName: string;
  isTurn: boolean;
  lng: number;
  lat: number;
};

// 웹 엔드포인트 estimateTime 항목. ptts·length는 직전 정류장 → 이 정류장 구간 값으로 본다.
export type GbisWebSegment = {
  seq: number;
  stationId: string;
  ptts: number;
  lengthMeters: number;
};

export type GbisApiBody = Record<string, unknown>;

async function callApi(path: string, key: string, params: Record<string, string>) {
  const query = new URLSearchParams({ serviceKey: key, format: 'json', ...params });
  const res = await fetch(`${GBIS_API_BASE}/${path}?${query.toString()}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GBIS ${path} HTTP ${res.status}`);
  const json = (await res.json()) as { response?: { msgBody?: GbisApiBody } };
  return json.response?.msgBody ?? {};
}

function asArray(value: unknown): GbisApiBody[] {
  if (Array.isArray(value)) return value as GbisApiBody[];
  return value ? [value as GbisApiBody] : [];
}

const text = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value);

export async function searchGbisRoutes(key: string, keyword: string): Promise<GbisRoute[]> {
  const body = await callApi('busrouteservice/v2/getBusRouteListv2', key, { keyword });
  return asArray(body.busRouteList).map((item) => ({
    routeId: text(item.routeId),
    routeName: text(item.routeName),
    routeTypeName: text(item.routeTypeName),
    startStationName: text(item.startStationName),
    endStationName: text(item.endStationName),
  }));
}

export async function fetchGbisRouteLastTimes(
  key: string,
  routeId: string,
): Promise<GbisRouteLastTimes> {
  const body = await callApi('busrouteservice/v2/getBusRouteInfoItemv2', key, { routeId });
  const item = (body.busRouteInfoItem ?? {}) as GbisApiBody;
  const pick = (direction: 'Up' | 'Down') =>
    Object.fromEntries(
      DAY_TYPES.map((day) => {
        const prefix = DAY_FIELD_PREFIX[day];
        const field = prefix
          ? `${prefix}${direction}LastTime`
          : `${direction.toLowerCase()}LastTime`;
        return [day, text(item[field])];
      }),
    ) as Record<DayType, string>;
  return { turnStationName: text(item.turnStNm), upLast: pick('Up'), downLast: pick('Down') };
}

export async function fetchGbisRouteStations(
  key: string,
  routeId: string,
): Promise<GbisRouteStation[]> {
  const body = await callApi('busrouteservice/v2/getBusRouteStationListv2', key, { routeId });
  return asArray(body.busRouteStationList).map((item) => ({
    seq: Number(item.stationSeq),
    stationId: text(item.stationId),
    stationName: text(item.stationName),
    isTurn: item.turnYn === 'Y',
    lng: Number(item.x),
    lat: Number(item.y),
  }));
}

export async function fetchGbisWebSegments(routeId: string): Promise<GbisWebSegment[]> {
  const res = await fetch(GBIS_WEB_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: new URLSearchParams({ cmd: 'searchRouteJson', routeId }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GBIS web HTTP ${res.status}`);
  const json = (await res.json()) as { result?: { estimateTime?: unknown } };
  return asArray(json.result?.estimateTime).map((item) => ({
    seq: Number(item.staOrder),
    stationId: text(item.stationId),
    ptts: Number(item.ptts),
    lengthMeters: Number(item.length),
  }));
}

// 실시간 응답 필드를 확인하는 단계라 원본 항목을 그대로 돌려준다.
export async function fetchGbisBusLocationsRaw(
  key: string,
  routeId: string,
): Promise<GbisApiBody[]> {
  const body = await callApi('buslocationservice/v2/getBusLocationListv2', key, { routeId });
  return asArray(body.busLocationList);
}

export async function fetchGbisStationArrivalsRaw(
  key: string,
  stationId: string,
): Promise<GbisApiBody[]> {
  const body = await callApi('busarrivalservice/v2/getBusArrivalListv2', key, { stationId });
  return asArray(body.busArrivalList);
}
