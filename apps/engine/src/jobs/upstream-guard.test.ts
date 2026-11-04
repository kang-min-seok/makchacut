import { describe, expect, it } from 'vitest';
import {
  isUpstreamStopMessage,
  UPSTREAM_FAILURE_LIMIT,
  UpstreamGuard,
  upstreamStopMessage,
} from '#jobs/upstream-guard';

function failTimes(guard: UpstreamGuard, times: number) {
  for (let i = 0; i < times; i += 1) guard.recordFailure();
}

describe('UpstreamGuard', () => {
  it('trips after the limit of consecutive failures', () => {
    const guard = new UpstreamGuard({ probing: false });
    failTimes(guard, UPSTREAM_FAILURE_LIMIT - 1);
    expect(guard.tripped).toBe(false);
    guard.recordFailure();
    expect(guard.tripped).toBe(true);
  });

  it('resets the streak on a success in between', () => {
    const guard = new UpstreamGuard({ probing: false, limit: 3 });
    failTimes(guard, 2);
    guard.recordSuccess();
    failTimes(guard, 2);
    expect(guard.streak).toBe(2);
    expect(guard.tripped).toBe(false);
    guard.recordFailure();
    expect(guard.tripped).toBe(true);
  });

  it('stops at the first failure while probing', () => {
    const guard = new UpstreamGuard({ probing: true });
    expect(guard.tripped).toBe(false);
    guard.recordFailure();
    expect(guard.tripped).toBe(true);
  });

  it('goes back to the normal limit once the probe succeeds', () => {
    const guard = new UpstreamGuard({ probing: true, limit: 3 });
    guard.recordSuccess();
    failTimes(guard, 2);
    expect(guard.tripped).toBe(false);
  });

  it('does not count data errors as upstream failures', () => {
    const guard = new UpstreamGuard({ probing: false, limit: 3 });
    failTimes(guard, 2);
    guard.recordDataError();
    failTimes(guard, 2);
    expect(guard.tripped).toBe(false);
  });

  it('ends probing when the probe gets a data error', () => {
    const guard = new UpstreamGuard({ probing: true, limit: 3 });
    guard.recordDataError();
    guard.recordFailure();
    expect(guard.tripped).toBe(false);
  });

  it('allows retries only until the first failure in a row', () => {
    const guard = new UpstreamGuard({ probing: false });
    expect(guard.allowsRetry).toBe(true);
    guard.recordFailure();
    expect(guard.allowsRetry).toBe(false);
    guard.recordSuccess();
    expect(guard.allowsRetry).toBe(true);
  });
});

describe('upstream stop message', () => {
  it('is recognized from the run error message', () => {
    expect(isUpstreamStopMessage(`${upstreamStopMessage(5)}\n123: HTTP 503`)).toBe(true);
    expect(isUpstreamStopMessage('123: HTTP 503')).toBe(false);
    expect(isUpstreamStopMessage(null)).toBe(false);
    expect(isUpstreamStopMessage(undefined)).toBe(false);
  });
});
