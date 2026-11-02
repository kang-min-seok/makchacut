import { type Confidence, type LastTimeSource, lowerConfidence } from '#stop-last/confidence';
import {
  cumulativeSeconds,
  DEFAULT_TRAVEL_SPEEDS,
  type StopLastStop,
  type TravelSpeeds,
} from '#stop-last/cumulative-seconds';
import { isPassingStop } from '#transit/passing-stop';

export type ScheduleLast = {
  // 기점 막차·회차점 막차 (서비스 일자 기준 분)
  lastAtOrigin: number | null;
  lastAtTurn: number | null;
};

export type StopLastValue = {
  lastMinutes: number;
  source: LastTimeSource;
  confidence: Confidence;
};

const SECONDS_PER_MINUTE = 60;
// 시간표 값 그대로인 기점·회차점
const EXACT_CONFIDENCE: Confidence = 'high';
const BASE_CONFIDENCE: Record<'gbis_eta' | 'distance', Confidence> = {
  gbis_eta: 'medium',
  distance: 'low',
};

// 회차점 = 마지막 outbound 정류장. 그 뒤에 inbound가 없으면 회차 없는 노선으로 본다.
function turnIndexOf(stops: readonly StopLastStop[]): number {
  const firstInbound = stops.findIndex((stop) => stop.direction === 'inbound');
  return firstInbound > 0 ? firstInbound - 1 : -1;
}

// 기점·회차점 막차와 구간 소요로 정류장별 막차를 추정한다 (ADR 3항).
// - 회차 후: 회차점 막차 + 회차점부터 누적
// - 회차 전: 기점 막차 + 기점부터 누적. 회차점 막차를 넘으면 비율 r로 줄이고 confidence 한 단계↓
// - 기점 막차가 없거나 회차점 막차보다 늦으면 회차 전은 회차점 막차에서 거꾸로 뺀다 (1551)
// 통과 정류장((경유) 등)은 탈 수 없어 결과에서 뺀다.
export function estimateFromSchedule(
  stops: readonly StopLastStop[],
  schedule: ScheduleLast,
  speeds: TravelSpeeds = DEFAULT_TRAVEL_SPEEDS,
): Map<number, StopLastValue> {
  const result = new Map<number, StopLastValue>();
  const { source, seconds } = cumulativeSeconds(stops, speeds);
  const base = BASE_CONFIDENCE[source];
  const lowered = lowerConfidence(base);
  const turnIndex = turnIndexOf(stops);
  const origin = schedule.lastAtOrigin;
  const turn = turnIndex >= 0 ? schedule.lastAtTurn : null;
  const originValid = origin !== null && (turn === null || origin <= turn);
  const toTurn = turnIndex >= 0 ? seconds[turnIndex] : undefined;
  const minutesAt = (index: number) => {
    const s = seconds[index];
    return s === undefined ? undefined : s / SECONDS_PER_MINUTE;
  };
  const turnMinutes = toTurn === undefined ? undefined : toTurn / SECONDS_PER_MINUTE;
  // 기점 막차 + 누적이 회차점 막차를 넘을 때만 축소한다(r < 1)
  const ratio =
    originValid && origin !== null && turn !== null && turnMinutes !== undefined && turnMinutes > 0
      ? Math.min((turn - origin) / turnMinutes, 1)
      : 1;

  const estimate = (index: number): { minutes: number; confidence: Confidence } | undefined => {
    const elapsed = minutesAt(index);
    if (turn !== null && index === turnIndex)
      return { minutes: turn, confidence: EXACT_CONFIDENCE };
    if (index === 0 && originValid && origin !== null) {
      return { minutes: origin, confidence: EXACT_CONFIDENCE };
    }
    if (elapsed === undefined) return undefined;
    if (turnIndex >= 0 && index > turnIndex) {
      if (turn !== null && turnMinutes !== undefined) {
        return { minutes: turn + elapsed - turnMinutes, confidence: base };
      }
      return originValid && origin !== null
        ? { minutes: origin + elapsed, confidence: lowered }
        : undefined;
    }
    if (originValid && origin !== null) {
      return ratio < 1
        ? { minutes: origin + elapsed * ratio, confidence: lowered }
        : { minutes: origin + elapsed, confidence: base };
    }
    if (turn !== null && turnMinutes !== undefined) {
      return { minutes: turn - (turnMinutes - elapsed), confidence: lowered };
    }
    return undefined;
  };

  stops.forEach((stop, index) => {
    if (isPassingStop(stop.name)) return;
    const value = estimate(index);
    if (value) {
      result.set(stop.seq, { lastMinutes: value.minutes, source, confidence: value.confidence });
    }
  });
  return result;
}
