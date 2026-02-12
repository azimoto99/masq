import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const usingManagedServers = !process.env.E2E_BASE_URL;

const runCommand = (command, args) =>
  spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
  });

const fail = (message, details) => {
  console.error(`[e2e preflight] ${message}`);
  if (details?.trim()) {
    console.error(details.trim());
  }
  process.exit(1);
};

const ensureCommand = (command, args, errorMessage) => {
  const result = runCommand(command, args);
  if (result.status !== 0) {
    fail(errorMessage, result.stderr || result.stdout);
  }
};

if (usingManagedServers) {
  ensureCommand(
    'docker',
    ['info'],
    'Docker is required when E2E_BASE_URL is not set. Start Docker Desktop and try again.',
  );
  ensureCommand(
    'docker',
    ['compose', 'version'],
    'Docker Compose is required for managed e2e services. Install/enable Docker Compose and try again.',
  );
}

try {
  const browser = await chromium.launch({ headless: true });
  await browser.close();
} catch (error) {
  const details = error instanceof Error ? error.message : String(error);
  fail(
    'Playwright Chromium is not installed. Run `pnpm test:e2e:install` before `pnpm test:e2e`.',
    details,
  );
}

console.log(
  `[e2e preflight] ready (${usingManagedServers ? 'managed docker services' : 'external base url'})`,
);
