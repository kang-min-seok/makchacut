import { cleanObservedLast, type ObservedStop } from '#stop-last/clean-observed';
import { type Confidence, type LastTimeSource, lowerConfidence } from '#stop-last/confidence';
import type { StopLastStop, TravelSpeeds } from '#stop-last/cumulative-seconds';
import { estimateFromSchedule } from '#stop-last/estimate-from-schedule';
import { type DaySchedule, usableSchedule } from '#stop-last/schedule-rules';
import { DAY_TYPES, type DayType } from '#time/day-type';
import { unfoldServiceMinutes } from '#time/service-day';
import { isPassingStop } from '#transit/passing-stop';

export type ByDayType<T> = Partial<Record<DayType, T>>;

// 서울 API 정류장별 막차(lastTm) 원본. 서울 노선 자신이거나, 서울을 지나는 경기 노선의 서울 쪽 노선이다.
export type SeoulObservation = {
  stops: readonly ObservedStop[];
  // 수집일의 요일 유형으로 저장된 seq → 분
  observed: ByDayType<ReadonlyMap<number, number>>;
  // 그 요일의 서울 기점 막차. 이보다 이른 lastTm은 버린다.
  lastAtOrigin: ByDayType<number | null>;
  // 서울 노선 seq → 계산 대상 노선 seq
  seqMap: ReadonlyMap<number, number>;
};

export type RouteStopLastInput = {
  // 심야 노선 판정용 (N61 등)
  routeName: string;
  stops: readonly StopLastStop[];
  schedules: ByDayType<DaySchedule>;
  // true(서울 노선): 공휴일 시간표·관측이 없으면 일요일 값을 쓰고 confidence를 낮춘다.
  // 그 밖의 요일은 서울·경기 모두 그 요일 시간표가 없으면 운행하지 않는다로 본다 (다른 요일 값을 빌리지 않는다).
  holidayFromSunday: boolean;
  seoul?: SeoulObservation;
  speeds?: TravelSpeeds;
};

export type StopLastRow = {
  seq: number;
  dayType: DayType;
  lastMinutes: number;
  source: LastTimeSource;
  confidence: Confidence;
};

// 서울 시내버스는 공휴일에 일요일 시간표로 운행한다. 서울 API는 공휴일 값을 거의 주지 않는다.
const HOLIDAY_SOURCE_DAY: DayType = 'sun';

function sourceDayOf(input: RouteStopLastInput, dayType: DayType): DayType {
  const borrow =
    input.holidayFromSunday && dayType === 'holiday' && input.schedules.holiday === undefined;
  return borrow ? HOLIDAY_SOURCE_DAY : dayType;
}

function laterOf(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  return b === null ? a : Math.max(a, b);
}

// 예약(출근) 노선은 시간표 API가 모체 노선 시간표(05:00~23:50)를 그대로 주기도 한다 — 1550-1(예약)·M4108(예약) 등
const RESERVED_ROUTE_NAME = /\(예약\)/;
// 그 요일 관측 막차가 모두 기점 막차보다 이만큼 넘게 이르면 시간표가 틀렸다고 본다 (관측 08~11시 vs 시간표 23시)
const OBSERVATION_GAP_MINUTES = 3 * 60;

function contradictedByObservation(
  routeName: string,
  lastAtOrigin: number | null,
  observed: ReadonlyMap<number, number> | undefined,
): boolean {
  if (!RESERVED_ROUTE_NAME.test(routeName) || lastAtOrigin === null || !observed?.size) {
    return false;
  }
  const latest = Math.max(
    ...[...observed.values()].map((minutes) => unfoldServiceMinutes(minutes, lastAtOrigin)),
  );
  return latest < lastAtOrigin - OBSERVATION_GAP_MINUTES;
}

function rowsForDay(input: RouteStopLastInput, dayType: DayType): StopLastRow[] {
  const sourceDay = sourceDayOf(input, dayType);
  const borrowed = sourceDay !== dayType;
  const daySchedule = input.schedules[sourceDay];
  const schedule = daySchedule && usableSchedule(input.routeName, daySchedule);
  if (!schedule) return [];
  if (
    contradictedByObservation(
      input.routeName,
      schedule.lastAtOrigin,
      input.seoul?.observed[sourceDay],
    )
  ) {
    return [];
  }

  const byTargetSeq = new Map<number, StopLastRow>();
  for (const [seq, value] of estimateFromSchedule(input.stops, schedule, input.speeds)) {
    const confidence = borrowed ? lowerConfidence(value.confidence) : value.confidence;
    byTargetSeq.set(seq, { seq, dayType, ...value, confidence });
  }

  // 그 요일 관측값만 쓴다 — 평일 값을 주말에 빌리면 8501 토요일이 강남 00:31(실제 23:30)이 된다
  const observed = input.seoul?.observed[sourceDay];
  if (input.seoul && observed) {
    const passing = new Set(input.stops.filter((s) => isPassingStop(s.name)).map((s) => s.seq));
    // 어느 정류장 막차도 기점 막차보다 이를 수 없다 — 서울 쪽 기점 막차가 더 이르면(4108 일 21:20) 계산 대상 노선의 기점 막차로
    const lowerBound = laterOf(input.seoul.lastAtOrigin[sourceDay] ?? null, schedule.lastAtOrigin);
    const cleaned = cleanObservedLast(input.seoul.stops, observed, lowerBound);
    for (const [seoulSeq, value] of cleaned) {
      const seq = input.seoul.seqMap.get(seoulSeq);
      if (seq === undefined || passing.has(seq)) continue;
      const steps = (value.interpolated ? 1 : 0) + (borrowed ? 1 : 0);
      byTargetSeq.set(seq, {
        seq,
        dayType,
        lastMinutes: value.lastMinutes,
        source: 'seoul_api',
        confidence: lowerConfidence('high', steps),
      });
    }
  }
  return [...byTargetSeq.values()].sort((a, b) => a.seq - b.seq);
}

// 노선 하나의 요일 유형별 정류장 막차. 우선순위는 서울 API > gbis_eta > distance (ADR 4항).
export function computeRouteStopLast(input: RouteStopLastInput): StopLastRow[] {
  return DAY_TYPES.flatMap((dayType) => rowsForDay(input, dayType));
}
