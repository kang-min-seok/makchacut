// 서비스 일자 기준 분 → 그 날짜 기준 +09:00 ISO 시각

import { MINUTES_PER_DAY } from '@makchacut/core';

const KST_OFFSET = '+09:00';
const MINUTES_PER_HOUR = 60;

const pad = (value: number) => String(value).padStart(2, '0');

// 경로 안 시각은 반올림(앞뒤 구간 순서가 뒤집히지 않게), 마감은 내림(늦게 알려 주지 않게)
export function serviceMinutesToIso(
  date: string,
  minutes: number,
  round: (value: number) => number = Math.round,
): string {
  const whole = round(minutes);
  const dayOffset = Math.floor(whole / MINUTES_PER_DAY);
  const inDay = whole - dayOffset * MINUTES_PER_DAY;
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + dayOffset);
  const ymd = day.toISOString().slice(0, 10);
  const clock = `${pad(Math.floor(inDay / MINUTES_PER_HOUR))}:${pad(inDay % MINUTES_PER_HOUR)}`;
  return `${ymd}T${clock}:00${KST_OFFSET}`;
}
