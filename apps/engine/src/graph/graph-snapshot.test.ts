import { describe, expect, it } from 'vitest';
import { buildTransitGraph } from '@makchacut/core';
import { decodeGraphSnapshot, encodeGraphSnapshot } from '#graph/graph-snapshot';

const { graph } = buildTransitGraph({
  stops: [
    { id: 10, name: '사당', lat: 37.4765, lng: 126.9816 },
    { id: 11, name: '교대', lat: 37.4934, lng: 127.0142 },
    { id: 12, name: '강남', lat: null, lng: null },
  ],
  trips: [
    {
      routeId: 2,
      routeName: '2호선',
      mode: 'subway',
      label: '2001 성수행',
      stopTimes: [
        { stopId: 10, arrival: null, departure: 1450.5 },
        { stopId: 11, arrival: 1454, departure: 1454.5 },
        { stopId: 12, arrival: 1457, departure: null },
      ],
    },
  ],
  footpaths: [{ fromStopId: 10, toStopId: 11, walkSeconds: 300 }],
});

describe('graph snapshot', () => {
  it('round-trips every array and string list', () => {
    const decoded = decodeGraphSnapshot(encodeGraphSnapshot(graph));
    expect(decoded).toEqual(graph);
    expect(decoded.departures).toBeInstanceOf(Float32Array);
  });

  it('rejects other data', () => {
    expect(() => decodeGraphSnapshot(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
