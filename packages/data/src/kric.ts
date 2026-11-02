// 국가철도공단 철도데이터포털(KRIC, data.kric.go.kr) 열차별 운행시각표. 열차번호(trnNo)와 급행 구분을 준다.
// data.go.kr 15041665는 LINK형이라 키를 철도데이터포털에서 따로 받는다.

const KRIC_BASE = 'https://openapi.kric.go.kr/openapi/trainUseInfo';
const REQUEST_TIMEOUT_MS = 20_000;
const TAGO_STATION_PREFIX = 'MTR';
const OPERATOR_CODE_LENGTH = 2;

// 7 토요일, 8 평일, 9 휴일
export const KRIC_DAY_CODES = ['8', '7', '9'] as const;
export type KricDayCode = (typeof KRIC_DAY_CODES)[number];

export type KricStationCode = {
  railOprIsttCd: string;
  lnCd: string;
  stinCd: string;
};

export type KricTimetableEntry = {
  trainNo: string;
  // "HHMMSS" 또는 빈 값
  departure: string;
  arrival: string;
  expressCode: string;
};

type KricItem = Record<string, unknown>;

// TAGO 역 ID는 "MTR" + 운영기관 + 선코드 + 역코드다(MTRKRK1K225 = KR·K1·K225).
// 선코드 경계는 TAGO 노선 ID(MTRKRK1)로 자른다.
export function toKricStationCode(
  tagoStationId: string,
  tagoRouteId: string,
): KricStationCode | undefined {
  if (!tagoStationId.startsWith(tagoRouteId) || !tagoRouteId.startsWith(TAGO_STATION_PREFIX)) {
    return undefined;
  }
  const route = tagoRouteId.slice(TAGO_STATION_PREFIX.length);
  return {
    railOprIsttCd: route.slice(0, OPERATOR_CODE_LENGTH),
    lnCd: route.slice(OPERATOR_CODE_LENGTH),
    stinCd: tagoStationId.slice(tagoRouteId.length),
  };
}

const text = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim();

const clock = (value: unknown): string => text(value).replaceAll(':', '');

function findItems(json: unknown): KricItem[] {
  if (Array.isArray(json)) return json as KricItem[];
  if (!json || typeof json !== 'object') return [];
  for (const value of Object.values(json)) {
    const items = findItems(value);
    if (items.length > 0) return items;
  }
  return [];
}

// 급행 구분이 있는 subwayTimetableExp를 쓴다(subwayTimetable과 출력이 같고 exptCd만 더 있다).
export async function fetchKricTimetable(
  key: string,
  code: KricStationCode,
  dayCd: KricDayCode,
): Promise<KricTimetableEntry[]> {
  const query = new URLSearchParams({ serviceKey: key, format: 'json', dayCd, ...code });
  const res = await fetch(`${KRIC_BASE}/subwayTimetableExp?${query.toString()}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`KRIC HTTP ${res.status}`);
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`KRIC 응답이 JSON이 아님: ${body.slice(0, 200)}`);
  }
  const items = findItems(json);
  if (items.length === 0) throw new Error(`KRIC 결과 없음: ${body.slice(0, 200)}`);
  return items.map((item) => ({
    trainNo: text(item.trnNo),
    departure: clock(item.dptTm),
    arrival: clock(item.arvTm),
    expressCode: text(item.exptCd),
  }));
}
