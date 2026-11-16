import { describe, expect, it } from 'vitest';
import {
  FIRST_WAY,
  parsePlanTarget,
  parseWayRef,
  planAnchorsHref,
  planDetailHref,
  planHref,
  type WayRef,
} from '@/lib/plan-target';
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

  it('carries which way the detail page shows', () => {
    const refs: WayRef[] = [
      { kind: 'way', index: 2 },
      { kind: 'later' },
      { kind: 'anchor', index: 1 },
    ];
    for (const ref of refs) {
      const params = new URL(planDetailHref(target, ref), 'https://example.com').searchParams;
      expect(parseWayRef(params)).toEqual(ref);
      expect(parsePlanTarget(params)).toEqual(target);
    }
  });

  it('falls back to the first way for a broken index', () => {
    expect(parseWayRef(new URLSearchParams({ way: '-1' }))).toEqual(FIRST_WAY);
    expect(parseWayRef(new URLSearchParams())).toEqual(FIRST_WAY);
    expect(parseWayRef(new URLSearchParams({ anchor: 'x', way: '1' }))).toEqual({
      kind: 'way',
      index: 1,
    });
  });

  it('links the other anchors page with the same target', () => {
    const url = new URL(planAnchorsHref(target), 'https://example.com');
    expect(url.pathname).toBe('/plan/anchors');
    expect(parsePlanTarget(url.searchParams)).toEqual(target);
  });
});

describe('safeNextPath', () => {
  it('only allows paths inside the app', () => {
    expect(safeNextPath('/plan?x=1')).toBe('/plan?x=1');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath('/\t/evil.example')).toBe('/');
    expect(safeNextPath(new URLSearchParams('next=/%5Cevil.example').get('next'))).toBe('/');
  });
});

function stringify(value: typeof target): Record<string, string> {
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]));
}
