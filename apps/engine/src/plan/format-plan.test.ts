import { describe, expect, it } from 'vitest';
import { buildTransitGraph, indexGraph, type PlannedWay, type RideLeg } from '@makchacut/core';
import { PlanResponseSchema } from '@makchacut/shared';
import {
  type FormatContext,
  formatPlan,
  formatWay,
  PLAN_NOTES,
  serviceMinutesToIso,
} from '#plan/format-plan';
import { LruCache } from '#plan/lru-cache';

const DATE = '2026-11-06';
const HOME = { lat: 37.199, lng: 127.09 };
const MEETUP = { lat: 37.433, lng: 127.13 };
const REQUEST = { date: DATE, home: HOME, meetup: MEETUP };

const { graph } = buildTransitGraph({
  stops: [
    { id: 1, name: '모란역', lat: 37.432, lng: 127.129 },
    { id: 2, name: '판교역', lat: 37.395, lng: 127.111 },
    { id: 3, name: '판교역동편', lat: null, lng: null },
    { id: 4, name: '동탄', lat: 37.2, lng: 127.095 },
  ],
  trips: [
    {
      routeId: 10,
      routeName: '220',
      mode: 'bus',
      label: '',
      headwayMinutes: 10,
      stopTimes: [
        { stopId: 1, arrival: 1400, departure: 1400, source: 'distance', confidence: 'low' },
        { stopId: 2, arrival: 1420, departure: 1420, source: 'distance', confidence: 'low' },
      ],
    },
    {
      routeId: 20,
      routeName: '6003',
      mode: 'bus',
      label: '',
      headwayMinutes: null,
      stopTimes: [
        { stopId: 3, arrival: 1435, departure: 1435, source: 'gbis_eta', confidence: 'high' },
        { stopId: 4, arrival: 1480.5, departure: 1480.5, source: 'gbis_eta', confidence: 'high' },
      ],
    },
  ],
  footpaths: [{ fromStopId: 2, toStopId: 3, walkSeconds: 120 }],
});
const index = indexGraph(graph);
const at = (id: number) => index.stopIndexById.get(id)!;

const feeder: RideLeg = {
  kind: 'ride',
  pattern: 0,
  trip: 0,
  fromStop: at(1),
  toStop: at(2),
  depart: 1405,
  arrive: 1425,
  headwayMinutes: 10,
  timeSource: 'distance',
  confidence: 'low',
};
const anchor: RideLeg = {
  ...feeder,
  pattern: 1,
  trip: 1,
  fromStop: at(3),
  toStop: at(4),
  depart: 1435,
  arrive: 1480.5,
  headwayMinutes: null,
  timeSource: 'gbis_eta',
  confidence: 'high',
};
const way: PlannedWay = {
  latestDeparture: 1388,
  meetupWalkMinutes: 4,
  legs: [feeder, { kind: 'walk', fromStop: at(2), toStop: at(3), seconds: 120 }, anchor],
  homeWalkMinutes: 6,
};

describe('serviceMinutesToIso', () => {
  it('rolls past midnight into the next date', () => {
    expect(serviceMinutesToIso(DATE, 1480.5, Math.floor)).toBe('2026-11-07T00:40:00+09:00');
    expect(serviceMinutesToIso(DATE, 1480.5)).toBe('2026-11-07T00:41:00+09:00');
    expect(serviceMinutesToIso('2026-12-31', 1445)).toBe('2027-01-01T00:05:00+09:00');
  });
});

describe('formatPlan', () => {
  const context = (anchorLeg: RideLeg | undefined): FormatContext => ({
    graph,
    ...REQUEST,
    anchor: anchorLeg,
  });

  it('lists walk, ride, transfer walk, ride and the walk home', () => {
    const steps = formatWay(context(anchor), way).steps;
    expect(steps.map((s) => [s.type, s.from, s.to])).toEqual([
      ['walk', '약속 장소', '모란역'],
      ['bus', '모란역', '판교역'],
      ['walk', '판교역', '판교역동편'],
      ['bus', '판교역동편', '동탄'],
      ['walk', '동탄', '집'],
    ]);
    expect(steps[1]?.timeKind).toBe('estimated');
    expect(steps[3]).toMatchObject({ routeName: '6003', timeKind: 'scheduled' });
  });

  it('adds map points and skips stops without coordinates', () => {
    const steps = formatWay(context(anchor), way).steps;
    expect(steps[0]?.path).toEqual([
      MEETUP,
      { lat: expect.closeTo(37.432, 4), lng: expect.closeTo(127.129, 4) },
    ]);
    expect(steps[1]?.path).toHaveLength(2);
    expect(steps[3]?.path).toHaveLength(1);
    expect(steps.at(-1)?.path.at(-1)).toEqual(HOME);
  });

  it('marks only the anchor ride', () => {
    expect(formatWay(context(anchor), way).steps.map((s) => s.isAnchor)).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(formatWay(context(undefined), way).steps.some((s) => s.isAnchor)).toBe(false);
  });

  it('builds a response that matches the shared schema', () => {
    const response = formatPlan(graph, REQUEST, 'weekday', {
      deadline: 1388,
      anchor,
      ways: [way],
      detour: { deadline: 1400, extraMinutes: 25 },
      detourFallback: false,
    });
    expect(PlanResponseSchema.safeParse(response).success).toBe(true);
    expect(response.dayType).toBe('weekday');
    expect(response.anchor).toMatchObject({
      routeName: '6003',
      stopName: '판교역동편',
      time: '2026-11-06T23:55:00+09:00',
      source: 'gbis_eta',
    });
    expect(response.notes).toEqual([PLAN_NOTES.estimated]);
  });
});

describe('LruCache', () => {
  it('evicts the least recently used entry', () => {
    const cache = new LruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.size).toBe(2);
  });
});
