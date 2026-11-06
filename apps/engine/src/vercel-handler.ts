import { handle } from '@hono/node-server/vercel';
import { createApp } from '#create-app';
import { loadConfig } from '#config';
import { createPlannerFromEnv } from '#plan/plan-runtime';

// Vercel Node.js Function 핸들러. tsup이 단일 파일로 번들해 .vercel/output에 넣는다(scripts/write-vercel-output.ts).
export default handle(createApp(loadConfig(), createPlannerFromEnv()));
