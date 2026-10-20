import { describe, expect, it } from 'vitest';
import { PlanRequestSchema } from '#plan';
import { DEFAULT_PLAN_OPTIONS, resolvePlanOptions } from '#plan-options';

const MORAN = { lat: 37.4321, lng: 127.1295 };
const DONGTAN = { lat: 37.2006, lng: 127.0957 };

describe('PlanRequestSchema', () => {
  it('accepts a request without options', () => {
    const result = PlanRequestSchema.safeParse({
      home: DONGTAN,
      meetup: MORAN,
      date: '2026-10-23',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an out-of-range latitude', () => {
    const result = PlanRequestSchema.safeParse({
      home: { lat: 120, lng: 127 },
      meetup: MORAN,
      date: '2026-10-23',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO date', () => {
    const result = PlanRequestSchema.safeParse({ home: DONGTAN, meetup: MORAN, date: '10/23' });
    expect(result.success).toBe(false);
  });
});

describe('resolvePlanOptions', () => {
  it('fills missing values with defaults', () => {
    expect(resolvePlanOptions({ maxTransfers: 1 })).toEqual({
      ...DEFAULT_PLAN_OPTIONS,
      maxTransfers: 1,
    });
  });
});
