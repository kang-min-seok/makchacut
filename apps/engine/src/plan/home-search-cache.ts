import { type AccessStop, type HomeSearch, searchHome } from '@makchacut/core';
import type { PlanOptions } from '@makchacut/shared';
import type { LoadedGraph } from '#plan/graph-cache';
import { LruCache } from '#plan/lru-cache';
import { searchOptions } from '#plan/search-options';

// 집 쪽 탐색 캐시: 같은 그래프 버전·집 진입점·설정이면 탐색 결과를 재사용한다

// 한 항목이 라운드 배열 수 MB라 인스턴스 메모리(2GB) 안에서 넉넉히 잡는다
export const HOME_SEARCH_CACHE_SIZE = 32;
// 집 진입점 도보 시간을 이 단위(분)로 묶어 가까운 집끼리 캐시를 나눠 쓴다
const WALK_KEY_PRECISION = 10;

export type HomeSearchCache = (
  loaded: LoadedGraph,
  homeAccess: readonly AccessStop[],
  options: PlanOptions,
) => HomeSearch;

function homeKey(parts: readonly (string | number)[], access: readonly AccessStop[]): string {
  const stops = access
    .map((s) => `${s.stop}:${Math.round(s.walkMinutes * WALK_KEY_PRECISION)}`)
    .sort()
    .join(',');
  return `${parts.join('|')}|${stops}`;
}

export function createHomeSearchCache(): HomeSearchCache {
  const homeSearches = new LruCache<string, HomeSearch>(HOME_SEARCH_CACHE_SIZE);
  return (loaded, homeAccess, options) => {
    const key = homeKey(
      [
        loaded.version,
        options.walkSpeed,
        options.maxTransfers,
        options.maxWalkMinutes,
        options.detour,
      ],
      homeAccess,
    );
    const cached = homeSearches.get(key);
    if (cached) return cached;
    const search = searchHome(
      loaded.graph,
      loaded.index,
      homeAccess,
      searchOptions(options),
      options.detour,
    );
    homeSearches.set(key, search);
    return search;
  };
}
