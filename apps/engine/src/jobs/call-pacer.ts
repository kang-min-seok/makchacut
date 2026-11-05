// 외부 호출 사이에 최소 간격을 둔다. 짧은 시간에 몰아 부르면 막는 원천(GBIS 웹)용.
export class CallPacer {
  #nextAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  // 기다리기 전에 자리를 먼저 잡아 동시에 불려도 간격이 지켜진다
  async wait(): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.#nextAt);
    this.#nextAt = at + this.minIntervalMs;
    if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
  }
}
