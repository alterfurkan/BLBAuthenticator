import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate } from './auth.js';
import {
  createEntry,
  deleteEntry,
  EntryError,
  generateEntryPreview,
  getEntryCode,
  listEntries,
  listEntriesWithCodes,
} from '../services/entries.js';

const labelSchema = z.string().min(1).max(255);
const issuerSchema = z.string().max(255).default('');

export async function entriesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/entries',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const entries = await listEntries(request.user.sub);
      return reply.send({ entries });
    },
  );

  app.get(
    '/api/entries/codes',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const entries = await listEntriesWithCodes(request.user.sub);
      return reply.send({ entries, remaining: entries[0]?.remaining ?? 30 - (Math.floor(Date.now() / 1000) % 30) });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/entries/:id/code',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const entryId = Number(request.params.id);
      if (!Number.isFinite(entryId)) {
        return reply.status(400).send({ error: 'Geçersiz kayıt id' });
      }

      const result = await getEntryCode(request.user.sub, entryId);
      if (!result) {
        return reply.status(404).send({ error: 'Kayıt bulunamadı' });
      }

      return reply.send(result);
    },
  );

  app.post(
    '/api/entries/generate',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        label: labelSchema,
        issuer: issuerSchema,
      });
      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Hesap adı gerekli', details: body.error.flatten() });
      }

      const preview = await generateEntryPreview(body.data.label, body.data.issuer);
      return reply.send(preview);
    },
  );

  app.post(
    '/api/entries',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        label: labelSchema,
        issuer: issuerSchema,
        secret: z.string().min(16).max(128),
        code: z.string().length(6),
      });
      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ error: 'Geçersiz kayıt bilgileri', details: body.error.flatten() });
      }

      try {
        const entry = await createEntry(
          request.user.sub,
          body.data.label,
          body.data.issuer,
          body.data.secret,
          body.data.code,
        );
        return reply.status(201).send({ entry });
      } catch (err) {
        if (err instanceof EntryError) {
          return reply.status(400).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/entries/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const entryId = Number(request.params.id);
      if (!Number.isFinite(entryId)) {
        return reply.status(400).send({ error: 'Geçersiz kayıt id' });
      }

      const deleted = await deleteEntry(request.user.sub, entryId);
      if (!deleted) {
        return reply.status(404).send({ error: 'Kayıt bulunamadı' });
      }

      return reply.send({ success: true, message: 'Kayıt silindi' });
    },
  );
}
