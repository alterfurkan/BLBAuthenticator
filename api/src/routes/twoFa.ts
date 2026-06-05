import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate } from './auth.js';
import {
  setupTotp,
  confirmTotpSetup,
  verifyUserTotp,
  disableTotp,
  get2faStatus,
  getUserTotpSecret,
} from '../services/user.js';
import { generateQrCodeDataUrl, generateTotpUri, getCurrentTotpToken } from '../services/totp.js';

export async function twoFaRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/2fa/status',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const status = await get2faStatus(request.user.sub);
      return reply.send(status);
    },
  );

  app.post(
    '/api/2fa/setup',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { secret } = await setupTotp(request.user.sub);
      const otpauthUri = generateTotpUri(secret, request.user.email);
      const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUri);

      return reply.send({
        secret,
        otpauthUri,
        qrCodeDataUrl,
      });
    },
  );

  app.post(
    '/api/2fa/confirm',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({ code: z.string().length(6) });
      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: '6 haneli kod gerekli' });
      }

      const confirmed = await confirmTotpSetup(request.user.sub, body.data.code);
      if (!confirmed) {
        return reply.status(400).send({ error: 'Doğrulama kodu hatalı' });
      }

      return reply.send({ success: true, message: '2FA başarıyla etkinleştirildi' });
    },
  );

  app.post(
    '/api/2fa/verify',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({ code: z.string().length(6) });
      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: '6 haneli kod gerekli' });
      }

      const valid = await verifyUserTotp(request.user.sub, body.data.code);
      return reply.send({ valid });
    },
  );

  app.post(
    '/api/2fa/disable',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({ code: z.string().length(6) });
      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: '6 haneli kod gerekli' });
      }

      const disabled = await disableTotp(request.user.sub, body.data.code);
      if (!disabled) {
        return reply.status(400).send({ error: 'Doğrulama kodu hatalı' });
      }

      return reply.send({ success: true, message: '2FA devre dışı bırakıldı' });
    },
  );

  app.get(
    '/api/2fa/code',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const secret = await getUserTotpSecret(request.user.sub);
      if (!secret) {
        return reply.status(400).send({ error: '2FA etkin değil' });
      }

      const code = await getCurrentTotpToken(secret);
      const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);

      return reply.send({ code, remaining });
    },
  );
}
