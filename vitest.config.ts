import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    // e2e/ son specs de Playwright: no deben correr bajo vitest
    exclude: ['e2e/**', 'node_modules/**', '.next/**', '.next-e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
    globalSetup: './src/test/global-setup.ts',
    // Run tests in a single worker to avoid DB connection pool exhaustion
    pool: 'forks',
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
