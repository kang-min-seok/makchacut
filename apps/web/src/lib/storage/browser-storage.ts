// localStorage 읽기·쓰기. 사생활 보호 모드·차단 등으로 실패해도 앱은 계속 동작한다.

const changeListeners = new Set<() => void>();
// 저장에 실패한 값. 이번 방문(같은 탭) 동안은 이 값을 쓴다.
const memoryFallback = new Map<string, string | null>();

export function readStorage(key: string): string | null {
  if (memoryFallback.has(key)) return memoryFallback.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    memoryFallback.delete(key);
  } catch {
    memoryFallback.set(key, value);
  }
  changeListeners.forEach((listener) => listener());
}

// 같은 탭의 쓰기와 다른 탭의 storage 이벤트를 함께 구독한다
export function subscribeStorage(listener: () => void): () => void {
  changeListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    changeListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
