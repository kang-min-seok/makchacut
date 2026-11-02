// 서울 열린데이터광장 지하철(서울교통공사) 역 목록·역별 시간표. 키는 SEOUL_OPEN_DATA_KEY.
// 한 번에 최대 1,000행이다(넘으면 ERROR-336). 역·요일·방향 하나는 200~250행이라 한 번에 받는다.

const SEOUL_OPEN_DATA_BASE = 'http://openapi.seoul.go.kr:8088';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ROWS = 1000;
const OK_CODE = 'INFO-000';
const NO_DATA_CODE = 'INFO-200';

// WEEK_TAG 1 평일 / 2 토 / 3 휴일, INOUT_TAG 1 상행·내선 / 2 하행·외선
export const SEOUL_SUBWAY_WEEK_TAGS = ['1', '2', '3'] as const;
export type SeoulSubwayWeekTag = (typeof SEOUL_SUBWAY_WEEK_TAGS)[number];
export const SEOUL_SUBWAY_INOUT_TAGS = ['1', '2'] as const;
export type SeoulSubwayInoutTag = (typeof SEOUL_SUBWAY_INOUT_TAGS)[number];

export type SeoulSubwayStation = {
  stationCode: string;
  stationName: string;
  // "02호선" 형태
  lineName: string;
  // 외부 역 번호(예: 222)
  externalCode: string;
};

export type SeoulSubwayTimetableRow = {
  lineName: string;
  trainNo: string;
  // "HH:MM:SS", 자정 이후는 24시 넘김 표기. "00:00:00"은 해당 없음(시발역 도착·종착역 출발)
  arrival: string;
  departure: string;
  originCode: string;
  destinationCode: string;
  destinationName: string;
  expressFlag: string;
};

type SeoulOpenDataItem = Record<string, unknown>;
type SeoulOpenDataResult = { CODE?: string; MESSAGE?: string };
type SeoulOpenDataBody = {
  RESULT?: SeoulOpenDataResult;
  row?: SeoulOpenDataItem[];
};

const text = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim();

async function call(service: string, key: string, path: string[]): Promise<SeoulOpenDataItem[]> {
  const segments = [encodeURIComponent(key), 'json', service, '1', String(MAX_ROWS), ...path];
  const res = await fetch(`${SEOUL_OPEN_DATA_BASE}/${segments.join('/')}/`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`서울 열린데이터 ${service} HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, SeoulOpenDataBody | SeoulOpenDataResult>;
  // 정상이면 { [service]: { RESULT, row } }, 오류·데이터 없음이면 최상위 { RESULT }
  const body = json[service] as SeoulOpenDataBody | undefined;
  const result = body?.RESULT ?? (json.RESULT as SeoulOpenDataResult | undefined);
  if (result?.CODE === NO_DATA_CODE) return [];
  if (result?.CODE !== OK_CODE) {
    throw new Error(`서울 열린데이터 ${service}: ${result?.CODE ?? '-'} ${result?.MESSAGE ?? ''}`);
  }
  return body?.row ?? [];
}

export async function fetchSeoulSubwayStations(key: string): Promise<SeoulSubwayStation[]> {
  const rows = await call('SearchSTNBySubwayLineInfo', key, []);
  return rows.map((row) => ({
    stationCode: text(row.STATION_CD),
    stationName: text(row.STATION_NM),
    lineName: text(row.LINE_NUM),
    externalCode: text(row.FR_CODE),
  }));
}

export async function fetchSeoulSubwayTimetable(
  key: string,
  stationCode: string,
  weekTag: SeoulSubwayWeekTag,
  inoutTag: SeoulSubwayInoutTag,
): Promise<SeoulSubwayTimetableRow[]> {
  const rows = await call('SearchSTNTimeTableByIDService', key, [stationCode, weekTag, inoutTag]);
  return rows.map((row) => ({
    lineName: text(row.LINE_NUM),
    trainNo: text(row.TRAIN_NO),
    arrival: text(row.ARRIVETIME),
    departure: text(row.LEFTTIME),
    originCode: text(row.ORIGINSTATION),
    destinationCode: text(row.DESTSTATION),
    destinationName: text(row.SUBWAYENAME),
    expressFlag: text(row.EXPRESS_YN),
  }));
}
