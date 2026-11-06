import { dayTypeOf, KOREA_TIME_ZONE } from '@makchacut/core';
import type { PlanDayType } from '@makchacut/shared';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const clockFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KOREA_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatKoreaClock(isoDateTime: string): string {
  return clockFormatter.format(new Date(isoDateTime));
}

const utcDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

export function weekdayOf(isoDate: string): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[utcDate(isoDate).getUTCDay()]!;
}

export function dayOfMonth(isoDate: string): number {
  return utcDate(isoDate).getUTCDate();
}

export function monthOf(isoDate: string): number {
  return utcDate(isoDate).getUTCMonth() + 1;
}

// "11월 6일 (금)"
export function formatDateLabel(isoDate: string): string {
  return `${monthOf(isoDate)}월 ${dayOfMonth(isoDate)}일 (${weekdayOf(isoDate)})`;
}

export const DAY_TYPE_LABELS: Readonly<Record<PlanDayType, string>> = {
  weekday: '평일',
  sat: '토요일',
  sun: '일요일',
  holiday: '공휴일',
};

// 공휴일은 엔진 응답에서야 알 수 있어 요일로만 짐작한다
export function guessDayType(isoDate: string): PlanDayType {
  return dayTypeOf(isoDate, new Set());
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / MS_PER_MINUTE);
}

// 남은 시간(분, 내림)
export function minutesUntil(isoDateTime: string, now: Date): number {
  return Math.floor((Date.parse(isoDateTime) - now.getTime()) / MS_PER_MINUTE);
}

// "1시간 12분", "25분", "2시간"
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}
