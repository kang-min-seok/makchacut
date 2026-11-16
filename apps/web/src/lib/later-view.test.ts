import { describe, expect, it } from 'vitest';
import type { PlanLater } from '@makchacut/shared';
import { laterHeadline } from '@/lib/later-view';

const later = (extraTransfers: number): PlanLater => ({
  latestDeparture: '2026-11-07T00:50:00+09:00',
  extraTransfers,
  way: { latestDeparture: '2026-11-07T00:50:00+09:00', steps: [] },
});

describe('laterHeadline', () => {
  it('says how many more transfers buy the later departure', () => {
    expect(laterHeadline(later(1))).toBe('환승을 한 번 더 하면 00:50에 나서도 돼요');
    expect(laterHeadline(later(2))).toBe('환승을 두 번 더 하면 00:50에 나서도 돼요');
  });

  it('falls back to digits for large counts', () => {
    expect(laterHeadline(later(5))).toBe('환승을 5번 더 하면 00:50에 나서도 돼요');
  });
});
