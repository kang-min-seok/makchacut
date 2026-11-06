import type { z } from 'zod';
import { readStorage, writeStorage } from '@/lib/storage/browser-storage';

// 브라우저 저장소의 JSON 값 하나. 형식이 맞지 않으면 없는 것으로 본다.
export type StoredValue<T> = {
  read: () => T | null;
  write: (value: T | null) => void;
};

export function createStoredValue<T>(key: string, schema: z.ZodType<T>): StoredValue<T> {
  let cachedRaw: string | null = null;
  let cachedValue: T | null = null;

  return {
    read() {
      const raw = readStorage(key);
      if (raw === cachedRaw) return cachedValue;
      cachedRaw = raw;
      cachedValue = parse(raw, schema);
      return cachedValue;
    },
    write(value) {
      writeStorage(key, value === null ? null : JSON.stringify(value));
    },
  };
}

function parse<T>(raw: string | null, schema: z.ZodType<T>): T | null {
  if (raw === null) return null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
