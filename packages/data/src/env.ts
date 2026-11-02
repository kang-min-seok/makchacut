import { existsSync } from 'node:fs';

const ENV_FILE = '.env';

export const DATA_KEY_NAMES = [
  'DATA_GO_KR_SERVICE_KEY',
  'SEOUL_OPEN_DATA_KEY',
  'KAKAO_REST_API_KEY',
] as const;

export type DataKeyName = (typeof DATA_KEY_NAMES)[number];
export type DataKeys = Partial<Record<DataKeyName, string>>;

// data.go.kr은 Encoding/Decoding 키를 함께 준다. 요청 시 URLSearchParams가 인코딩하므로
// Encoding 키(%2B 등 포함)가 들어오면 Decoding 형태로 되돌려 이중 인코딩을 막는다.
function toDecodedKey(value: string): string {
  return value.includes('%') ? decodeURIComponent(value) : value;
}

export function loadDataKeys(env: NodeJS.ProcessEnv = process.env): DataKeys {
  if (env === process.env && existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  const keys: DataKeys = {};
  for (const name of DATA_KEY_NAMES) {
    const value = env[name]?.trim();
    if (value) keys[name] = name === 'DATA_GO_KR_SERVICE_KEY' ? toDecodedKey(value) : value;
  }
  return keys;
}
