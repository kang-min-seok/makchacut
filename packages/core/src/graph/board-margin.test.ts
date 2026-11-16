import { describe, expect, it } from 'vitest';
import {
  buildTransitGraph,
  type GraphStopTimeInput,
  type GraphTripInput,
} from '#graph/build-graph';
import { indexGraph } from '#graph/graph-index';
import { reconstructJourney } from '#raptor/journey';
import { reverseRaptor } from '#raptor/reverse-raptor';
import type { Confidence } from '#stop-last/confidence';

const STOP_IDS = [1, 2, 3];
const STOPS = STOP_IDS.map((id) => ({ id, name: `S${id}`, lat: null, lng: null }));
const LOW_MARGIN = 10;
const SEARCH_OPTIONS = { maxRides: 3, minTransferMinutes: 1, walkTimeFactor: 1 };

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

function busTrip(routeId: number, stopTimes: GraphStopTimeInput[]): GraphTripInput {
  return {
    routeId,
    routeName: `B${routeId}`,
    mode: 'bus',
    label: '막차',
    headwayMinutes: null,
    stopTimes,
  };
}

function busGraph(...trips: GraphTripInput[]) {
  return buildTransitGraph({ stops: STOPS, trips, footpaths: [] }).graph;
}

describe('applyBoardMargin in the graph builder', () => {
  it('keeps raw arrivals and moves only departures earlier by the margin', () => {
    const graph = busGraph(
      busTrip(1, [
        stopTime(1, 1400, 'high', 0),
        stopTime(2, 1405, 'low', LOW_MARGIN),
        stopTime(3, 1410, 'high', 0),
      ]),
    );
    expect(Array.from(graph.arrivals)).toEqual([1400, 1405, 1410]);
    expect(Array.from(graph.departures)).toEqual([1400, 1395, 1410]);
  });

  it('leaves no zero-minute segment where confidence changes high → low → high', () => {
    const graph = busGraph(
      busTrip(1, [
        stopTime(1, 1400, 'high', 0),
        stopTime(2, 1405, 'low', LOW_MARGIN),
        stopTime(3, 1410, 'high', 0),
      ]),
    );
    const segments = [0, 1].map((i) => graph.arrivals[i + 1]! - graph.arrivals[i]!);
    expect(segments.every((minutes) => minutes > 0)).toBe(true);
  });

  it('aligns the raw times before taking the margin off', () => {
    const graph = busGraph(
      busTrip(1, [
        stopTime(1, 1400, 'high', 0),
        stopTime(2, 1398, 'low', LOW_MARGIN),
        stopTime(3, 1410, 'high', 0),
      ]),
    );
    expect(Array.from(graph.arrivals)).toEqual([1400, 1400, 1410]);
    expect(Array.from(graph.departures)).toEqual([1400, 1390, 1410]);
  });
});

describe('transfer after alighting at an estimated stop', () => {
  // 1(high) → 2(low, 원래 23:40) 버스에서 내려 2 → 3(집) 버스로 갈아탄다
  function firstLegDeparture(transferDeparture: number): number | undefined {
    const graph = busGraph(
      busTrip(1, [stopTime(1, 1400, 'high', 0), stopTime(2, 1420, 'low', LOW_MARGIN)]),
      busTrip(2, [stopTime(2, transferDeparture, 'high', 0), stopTime(3, 1440, 'high', 0)]),
    );
    const index = indexGraph(graph);
    const home = index.stopIndexById.get(3)!;
    const result = reverseRaptor(
      graph,
      index,
      [{ stop: home, latestArrival: Infinity }],
      SEARCH_OPTIONS,
    );
    return reconstructJourney(graph, result, index.stopIndexById.get(1)!)?.latestDeparture;
  }

  it('connects using the raw arrival at the estimated stop', () => {
    expect(firstLegDeparture(1425)).toBe(1400);
  });

  it('does not connect to a bus leaving before the raw arrival', () => {
    // 여유를 도착에도 빼면(23:30 도착) 23:37 차로 갈아탈 수 있다고 잘못 본다
    expect(firstLegDeparture(1417)).toBeUndefined();
  });
});
