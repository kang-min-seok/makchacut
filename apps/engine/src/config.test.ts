import { describe, expect, it } from 'vitest';
import { loadConfig, loadIngestConfig } from '#config';

const BASE_ENV = { ENGINE_API_KEY: 'test-key-0123456789' };
const INGEST_ENV = {
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/postgres',
  DATA_GO_KR_SERVICE_KEY: 'data-key',
  SEOUL_OPEN_DATA_KEY: 'seoul-key',
  INGEST_CRON_SECRET: 'cron-secret-0123456789',
};

describe('config', () => {
  it('loads the plan config without ingest env', () => {
    expect(loadConfig(BASE_ENV).apiKey).toBe(BASE_ENV.ENGINE_API_KEY);
  });

  it('requires ingest env only when the ingest config is loaded', () => {
    expect(() => loadIngestConfig(BASE_ENV)).toThrow();
    expect(loadIngestConfig({ ...BASE_ENV, ...INGEST_ENV }).cronSecret).toBe(
      INGEST_ENV.INGEST_CRON_SECRET,
    );
  });

  it('rejects a REST URL as DATABASE_URL', () => {
    expect(() =>
      loadIngestConfig({ ...INGEST_ENV, DATABASE_URL: 'https://ref.supabase.co' }),
    ).toThrow();
  });
});
