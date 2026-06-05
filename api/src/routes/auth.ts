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

    const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' });
    return reply.send({
      token,
      user: { id: user.id, email: user.email },
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
    payload: { sub: number; email: string };
    user: { sub: number; email: string };
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: { sub: number; email: string };
  }
}

export { authenticate };
