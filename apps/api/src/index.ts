import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { buildApp } from './app.js';
import { createPrismaRepository } from './domain/prisma-repository.js';
import { ENV } from './env.js';

const prisma = new PrismaClient();
const redis = new Redis(ENV.REDIS_URL);

const start = async () => {
  const repository = createPrismaRepository(prisma);
  const app = await buildApp({
    env: ENV,
    repo: repository,
    redis,
  });

  try {
    try {
      await prisma.$connect();
      app.log.info('Database connected');
    } catch (error) {
      app.log.warn({ error }, 'Database connection failed at startup');
    }

    try {
      const pong = await redis.ping();
      app.log.info({ pong }, 'Redis connected');
    } catch (error) {
      app.log.warn({ error }, 'Redis connection failed at startup');
    }

    await app.listen({
      host: '0.0.0.0',
      port: ENV.PORT,
    });

    app.log.info(`Masq API running on :${ENV.PORT}`);
  } catch (error) {
    app.log.error({ error }, 'Failed to start API');
    await app.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(1);
  }

  const shutdown = async () => {
    try {
      await app.close();
      await prisma.$disconnect();
      await redis.quit();
    } catch (error) {
      app.log.error({ error }, 'Shutdown failed');
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

void start();
