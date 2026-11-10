import { describe, expect, it } from 'vitest';
import { alignGbisSegments } from '#normalize/gbis-segments';
import { headwayRange } from '#normalize/headway';
import { directionsByTurn } from '#normalize/route-direction';
import { seoulTimestampMinutes } from '#normalize/seoul-bus';
import { toSubwayStopTime } from '#normalize/subway-timetable';
import { pickSubwayPlace } from '#kakao-local';

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
    { seq: 1, sourceStopIds: ['A'] },
    { seq: 2, sourceStopIds: ['B'] },
  ];
  const first = { seq: 1, stationId: 'A', ptts: 20, lengthMeters: 0 };
  const second = { seq: 2, stationId: 'B', ptts: 48, lengthMeters: 150 };

  it('maps segments onto official stop order as previous → this stop', () => {
    const aligned = alignGbisSegments(stops, [first, { ...second, ptts: 0 }]);
    expect(aligned?.get(1)).toEqual({ seconds: 0, meters: 0 });
    // ptts는 이 정류장 → 다음 정류장이라 한 칸 밀린다
    expect(aligned?.get(2)).toEqual({ seconds: 20, meters: 150 });
  });

  it('rejects mismatched stations, non-numeric ptts, or missing segments', () => {
    expect(alignGbisSegments(stops, [first, { ...second, stationId: 'X' }])).toBeUndefined();
    expect(alignGbisSegments(stops, [first, { ...second, ptts: NaN }])).toBeUndefined();
    expect(alignGbisSegments(stops, [first])).toBeUndefined();
  });

  it('accepts any source id merged into the same unified stop', () => {
    const merged = [stops[0]!, { seq: 2, sourceStopIds: ['B', 'B2'] }];
    const aligned = alignGbisSegments(merged, [first, { ...second, stationId: 'B2' }]);
    expect(aligned?.get(2)).toEqual({ seconds: 20, meters: 150 });
  });
});

describe('headwayRange', () => {
  it('ignores unknown values', () => {
    expect(headwayRange([10, 0, 40])).toEqual({ min: 10, max: 40 });
    expect(headwayRange([0, 0])).toBeUndefined();
  });
});

describe('pickSubwayPlace', () => {
  const places = [
    { placeName: '서울역 GTX-A', lat: 37.5554, lng: 126.9726 },
    { placeName: '서울역 1호선', lat: 37.5559, lng: 126.972 },
    { placeName: '서울역 4호선', lat: 37.553, lng: 126.9726 },
    { placeName: '시청역 1호선', lat: 37.5653, lng: 126.9771 },
  ];

  it('matches the station and line', () => {
    expect(pickSubwayPlace(places, '서울역', '04호선')?.lat).toBe(37.553);
  });

  it('falls back to the same station on another line', () => {
    expect(pickSubwayPlace(places, '서울역', '09호선')?.placeName).toBe('서울역 GTX-A');
    expect(pickSubwayPlace(places, '시청', '02호선')?.placeName).toBe('시청역 1호선');
    expect(pickSubwayPlace(places, '강남', '02호선')).toBeUndefined();
  });
});
