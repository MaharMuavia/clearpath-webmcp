import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'next/link': fileURLToPath(
        new URL('./test-support/next-link.tsx', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'hooks/**/*.test.ts',
      'app/**/*.test.tsx',
    ],
  },
});
