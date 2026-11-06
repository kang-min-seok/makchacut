import { httpError } from '#http-error';
// 카카오 로컬 검색: 지하철역 좌표(서울교통공사 역 목록 API에는 좌표가 없다), 주소 좌표. 키는 KAKAO_REST_API_KEY.

const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_ADDRESS_URL = 'https://dapi.kakao.com/v2/local/search/address.json';
const REQUEST_TIMEOUT_MS = 10_000;
// 지하철역 카테고리
const SUBWAY_CATEGORY = 'SW8';
const MAX_RESULTS = '15';
const STATION_SUFFIX = '역';

export type KakaoPlace = {
  placeName: string;
  lat: number;
  lng: number;
};

// 장소·주소 검색 결과 한 건 (사용자 검색창 표시용)
export type KakaoSearchResult = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type KakaoKeywordDocument = {
  id?: string;
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
};

type KakaoAddressDocument = {
  address_name?: string;
  road_address?: { address_name?: string; building_name?: string } | null;
  x?: string;
  y?: string;
};

function toPoint(doc: { x?: string; y?: string }): { lat: number; lng: number } | undefined {
  const lat = Number(doc.y);
  const lng = Number(doc.x);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
}

async function kakaoGet<T>(key: string, url: string, params: URLSearchParams, label: string) {
  const res = await fetch(`${url}?${params.toString()}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw await httpError(label, res, [key]);
  const json = (await res.json()) as { documents?: T[] };
  return json.documents ?? [];
}

// 키워드(장소 이름) 검색. 도로명 주소가 있으면 그걸 주소로 쓴다.
export async function searchKakaoKeywordPlaces(
  key: string,
  query: string,
  size: number,
): Promise<KakaoSearchResult[]> {
  const params = new URLSearchParams({ query, size: String(size) });
  const docs = await kakaoGet<KakaoKeywordDocument>(
    key,
    KAKAO_KEYWORD_URL,
    params,
    '카카오 키워드 검색',
  );
  return docs.flatMap((doc) => {
    const point = toPoint(doc);
    const address = doc.road_address_name || doc.address_name;
    return point && doc.id && doc.place_name && address
      ? [{ id: `place:${doc.id}`, name: doc.place_name, address, ...point }]
      : [];
  });
}

// 주소 검색. 도로명 주소를 이름으로, 건물 이름이 있으면 덧붙인다.
export async function searchKakaoAddresses(
  key: string,
  query: string,
  size: number,
): Promise<KakaoSearchResult[]> {
  const params = new URLSearchParams({ query, size: String(size) });
  const docs = await kakaoGet<KakaoAddressDocument>(
    key,
    KAKAO_ADDRESS_URL,
    params,
    '카카오 주소 검색',
  );
  return docs.flatMap((doc) => {
    const point = toPoint(doc);
    const road = doc.road_address?.address_name;
    const name = road || doc.address_name;
    if (!point || !name || !doc.address_name) return [];
    const building = doc.road_address?.building_name;
    return [
      {
        id: `address:${point.lat},${point.lng}`,
        name: building ? `${name} (${building})` : name,
        address: doc.address_name,
        ...point,
      },
    ];
  });
}

export async function searchKakaoSubwayPlaces(key: string, query: string): Promise<KakaoPlace[]> {
  const params = new URLSearchParams({
    query,
    category_group_code: SUBWAY_CATEGORY,
    size: MAX_RESULTS,
  });
  const res = await fetch(`${KAKAO_KEYWORD_URL}?${params.toString()}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw await httpError('카카오 키워드 검색', res, [key]);
  const json = (await res.json()) as {
    documents?: { place_name?: string; x?: string; y?: string }[];
  };
  return (json.documents ?? []).flatMap((doc) => {
    const lat = Number(doc.y);
    const lng = Number(doc.x);
    return doc.place_name && Number.isFinite(lat) && Number.isFinite(lng)
      ? [{ placeName: doc.place_name, lat, lng }]
      : [];
  });
}

// 주소 → 좌표. 맞는 주소가 없으면 undefined.
export async function searchKakaoAddress(
  key: string,
  address: string,
): Promise<KakaoPlace | undefined> {
  const params = new URLSearchParams({ query: address, size: '1' });
  const res = await fetch(`${KAKAO_ADDRESS_URL}?${params.toString()}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw await httpError('카카오 주소 검색', res, [key]);
  const json = (await res.json()) as {
    documents?: { address_name?: string; x?: string; y?: string }[];
  };
  const doc = json.documents?.[0];
  const lat = Number(doc?.y);
  const lng = Number(doc?.x);
  if (!doc?.address_name || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { placeName: doc.address_name, lat, lng };
}

// "서울역"처럼 이미 역으로 끝나는 이름은 그대로
export function subwayStationQuery(stationName: string): string {
  return stationName.endsWith(STATION_SUFFIX) ? stationName : `${stationName}${STATION_SUFFIX}`;
}

// 서울교통공사 "02호선" → 카카오 "2호선"
function kakaoLineLabel(lineName: string): string {
  return lineName.replace(/^0+/, '');
}

// 카카오 장소명은 "강남역 2호선" 형태다. 호선까지 같은 곳, 없으면 같은 역의 다른 호선을 고른다.
export function pickSubwayPlace(
  places: readonly KakaoPlace[],
  stationName: string,
  lineName: string,
): KakaoPlace | undefined {
  const query = subwayStationQuery(stationName);
  return (
    places.find((place) => place.placeName === `${query} ${kakaoLineLabel(lineName)}`) ??
    places.find((place) => place.placeName.startsWith(`${query} `))
  );
}
