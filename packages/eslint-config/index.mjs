import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export const sharedRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['../*'],
          message: '상위 경로 상대 임포트 대신 패키지 subpath 임포트(#…) 또는 별칭을 쓰세요.',
        },
      ],
    },
  ],
};

export const typescriptConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: sharedRules },
];
