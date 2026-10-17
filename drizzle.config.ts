import { defineConfig } from 'drizzle-kit';

if (typeof process.loadEnvFile === 'function' && !process.env.DATABASE_URL) {
  try {
    process.loadEnvFile();
  } catch {}
}

const resolvedDatabaseUrl = (process.env.DATABASE_URL || '')
  .trim()
  .replace(/^["']|["']$/g, '');

if (process.env.CI && !resolvedDatabaseUrl) {
  console.error('::error::DATABASE_URL secret is not set in GitHub Actions environment.');
  process.exit(1);
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  verbose: true,
  dbCredentials: {
    url: resolvedDatabaseUrl || 'postgresql://postgres:postgres@localhost:5432/tournament_manager',
  },
});
