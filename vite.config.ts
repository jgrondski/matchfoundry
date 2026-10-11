/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { createApiMiddleware } from './src/server/api';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Ensure all .env variables are available to Node server middleware & runtime
  for (const [key, val] of Object.entries(env)) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
    }
  }

  const defaultDbUrl = 'postgresql://postgres:postgres@localhost:5432/tournament_manager';
  const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL || defaultDbUrl;
  if (!process.env.DATABASE_URL && databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
  }

  return {
    plugins: [
      react(),
      {
        name: 'tournament-api-middleware',
        configureServer(server) {
          server.middlewares.use(createApiMiddleware());
        },
      },
    ],
    define: {
      'process.env.DATABASE_URL': JSON.stringify(databaseUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'node',
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    },
  };
});
