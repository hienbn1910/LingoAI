import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/lingoai/**/*.test.js'], environment: 'node', fileParallelism: false, testTimeout: 20000, hookTimeout: 120000 } });
