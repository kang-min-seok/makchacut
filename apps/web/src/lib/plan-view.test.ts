import { describe, expect, it } from 'vitest';
import type { PlanResponse, PlanStep, PlanWay } from '@makchacut/shared';
import {
  countdownTone,
  hasWaysToAnchor,
  stepsToAnchor,
  summarizeWay,
  URGENT_MINUTES,
} from '@/lib/plan-view';

const at = (clock: string, day = '06') => `2026-11-${day}T${clock}:00+09:00`;

const step = (overrides: Partial<PlanStep>): PlanStep => ({
  type: 'walk',
  from: '약속 장소',
  to: '정류장',
  depart: at('23:18'),
  arrive: at('23:20'),
  timeKind: 'estimated',
  path: [],
  isAnchor: false,
  ...overrides,
});

const feederWay: PlanWay = {
  latestDeparture: at('23:18'),
  steps: [
    step({ to: '풍생고' }),
    step({ type: 'bus', routeName: '340', depart: at('23:25'), arrive: at('23:45') }),
    step({ from: '판교역', to: '판교역·낙생육교', depart: at('23:45'), arrive: at('23:46') }),
    step({
      type: 'bus',
      routeName: '6003',
      depart: at('23:55'),
      arrive: at('00:40', '07'),
      timeKind: 'scheduled',
      isAnchor: true,
    }),
    step({ from: '노작마을', to: '집', depart: at('00:40', '07'), arrive: at('00:47', '07') }),
  ],
};

const directWay: PlanWay = {
  latestDeparture: at('23:28'),
  steps: [
    step({ to: '잠실역', depart: at('23:28'), arrive: at('23:32') }),
    step({
      type: 'subway',
      routeName: '08호선',
      depart: at('23:37'),
      arrive: at('23:58'),
      timeKind: 'scheduled',
      isAnchor: true,
    }),
    step({ to: '집', depart: at('23:58'), arrive: at('00:05', '07') }),
  ],
};

const planWith = (ways: PlanWay[]): PlanResponse => ({
  deadline: ways[0]!.latestDeparture,
  dayType: 'weekday',
  anchor: {
    routeName: '6003',
    stopName: '판교역·낙생육교',
    time: at('23:55'),
    timeKind: 'scheduled',
    source: 'gbis_eta',
    confidence: 'high',
  },
  ways,
  detour: null,
  notes: [],
});

describe('hasWaysToAnchor', () => {
  it('shows the ways when the latest way takes a feeder first', () => {
    expect(hasWaysToAnchor(planWith([feederWay]))).toBe(true);
  });

  it('hides them when the latest way walks straight to the last train', () => {
    expect(hasWaysToAnchor(planWith([directWay, feederWay]))).toBe(false);
  });
});

describe('stepsToAnchor', () => {
  it('stops at the anchor ride', () => {
    expect(stepsToAnchor(feederWay).map((s) => s.routeName ?? 'walk')).toEqual([
      'walk',
      '340',
      'walk',
      '6003',
    ]);
  });
});

describe('summarizeWay', () => {
  it('adds up time across midnight, transfers and walking', () => {
    expect(summarizeWay(feederWay)).toEqual({
      totalMinutes: 89,
      transfers: 1,
      walkMinutes: 10,
      arrive: at('00:47', '07'),
    });
  });
});

describe('countdownTone', () => {
  it('turns urgent at the threshold', () => {
    expect(countdownTone(URGENT_MINUTES + 1)).toBe('calm');
    expect(countdownTone(URGENT_MINUTES)).toBe('urgent');
  });
});
