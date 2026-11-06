'use client';

import { serviceDateInKorea } from '@makchacut/core';
import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

// 운행 기준 오늘 날짜. 서버 렌더링(미리 만든 HTML)에는 날짜를 넣지 않는다.
export function useServiceToday(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => serviceDateInKorea(),
    () => null,
  );
}
