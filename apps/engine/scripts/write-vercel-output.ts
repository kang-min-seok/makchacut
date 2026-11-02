import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// tsup이 만든 번들(.vercel/output/functions/index.func/index.mjs) 옆에 Build Output API 설정을 쓴다.
// https://vercel.com/docs/build-output-api
const OUTPUT_DIR = '.vercel/output';
const FUNCTION_DIR = join(OUTPUT_DIR, 'functions', 'index.func');
const REGIONS = ['icn1'];

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

mkdirSync(FUNCTION_DIR, { recursive: true });

writeJson(join(FUNCTION_DIR, '.vc-config.json'), {
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  // 헬퍼가 요청 본문을 먼저 읽으면 Hono가 본문을 못 읽는다
  shouldAddHelpers: false,
  shouldAddSourcemapSupport: false,
  regions: REGIONS,
});

// 모든 경로를 단일 함수로 보내고, 원래 경로를 유지한다
writeJson(join(OUTPUT_DIR, 'config.json'), {
  version: 3,
  routes: [
    { handle: 'filesystem' },
    {
      src: '/(.*)',
      dest: '/',
      transforms: [{ type: 'request.path', op: 'set', args: '/$1' }],
    },
  ],
});

console.log(`Vercel Build Output 작성: ${OUTPUT_DIR}`);
