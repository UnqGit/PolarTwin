/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // lib tests (layout.ts, materials.ts) don't need a DOM; the R3F tests do.
    // Vitest can only set one environment per config, so use jsdom for all and
    // the pure TS tests still work fine under jsdom.
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
