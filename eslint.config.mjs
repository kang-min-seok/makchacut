import { defineConfig, globalIgnores } from 'eslint/config';
import { typescriptConfig } from '@makchacut/eslint-config';

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.vercel/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/drizzle/**',
    'apps/web/**',
  ]),
  ...typescriptConfig,
]);
