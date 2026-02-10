import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
const useManagedServers = !process.env.E2E_BASE_URL;
const managedServerEnv = {
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://masq:masq@localhost:5432/masq?schema=public',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5173',
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://127.0.0.1:5173',
  JWT_SECRET: process.env.JWT_SECRET ?? 'masq-dev-secret-change-me-change-me!',
  COOKIE_SECURE: process.env.COOKIE_SECURE ?? 'false',
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  workers: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
    headless: true,
  },
  webServer: useManagedServers
    ? [
        {
          command: 'docker compose up -d',
          cwd: '.',
          timeout: 120_000,
          reuseExistingServer: true,
        },
        {
          command: 'pnpm prisma:migrate',
          cwd: '.',
          env: managedServerEnv,
          timeout: 120_000,
          reuseExistingServer: true,
        },
        {
          command: 'pnpm --filter @masq/api dev',
          cwd: '.',
          port: 4000,
          env: managedServerEnv,
          timeout: 120_000,
          reuseExistingServer: !isCI,
        },
        {
          command: 'pnpm --filter @masq/web dev -- --host 127.0.0.1 --port 5173',
          cwd: '.',
          port: 5173,
          timeout: 120_000,
          reuseExistingServer: !isCI,
        },
      ]
    : undefined,
});
