import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@admin': resolve(__dirname, 'admin/src'),
      '@vault': resolve(__dirname, 'vault/src'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
