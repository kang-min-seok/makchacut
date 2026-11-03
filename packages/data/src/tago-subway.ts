import { httpError } from '#http-error';
// TAGO 지하철정보(data.go.kr 15098554). 신분당·수인분당·경강·GTX-A·공항·경의중앙 등 역별 시간표를 준다. 열차번호는 없다.
// 오퍼레이션 이름은 대문자 Get…이다(소문자는 NO_OPENAPI_SERVICE_ERROR).

const TAGO_SUBWAY_BASE = 'https://apis.data.go.kr/1613000/SubwayInfo';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ROWS = '1000';
// depTime/arrTime 이 "0"이면 해당 없음(종착역 도착만, 시발역 출발만)
const NO_TIME = '0';

// 01 평일, 02 토요일, 03 일요일·공휴일. 신분당·경강 등은 02가 비어 있다.
export const TAGO_DAY_TYPES = ['01', '02', '03'] as const;
export type TagoDayType = (typeof TAGO_DAY_TYPES)[number];
export const TAGO_DIRECTIONS = ['U', 'D'] as const;
export type TagoDirection = (typeof TAGO_DIRECTIONS)[number];

export type TagoSubwayStation = {
  stationId: string;
  stationName: string;
  routeName: string;
};

export type TagoScheduleEntry = {
  routeId: string;
  destinationId: string;
  destinationName: string;
  // "HHMMSS" 또는 빈 값
  departure: string;
  arrival: string;
};

type TagoItem = Record<string, unknown>;

async function call(operation: string, key: string, params: Record<string, string>) {
  const query = new URLSearchParams({
    serviceKey: key,
    _type: 'json',
    numOfRows: MAX_ROWS,
    ...params,
  });
  const res = await fetch(`${TAGO_SUBWAY_BASE}/${operation}?${query.toString()}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw await httpError(`TAGO ${operation}`, res, [key]);
  const json = (await res.json()) as {
    response?: {
      header?: { resultCode?: string; resultMsg?: string };
      body?: { items?: { item?: TagoItem | TagoItem[] } | '' };
    };
  };
  const header = json.response?.header;
  if (header?.resultCode !== '00') {
    throw new Error(`TAGO ${operation}: ${header?.resultMsg ?? '알 수 없는 오류'}`);
  }
  const items = json.response?.body?.items;
  const item = items ? items.item : undefined;
  if (Array.isArray(item)) return item;
  return item ? [item] : [];
}

const text = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim();

const time = (value: unknown): string => {
  const raw = text(value);
  return raw === NO_TIME ? '' : raw.padStart(6, '0');
};

export async function searchTagoSubwayStations(
  key: string,
  stationName: string,
): Promise<TagoSubwayStation[]> {
  const items = await call('GetKwrdFndSubwaySttnList', key, { subwayStationName: stationName });
  return items.map((item) => ({
    stationId: text(item.subwayStationId),
    stationName: text(item.subwayStationName),
    routeName: text(item.subwayRouteName),
  }));
}

export async function fetchTagoStationSchedule(
  key: string,
  stationId: string,
  dayType: TagoDayType,
  direction: TagoDirection,
): Promise<TagoScheduleEntry[]> {
  const items = await call('GetSubwaySttnAcctoSchdulList', key, {
    subwayStationId: stationId,
    dailyTypeCode: dayType,
    upDownTypeCode: direction,
  });
  return items.map((item) => ({
    routeId: text(item.subwayRouteId),
    destinationId: text(item.endSubwayStationId),
    destinationName: text(item.endSubwayStationNm),
    departure: time(item.depTime),
    arrival: time(item.arrTime),
  }));
}
