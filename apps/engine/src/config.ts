import { z } from 'zod';

const DEFAULT_PORT = 8080;
const MIN_API_KEY_LENGTH = 16;
const MIN_CRON_SECRET_LENGTH = 16;
const POSTGRES_URL_PATTERN = /^postgres(ql)?:\/\//;

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  ENGINE_API_KEY: z.string().min(MIN_API_KEY_LENGTH),
});

// 수집 경로에서만 요구한다 — 없어도 /plan은 뜬다(Vercel Preview에는 수집 env가 없다).
const IngestEnvSchema = z.object({
  DATABASE_URL: z.string().regex(POSTGRES_URL_PATTERN, 'postgresql:// 접속 문자열이어야 합니다'),
  DATA_GO_KR_SERVICE_KEY: z.string().min(1),
  SEOUL_OPEN_DATA_KEY: z.string().min(1),
  INGEST_CRON_SECRET: z.string().min(MIN_CRON_SECRET_LENGTH),
});

export type EngineConfig = {
  port: number;
  apiKey: string;
};

export type IngestConfig = {
  databaseUrl: string;
  dataGoKrServiceKey: string;
  seoulOpenDataKey: string;
  cronSecret: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): EngineConfig {
  const parsed = EnvSchema.parse(env);
  return { port: parsed.PORT, apiKey: parsed.ENGINE_API_KEY };
}

export function loadIngestConfig(env: NodeJS.ProcessEnv = process.env): IngestConfig {
  const parsed = IngestEnvSchema.parse(env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    dataGoKrServiceKey: parsed.DATA_GO_KR_SERVICE_KEY,
    seoulOpenDataKey: parsed.SEOUL_OPEN_DATA_KEY,
    cronSecret: parsed.INGEST_CRON_SECRET,
  };
}
