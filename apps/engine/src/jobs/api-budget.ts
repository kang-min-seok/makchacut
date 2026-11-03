import { withRetry } from '#jobs/retry';

const RETRY_ATTEMPTS = 3;
const SINGLE_ATTEMPT = 1;
const RETRY_DELAY_MS = 1_000;
const ALWAYS_RETRY = () => true;

export class QuotaExhaustedError extends Error {
  constructor() {
    super('오늘 호출 한도를 다 썼습니다');
  }
}

// 한 실행에서 쓸 수 있는 외부 API 호출 수. 재시도도 한 번의 호출로 센다.
export class ApiBudget {
  #used = 0;

  // retryAllowed가 false면 실패해도 다시 부르지 않는다(원천 장애 중 한도 절약)
  constructor(
    private readonly limit: number,
    private readonly retryAllowed: () => boolean = ALWAYS_RETRY,
  ) {}

  get used(): number {
    return this.#used;
  }

  get remaining(): number {
    return Math.max(this.limit - this.#used, 0);
  }

  call<T>(request: () => Promise<T>): Promise<T> {
    return withRetry(
      () => {
        if (this.#used >= this.limit) throw new QuotaExhaustedError();
        this.#used += 1;
        return request();
      },
      {
        attempts: this.retryAllowed() ? RETRY_ATTEMPTS : SINGLE_ATTEMPT,
        delayMs: RETRY_DELAY_MS,
        isRetryable: (error) => !(error instanceof QuotaExhaustedError),
      },
    );
  }
}
