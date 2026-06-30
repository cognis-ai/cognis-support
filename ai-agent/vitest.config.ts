import { defineConfig } from 'vitest/config';

// Local config so vitest does NOT climb to the parent Chatwoot fork's vite.config.ts.
export default defineConfig({
  root: __dirname,
  // Inline (empty) postcss config so Vite doesn't climb to the parent Chatwoot fork's
  // postcss.config.js / vite.config.ts. This is a pure Node service — no CSS.
  css: { postcss: { plugins: [] } },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    css: false,
  },
});
