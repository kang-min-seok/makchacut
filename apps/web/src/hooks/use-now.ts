'use client';

import { useEffect, useState } from 'react';

const TICK_MS = 30_000;

// 남은 시간 표시용 현재 시각. 30초마다 갱신한다.
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
