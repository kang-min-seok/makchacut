export type RetryOptions = {
  attempts: number;
  delayMs: number;
  // false를 돌려주는 오류는 바로 던진다
  isRetryable: (error: unknown) => boolean;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 실패하면 delayMs × 시도 횟수만큼 기다렸다 다시 부른다
export async function withRetry<T>(request: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (!options.isRetryable(error) || attempt === options.attempts) break;
      await wait(options.delayMs * attempt);
    }
  }
  throw lastError;
}
