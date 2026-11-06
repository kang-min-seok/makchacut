import { describe, expect, it } from 'vitest';
import { keepLatestFailure, MAX_FAILURE_SAMPLES } from '#jobs/failure-samples';

describe('keepLatestFailure', () => {
  it('keeps only the latest failures', () => {
    let samples: string[] = [];
    for (let i = 1; i <= MAX_FAILURE_SAMPLES + 2; i += 1)
      samples = keepLatestFailure(samples, `f${i}`);
    expect(samples).toEqual(['f3', 'f4', 'f5', 'f6', 'f7']);
  });
});
