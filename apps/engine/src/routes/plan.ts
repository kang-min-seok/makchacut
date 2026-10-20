import { Hono } from 'hono';
import { PlanRequestSchema } from '@makchacut/shared';
import { createDummyPlan } from '#plan/dummy-plan';

export const planRoute = new Hono().post('/', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  }
  return c.json(createDummyPlan(parsed.data));
});
