// HTTP 오류 응답 본문 앞부분을 메시지에 남겨 점검 안내 페이지인지, 차단 응답인지 나중에 구분한다
const BODY_PREVIEW_LENGTH = 160;
const REDACTED = '***';
// 응답 본문이 요청 URL을 그대로 보여 줄 때 섞이는 키 파라미터
const KEY_PARAM = /\b(service_?key|api_?key|key)=[^&\s"'<>]*/gi;
const SCRIPT_OR_STYLE = /<(script|style)\b[\s\S]*?<\/\1>/gi;
const TAG = /<[^>]*>/g;
const WHITESPACE = /\s+/g;

function redact(text: string, secrets: readonly string[]): string {
  const masked = text.replace(KEY_PARAM, (_, name: string) => `${name}=${REDACTED}`);
  return secrets
    .filter((secret) => secret.length > 0)
    .flatMap((secret) => [secret, encodeURIComponent(secret)])
    .reduce((acc, secret) => acc.split(secret).join(REDACTED), masked);
}

// HTML이면 태그를 걷어 내고, 공백을 줄이고, 키를 가린 뒤 앞부분만 남긴다
export function previewBody(body: string, secrets: readonly string[] = []): string {
  const plain = body
    .replace(SCRIPT_OR_STYLE, ' ')
    .replace(TAG, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
  return redact(plain, secrets).slice(0, BODY_PREVIEW_LENGTH);
}

export async function httpError(
  label: string,
  res: Response,
  secrets: readonly string[] = [],
): Promise<Error> {
  const body = await res.text().catch(() => '');
  const preview = previewBody(body, secrets);
  return new Error(`${label} HTTP ${res.status}${preview ? `: ${preview}` : ''}`);
}
