import { Hono } from 'hono';
import { PlanRequestSchema } from '@makchacut/shared';
import type { Planner } from '#plan/planner';

const UNPROCESSABLE = 422;
const SERVICE_UNAVAILABLE = 503;

// planner가 없으면(DATABASE_URL 없는 Preview 등) 503
export function createPlanRoute(planner: Planner | undefined) {
  return new Hono().post('/', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = PlanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
    }
    if (!planner) return c.json({ error: 'engine_unavailable' }, SERVICE_UNAVAILABLE);
    const outcome = await planner(parsed.data);
    if (outcome.kind === 'no_graph') {
      return c.json({ error: 'graph_not_ready' }, SERVICE_UNAVAILABLE);
    }
    if (outcome.kind === 'no_route') return c.json({ error: 'no_route' }, UNPROCESSABLE);
    return c.json(outcome.response);
  });
}
