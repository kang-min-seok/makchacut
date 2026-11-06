import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiBudget } from '#jobs/api-budget';
import { CallPacer } from '#jobs/call-pacer';

const INTERVAL_MS = 1_000;

describe('CallPacer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not wait before the first call', async () => {
    const pacer = new CallPacer(INTERVAL_MS);
    const start = Date.now();
    await pacer.wait();
    expect(Date.now() - start).toBe(0);
  });

  it('spaces budget calls by the interval', async () => {
    const budget = new ApiBudget(5, () => true, new CallPacer(INTERVAL_MS));
    const calledAt: number[] = [];
    const request = async () => {
      calledAt.push(Date.now());
      return 'ok';
    };
    const calls = Promise.all([budget.call(request), budget.call(request), budget.call(request)]);
    await vi.runAllTimersAsync();
    await calls;
    const gaps = calledAt.slice(1).map((at, i) => at - (calledAt[i] ?? at));
    expect(gaps.every((gap) => gap >= INTERVAL_MS)).toBe(true);
  });
});
