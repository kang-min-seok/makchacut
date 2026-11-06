import { describe, expect, it } from 'vitest';
import { formatDateLabel, formatDuration, minutesUntil } from '@/lib/korea-time';
import { routeColorClass, routeLabel } from '@/lib/route-style';

describe('korea time labels', () => {
  it('formats the date with the weekday', () => {
    expect(formatDateLabel('2026-11-06')).toBe('11월 6일 (금)');
  });

  it('formats durations', () => {
    expect(formatDuration(25)).toBe('25분');
    expect(formatDuration(72)).toBe('1시간 12분');
    expect(formatDuration(120)).toBe('2시간');
  });

  it('floors the minutes left', () => {
    const now = new Date('2026-11-06T14:00:30Z');
    expect(minutesUntil('2026-11-06T23:18:00+09:00', now)).toBe(17);
  });
});

describe('route style', () => {
  it('uses Seoul subway line colors and drops the leading zero', () => {
    const step = { type: 'subway' as const, routeName: '08호선' };
    expect(routeLabel(step)).toBe('8호선');
    expect(routeColorClass(step)).toBe('bg-line-8');
  });

  it('keeps one color for buses', () => {
    expect(routeColorClass({ type: 'bus', routeName: '6003' })).toBe('bg-transit-bus');
  });
});
