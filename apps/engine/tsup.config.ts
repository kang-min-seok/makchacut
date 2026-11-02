import { defineConfig, type Options } from 'tsup';

// 워크스페이스 패키지가 `#*` → `.ts` subpath imports를 쓰므로, 파일 단위 컴파일 대신 전부 한 파일로 번들한다.
const shared: Options = {
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  noExternal: [/.*/],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
};

export default defineConfig([
  // 로컬 실행·Docker용 상시 서버
  { ...shared, entry: ['src/node-server.ts'], outDir: 'dist', clean: true },
  // Vercel Function (Build Output API)
  {
    ...shared,
    entry: { index: 'src/vercel-handler.ts' },
    outDir: '.vercel/output/functions/index.func',
    outExtension: () => ({ js: '.mjs' }),
    clean: true,
  },
]);
