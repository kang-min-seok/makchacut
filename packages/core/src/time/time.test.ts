import { describe, expect, it } from 'vitest';
import { dayTypeOf } from '#time/day-type';
import { todayInKorea } from '#time/korea-date';
import { formatClock, minutesToClock, toServiceMinutes } from '#time/service-day';

describe('toServiceMinutes', () => {
  it('keeps evening times as they are', () => {
    expect(toServiceMinutes('23:55')).toBe(1435);
    expect(toServiceMinutes('04:00')).toBe(240);
  });

  it('adds a day to times after midnight and before 04:00', () => {
    expect(toServiceMinutes('00:40')).toBe(1480);
    expect(toServiceMinutes('0040')).toBe(1480);
    expect(toServiceMinutes('03:59')).toBe(1679);
  });

  it('reads 24-hour-overflow notation with seconds', () => {
    expect(toServiceMinutes('24:46:30')).toBe(1486.5);
    expect(toServiceMinutes('244630')).toBe(1486.5);
  });

  it('returns undefined for empty or malformed values', () => {
    expect(toServiceMinutes('')).toBeUndefined();
    expect(toServiceMinutes('0')).toBeUndefined();
    expect(toServiceMinutes('23시55분')).toBeUndefined();
  });
});

describe('minutesToClock', () => {
  it('wraps service minutes past 24:00 back to clock time', () => {
    expect(minutesToClock(1480)).toBe('00:40');
    expect(minutesToClock(1435)).toBe('23:55');
  });
});

describe('formatClock', () => {
  it('formats HHMMSS and leaves other values', () => {
    expect(formatClock('004000')).toBe('00:40:00');
    expect(formatClock('24:46:00')).toBe('24:46:00');
  });
});

describe('todayInKorea', () => {
  it('uses the Korean date even when UTC is still the previous day', () => {
    expect(todayInKorea(new Date('2026-11-01T15:30:00Z'))).toBe('2026-11-02');
    expect(todayInKorea(new Date('2026-11-01T14:59:00Z'))).toBe('2026-11-01');
  });
});

describe('dayTypeOf', () => {
  const holidays = new Set(['2026-12-25', '2026-10-03']);

  it('classifies weekdays and weekends', () => {
    expect(dayTypeOf('2026-11-02', holidays)).toBe('weekday');
    expect(dayTypeOf('2026-11-07', holidays)).toBe('sat');
    expect(dayTypeOf('2026-11-08', holidays)).toBe('sun');
  });

  it('puts holidays before weekends', () => {
    expect(dayTypeOf('2026-12-25', holidays)).toBe('holiday');
    expect(dayTypeOf('2026-10-03', holidays)).toBe('holiday');
  });

  it('rejects malformed or impossible dates', () => {
    expect(() => dayTypeOf('20261102', holidays)).toThrow();
    expect(() => dayTypeOf('2026-13-40', holidays)).toThrow();
  });
});
