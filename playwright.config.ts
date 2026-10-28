import { defineConfig, devices } from '@playwright/test';

// Load .env so tests share the dev server's SYSTEM_ADMIN_RECOVERY_PIN and DATABASE_URL.
// Variables already set in the shell take precedence.
try {
  process.loadEnvFile();
} catch {
  // No .env file; rely on the shell environment
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
