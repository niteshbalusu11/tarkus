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
          include: ['convex/**/*.test.ts'],
          environment: 'edge-runtime',
        },
      },
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          environment: 'node',
        },
      },
    ],
  },
})
