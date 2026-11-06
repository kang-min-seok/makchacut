import { SERVICE_DAY_CUTOFF_MINUTES } from '#time/service-day';

export const KOREA_TIME_ZONE = 'Asia/Seoul';

const MS_PER_MINUTE = 60_000;

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KOREA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// 한국 시각 기준 오늘 날짜 "YYYY-MM-DD"
export function todayInKorea(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

// 운행 기준 오늘 날짜. 새벽 4시 전은 전날 운행으로 본다(토 00:30 → 금요일).
export function serviceDateInKorea(now: Date = new Date()): string {
  return todayInKorea(new Date(now.getTime() - SERVICE_DAY_CUTOFF_MINUTES * MS_PER_MINUTE));
}

// "YYYY-MM-DD"에 날짜 수를 더한다
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
