import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

const ENV_FILE = '.env';
const POSTGRES_URL_PATTERN = /^postgres(ql)?:\/\//;

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL이 없습니다. packages/db/.env에 넣어 주세요 (.env.example 참고).');
  }
  if (!POSTGRES_URL_PATTERN.test(url)) {
    throw new Error(
      'DATABASE_URL은 postgresql://로 시작하는 DB 접속 문자열이어야 합니다. ' +
        'https://<ref>.supabase.co는 REST API 주소입니다. ' +
        'Supabase 대시보드 상단 Connect > Connection string에서 복사하세요.',
    );
  }
  return url;
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: readDatabaseUrl(),
  },
});
