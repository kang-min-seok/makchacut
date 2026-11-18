import { buildTransitGraph, indexGraph } from '@makchacut/core';
import { DEFAULT_PLAN_OPTIONS } from '@makchacut/shared';
import { describe, expect, it } from 'vitest';
import type { LoadedGraph } from '#plan/graph-cache';
import { createHomeSearchCache } from '#plan/home-search-cache';

const MEETUP = 1;
const HOME = 2;
const LATE_ROUTE = 10;
const EARLY_ROUTE = 20;

function directTrip(routeId: number, departure: number) {
  return {
    routeId,
    routeName: `${routeId}`,
    mode: 'bus' as const,
    label: '',
    headwayMinutes: null,
    stopTimes: [MEETUP, HOME].map((stopId, i) => ({
      stopId,
      arrival: departure + i * 30,
      departure: departure + i * 30,
      source: 'timetable' as const,
      confidence: 'high' as const,
    })),
  };
}

const { graph } = buildTransitGraph({
  stops: [MEETUP, HOME].map((id) => ({ id, name: `S${id}`, lat: null, lng: null })),
  trips: [directTrip(LATE_ROUTE, 1430), directTrip(EARLY_ROUTE, 1400)],
  footpaths: [],
});
const index = indexGraph(graph);
const LOADED: LoadedGraph = { graph, index, version: 'v1' };
const HOME_ACCESS = [{ stop: index.stopIndexById.get(HOME)!, walkMinutes: 0 }];
const meetupValue = (rounds: { ride: Float64Array }[]) =>
  rounds[1]!.ride[index.stopIndexById.get(MEETUP)!];

describe('createHomeSearchCache', () => {
  it('reuses the home search and the excluded search for the same home', () => {
    const cache = createHomeSearchCache();
    const first = cache(LOADED, HOME_ACCESS, DEFAULT_PLAN_OPTIONS);
    const second = cache(LOADED, HOME_ACCESS, DEFAULT_PLAN_OPTIONS);
    expect(second.homeSearch).toBe(first.homeSearch);
    const excluded = first.searchExcluding(new Set([LATE_ROUTE, EARLY_ROUTE]));
    expect(second.searchExcluding(new Set([EARLY_ROUTE, LATE_ROUTE]))).toBe(excluded);
  });

  it('keys excluded searches by the excluded routes', () => {
    const { homeSearch, searchExcluding } = createHomeSearchCache()(
      LOADED,
      HOME_ACCESS,
      DEFAULT_PLAN_OPTIONS,
    );
    expect(meetupValue(homeSearch.free.rounds)).toBe(1430);
    expect(meetupValue(searchExcluding(new Set([LATE_ROUTE])).rounds)).toBe(1400);
    expect(searchExcluding(new Set([EARLY_ROUTE]))).not.toBe(
      searchExcluding(new Set([LATE_ROUTE])),
    );
  });
});
