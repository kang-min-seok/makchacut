import { DAY_TYPES, type DayType } from '#time/day-type';
import { cleanObservedLast, type ObservedStop } from '#stop-last/clean-observed';
import { type Confidence, type LastTimeSource, lowerConfidence } from '#stop-last/confidence';
import type { StopLastStop, TravelSpeeds } from '#stop-last/cumulative-seconds';
import { estimateFromSchedule, type ScheduleLast } from '#stop-last/estimate-from-schedule';
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
  stops: readonly StopLastStop[];
  schedules: ByDayType<ScheduleLast>;
  // true(서울 노선): 그 요일 시간표가 없으면 평일 값을 쓰고 confidence를 낮춘다.
  // false(경기 노선): 4요일 시간표가 다 있으므로, 없거나 비어 있으면 그 요일은 운행하지 않는다.
  scheduleFallback: boolean;
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

type Picked<T> = { value: T; dayType: DayType; exact: boolean };

// 그 요일 값, 없으면 평일 값, 그것도 없으면 아무 요일 값 (결정 사항 2)
function pickDay<T>(byDay: ByDayType<T>, dayType: DayType): Picked<T> | undefined {
  const exact = byDay[dayType];
  if (exact !== undefined) return { value: exact, dayType, exact: true };
  for (const candidate of ['weekday', ...DAY_TYPES] as const) {
    const value = byDay[candidate];
    if (value !== undefined) return { value, dayType: candidate, exact: false };
  }
  return undefined;
}

const runs = (schedule: ScheduleLast) =>
  schedule.lastAtOrigin !== null || schedule.lastAtTurn !== null;

function rowsForDay(input: RouteStopLastInput, dayType: DayType): StopLastRow[] {
  const schedule = input.scheduleFallback
    ? pickDay(input.schedules, dayType)
    : input.schedules[dayType] && { value: input.schedules[dayType], dayType, exact: true };
  if (!input.scheduleFallback && (!schedule || !runs(schedule.value))) return [];

  const byTargetSeq = new Map<number, StopLastRow>();
  if (schedule) {
    for (const [seq, value] of estimateFromSchedule(input.stops, schedule.value, input.speeds)) {
      const confidence = schedule.exact ? value.confidence : lowerConfidence(value.confidence);
      byTargetSeq.set(seq, { seq, dayType, ...value, confidence });
    }
  }

  const observed = input.seoul && pickDay(input.seoul.observed, dayType);
  if (input.seoul && observed) {
    const passing = new Set(input.stops.filter((s) => isPassingStop(s.name)).map((s) => s.seq));
    const lowerBound = input.seoul.lastAtOrigin[observed.dayType] ?? null;
    const cleaned = cleanObservedLast(input.seoul.stops, observed.value, lowerBound);
    for (const [seoulSeq, value] of cleaned) {
      const seq = input.seoul.seqMap.get(seoulSeq);
      if (seq === undefined || passing.has(seq)) continue;
      // 그 요일 관측값이 아니면(평일 값 대체) 요일별 시간표 추정이 있을 때 추정을 쓴다 (8501 토·일)
      if (!observed.exact && byTargetSeq.has(seq)) continue;
      const steps = (value.interpolated ? 1 : 0) + (observed.exact ? 0 : 1);
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
