import { describe, expect, it, vi } from 'vitest';
import { ApiBudget, QuotaExhaustedError } from '#jobs/api-budget';

describe('ApiBudget', () => {
  it('counts each attempt and retries failures', async () => {
    vi.useFakeTimers();
    const budget = new ApiBudget(5);
    const request = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue('ok');
    const result = budget.call(request);
    await vi.runAllTimersAsync();
    expect(await result).toBe('ok');
    expect(budget.used).toBe(2);
    vi.useRealTimers();
  });

  it('stops without retrying once the limit is reached', async () => {
    const budget = new ApiBudget(1);
    await budget.call(async () => 'first');
    const request = vi.fn();
    await expect(budget.call(request)).rejects.toBeInstanceOf(QuotaExhaustedError);
    expect(request).not.toHaveBeenCalled();
    expect(budget.remaining).toBe(0);
  });
});
