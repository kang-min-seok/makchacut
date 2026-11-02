import { describe, expect, it } from 'vitest';
import { alignStopSequences } from '#stop-last/align-stop-sequences';
import { cleanObservedLast } from '#stop-last/clean-observed';
import { cumulativeSeconds, type StopLastStop } from '#stop-last/cumulative-seconds';
import { estimateFromSchedule } from '#stop-last/estimate-from-schedule';
import { computeRouteStopLast, type StopLastRow } from '#stop-last/route-stop-last';
import { toServiceMinutes } from '#time/service-day';

const at = (clock: string) => {
  const minutes = toServiceMinutes(clock);
  if (minutes === undefined) throw new Error(clock);
  return minutes;
};

function stop(
  seq: number,
  name: string,
  direction: StopLastStop['direction'],
  segmentSeconds: number | null,
  extra: Partial<StopLastStop> = {},
): StopLastStop {
  return {
    seq,
    name,
    direction,
    lat: null,
    lng: null,
    segmentSeconds,
    segmentMeters: null,
    ...extra,
  };
}

const rowAt = (rows: StopLastRow[], seq: number, dayType: StopLastRow['dayType']) =>
  rows.find((row) => row.seq === seq && row.dayType === dayType);

describe('6003 (GBIS only, Pangyo turn 23:55)', () => {
  // 기점 동탄2차고지 23:00, 회차점 판교역.낙생육교.현대백화점 23:55 — 4요일 같음 (M0)
  const schedule = { lastAtOrigin: at('23:00'), lastAtTurn: at('23:55') };
  const stops = [
    stop(1, '동탄2차고지', 'outbound', 0),
    stop(2, '판교역동편', 'outbound', 55 * 60),
    stop(3, '판교역.낙생육교.현대백화점', 'outbound', 5 * 60),
    stop(4, '판교출입(경유)', 'inbound', 10 * 60),
    stop(5, '이마트.한림대병원', 'inbound', 7 * 60),
  ];
  const rows = computeRouteStopLast({
    stops,
    schedules: { weekday: schedule, sat: schedule, sun: schedule, holiday: schedule },
    scheduleFallback: false,
  });

  it('boards at the Pangyo turn stop at 23:55 on every day type', () => {
    for (const dayType of ['weekday', 'sat', 'sun', 'holiday'] as const) {
      expect(rowAt(rows, 3, dayType)).toMatchObject({
        lastMinutes: at('23:55'),
        source: 'gbis_eta',
        confidence: 'high',
      });
    }
  });

  it('adds ptts after the turn and skips passing stops', () => {
    expect(rowAt(rows, 5, 'weekday')).toMatchObject({
      lastMinutes: at('00:12'),
      confidence: 'medium',
    });
    expect(rowAt(rows, 4, 'weekday')).toBeUndefined();
  });

  it('shrinks the pre-turn leg when origin + ptts overshoots the turn, lowering confidence', () => {
    // 23:00 + 60분 > 23:55 → r = 55/60
    const row = rowAt(rows, 2, 'weekday');
    expect(row?.lastMinutes).toBeCloseTo(at('23:00') + 55 * (55 / 60));
    expect(row?.confidence).toBe('low');
    expect(rowAt(rows, 1, 'weekday')).toMatchObject({
      lastMinutes: at('23:00'),
      confidence: 'high',
    });
  });
});

describe('1551 (pre-turn stop counted back from the turn)', () => {
  // 회차점 양재역 23:40, 강남역우리은행은 회차 전 6분 앞 (2026-11-01 예시 데이터)
  const stops = [
    stop(1, '수원대학교', 'outbound', 0),
    stop(2, '강남역우리은행', 'outbound', 60 * 60),
    stop(3, '뱅뱅사거리(중)', 'outbound', 5 * 60),
    stop(4, '양재역.서초문화예술회관(중)', 'outbound', 60),
    stop(5, '말죽거리공원사거리(중)', 'inbound', 2 * 60),
  ];

  it('counts back from the turn when the origin last bus is missing', () => {
    const values = estimateFromSchedule(stops, { lastAtOrigin: null, lastAtTurn: at('23:40') });
    expect(values.get(2)).toMatchObject({ lastMinutes: at('23:34'), confidence: 'low' });
    expect(values.get(5)).toMatchObject({ lastMinutes: at('23:42'), confidence: 'medium' });
    expect(values.get(1)?.lastMinutes).toBe(at('22:34'));
  });

  it('treats an origin last bus later than the turn as an outlier', () => {
    const values = estimateFromSchedule(stops, {
      lastAtOrigin: at('23:50'),
      lastAtTurn: at('23:40'),
    });
    expect(values.get(2)?.lastMinutes).toBe(at('23:34'));
  });

  it('keeps origin + ptts when it reaches the turn in time (r >= 1)', () => {
    const values = estimateFromSchedule(stops, {
      lastAtOrigin: at('22:00'),
      lastAtTurn: at('23:40'),
    });
    expect(values.get(2)).toMatchObject({ lastMinutes: at('23:00'), confidence: 'medium' });
  });
});

describe('8501 (Seoul API first on weekdays, GBIS by day type otherwise)', () => {
  // 통합 정류장 id: 수원대 1, 예당마을 2, 강남역우리은행 3, 뱅뱅사거리 4
  const gbisStops = [
    stop(1, '수원대학교', 'outbound', 0),
    stop(2, '예당마을.롯데캐슬(중)', 'outbound', 30 * 60),
    stop(3, '강남역우리은행', 'outbound', 40 * 60),
    stop(4, '뱅뱅사거리(중)', 'inbound', 7 * 60),
    stop(5, '예당마을.롯데캐슬(중)', 'inbound', 32 * 60),
  ];
  const stopIds = [1, 2, 3, 4, 2];
  const seoulStops = [
    { seq: 11, name: '수원대학교', stopId: 1 },
    { seq: 12, name: '예당마을.롯데캐슬(중)', stopId: 2 },
    { seq: 13, name: '기흥IC(미정차)', stopId: 9 },
    { seq: 14, name: '강남역우리은행', stopId: 3 },
    { seq: 15, name: '뱅뱅사거리(중)', stopId: 4 },
    { seq: 16, name: '예당마을.롯데캐슬(중)', stopId: 2 },
  ];
  const weekday = { lastAtOrigin: at('23:40'), lastAtTurn: at('00:50') };
  const weekend = { lastAtOrigin: at('22:20'), lastAtTurn: at('23:30') };
  const seqMap = alignStopSequences(
    gbisStops.map((s, i) => ({ seq: s.seq, stopId: stopIds[i] ?? 0, name: s.name })),
    seoulStops,
  );
  const rows = computeRouteStopLast({
    stops: gbisStops,
    schedules: { weekday, sat: weekend, sun: weekend, holiday: weekend },
    scheduleFallback: false,
    seoul: {
      stops: seoulStops,
      // 평일(월요일) 수집 값만 있다
      observed: {
        weekday: new Map([
          [12, at('23:59')],
          [13, at('20:02')],
          [14, at('00:52')],
          [15, at('00:59')],
          [16, at('01:26')],
        ]),
      },
      lastAtOrigin: { weekday: at('22:20') },
      seqMap,
    },
  });

  it('maps Seoul stops onto GBIS stops in order, including the repeated stop', () => {
    expect([...seqMap]).toEqual([
      [11, 1],
      [12, 2],
      [14, 3],
      [15, 4],
      [16, 5],
    ]);
  });

  it('uses the Seoul value 00:52 at 강남역우리은행 on weekdays', () => {
    expect(rowAt(rows, 3, 'weekday')).toMatchObject({
      lastMinutes: at('00:52'),
      source: 'seoul_api',
      confidence: 'high',
    });
    expect(rowAt(rows, 5, 'weekday')?.lastMinutes).toBe(at('01:26'));
  });

  it('falls back to the GBIS weekend schedule instead of the weekday Seoul value', () => {
    expect(rowAt(rows, 3, 'sat')).toMatchObject({
      lastMinutes: at('23:30'),
      source: 'gbis_eta',
      confidence: 'high',
    });
    expect(rowAt(rows, 4, 'sun')?.lastMinutes).toBe(at('23:37'));
  });
});

describe('Seoul-only route day type fallback', () => {
  const stops = [stop(1, 'A', 'outbound', null), stop(2, 'B', 'outbound', null)];
  const rows = computeRouteStopLast({
    stops,
    schedules: { weekday: { lastAtOrigin: at('23:00'), lastAtTurn: null } },
    scheduleFallback: true,
    seoul: {
      stops,
      observed: {
        weekday: new Map([
          [1, at('23:00')],
          [2, at('23:10')],
        ]),
      },
      lastAtOrigin: { weekday: at('23:00') },
      seqMap: new Map([
        [1, 1],
        [2, 2],
      ]),
    },
  });

  it('stores the weekday value for other day types with lower confidence', () => {
    expect(rowAt(rows, 2, 'weekday')).toMatchObject({ source: 'seoul_api', confidence: 'high' });
    expect(rowAt(rows, 2, 'sat')).toMatchObject({
      lastMinutes: at('23:10'),
      source: 'seoul_api',
      confidence: 'medium',
    });
  });
});

describe('cleanObservedLast', () => {
  const stops = [
    { seq: 1, name: '기점' },
    { seq: 2, name: '예당마을' },
    { seq: 3, name: '다은마을(중)' },
    { seq: 4, name: '고속도로(미정차)' },
    { seq: 5, name: '서울시청' },
    { seq: 6, name: '서울역' },
  ];

  it('drops inverted, too-early and passing values, then interpolates', () => {
    const cleaned = cleanObservedLast(
      stops,
      new Map([
        [1, at('14:11')],
        [2, at('22:41')],
        [3, at('22:22')],
        [4, at('20:02')],
        [5, at('23:35')],
        [6, at('23:41')],
      ]),
      at('22:40'),
    );
    expect(cleaned.has(1)).toBe(false);
    expect(cleaned.has(4)).toBe(false);
    expect(cleaned.get(3)).toEqual({ lastMinutes: at('23:08'), interpolated: true });
    expect(cleaned.get(6)).toEqual({ lastMinutes: at('23:41'), interpolated: false });
  });
});

describe('cumulativeSeconds', () => {
  it('estimates by segment type when ptts is missing: passing 80km/h, city 25km/h', () => {
    const { source, seconds } = cumulativeSeconds([
      stop(1, '판교역', 'outbound', null),
      stop(2, '서울TG(경유)', 'outbound', null, { segmentMeters: 20_000 }),
      stop(3, '이마트', 'outbound', null, { segmentMeters: 2_500 }),
      stop(4, '전하리', 'outbound', null, { segmentMeters: 500 }),
    ]);
    expect(source).toBe('distance');
    expect(seconds).toEqual([0, 900, 1012.5, 1084.5]);
  });

  it('stops accumulating after a segment with no distance', () => {
    const { seconds } = cumulativeSeconds([
      stop(1, 'A', 'outbound', null, { lat: 37.5, lng: 127 }),
      stop(2, 'B', 'outbound', null),
      stop(3, 'C', 'outbound', null, { segmentMeters: 100 }),
    ]);
    expect(seconds).toEqual([0, undefined, undefined]);
  });
});
