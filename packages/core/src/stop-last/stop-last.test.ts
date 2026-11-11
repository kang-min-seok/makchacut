import { describe, expect, it } from 'vitest';
import { alignStopSequences } from '#stop-last/align-stop-sequences';
import { cleanObservedLast } from '#stop-last/clean-observed';
import { cumulativeSeconds, type StopLastStop } from '#stop-last/cumulative-seconds';
import { estimateFromSchedule } from '#stop-last/estimate-from-schedule';
import { computeRouteStopLast, type StopLastRow } from '#stop-last/route-stop-last';
import { type DaySchedule, usableSchedule } from '#stop-last/schedule-rules';
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

function daySchedule(lastAtOrigin: number | null, lastAtTurn: number | null): DaySchedule {
  return { firstAtOrigin: null, lastAtOrigin, firstAtTurn: null, lastAtTurn };
}

const rowAt = (rows: StopLastRow[], seq: number, dayType: StopLastRow['dayType']) =>
  rows.find((row) => row.seq === seq && row.dayType === dayType);

describe('6003 (GBIS only, Pangyo turn 23:55)', () => {
  // 기점 동탄2차고지 23:00, 회차점 판교역.낙생육교.현대백화점 23:55 — 4요일 같음 (M0)
  const schedule = daySchedule(at('23:00'), at('23:55'));
  const stops = [
    stop(1, '동탄2차고지', 'outbound', 0),
    stop(2, '판교역동편', 'outbound', 55 * 60),
    stop(3, '판교역.낙생육교.현대백화점', 'outbound', 5 * 60),
    stop(4, '판교출입(경유)', 'inbound', 10 * 60),
    stop(5, '이마트.한림대병원', 'inbound', 7 * 60),
  ];
  const rows = computeRouteStopLast({
    routeName: '6003',
    stops,
    schedules: { weekday: schedule, sat: schedule, sun: schedule, holiday: schedule },
    holidayFromSunday: false,
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
    { seq: 11, name: '수원대학교', stopId: 1, lat: null, lng: null },
    { seq: 12, name: '예당마을.롯데캐슬(중)', stopId: 2, lat: null, lng: null },
    { seq: 13, name: '기흥IC(미정차)', stopId: 9, lat: null, lng: null },
    { seq: 14, name: '강남역우리은행', stopId: 3, lat: null, lng: null },
    { seq: 15, name: '뱅뱅사거리(중)', stopId: 4, lat: null, lng: null },
    { seq: 16, name: '예당마을.롯데캐슬(중)', stopId: 2, lat: null, lng: null },
  ];
  const weekday = daySchedule(at('23:40'), at('00:50'));
  const weekend = daySchedule(at('22:20'), at('23:30'));
  const seqMap = alignStopSequences(
    gbisStops.map((s, i) => ({ seq: s.seq, stopId: stopIds[i] ?? 0, name: s.name })),
    seoulStops,
  );
  const rows = computeRouteStopLast({
    routeName: '8501',
    stops: gbisStops,
    schedules: { weekday, sat: weekend, sun: weekend, holiday: weekend },
    holidayFromSunday: false,
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

describe('Seoul observations on a GBIS route', () => {
  // 4108 일요일: 서울 쪽 기점 막차(21:20)가 경기 기점 막차(22:40)보다 이르면, 그 사이 관측(22:13)은 기점 막차 전이라 불가능하다
  it('drops observations earlier than the GBIS origin last run', () => {
    const stops = [stop(1, '나루마을', 'outbound', 0), stop(2, '다은마을', 'outbound', 5 * 60)];
    const rows = computeRouteStopLast({
      routeName: '4108',
      stops,
      schedules: { sun: daySchedule(at('22:40'), null) },
      holidayFromSunday: false,
      seoul: {
        stops,
        observed: {
          sun: new Map([
            [1, at('22:13')],
            [2, at('22:46')],
          ]),
        },
        lastAtOrigin: { sun: at('21:20') },
        seqMap: new Map([
          [1, 1],
          [2, 2],
        ]),
      },
    });
    expect(rowAt(rows, 1, 'sun')).toMatchObject({ lastMinutes: at('22:40'), source: 'gbis_eta' });
    expect(rowAt(rows, 2, 'sun')).toMatchObject({ lastMinutes: at('22:46'), source: 'seoul_api' });
  });
});

describe('alignStopSequences (서울 → 경기 순번 짝)', () => {
  const seq = (stops: readonly [number, string, number][]) =>
    stops.map(([s, name, stopId]) => ({ seq: s, name, stopId }));

  // 4108 실데이터 순서: 경기는 같은 통과 지점을 가는 길에 (경유), 오는 길에 (미정차)로 부르고 서울은 둘 다 (미정차)다.
  // 앞쪽 탐색이면 서울 #18이 경기 복귀 #44와 이름으로 맞아 명동입구B(#35)까지 건너뛴다 (2026-11-09 회귀)
  it('does not jump to a passing stop on the way back (4108)', () => {
    const gbis = seq([
      [1, '나루마을.월드반도', 743],
      [10, '수원신갈IC(미정차)', 675],
      [18, '청계산입구역(경유)', 683],
      [28, '서울시청', 757],
      [35, '명동입구B', 764],
      [36, '명동성당', 765],
      [44, '청계산입구역(미정차)', 697],
      [55, '예당마을.롯데캐슬(중)', 772],
    ]);
    const seoul = seq([
      [1, '나루마을.월드반도', 743],
      [10, '수원신갈IC(미정차)', 875],
      [18, '청계산입구역(미정차)', 883],
      [28, '서울시청', 757],
      [35, '명동입구B', 764],
      [36, '명동성당', 765],
      [44, '청계산입구역(미정차)', 897],
      [55, '예당마을.롯데캐슬(중)', 772],
    ]);
    expect([...alignStopSequences(gbis, seoul)]).toEqual([
      [1, 1],
      [28, 28],
      [35, 35],
      [36, 36],
      [55, 55],
    ]);
  });

  // 8844: 서울 목록 앞쪽 정류장이 경기 목록에서는 맨 끝(#70)에만 있다 — 그 한 짝 때문에 나머지를 버리지 않는다
  it('drops a single pair at the far end rather than every stop before it', () => {
    const gbis = seq([
      [1, '광릉내', 6300],
      [2, '신광마을입구', 6321],
      [3, '진접역', 6322],
      [70, '광릉내종점', 6320],
    ]);
    const seoul = seq([
      [2, '광릉내종점', 6320],
      [3, '신광마을입구', 6321],
      [4, '진접역', 6322],
    ]);
    expect([...alignStopSequences(gbis, seoul)]).toEqual([
      [3, 2],
      [4, 3],
    ]);
  });

  // 7790: 경기 쪽에 없는 정류장이 복귀 구간의 이름만 같은 길 건너 정류장(통합 안 됨)과 맞아도 그 사이를 버리지 않는다
  it('skips a lone same-name match on the way back instead of the stops before it', () => {
    const gbis = seq([
      [10, '와우지구', 5800],
      [11, '봉담읍사무소', 5801],
      [59, '수원대입구', 5739],
    ]);
    const seoul = seq([
      [9, '수원대입구', 5788],
      [10, '와우지구', 5800],
      [11, '봉담읍사무소', 5801],
    ]);
    expect([...alignStopSequences(gbis, seoul)]).toEqual([
      [10, 10],
      [11, 11],
    ]);
  });
});

describe('Seoul-only route by day type', () => {
  const stops = [stop(1, 'A', 'outbound', null), stop(2, 'B', 'outbound', null)];
  const observedAt = (first: string, second: string) =>
    new Map([
      [1, at(first)],
      [2, at(second)],
    ]);
  const rows = computeRouteStopLast({
    routeName: '8501(예약)화성',
    stops,
    // 토요일 시간표·관측이 아직 없다
    schedules: { weekday: daySchedule(at('23:00'), null), sun: daySchedule(at('22:30'), null) },
    holidayFromSunday: true,
    seoul: {
      stops,
      observed: { weekday: observedAt('23:00', '23:10'), sun: observedAt('22:30', '22:40') },
      lastAtOrigin: { weekday: at('23:00'), sun: at('22:30') },
      seqMap: new Map([
        [1, 1],
        [2, 2],
      ]),
    },
  });

  it('does not borrow the weekday value for a day without its own schedule', () => {
    expect(rowAt(rows, 2, 'weekday')).toMatchObject({ source: 'seoul_api', confidence: 'high' });
    expect(rows.filter((row) => row.dayType === 'sat')).toEqual([]);
  });

  it('uses the Sunday value on holidays with lower confidence', () => {
    expect(rowAt(rows, 2, 'holiday')).toMatchObject({
      lastMinutes: at('22:40'),
      source: 'seoul_api',
      confidence: 'medium',
    });
  });

  it('keeps GBIS routes without a holiday schedule out of service on holidays', () => {
    const gbisRows = computeRouteStopLast({
      routeName: '6003',
      stops,
      schedules: { sun: daySchedule(at('22:30'), null) },
      holidayFromSunday: false,
    });
    expect(gbisRows.filter((row) => row.dayType === 'holiday')).toEqual([]);
  });
});

describe('reserved route whose schedule is the parent route timetable (1550-1(예약))', () => {
  const stops = [stop(1, '한신대', 'outbound', 0), stop(2, '신분당선강남역', 'outbound', 50 * 60)];
  const seoulFor = (observed: Map<number, number>, last: number) => ({
    stops,
    observed: { weekday: observed },
    lastAtOrigin: { weekday: last },
    seqMap: new Map([
      [1, 1],
      [2, 2],
    ]),
  });
  const rowsOf = (routeName: string, observed: Map<number, number>, last = at('23:50')) =>
    computeRouteStopLast({
      routeName,
      stops,
      schedules: { weekday: daySchedule(last, null) },
      holidayFromSunday: false,
      seoul: seoulFor(observed, last),
    });
  const morning = new Map([
    [1, at('09:00')],
    [2, at('10:03')],
  ]);

  it('makes no rows when every observation is hours before the scheduled last run', () => {
    expect(rowsOf('1550-1(예약)', morning)).toEqual([]);
  });

  it('keeps reserved routes whose observations match the schedule', () => {
    const night = new Map([
      [1, at('23:50')],
      [2, at('00:40')],
    ]);
    expect(rowsOf('1550-1(예약)', night)).toHaveLength(2);
  });

  it('unfolds after-midnight observations before comparing', () => {
    // 기점 막차 01:20, 관측 04:30은 04시 경계로 접힌 값(270분)이라 펴면 28:30
    const lateNight = new Map([[2, at('04:30')]]);
    expect(rowsOf('1550-1(예약)', lateNight, at('01:20'))).toHaveLength(2);
  });

  it('keeps regular routes even when observations are early', () => {
    expect(rowsOf('1560A', morning)).toHaveLength(2);
  });
});

describe('night route whose origin last time folds past 04:00 (N61)', () => {
  // 기점 23:40~04:10. 서울 lastTm은 02:35~02:59에서 오르내리는 섞인 값이라 기점 막차(28:10)보다 이르다
  const stops = [
    stop(1, '양천공영차고지', 'outbound', 0),
    stop(2, '건대입구역1번출구', 'outbound', 120 * 60),
    stop(3, '서울교대사거리', 'outbound', 20 * 60),
  ];
  const schedule: DaySchedule = {
    firstAtOrigin: at('23:40'),
    lastAtOrigin: at('04:10'),
    firstAtTurn: null,
    lastAtTurn: null,
  };
  const rows = computeRouteStopLast({
    routeName: 'N61',
    stops,
    schedules: { sat: schedule },
    holidayFromSunday: true,
    seoul: {
      stops,
      observed: {
        sat: new Map([
          [2, at('02:59')],
          [3, at('02:45')],
        ]),
      },
      lastAtOrigin: { sat: usableSchedule('N61', schedule)?.lastAtOrigin ?? null },
      seqMap: new Map([
        [1, 1],
        [2, 2],
        [3, 3],
      ]),
    },
  });

  it('estimates every stop after the unfolded origin without zero-minute or backward rides', () => {
    const minutes = [1, 2, 3].map((seq) => rowAt(rows, seq, 'sat')?.lastMinutes ?? 0);
    expect(minutes).toEqual([at('04:10') + 24 * 60, at('06:10') + 24 * 60, at('06:30') + 24 * 60]);
    expect(rows.every((row) => row.source !== 'seoul_api')).toBe(true);
  });
});

describe('usableSchedule', () => {
  const schedule = (first: string, last: string, turn: [string, string] | null = null) => ({
    firstAtOrigin: at(first),
    lastAtOrigin: at(last),
    firstAtTurn: turn ? at(turn[0]) : null,
    lastAtTurn: turn ? at(turn[1]) : null,
  });

  it('treats first = last = 00:00 as no service (weekend commute route, no return run)', () => {
    expect(usableSchedule('5000(예약)', schedule('00:00', '00:00', ['00:00', '00:00']))).toBe(
      undefined,
    );
    expect(usableSchedule('학생2', schedule('07:00', '15:55', ['00:00', '00:00']))).toEqual({
      lastAtOrigin: at('15:55'),
      lastAtTurn: null,
    });
    // 82-1: 회차점 막차만 00:00이면 실제 자정 막차
    expect(usableSchedule('82-1', schedule('05:00', '23:05', ['06:05', '00:00']))).toEqual({
      lastAtOrigin: at('23:05'),
      lastAtTurn: at('00:00'),
    });
  });

  it('drops dawn-only routes but keeps night routes that start in the evening', () => {
    expect(usableSchedule('새벽A148', schedule('03:30', '03:30'))).toBe(undefined);
    expect(usableSchedule('100출', schedule('03:10', '03:10', ['04:00', '04:00']))).toBe(undefined);
    expect(usableSchedule('H4', schedule('22:00', '02:50'))?.lastAtOrigin).toBe(at('02:50'));
    expect(usableSchedule('N26', schedule('00:30', '03:00'))?.lastAtOrigin).toBe(at('03:00'));
    // 막차가 01:30 전이면 낮에 시작해도 그대로 (3000 회차점 01:30)
    expect(usableSchedule('3000', schedule('04:30', '01:00', ['05:30', '02:00']))).toEqual({
      lastAtOrigin: at('01:00'),
      lastAtTurn: at('02:00'),
    });
  });

  it('unfolds a turn time folded past the 04:00 service day boundary (33-1)', () => {
    expect(usableSchedule('33-1', schedule('23:40', '03:30', ['00:30', '04:10']))).toEqual({
      lastAtOrigin: at('03:30'),
      lastAtTurn: at('04:10') + 24 * 60,
    });
  });

  it('unfolds an origin last time folded past 04:00 for night routes only (N61)', () => {
    expect(usableSchedule('N61', schedule('23:40', '04:10'))?.lastAtOrigin).toBe(
      at('04:10') + 24 * 60,
    );
    // 낮에 시작하는 노선의 04~06시 막차는 첫차 같은 잘못된 값이라 펴지 않는다
    expect(usableSchedule('1162', schedule('05:00', '04:30'))?.lastAtOrigin).toBe(at('04:30'));
  });
});

describe('estimateFromSchedule with an independent turn departure', () => {
  // 1336·6800: 양쪽 기점 막차가 같은 시각이면 회차 전 구간을 0분으로 줄이지 않는다
  it('does not squash the outbound run when the turn last departs at the same time', () => {
    const result = estimateFromSchedule(
      [
        stop(1, '기점', 'outbound', 0),
        stop(2, '중간', 'outbound', 30 * 60),
        stop(3, '회차점', 'outbound', 30 * 60),
        stop(4, '복귀', 'inbound', 10 * 60),
      ],
      { lastAtOrigin: at('20:00'), lastAtTurn: at('20:00') },
    );
    expect(result.get(2)).toMatchObject({ lastMinutes: at('20:30'), confidence: 'low' });
    expect(result.get(3)?.lastMinutes).toBe(at('20:00'));
    expect(result.get(4)?.lastMinutes).toBe(at('20:10'));
  });
});

describe('cleanObservedLast', () => {
  const stops = [
    { seq: 1, name: '기점', lat: null, lng: null },
    { seq: 2, name: '예당마을', lat: null, lng: null },
    { seq: 3, name: '다은마을(중)', lat: null, lng: null },
    { seq: 4, name: '고속도로(미정차)', lat: null, lng: null },
    { seq: 5, name: '서울시청', lat: null, lng: null },
    { seq: 6, name: '서울역', lat: null, lng: null },
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

  // N61 건대→강남 1분: 직선 3.9km를 1분에 갈 수 없다 → 둘 중 하나는 버리고 보간한다
  it('never keeps both ends of a physically impossible segment', () => {
    const located = [
      { seq: 1, name: '건대입구', lat: 37.5404, lng: 127.0692 },
      { seq: 2, name: '영동대교남단', lat: 37.524, lng: 127.056 },
      { seq: 3, name: '강남역', lat: 37.4979, lng: 127.0276 },
      { seq: 4, name: '신논현역', lat: 37.5045, lng: 127.025 },
    ];
    const cleaned = cleanObservedLast(
      located,
      new Map([
        [1, at('00:50')],
        [2, at('00:55')],
        [3, at('00:56')],
        [4, at('01:10')],
      ]),
      null,
    );
    expect([2, 3].filter((seq) => cleaned.get(seq)?.interpolated === false)).toHaveLength(1);
  });

  it('unfolds night values folded past 04:00 instead of dropping them', () => {
    const cleaned = cleanObservedLast(
      stops,
      new Map([
        [1, at('01:30')],
        [2, at('03:50')],
        [3, at('04:20')],
      ]),
      at('01:30'),
    );
    expect(cleaned.get(3)).toEqual({ lastMinutes: at('04:20') + 24 * 60, interpolated: false });
  });

  // 1162·4300-2: 자정 전에 끝나는 노선의 05시대 lastTm은 첫차 시각이라 다음 날 아침 막차로 펴지 않는다
  it('drops early-morning values of routes that end before midnight', () => {
    const cleaned = cleanObservedLast(
      stops,
      new Map([
        [1, at('23:00')],
        [2, at('23:05')],
        [3, at('05:10')],
      ]),
      at('23:00'),
    );
    expect(cleaned.has(3)).toBe(false);
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
