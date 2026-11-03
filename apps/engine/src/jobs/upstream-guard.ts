// 대상이 연달아 이만큼 실패하면 원천 API 장애로 보고 실행을 멈춘다
export const UPSTREAM_FAILURE_LIMIT = 5;
// ingest_run.error_message 맨 앞에 두어 같은 날 다음 회차가 알아보게 한다
export const UPSTREAM_STOP_MARKER = '원천 API 연속 실패로 중단';
// 직전 회차가 원천 장애로 멈췄으면 첫 성공 전까지는 이만큼만 실패해도 멈춘다(시험 호출)
const PROBE_FAILURE_LIMIT = 1;

export type UpstreamGuardOptions = {
  probing: boolean;
  limit?: number;
};

export function isUpstreamStopMessage(message: string | null | undefined): boolean {
  return message?.startsWith(UPSTREAM_STOP_MARKER) ?? false;
}

export function upstreamStopMessage(streak: number): string {
  return `${UPSTREAM_STOP_MARKER} (연속 ${streak}건)`;
}

// 대상 결과를 차례로 받아 원천 장애로 보고 멈출지, 실패 중이라 재시도를 아낄지 판단한다
export class UpstreamGuard {
  #streak = 0;
  #probing: boolean;
  readonly #limit: number;

  constructor(options: UpstreamGuardOptions) {
    this.#probing = options.probing;
    this.#limit = options.limit ?? UPSTREAM_FAILURE_LIMIT;
  }

  get streak(): number {
    return this.#streak;
  }

  get tripped(): boolean {
    return this.#streak >= (this.#probing ? PROBE_FAILURE_LIMIT : this.#limit);
  }

  // 실패가 이어지는 동안에는 대상마다 한 번만 부른다
  get allowsRetry(): boolean {
    return this.#streak === 0;
  }

  recordSuccess(): void {
    this.#streak = 0;
    this.#probing = false;
  }

  recordFailure(): void {
    this.#streak += 1;
  }
}
