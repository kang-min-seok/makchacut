import { PlanRequestSchema } from '@makchacut/shared';
import { requestPlan } from '@/server/engine-client';

const BAD_REQUEST = 400;
const BAD_GATEWAY = 502;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_request' }, { status: BAD_REQUEST });
  }

  try {
    return Response.json(await requestPlan(parsed.data));
  } catch (error) {
    console.error('plan proxy failed', error);
    return Response.json({ error: 'engine_unavailable' }, { status: BAD_GATEWAY });
  }
}
