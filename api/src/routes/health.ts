import type { FastifyInstance } from 'fastify';
import { checkDbConnection } from '../db/pool.js';
import { config } from '../config/env.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const dbOk = await checkDbConnection();
    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      database: dbOk ? 'connected' : 'disconnected',
    };
  });

  app.get('/api/health', async () => {
    const dbOk = await checkDbConnection();
    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      database: dbOk ? 'connected' : 'disconnected',
    };
  });
}
