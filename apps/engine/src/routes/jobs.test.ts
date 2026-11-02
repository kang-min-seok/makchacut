import { describe, expect, it, vi } from 'vitest';
import type { IngestConfig } from '#config';
import type { RunIngestJob } from '#jobs/ingest-job';
import type { IngestSummary } from '#jobs/run-ingest';
import { CRON_SECRET_HEADER, createJobsRoute } from '#routes/jobs';

const CONFIG: IngestConfig = {
  databaseUrl: 'postgresql://user:pw@localhost:5432/postgres',
  dataGoKrServiceKey: 'data-key',
  seoulOpenDataKey: 'seoul-key',
  cronSecret: 'cron-secret-0123456789',
};

const SUMMARY: IngestSummary = {
  source: 'holiday',
  stoppedBy: 'done',
  listRefreshed: true,
  succeeded: 2,
  failed: 0,
  rowCount: 40,
  apiCalls: 2,
  quotaLeftToday: 98,
  failures: [],
};

function setup(loadConfig: () => IngestConfig = () => CONFIG) {
  const runIngest = vi.fn<RunIngestJob>().mockResolvedValue(SUMMARY);
  const route = createJobsRoute({ loadConfig, runIngest });
  const post = (path: string, secret = CONFIG.cronSecret) =>
    route.request(path, { method: 'POST', headers: { [CRON_SECRET_HEADER]: secret } });
  return { runIngest, post };
}

describe('jobs route', () => {
  it('answers 503 when ingest env is missing', async () => {
    const { post } = setup(() => {
      throw new Error('missing env');
    });
    expect((await post('/ingest/holiday')).status).toBe(503);
  });

  it('rejects a wrong cron secret', async () => {
    const { post, runIngest } = setup();
    expect((await post('/ingest/holiday', 'wrong-secret')).status).toBe(401);
    expect(runIngest).not.toHaveBeenCalled();
  });

  it('rejects an unknown source', async () => {
    const { post } = setup();
    expect((await post('/ingest/kric')).status).toBe(400);
  });

  it('runs the requested source with an optional call cap', async () => {
    const { post, runIngest } = setup();
    const res = await post('/ingest/holiday?maxCalls=3');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(SUMMARY);
    expect(runIngest).toHaveBeenCalledWith(CONFIG, { source: 'holiday', maxCalls: 3 });
  });
});
