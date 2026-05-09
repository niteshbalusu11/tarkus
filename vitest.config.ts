import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const srcPath = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '#': srcPath,
      '@': srcPath,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'convex',
          include: ['tests/convex/**/*.test.ts'],
          environment: 'edge-runtime',
        },
      },
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
          environment: 'node',
        },
      },
    ],
  },
})
