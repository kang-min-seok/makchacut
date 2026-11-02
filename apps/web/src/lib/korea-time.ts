import { KOREA_TIME_ZONE } from '@makchacut/core';

const clockFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KOREA_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatKoreaClock(isoDateTime: string): string {
  return clockFormatter.format(new Date(isoDateTime));
}
