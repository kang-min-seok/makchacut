import { Hono } from 'hono';
import { z } from 'zod';
import type { IngestConfig } from '#config';
import type { RunComputeJob } from '#compute/compute-job';
import { isComputeStep } from '#compute/compute-step';
import type { RunIngestJob } from '#jobs/ingest-job';
import { isIngestSource } from '#jobs/ingesters';

export const CRON_SECRET_HEADER = 'x-cron-secret';

const TARGET_SEPARATOR = ',';

const IngestQuerySchema = z.object({
  maxCalls: z.coerce.number().int().positive().optional(),
  // 쉼표로 구분한 대상 ID. 주면 목록 갱신 없이 그 대상만 받는다.
  targets: z
    .string()
    .transform((value) =>
      value
        .split(TARGET_SEPARATOR)
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .optional(),
});

export type JobsDeps = {
  // 수집 env가 없으면 던진다
  loadConfig: () => IngestConfig;
  runIngest: RunIngestJob;
  runCompute: RunComputeJob;
};

type JobsEnv = { Variables: { config: IngestConfig } };

export function createJobsRoute(deps: JobsDeps) {
  const route = new Hono<JobsEnv>();
  route.use('*', async (c, next) => {
    let config: IngestConfig;
    try {
      config = deps.loadConfig();
    } catch {
      return c.json({ error: 'ingest_not_configured' }, 503);
    }
    if (c.req.header(CRON_SECRET_HEADER) !== config.cronSecret) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    c.set('config', config);
    await next();
  });

  route.post('/compute/:step', async (c) => {
    const step = c.req.param('step');
    if (!isComputeStep(step)) return c.json({ error: 'unknown_step', step }, 400);
    return c.json(await deps.runCompute(c.get('config'), step));
  });

  return route.post('/ingest/:source', async (c) => {
    const config = c.get('config');
    const source = c.req.param('source');
    if (!isIngestSource(source)) return c.json({ error: 'unknown_source', source }, 400);
    const query = IngestQuerySchema.safeParse(c.req.query());
    if (!query.success)
      return c.json({ error: 'invalid_request', issues: query.error.issues }, 400);
    const { maxCalls, targets } = query.data;
    return c.json(await deps.runIngest(config, { source, maxCalls, targetIds: targets }));
  });
}
