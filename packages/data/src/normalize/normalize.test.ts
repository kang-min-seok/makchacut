import { describe, expect, it } from 'vitest';
import { alignGbisSegments } from '#normalize/gbis-segments';
import { headwayRange } from '#normalize/headway';
import { directionsByTurn } from '#normalize/route-direction';
import { seoulTimestampMinutes } from '#normalize/seoul-bus';
import { toSubwayStopTime } from '#normalize/subway-timetable';

describe('toSubwayStopTime', () => {
  const row = {
    lineName: '02호선',
    trainNo: '2016',
    arrival: '24:46:30',
    departure: '00:00:00',
    originCode: '0219',
    destinationCode: '0211',
    destinationName: '성수',
    expressFlag: 'G',
  };

  it('reads 24-hour-overflow times and treats 00:00:00 as missing', () => {
    expect(toSubwayStopTime(row)).toMatchObject({
      arrivalMinutes: 1486.5,
      departureMinutes: null,
      isExpress: false,
    });
  });

  it('marks express trains', () => {
    expect(toSubwayStopTime({ ...row, expressFlag: 'D' }).isExpress).toBe(true);
  });
});

describe('directionsByTurn', () => {
  it('splits at the turn stop, keeping the turn stop outbound', () => {
    expect(directionsByTurn(4, 1)).toEqual(['outbound', 'outbound', 'inbound', 'inbound']);
  });

  it('keeps everything outbound when the turn stop is unknown', () => {
    expect(directionsByTurn(2, -1)).toEqual(['outbound', 'outbound']);
  });
});

describe('seoulTimestampMinutes', () => {
  it('takes the clock part of a Seoul bus timestamp', () => {
    expect(seoulTimestampMinutes('20261102234000')).toBe(1420);
    expect(seoulTimestampMinutes('20261102003000')).toBe(1470);
    expect(seoulTimestampMinutes('              ')).toBeUndefined();
  });
});

describe('alignGbisSegments', () => {
  const stops = [
    { seq: 1, sourceStopId: 'A' },
    { seq: 2, sourceStopId: 'B' },
  ];
  const first = { seq: 1, stationId: 'A', ptts: 20, lengthMeters: 0 };
  const second = { seq: 2, stationId: 'B', ptts: 48, lengthMeters: 150 };

  it('maps segments onto official stop order', () => {
    expect(alignGbisSegments(stops, [first, second])?.get(2)).toEqual({
      seconds: 48,
      meters: 150,
    });
  });

  it('rejects mismatched stations, non-numeric ptts, or missing segments', () => {
    expect(alignGbisSegments(stops, [first, { ...second, stationId: 'X' }])).toBeUndefined();
    expect(alignGbisSegments(stops, [first, { ...second, ptts: NaN }])).toBeUndefined();
    expect(alignGbisSegments(stops, [first])).toBeUndefined();
  });
});

describe('headwayRange', () => {
  it('ignores unknown values', () => {
    expect(headwayRange([10, 0, 40])).toEqual({ min: 10, max: 40 });
    expect(headwayRange([0, 0])).toBeUndefined();
  });
});
