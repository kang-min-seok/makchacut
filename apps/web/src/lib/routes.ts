export const HOME_PATH = '/';
export const HOME_REGISTER_PATH = '/home';
export const PLAN_PATH = '/plan';
export const PLAN_DETAIL_PATH = '/plan/detail';
export const SETTINGS_PATH = '/settings';

// 집 등록 뒤 돌아갈 곳. 앱 안 경로만 허용한다(외부 주소로 보내지 않게).
export const NEXT_PARAM = 'next';

export function safeNextPath(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : HOME_PATH;
}

export function homeRegisterHref(next: string): string {
  return `${HOME_REGISTER_PATH}?${new URLSearchParams({ [NEXT_PARAM]: next }).toString()}`;
}
