import { existsSync } from 'node:fs';
import postgres from 'postgres';

const ENV_FILE = '.env';
const CONNECT_TIMEOUT_SECONDS = 10;

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('DATABASE_URL이 없습니다.');
  process.exit(1);
}

const url = new URL(rawUrl);
console.log(
  `user=${url.username} host=${url.hostname} port=${url.port} db=${url.pathname.slice(1)}`,
);
console.log(`password length=${decodeURIComponent(url.password).length}`);

const sql = postgres(rawUrl, { prepare: false, connect_timeout: CONNECT_TIMEOUT_SECONDS, max: 1 });

try {
  const [row] = await sql`select current_user, version()`;
  console.log('연결 성공:', row);
} catch (error) {
  const { code, message } = error as { code?: string; message?: string };
  console.error(`연결 실패: code=${code ?? '-'} message=${message ?? String(error)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 1 });
}
