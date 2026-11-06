import type { Db } from '@makchacut/db';

export const COMPUTE_STEPS = [
  'subway-coords',
  'merge-stops',
  'stop-last',
  'footpath',
  'graph-snapshot',
] as const;
export type ComputeStep = (typeof COMPUTE_STEPS)[number];

export type ComputeKeys = {
  seoulOpenData: string;
  // 없으면 지하철 역 좌표 보완을 건너뛴다
  kakaoRest: string | undefined;
};

export type ComputeContext = {
  db: Db;
  keys: ComputeKeys;
  // 이 시각이 지나면 외부 호출을 멈춘다
  deadline: number;
};

export type ComputeResult = {
  rowCount: number;
  apiCalls: number;
  // 변경량 급증·ptts 대체 비율 등. 로그와 ingest_run.error_message에 남긴다.
  warnings: string[];
  details: Record<string, number>;
};

export type ComputeStepRunner = (ctx: ComputeContext) => Promise<ComputeResult>;

export function isComputeStep(value: string): value is ComputeStep {
  return (COMPUTE_STEPS as readonly string[]).includes(value);
}
