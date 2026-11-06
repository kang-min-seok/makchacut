'use client';

import { useSyncExternalStore } from 'react';
import { subscribeStorage } from '@/lib/storage/browser-storage';
import type { StoredValue } from '@/lib/storage/stored-value';

// 서버 렌더링과 첫 하이드레이션 동안은 아직 읽지 않은 상태
export const NOT_LOADED = Symbol('not-loaded');

export function useStoredValue<T>(stored: StoredValue<T>): T | null | typeof NOT_LOADED {
  return useSyncExternalStore<T | null | typeof NOT_LOADED>(
    subscribeStorage,
    stored.read,
    () => NOT_LOADED,
  );
}
