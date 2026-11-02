import { type DataKeyName, type DataKeys, loadDataKeys } from '#env';

// 키마다 실제 API를 한 번씩 호출해 승인·동작 여부만 확인한다. 키 값은 출력하지 않는다.

const REQUEST_TIMEOUT_MS = 10_000;
const BODY_PREVIEW_LENGTH = 200;

const SEOUL_BUS_BASE = 'http://ws.bus.go.kr/api/rest';
const GBIS_BASE = 'https://apis.data.go.kr/6410000';
const TAGO_SUBWAY_BASE = 'https://apis.data.go.kr/1613000/SubwayInfo';
const SPECIAL_DAY_BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';
const SEOUL_OPEN_DATA_BASE = 'http://openapi.seoul.go.kr:8088';
const KAKAO_LOCAL_BASE = 'https://dapi.kakao.com/v2/local';

type ApiResponse = { status: number; body: string };

type Check = {
  name: string;
  keyName: DataKeyName;
  run: (key: string) => Promise<ApiResponse>;
  isOk: (response: ApiResponse) => boolean;
};

async function get(url: string, headers: Record<string, string> = {}): Promise<ApiResponse> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return { status: res.status, body: await res.text() };
}

function withQuery(base: string, params: Record<string, string>): string {
  return `${base}?${new URLSearchParams(params).toString()}`;
}

function firstMatch(body: string, pattern: RegExp): string | undefined {
  return pattern.exec(body)?.[1];
}

// data.go.kr 게이트웨이 응답: resultCode 0 / "00" 이면 정상 (XML·JSON 모두)
function hasZeroResultCode({ status, body }: ApiResponse): boolean {
  return status === 200 && /resultCode"?\s*[:>]\s*"?0+"?\s*[,<}]/.test(body);
}

// 서울 버스(ws.bus.go.kr): headerCd 0 이면 정상
function hasSeoulBusOk({ status, body }: ApiResponse): boolean {
  return status === 200 && /headerCd"?\s*[:>]\s*"?0"?\s*[,<}]/.test(body);
}

function seoulBus(path: string, key: string, params: Record<string, string>) {
  return get(
    withQuery(`${SEOUL_BUS_BASE}/${path}`, { serviceKey: key, resultType: 'json', ...params }),
  );
}

function gbis(path: string, key: string, params: Record<string, string>) {
  return get(withQuery(`${GBIS_BASE}/${path}`, { serviceKey: key, format: 'json', ...params }));
}

async function seoulBusRouteId(key: string): Promise<string> {
  const { body } = await seoulBus('busRouteInfo/getBusRouteList', key, { strSrch: '470' });
  return firstMatch(body, /busRouteId"?\s*[:>]\s*"?(\d+)/) ?? '';
}

async function gbisRouteId(key: string): Promise<string> {
  const { body } = await gbis('busrouteservice/v2/getBusRouteListv2', key, { keyword: '6003' });
  return firstMatch(body, /routeId"?\s*[:>]\s*"?(\d+)/) ?? '';
}

async function gbisStationId(key: string): Promise<string> {
  const { body } = await gbis('busstationservice/v2/getBusStationListv2', key, {
    keyword: '판교역',
  });
  return firstMatch(body, /stationId"?\s*[:>]\s*"?(\d+)/) ?? '';
}

const CHECKS: Check[] = [
  {
    name: '서울 버스 노선정보 (getBusRouteList)',
    keyName: 'DATA_GO_KR_SERVICE_KEY',
    run: (key) => seoulBus('busRouteInfo/getBusRouteList', key, { strSrch: '470' }),
    isOk: hasSeoulBusOk,
  },
  {
    name: '서울 버스 정류소정보 (getStationByName)',
    keyName: 'DATA_GO_KR_SERVICE_KEY',
    run: (key) => seoulBus('stationinfo/getStationByName', key, { stSrch: '강남역' }),
    isOk: hasSeoulBusOk,
  },
  {
    name: '서울 버스 도착정보 (getArrInfoByRouteAll)',
    keyName: 'DATA_GO_KR_SERVICE_KEY',
    run: async (key) =>
      seoulBus('arrive/getArrInfoByRouteAll', key, { busRouteId: await seoulBusRouteId(key) }),
    isOk: hasSeoulBusOk,
  },
  {
    name: '경기 버스노선 (getBusRouteListv2)',
    keyName: 'DATA_GO_KR_SERVICE_KEY',
    run: (key) => gbis('busrouteservice/v2/getBusRouteListv2', key, { keyword: '6003' }),
    isOk: hasZeroResultCode,
  },
  {
    name: '경기 정류소 (getBusStationListv2)',
    keyName: 'DATA_GO_KR_SERVICE_KEY',
    run: (key) => gbis('busstationservice/v2/getBusStationListv2', key, { keyword: '판교역' }),
    isOk: hasZeroResultCode,
  },
  {
    name: '경기 버스도착 (getBusArrivalListv2)',
    keyName: 'DATA_GO_KR_SERVICE_KEY',
    run: async (key) =>
      gbis('busarrivalservice/v2/getBusArrivalListv2', key, {
        stationId: await gbisStationId(key),
      }),
    isOk: hasZeroResultCode,
  },
  {
    name: '경기 버스위치 (getBusLocationListv2)',
    keyName: 'DATA_GO_KR_SERVICE_KEY',
    run: async (key) =>
      gbis('buslocationservice/v2/getBusLocationListv2', key, { routeId: await gbisRouteId(key) }),
    isOk: hasZeroResultCode,
  },
  {
    name: 'TAGO 지하철역 검색 (GetKwrdFndSubwaySttnList)',
    keyName: 'DATA_GO_KR_SERVICE_KEY',
    run: (key) =>
      get(
        withQuery(`${TAGO_SUBWAY_BASE}/GetKwrdFndSubwaySttnList`, {
          serviceKey: key,
          _type: 'json',
          subwayStationName: '판교',
        }),
      ),
    isOk: hasZeroResultCode,
  },
  {
    name: '특일 정보 (getRestDeInfo)',
    keyName: 'DATA_GO_KR_SERVICE_KEY',
    run: (key) =>
      get(
        withQuery(`${SPECIAL_DAY_BASE}/getRestDeInfo`, {
          serviceKey: key,
          _type: 'json',
          solYear: '2026',
          solMonth: '12',
        }),
      ),
    isOk: hasZeroResultCode,
  },
  {
    name: '서울 열린데이터 지하철역 (SearchSTNBySubwayLineInfo)',
    keyName: 'SEOUL_OPEN_DATA_KEY',
    run: (key) =>
      get(`${SEOUL_OPEN_DATA_BASE}/${encodeURIComponent(key)}/json/SearchSTNBySubwayLineInfo/1/1/`),
    isOk: ({ status, body }) => status === 200 && body.includes('INFO-000'),
  },
  {
    name: '카카오 로컬 키워드 검색',
    keyName: 'KAKAO_REST_API_KEY',
    run: (key) =>
      get(withQuery(`${KAKAO_LOCAL_BASE}/search/keyword.json`, { query: '판교역', size: '1' }), {
        Authorization: `KakaoAK ${key}`,
      }),
    isOk: ({ status }) => status === 200,
  },
];

function maskKeys(text: string, keys: DataKeys): string {
  let masked = text;
  for (const value of Object.values(keys)) {
    if (!value) continue;
    masked = masked.replaceAll(value, '***').replaceAll(encodeURIComponent(value), '***');
  }
  return masked;
}

function preview(body: string, keys: DataKeys): string {
  return maskKeys(body.replace(/\s+/g, ' '), keys).slice(0, BODY_PREVIEW_LENGTH);
}

const keys = loadDataKeys();
let failed = 0;

for (const check of CHECKS) {
  const key = keys[check.keyName];
  if (!key) {
    console.log(`⏭️  ${check.name} — ${check.keyName} 없음`);
    failed += 1;
    continue;
  }
  try {
    const response = await check.run(key);
    if (check.isOk(response)) {
      console.log(`✅ ${check.name} — HTTP ${response.status}`);
    } else {
      console.log(`❌ ${check.name} — HTTP ${response.status}: ${preview(response.body, keys)}`);
      failed += 1;
    }
  } catch (error) {
    console.log(`❌ ${check.name} — ${maskKeys(String(error), keys)}`);
    failed += 1;
  }
}

console.log(`\n${CHECKS.length - failed}/${CHECKS.length} 통과`);
if (failed > 0) process.exitCode = 1;
