import { PlanRequestSchema } from '@makchacut/shared';
import { HTTP_STATUS } from '@/lib/plan-api';
import { requestPlan } from '@/server/engine-client';

// 엔진의 422(경로 없음)·503(그래프 준비 안 됨)은 그대로, 그 밖의 실패는 502로 돌려준다
const PASSED_THROUGH = new Set<number>([HTTP_STATUS.unprocessable, HTTP_STATUS.serviceUnavailable]);

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_request' }, { status: HTTP_STATUS.badRequest });
  }

  try {
    const result = await requestPlan(parsed.data);
    if (result.ok) return Response.json(result.plan);
    const status = PASSED_THROUGH.has(result.status) ? result.status : HTTP_STATUS.badGateway;
    return Response.json({ error: result.error }, { status });
  } catch (error) {
    console.error('plan proxy failed', error);
    return Response.json({ error: 'engine_unavailable' }, { status: HTTP_STATUS.badGateway });
  }
}
