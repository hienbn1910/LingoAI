import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['dist/**','node_modules/**'] },
  { files: ['src/**/*.{js,jsx}'], ...js.configs.recommended,
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }] } },
  { files: ['*.config.js'], languageOptions: { globals: globals.node } },
];
