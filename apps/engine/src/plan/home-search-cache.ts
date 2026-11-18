import {
  type AccessStop,
  type HomeSearch,
  type ReverseRaptorResult,
  searchHome,
  searchHomeExcluding,
} from '@makchacut/core';
import type { PlanOptions } from '@makchacut/shared';
import type { LoadedGraph } from '#plan/graph-cache';
import { LruCache } from '#plan/lru-cache';
import { searchOptions } from '#plan/search-options';

// 집 쪽 탐색 캐시: 같은 그래프 버전·집 진입점·설정이면 탐색 결과를 재사용한다.
// 다른 막차 찾기용 제외 탐색도 (집 키, 제외 노선)으로 따로 둔다 — 같은 집이면 약속 장소가 달라도 제외가 겹치는 경우가 많다.

// 한 항목이 라운드 배열 수 MB라 인스턴스 메모리(2GB) 안에서 넉넉히 잡는다
export const HOME_SEARCH_CACHE_SIZE = 32;
// 제외 탐색 결과 하나는 약 11MB(정류장 5만 × 4라운드). 요청 하나가 최대 14번 탐색하므로 요청 두세 개 분량.
export const EXCLUDED_SEARCH_CACHE_SIZE = 32;
// 집 진입점 도보 시간을 이 단위(분)로 묶어 가까운 집끼리 캐시를 나눠 쓴다
const WALK_KEY_PRECISION = 10;

export type HomeSearches = {
  homeSearch: HomeSearch;
  searchExcluding: (excluded: ReadonlySet<number>) => ReverseRaptorResult;
};

export type HomeSearchCache = (
  loaded: LoadedGraph,
  homeAccess: readonly AccessStop[],
  options: PlanOptions,
) => HomeSearches;

function homeKey(parts: readonly (string | number)[], access: readonly AccessStop[]): string {
  const stops = access
    .map((s) => `${s.stop}:${Math.round(s.walkMinutes * WALK_KEY_PRECISION)}`)
    .sort()
    .join(',');
  return `${parts.join('|')}|${stops}`;
}

function excludedKey(key: string, excluded: ReadonlySet<number>): string {
  return `${key}|x${[...excluded].sort((a, b) => a - b).join(',')}`;
}

function cached<V>(cache: LruCache<string, V>, key: string, compute: () => V): V {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  cache.set(key, value);
  return value;
}

export function createHomeSearchCache(): HomeSearchCache {
  const homeSearches = new LruCache<string, HomeSearch>(HOME_SEARCH_CACHE_SIZE);
  const excludedSearches = new LruCache<string, ReverseRaptorResult>(EXCLUDED_SEARCH_CACHE_SIZE);
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
    const raptorOptions = searchOptions(options);
    const homeSearch = cached(homeSearches, key, () =>
      searchHome(loaded.graph, loaded.index, homeAccess, raptorOptions, options.detour),
    );
    const searchExcluding = (excluded: ReadonlySet<number>) =>
      cached(excludedSearches, excludedKey(key, excluded), () =>
        searchHomeExcluding(
          loaded.graph,
          loaded.index,
          homeAccess,
          raptorOptions,
          homeSearch,
          options.detour,
          excluded,
        ),
      );
    return { homeSearch, searchExcluding };
  };
}
