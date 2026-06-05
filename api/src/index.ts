import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config, corsOrigins } from './config/env.js';
import { migrate } from './db/migrate.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { twoFaRoutes } from './routes/twoFa.js';

async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV === 'development',
  });

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(twoFaRoutes);

  return app;
}

async function start() {
  try {
    await migrate();
    const app = await buildApp();

    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`API running at http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
