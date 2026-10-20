import { Hono } from 'hono';
import { ENGINE_PLAN_PATH } from '@makchacut/shared';
import type { EngineConfig } from '#config';
import { requireApiKey } from '#middleware/require-api-key';
import { planRoute } from '#routes/plan';

export function createApp(config: Pick<EngineConfig, 'apiKey'>) {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.use(`${ENGINE_PLAN_PATH}/*`, requireApiKey(config.apiKey));
  app.route(ENGINE_PLAN_PATH, planRoute);
  return app;
}
