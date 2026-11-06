import { Hono } from 'hono';
import { ENGINE_PLAN_PATH } from '@makchacut/shared';
import { type EngineConfig, loadIngestConfig } from '#config';
import { runComputeJob } from '#compute/compute-job';
import { runIngestJob } from '#jobs/ingest-job';
import { requireApiKey } from '#middleware/require-api-key';
import { createJobsRoute, type JobsDeps } from '#routes/jobs';
import type { Planner } from '#plan/planner';
import { createPlanRoute } from '#routes/plan';

const JOBS_PATH = '/jobs';
const DEFAULT_JOBS_DEPS: JobsDeps = {
  loadConfig: () => loadIngestConfig(),
  runIngest: runIngestJob,
  runCompute: runComputeJob,
};

export function createApp(
  config: Pick<EngineConfig, 'apiKey'>,
  planner: Planner | undefined,
  jobs: JobsDeps = DEFAULT_JOBS_DEPS,
) {
  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.use(`${ENGINE_PLAN_PATH}/*`, requireApiKey(config.apiKey));
  app.route(ENGINE_PLAN_PATH, createPlanRoute(planner));
  app.route(JOBS_PATH, createJobsRoute(jobs));
  return app;
}
