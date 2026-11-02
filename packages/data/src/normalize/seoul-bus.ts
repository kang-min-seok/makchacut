import { toServiceMinutes } from '@makchacut/core';

const TIMESTAMP_PATTERN = /^\d{8}(\d{4})\d{2}$/;

// 서울 버스 "YYYYMMDDHHMMSS"의 시각 부분 → 서비스 일자 기준 분
export function seoulTimestampMinutes(timestamp: string): number | undefined {
  const match = TIMESTAMP_PATTERN.exec(timestamp.trim());
  return match?.[1] ? toServiceMinutes(match[1]) : undefined;
}
