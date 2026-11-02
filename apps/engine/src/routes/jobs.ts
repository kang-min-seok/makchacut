import { Hono } from 'hono';
import { z } from 'zod';
import type { IngestConfig } from '#config';
import type { RunIngestJob } from '#jobs/ingest-job';
import { isIngestSource } from '#jobs/ingesters';

export const CRON_SECRET_HEADER = 'x-cron-secret';

const IngestQuerySchema = z.object({
  maxCalls: z.coerce.number().int().positive().optional(),
});

export type JobsDeps = {
  // 수집 env가 없으면 던진다
  loadConfig: () => IngestConfig;
  runIngest: RunIngestJob;
};

export function createJobsRoute(deps: JobsDeps) {
  return new Hono().post('/ingest/:source', async (c) => {
    let config: IngestConfig;
    try {
      config = deps.loadConfig();
    } catch {
      return c.json({ error: 'ingest_not_configured' }, 503);
    }
    if (c.req.header(CRON_SECRET_HEADER) !== config.cronSecret) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const source = c.req.param('source');
    if (!isIngestSource(source)) return c.json({ error: 'unknown_source', source }, 400);
    const query = IngestQuerySchema.safeParse(c.req.query());
    if (!query.success)
      return c.json({ error: 'invalid_request', issues: query.error.issues }, 400);
    return c.json(await deps.runIngest(config, { source, maxCalls: query.data.maxCalls }));
  });
}
