import { describe, expect, it } from 'vitest';
import { buildTransitGraph, type GraphStopTimeInput } from '#graph/build-graph';
import type { Confidence } from '#stop-last/confidence';

const STOP_IDS = [1, 2, 3];
const STOPS = STOP_IDS.map((id) => ({ id, name: `S${id}`, lat: null, lng: null }));
const LOW_MARGIN = 10;

function stopTime(
  stopId: number,
  minutes: number,
  confidence: Confidence,
  boardMarginMinutes: number,
): GraphStopTimeInput {
  return {
    stopId,
    arrival: minutes,
    departure: minutes,
    source: 'gbis_eta',
    confidence,
    boardMarginMinutes,
  };
}

function busGraph(stopTimes: GraphStopTimeInput[]) {
  return buildTransitGraph({
    stops: STOPS,
    trips: [
      { routeId: 1, routeName: 'B1', mode: 'bus', label: '막차', headwayMinutes: null, stopTimes },
    ],
    footpaths: [],
  }).graph;
}

describe('applyBoardMargin in the graph builder', () => {
  it('keeps raw arrivals and moves only departures earlier by the margin', () => {
    const graph = busGraph([
      stopTime(1, 1400, 'high', 0),
      stopTime(2, 1405, 'low', LOW_MARGIN),
      stopTime(3, 1410, 'high', 0),
    ]);
    expect(Array.from(graph.arrivals)).toEqual([1400, 1405, 1410]);
    expect(Array.from(graph.departures)).toEqual([1400, 1395, 1410]);
  });

  it('leaves no zero-minute segment where confidence changes high → low → high', () => {
    const graph = busGraph([
      stopTime(1, 1400, 'high', 0),
      stopTime(2, 1405, 'low', LOW_MARGIN),
      stopTime(3, 1410, 'high', 0),
    ]);
    const segments = [0, 1].map((i) => graph.arrivals[i + 1]! - graph.arrivals[i]!);
    expect(segments.every((minutes) => minutes > 0)).toBe(true);
  });

  it('aligns the raw times before taking the margin off', () => {
    const graph = busGraph([
      stopTime(1, 1400, 'high', 0),
      stopTime(2, 1398, 'low', LOW_MARGIN),
      stopTime(3, 1410, 'high', 0),
    ]);
    expect(Array.from(graph.arrivals)).toEqual([1400, 1400, 1410]);
    expect(Array.from(graph.departures)).toEqual([1400, 1390, 1410]);
  });
});
