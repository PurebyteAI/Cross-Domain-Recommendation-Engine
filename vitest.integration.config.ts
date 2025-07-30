import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node', // Use node environment for integration tests
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 30000, // 30 second timeout for integration tests
    hookTimeout: 10000, // 10 second timeout for setup/teardown
    include: ['src/__tests__/integration/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/integration-results.json'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/integration',
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/test-setup.ts',
        'src/**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})