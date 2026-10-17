import fs from 'fs';
import path from 'path';
import { defineConfig } from 'drizzle-kit';

function loadDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, '');
  }

  for (const relPath of ['.env', '.vercel/.env.production.local', '.vercel/.env.preview.local']) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(/^(?:export\s+)?DATABASE_URL\s*=\s*(.+)$/);
        if (match) {
          const val = match[1].trim().replace(/^["']|["']$/g, '');
          if (val) {
            process.env.DATABASE_URL = val;
            return val;
          }
        }
      }
    } catch {}
  }
  return undefined;
}

const envUrl = loadDatabaseUrl();

if (process.env.CI && !envUrl) {
  console.error(
    '::error::DATABASE_URL not found in CI environment or .vercel/.env.*.local files.'
  );
  process.exit(1);
}

const resolvedDatabaseUrl =
  envUrl || 'postgresql://postgres:postgres@localhost:5432/tournament_manager';

try {
  const parsed = new URL(resolvedDatabaseUrl);
  console.log(`[drizzle.config] Target DB host: ${parsed.host}`);
} catch {}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  verbose: true,
  dbCredentials: {
    url: resolvedDatabaseUrl,
  },
});
