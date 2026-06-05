import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { decryptSecret, encryptSecret } from './crypto.js';
import {
  generateQrCodeDataUrl,
  generateTotpSecret,
  generateTotpUri,
  getCurrentTotpToken,
  getRemainingSeconds,
  verifyTotpToken,
} from './totp.js';

export interface EntryRow extends RowDataPacket {
  id: number;
  user_id: number;
  label: string;
  issuer: string;
  secret_encrypted: string;
  sort_order: number;
  created_at: Date;
}

export interface EntryPublic {
  id: number;
  label: string;
  issuer: string;
  createdAt: string;
}

export interface EntryWithCode extends EntryPublic {
  code: string;
  remaining: number;
}

export async function listEntries(userId: number): Promise<EntryPublic[]> {
  const [rows] = await pool.execute<EntryRow[]>(
    'SELECT id, label, issuer, created_at FROM totp_entries WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    issuer: row.issuer,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function listEntriesWithCodes(userId: number): Promise<EntryWithCode[]> {
  const [rows] = await pool.execute<EntryRow[]>(
    'SELECT * FROM totp_entries WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
    [userId],
  );

  const remaining = getRemainingSeconds();
  const results: EntryWithCode[] = [];

  for (const row of rows) {
    const secret = decryptSecret(row.secret_encrypted);
    const code = await getCurrentTotpToken(secret);
    results.push({
      id: row.id,
      label: row.label,
      issuer: row.issuer,
      createdAt: row.created_at.toISOString(),
      code,
      remaining,
    });
  }

  return results;
}

export async function findEntryById(userId: number, entryId: number): Promise<EntryRow | null> {
  const [rows] = await pool.execute<EntryRow[]>(
    'SELECT * FROM totp_entries WHERE id = ? AND user_id = ? LIMIT 1',
    [entryId, userId],
  );
  return rows[0] ?? null;
}

export async function generateEntryPreview(
  label: string,
  issuer: string,
): Promise<{ secret: string; otpauthUri: string; qrCodeDataUrl: string }> {
  const secret = generateTotpSecret();
  const otpauthUri = generateTotpUri(secret, label, issuer);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUri);
  return { secret, otpauthUri, qrCodeDataUrl };
}

export async function createEntry(
  userId: number,
  label: string,
  issuer: string,
  secret: string,
  confirmCode: string,
): Promise<EntryPublic> {
  const normalizedSecret = secret.replace(/\s/g, '').toUpperCase();
  if (!(await verifyTotpToken(normalizedSecret, confirmCode))) {
    throw new EntryError('INVALID_CODE', 'Doğrulama kodu hatalı');
  }

  const encrypted = encryptSecret(normalizedSecret);
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO totp_entries (user_id, label, issuer, secret_encrypted) VALUES (?, ?, ?, ?)',
    [userId, label.trim(), issuer.trim(), encrypted],
  );

  const entry = await findEntryById(userId, result.insertId);
  if (!entry) throw new EntryError('CREATE_FAILED', 'Kayıt oluşturulamadı');

  return {
    id: entry.id,
    label: entry.label,
    issuer: entry.issuer,
    createdAt: entry.created_at.toISOString(),
  };
}

export async function deleteEntry(userId: number, entryId: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM totp_entries WHERE id = ? AND user_id = ?',
    [entryId, userId],
  );
  return result.affectedRows > 0;
}

export async function getEntryCode(userId: number, entryId: number): Promise<{ code: string; remaining: number } | null> {
  const entry = await findEntryById(userId, entryId);
  if (!entry) return null;

  const secret = decryptSecret(entry.secret_encrypted);
  const code = await getCurrentTotpToken(secret);
  return { code, remaining: getRemainingSeconds() };
}

export class EntryError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EntryError';
  }
}
