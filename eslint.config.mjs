import { defineConfig, globalIgnores } from 'eslint/config';
import { typescriptConfig } from '@makchacut/eslint-config';

export default defineConfig([
  globalIgnores(['**/dist/**', '**/.next/**', '**/.turbo/**', '**/drizzle/**', 'apps/web/**']),
  ...typescriptConfig,
]);
