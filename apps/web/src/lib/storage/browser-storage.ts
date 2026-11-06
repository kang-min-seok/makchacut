// localStorage 읽기·쓰기. 사생활 보호 모드·차단 등으로 실패해도 앱은 계속 동작한다.

const changeListeners = new Set<() => void>();

export function readStorage(key: string): string | null {
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
  } catch {
    // 저장 실패는 무시한다(이번 방문 동안만 유지되지 않을 뿐)
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
