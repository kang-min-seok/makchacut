// 한국천문연구원 특일 정보(data.go.kr 15012690) 공휴일. 대체공휴일·선거일이 포함된다. 연 1회 호출이면 된다.

const SPECIAL_DAY_BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';
const REQUEST_TIMEOUT_MS = 20_000;
// 한 해 공휴일은 30건을 넘지 않는다
const MAX_ROWS = '100';
const HOLIDAY_FLAG = 'Y';
const LOCDATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

export type Holiday = {
  // "YYYY-MM-DD"
  date: string;
  name: string;
};

type SpecialDayItem = Record<string, unknown>;

const text = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim();

function toIsoDate(locdate: string): string | undefined {
  const match = LOCDATE_PATTERN.exec(locdate);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

export async function fetchHolidays(key: string, year: number): Promise<Holiday[]> {
  const query = new URLSearchParams({
    serviceKey: key,
    _type: 'json',
    solYear: String(year),
    numOfRows: MAX_ROWS,
  });
  const res = await fetch(`${SPECIAL_DAY_BASE}/getRestDeInfo?${query.toString()}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`특일 getRestDeInfo HTTP ${res.status}`);
  const json = (await res.json()) as {
    response?: {
      header?: { resultCode?: string; resultMsg?: string };
      body?: { items?: { item?: SpecialDayItem | SpecialDayItem[] } | '' };
    };
  };
  const header = json.response?.header;
  if (header?.resultCode !== '00') {
    throw new Error(`특일 getRestDeInfo: ${header?.resultMsg ?? '알 수 없는 오류'}`);
  }
  const items = json.response?.body?.items;
  const item = items ? items.item : undefined;
  const list = Array.isArray(item) ? item : item ? [item] : [];
  return list.flatMap((entry) => {
    const date = toIsoDate(text(entry.locdate));
    if (!date || text(entry.isHoliday) !== HOLIDAY_FLAG) return [];
    return [{ date, name: text(entry.dateName) }];
  });
}
