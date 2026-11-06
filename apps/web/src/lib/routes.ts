export const HOME_PATH = '/';
export const HOME_REGISTER_PATH = '/home';
export const PLAN_PATH = '/plan';
export const PLAN_DETAIL_PATH = '/plan/detail';
export const SETTINGS_PATH = '/settings';

// 집 등록 뒤 돌아갈 곳. 앱 안 경로만 허용한다(외부 주소로 보내지 않게).
export const NEXT_PARAM = 'next';

// 브라우저처럼 해석해 본다(역슬래시·탭 등으로 외부 주소가 되는 입력을 걸러 낸다). 실제 origin과 무관한 기준값이다.
const PATH_BASE = 'https://makchacut.invalid';

export function safeNextPath(value: string | null): string {
  if (!value?.startsWith('/')) return HOME_PATH;
  try {
    const url = new URL(value, PATH_BASE);
    return url.origin === PATH_BASE ? `${url.pathname}${url.search}${url.hash}` : HOME_PATH;
  } catch {
    return HOME_PATH;
  }
}

export function homeRegisterHref(next: string): string {
  return `${HOME_REGISTER_PATH}?${new URLSearchParams({ [NEXT_PARAM]: next }).toString()}`;
}
