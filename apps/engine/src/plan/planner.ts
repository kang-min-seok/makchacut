import { accessStops, planTrip } from '@makchacut/core';
import type { Db } from '@makchacut/db';
import { type PlanRequest, type PlanResponse, resolvePlanOptions } from '@makchacut/shared';
import { formatPlan } from '#plan/format-plan';
import type { GraphCache } from '#plan/graph-cache';
import { createHomeSearchCache } from '#plan/home-search-cache';
import { requestDayType } from '#plan/request-day-type';
import { searchOptions } from '#plan/search-options';

// /plan 계산: 요일 유형 그래프 → 진입점 → 집 쪽 탐색·제외 탐색(캐시) → 약속 장소 질의 → 응답 형태

export type PlanOutcome =
  { kind: 'planned'; response: PlanResponse } | { kind: 'no_graph' } | { kind: 'no_route' };

export type Planner = (request: PlanRequest) => Promise<PlanOutcome>;

export type PlannerDeps = {
  db: Db;
  graphs: GraphCache;
};

export function createPlanner({ db, graphs }: PlannerDeps): Planner {
  const homeSearchFor = createHomeSearchCache();

  return async (request) => {
    const options = resolvePlanOptions(request.options);
    const dayType = await requestDayType(db, request.date);
    const loaded = await graphs.get(dayType);
    if (!loaded) return { kind: 'no_graph' };

    const tripOptions = searchOptions(options);
    const access = {
      maxWalkMinutes: options.maxWalkMinutes,
      walkTimeFactor: tripOptions.walkTimeFactor,
    };
    const homeAccess = accessStops(loaded.graph, request.home, access);
    const meetupAccess = accessStops(loaded.graph, request.meetup, access);
    if (homeAccess.length === 0 || meetupAccess.length === 0) return { kind: 'no_route' };

    const { homeSearch, searchExcluding } = homeSearchFor(loaded, homeAccess, options);
    const plan = planTrip({
      graph: loaded.graph,
      index: loaded.index,
      homeAccess,
      homeSearch,
      searchExcluding,
      meetupAccess,
      options: tripOptions,
    });
    if (!plan) return { kind: 'no_route' };
    return { kind: 'planned', response: formatPlan(loaded.graph, request, dayType, plan) };
  };
}
