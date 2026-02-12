import { afterEach, describe, expect, it, vi } from 'vitest';
const originalEnv = { ...process.env };

const loadEnvModule = async (overrides: Record<string, string | undefined>) => {
  const nextEnv: NodeJS.ProcessEnv = {
    ...originalEnv,
    NODE_ENV: 'test',
    PORT: '4000',
    DATABASE_URL: 'postgresql://masq:masq@localhost:5432/masq?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    WEB_ORIGIN: 'http://localhost:5173',
    CORS_ORIGINS: 'http://localhost:5173',
    CORS_ALLOW_NO_ORIGIN: 'true',
    JWT_SECRET: '0123456789abcdef0123456789abcdef',
    AUTH_COOKIE_NAME: 'masq_token',
    ACCESS_TOKEN_TTL_SECONDS: '86400',
    COOKIE_SECURE: 'false',
    COOKIE_SAME_SITE: 'lax',
    API_RATE_LIMIT_MAX: '120',
    API_RATE_LIMIT_WINDOW_MS: '60000',
    TRUST_PROXY: 'false',
    LOG_LEVEL: 'info',
    UPLOADS_DIR: './uploads',
    MAX_IMAGE_UPLOAD_BYTES: '10485760',
  };

  delete nextEnv.COOKIE_DOMAIN;
  delete nextEnv.LIVEKIT_URL;
  delete nextEnv.LIVEKIT_API_KEY;
  delete nextEnv.LIVEKIT_API_SECRET;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete nextEnv[key];
      continue;
    }
    nextEnv[key] = value;
  }

  process.env = nextEnv;
  vi.resetModules();
  return import('../src/env.ts');
};

describe('ENV validation', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects production config with default JWT secret', async () => {
    await expect(
      loadEnvModule({
        NODE_ENV: 'production',
        JWT_SECRET: undefined,
      }),
    ).rejects.toThrow('JWT_SECRET must be changed from the default value in production');
  });

  it('accepts production config with non-default JWT secret', async () => {
    const module = await loadEnvModule({
      NODE_ENV: 'production',
      JWT_SECRET: '0123456789abcdef0123456789abcdef-prod',
      COOKIE_SECURE: 'true',
      CORS_ALLOW_NO_ORIGIN: 'false',
    });

    expect(module.ENV.NODE_ENV).toBe('production');
    expect(module.ENV.JWT_SECRET).toBe('0123456789abcdef0123456789abcdef-prod');
  });
});
