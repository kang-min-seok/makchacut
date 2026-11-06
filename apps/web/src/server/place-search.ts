import 'server-only';
import { searchKakaoAddresses, searchKakaoKeywordPlaces } from '@makchacut/data';
import type { Place } from '@/lib/place';
import { getKakaoRestKey } from '@/server/kakao-config';

const ADDRESS_RESULTS = 3;
const KEYWORD_RESULTS = 10;

// 주소("노작로 150")와 장소 이름("강남역")을 함께 찾아 주소를 앞에 둔다
export async function searchPlaces(query: string): Promise<Place[]> {
  const key = getKakaoRestKey();
  const [addresses, keywords] = await Promise.all([
    searchKakaoAddresses(key, query, ADDRESS_RESULTS),
    searchKakaoKeywordPlaces(key, query, KEYWORD_RESULTS),
  ]);
  const seen = new Set<string>();
  return [...addresses, ...keywords].filter((place) => {
    const key = `${place.name}|${place.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
