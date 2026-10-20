import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { sharedRules } from '@makchacut/eslint-config';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: sharedRules },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
