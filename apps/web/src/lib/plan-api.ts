// 웹 /api/plan 프록시와 화면이 함께 쓰는 약속

export const PLAN_API_PATH = '/api/plan';

export const HTTP_STATUS = {
  badRequest: 400,
  unprocessable: 422,
  badGateway: 502,
  serviceUnavailable: 503,
} as const;

// 경로 없음(422)만 따로 안내하고 나머지는 "지금은 계산할 수 없어요"로 묶는다
export const PLAN_ERROR_KINDS = ['no_route', 'unavailable'] as const;
export type PlanErrorKind = (typeof PLAN_ERROR_KINDS)[number];

export function planErrorKindOf(status: number): PlanErrorKind {
  return status === HTTP_STATUS.unprocessable ? 'no_route' : 'unavailable';
}
