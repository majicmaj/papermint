import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-*', 'node_modules', 'screenshots', 'test-results', 'test-results-*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      complexity: ['error', 20],
      'max-depth': ['error', 3],
      'max-lines': ['error', { max: 800 }],
      'max-lines-per-function': ['error', { max: 80 }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
