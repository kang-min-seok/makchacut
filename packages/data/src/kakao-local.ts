// 카카오 로컬 키워드 검색으로 지하철역 좌표를 찾는다. 서울교통공사 역 목록 API에는 좌표가 없다. 키는 KAKAO_REST_API_KEY.

const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
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
  if (!res.ok) throw new Error(`카카오 키워드 검색 HTTP ${res.status}`);
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
