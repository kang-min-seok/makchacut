import type { TimeSource } from '#graph/transit-graph';
import type { Confidence } from '#stop-last/confidence';

// 빌더가 다듬는 운행의 정차 하나 (시각은 서비스 일자 기준 분)
export type TimedStop = {
  stop: number;
  arrival: number;
  departure: number;
  // 타는 시각에서 뺄 여유(분). 시각 보정 뒤 출발에만 적용한다.
  boardMargin: number;
  source: TimeSource;
  confidence: Confidence;
};
