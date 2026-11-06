import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readStorage, writeStorage } from '@/lib/storage/browser-storage';

const KEY = 'test:key';

function createLocalStorage(failWrites: () => boolean) {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites()) throw new Error('QuotaExceededError');
      items.set(key, value);
    },
    removeItem: (key: string) => {
      if (failWrites()) throw new Error('SecurityError');
      items.delete(key);
    },
  };
}

describe('browser storage', () => {
  let failing = false;

  beforeEach(() => {
    failing = false;
    vi.stubGlobal('window', { localStorage: createLocalStorage(() => failing) });
  });

  afterEach(() => {
    writeStorage(KEY, null);
    vi.unstubAllGlobals();
  });

  it('reads back what it saved', () => {
    writeStorage(KEY, 'a');
    expect(readStorage(KEY)).toBe('a');
    writeStorage(KEY, null);
    expect(readStorage(KEY)).toBeNull();
  });

  it('keeps the value for this visit when saving fails', () => {
    writeStorage(KEY, 'a');
    failing = true;
    writeStorage(KEY, 'b');
    expect(readStorage(KEY)).toBe('b');
    writeStorage(KEY, null);
    expect(readStorage(KEY)).toBeNull();
  });

  it('goes back to localStorage once saving works again', () => {
    failing = true;
    writeStorage(KEY, 'a');
    failing = false;
    writeStorage(KEY, 'b');
    expect(readStorage(KEY)).toBe('b');
    expect(window.localStorage.getItem(KEY)).toBe('b');
  });
});
