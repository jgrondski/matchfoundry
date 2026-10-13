export function assertDatabaseConfig(): string {
  // Client-side browser bundles do not have (and must never have) direct database connection credentials
  if (typeof window !== 'undefined') {
    return '';
  }
  const url = (typeof process !== 'undefined' ? process.env?.DATABASE_URL : '') || '';
  if (!url) {
    throw new Error(
      'Configuration Error: DATABASE_URL is missing. Please copy .env.example to .env and run "npm run db:up".'
    );
  }
  return url;
}

