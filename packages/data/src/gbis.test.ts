import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGbisWebSegments } from '#gbis';

describe('fetchGbisWebSegments', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps empty ptts and length as NaN instead of 0', async () => {
    const estimateTime = [
      { staOrder: '1', stationId: 'A', ptts: '20', length: '0' },
      { staOrder: '2', stationId: 'B', ptts: null, length: '' },
      { staOrder: '3', stationId: 'C', ptts: '0', length: null },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ result: { estimateTime } }))),
    );

    const segments = await fetchGbisWebSegments('route');

    expect(segments.map((s) => s.ptts)).toEqual([20, NaN, 0]);
    expect(segments.map((s) => s.lengthMeters)).toEqual([0, NaN, NaN]);
  });
});
