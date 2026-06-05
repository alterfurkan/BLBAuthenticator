import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { findUserByEmail, createUser, verifyPassword, findUserById } from '../services/user.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Geçersiz kayıt bilgileri', details: body.error.flatten() });
    }

    const existing = await findUserByEmail(body.data.email);
    if (existing) {
      return reply.status(409).send({ error: 'Bu e-posta adresi zaten kayıtlı' });
    }

    const userId = await createUser(body.data.email, body.data.password);
    const token = app.jwt.sign({ sub: userId, email: body.data.email }, { expiresIn: '7d' });

    return reply.send({
      token,
      user: { id: userId, email: body.data.email },
    });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Geçersiz giriş bilgileri' });
    }

    const user = await findUserByEmail(body.data.email);
    if (!user || !(await verifyPassword(user, body.data.password))) {
      return reply.status(401).send({ error: 'E-posta veya şifre hatalı' });
    }

    if (user.totp_enabled) {
      const pendingToken = app.jwt.sign(
        { sub: user.id, email: user.email, pending2fa: true },
        { expiresIn: '5m' },
      );
      return reply.send({
        requires2fa: true,
        pendingToken,
        user: { id: user.id, email: user.email },
      });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' });
    return reply.send({
      token,
      user: { id: user.id, email: user.email },
    });
  });

  app.post('/api/auth/verify-2fa', async (request, reply) => {
    const schema = z.object({
      pendingToken: z.string(),
      code: z.string().length(6),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Geçersiz doğrulama kodu' });
    }

    let payload: { sub: number; email: string; pending2fa?: boolean };
    try {
      payload = app.jwt.verify(body.data.pendingToken) as typeof payload;
    } catch {
      return reply.status(401).send({ error: 'Doğrulama oturumu süresi doldu, tekrar giriş yapın' });
    }

    if (!payload.pending2fa) {
      return reply.status(400).send({ error: 'Geçersiz oturum' });
    }

    const { verifyUserTotp } = await import('../services/user.js');
    const valid = await verifyUserTotp(payload.sub, body.data.code);
    if (!valid) {
      return reply.status(401).send({ error: 'Doğrulama kodu hatalı' });
    }

    const token = app.jwt.sign({ sub: payload.sub, email: payload.email }, { expiresIn: '7d' });
    return reply.send({
      token,
      user: { id: payload.sub, email: payload.email },
    });
  });

  app.get(
    '/api/auth/me',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user.sub;
      const user = await findUserById(userId);
      if (!user) {
        return reply.status(404).send({ error: 'Kullanıcı bulunamadı' });
      }
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          totpEnabled: user.totp_enabled === 1,
        },
      });
    },
  );
}

async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Yetkilendirme gerekli' });
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number; email: string; pending2fa?: boolean };
    user: { sub: number; email: string; pending2fa?: boolean };
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: { sub: number; email: string; pending2fa?: boolean };
  }
}

export { authenticate };
