import { defineConfig } from 'drizzle-kit';

if (typeof process.loadEnvFile === 'function' && !process.env.DATABASE_URL) {
  for (const envPath of ['.env', '.vercel/.env.production.local', '.vercel/.env.preview.local']) {
    try {
      process.loadEnvFile(envPath);
      if (process.env.DATABASE_URL) break;
    } catch {}
  }
}

const resolvedDatabaseUrl = (
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tournament_manager'
)
  .trim()
  .replace(/^["']|["']$/g, '');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: resolvedDatabaseUrl,
  },
});
