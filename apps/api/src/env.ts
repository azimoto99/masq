import { config } from 'dotenv';
import { z } from 'zod';

config();

const parseBooleanValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return value;
};

const BooleanFromEnvSchema = z.preprocess(parseBooleanValue, z.boolean());
const DEFAULT_UPLOADS_DIRECTORY = './uploads';
const DEFAULT_RENDER_UPLOADS_DIRECTORY = '/var/data/masq-uploads';
const DEFAULT_JWT_SECRET = 'masq-dev-secret-change-me-change-me!';

const resolveUploadsDir = (rawUploadsDir: string | undefined): string => {
  const trimmed = rawUploadsDir?.trim();
  if (trimmed) {
    return trimmed;
  }

  const isRenderEnvironment =
    Boolean(process.env.RENDER) ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    Boolean(process.env.RENDER_INSTANCE_ID);

  return isRenderEnvironment ? DEFAULT_RENDER_UPLOADS_DIRECTORY : DEFAULT_UPLOADS_DIRECTORY;
};

const RawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .default('postgresql://masq:masq@localhost:5432/masq?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional(),
  CORS_ALLOW_NO_ORIGIN: BooleanFromEnvSchema.optional(),
  JWT_SECRET: z.string().min(32).default(DEFAULT_JWT_SECRET),
  AUTH_COOKIE_NAME: z.string().default('masq_token'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  COOKIE_SECURE: BooleanFromEnvSchema.optional(),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LIVEKIT_URL: z.string().url().optional(),
  LIVEKIT_API_KEY: z.string().min(1).optional(),
  LIVEKIT_API_SECRET: z.string().min(1).optional(),
  TRUST_PROXY: BooleanFromEnvSchema.default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  UPLOADS_DIR: z.string().optional(),
  MAX_IMAGE_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  ENABLE_DEV_ENTITLEMENTS: BooleanFromEnvSchema.default(false),
  ENABLE_STRIPE_WEBHOOK: BooleanFromEnvSchema.default(false),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

const parsed = RawEnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

const parsedCorsOrigins =
  parsed.data.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) ?? [];

const corsOrigins = parsedCorsOrigins.length > 0 ? parsedCorsOrigins : [parsed.data.WEB_ORIGIN];
const cookieSecure = parsed.data.COOKIE_SECURE ?? parsed.data.NODE_ENV === 'production';
const corsAllowNoOrigin = parsed.data.CORS_ALLOW_NO_ORIGIN ?? parsed.data.NODE_ENV !== 'production';
const uploadsDir = resolveUploadsDir(parsed.data.UPLOADS_DIR);

if (parsed.data.COOKIE_SAME_SITE === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET must be changed from the default value in production');
}

if (parsed.data.ENABLE_STRIPE_WEBHOOK && !parsed.data.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is required when ENABLE_STRIPE_WEBHOOK=true');
}

const livekitConfigCount = [
  parsed.data.LIVEKIT_URL,
  parsed.data.LIVEKIT_API_KEY,
  parsed.data.LIVEKIT_API_SECRET,
].filter((value) => typeof value === 'string' && value.length > 0).length;

if (livekitConfigCount > 0 && livekitConfigCount < 3) {
  throw new Error('LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be configured together');
}

export const ENV = {
  ...parsed.data,
  CORS_ORIGINS: corsOrigins,
  CORS_ALLOW_NO_ORIGIN: corsAllowNoOrigin,
  COOKIE_SECURE: cookieSecure,
  UPLOADS_DIR: uploadsDir,
} as const;

export type Env = typeof ENV;
