import {
  accessStops,
  type AccessStop,
  dayTypeOf,
  DEFAULT_MIN_TRANSFER_MINUTES,
  type HomeSearch,
  planTrip,
  searchHome,
  WALK_TIME_FACTORS,
} from '@makchacut/core';
import type { Db } from '@makchacut/db';
import { type PlanRequest, type PlanResponse, resolvePlanOptions } from '@makchacut/shared';
import { isHoliday } from '#jobs/stores/holiday-store';
import { formatPlan } from '#plan/format-plan';
import type { GraphCache, LoadedGraph } from '#plan/graph-cache';
import { LruCache } from '#plan/lru-cache';

// /plan 계산: 요일 유형 그래프 → 집 쪽 탐색(캐시) → 약속 장소 질의 → 응답 형태

// 한 항목이 라운드 배열 수 MB라 인스턴스 메모리(2GB) 안에서 넉넉히 잡는다
export const HOME_SEARCH_CACHE_SIZE = 32;
// 집 진입점 도보 시간을 이 단위(분)로 묶어 가까운 집끼리 캐시를 나눠 쓴다
const WALK_KEY_PRECISION = 10;

export type PlanOutcome =
  { kind: 'planned'; response: PlanResponse } | { kind: 'no_graph' } | { kind: 'no_route' };

export type Planner = (request: PlanRequest) => Promise<PlanOutcome>;

export type PlannerDeps = {
  db: Db;
  graphs: GraphCache;
};

function homeKey(parts: readonly (string | number)[], access: readonly AccessStop[]): string {
  const stops = access
    .map((s) => `${s.stop}:${Math.round(s.walkMinutes * WALK_KEY_PRECISION)}`)
    .sort()
    .join(',');
  return `${parts.join('|')}|${stops}`;
}

export function createPlanner({ db, graphs }: PlannerDeps): Planner {
  const homeSearches = new LruCache<string, HomeSearch>(HOME_SEARCH_CACHE_SIZE);

  function homeSearchFor(
    loaded: LoadedGraph,
    homeAccess: readonly AccessStop[],
    options: ReturnType<typeof resolvePlanOptions>,
  ): HomeSearch {
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
      {
        maxRides: options.maxTransfers + 1,
        minTransferMinutes: DEFAULT_MIN_TRANSFER_MINUTES,
        walkTimeFactor: WALK_TIME_FACTORS[options.walkSpeed],
      },
      options.detour,
    );
    homeSearches.set(key, search);
    return search;
  }

  return async (request) => {
    const options = resolvePlanOptions(request.options);
    const holidays = (await isHoliday(db, request.date))
      ? new Set([request.date])
      : new Set<string>();
    const loaded = await graphs.get(dayTypeOf(request.date, holidays));
    if (!loaded) return { kind: 'no_graph' };

    const walkTimeFactor = WALK_TIME_FACTORS[options.walkSpeed];
    const access = { maxWalkMinutes: options.maxWalkMinutes, walkTimeFactor };
    const homeAccess = accessStops(loaded.graph, request.home, access);
    const meetupAccess = accessStops(loaded.graph, request.meetup, access);
    if (homeAccess.length === 0 || meetupAccess.length === 0) return { kind: 'no_route' };

    const plan = planTrip({
      graph: loaded.graph,
      index: loaded.index,
      homeAccess,
      ...homeSearchFor(loaded, homeAccess, options),
      meetupAccess,
      options: {
        maxRides: options.maxTransfers + 1,
        minTransferMinutes: DEFAULT_MIN_TRANSFER_MINUTES,
        walkTimeFactor,
        safetyMarginMinutes: options.safetyMarginMinutes,
      },
    });
    if (!plan) return { kind: 'no_route' };
    return { kind: 'planned', response: formatPlan(loaded.graph, request.date, plan) };
  };
}
