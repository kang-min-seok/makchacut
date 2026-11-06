import { describe, expect, it } from 'vitest';
import { parsePlanTarget, parseWayIndex, planDetailHref, planHref } from '@/lib/plan-target';
import { safeNextPath } from '@/lib/routes';

const target = { name: '모란역', lat: 37.432, lng: 127.129, date: '2026-11-06' };

describe('plan target in the URL', () => {
  it('round-trips through the query string', () => {
    const params = new URL(planHref(target), 'https://example.com').searchParams;
    expect(parsePlanTarget(params)).toEqual(target);
  });

  it('rejects a broken date or coordinate', () => {
    expect(parsePlanTarget(new URLSearchParams({ ...stringify(target), date: '11/6' }))).toBeNull();
    expect(parsePlanTarget(new URLSearchParams({ ...stringify(target), lat: 'abc' }))).toBeNull();
  });

  it('carries the way index for the detail page', () => {
    const params = new URL(planDetailHref(target, 2), 'https://example.com').searchParams;
    expect(parseWayIndex(params)).toBe(2);
    expect(parseWayIndex(new URLSearchParams({ way: '-1' }))).toBe(0);
  });
});

describe('safeNextPath', () => {
  it('only allows paths inside the app', () => {
    expect(safeNextPath('/plan?x=1')).toBe('/plan?x=1');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });
});

function stringify(value: typeof target): Record<string, string> {
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]));
}
