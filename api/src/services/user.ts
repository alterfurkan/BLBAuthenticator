import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { decryptSecret, encryptSecret, generateRecoveryCode } from '../services/crypto.js';
import { generateTotpSecret, verifyTotpToken } from '../services/totp.js';

export interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  totp_enabled: number;
  totp_secret_encrypted: string | null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await pool.execute<UserRow[]>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] ?? null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const [rows] = await pool.execute<UserRow[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] ?? null;
}

export async function createUser(email: string, password: string): Promise<number> {
  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    [email, passwordHash],
  );
  return result.insertId;
}

export async function verifyPassword(user: UserRow, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

export async function setupTotp(userId: number): Promise<{ secret: string; pendingEncrypted: string }> {
  const secret = generateTotpSecret();
  const pendingEncrypted = encryptSecret(secret);
  await pool.execute('UPDATE users SET totp_secret_encrypted = ?, totp_enabled = 0 WHERE id = ?', [
    pendingEncrypted,
    userId,
  ]);
  return { secret, pendingEncrypted };
}

export async function confirmTotpSetup(userId: number, token: string): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user?.totp_secret_encrypted) return false;

  const secret = decryptSecret(user.totp_secret_encrypted);
  if (!(await verifyTotpToken(secret, token))) return false;

  await pool.execute('UPDATE users SET totp_enabled = 1 WHERE id = ?', [userId]);
  await generateRecoveryCodes(userId);
  return true;
}

export async function verifyUserTotp(userId: number, token: string): Promise<boolean> {
  const user = await findUserById(userId);
  if (!user?.totp_enabled || !user.totp_secret_encrypted) return false;

  const secret = decryptSecret(user.totp_secret_encrypted);
  return await verifyTotpToken(secret, token);
}

export async function getUserTotpSecret(userId: number): Promise<string | null> {
  const user = await findUserById(userId);
  if (!user?.totp_enabled || !user.totp_secret_encrypted) return null;
  return decryptSecret(user.totp_secret_encrypted);
}

export async function disableTotp(userId: number, token: string): Promise<boolean> {
  const valid = await verifyUserTotp(userId, token);
  if (!valid) return false;

  await pool.execute(
    'UPDATE users SET totp_enabled = 0, totp_secret_encrypted = NULL WHERE id = ?',
    [userId],
  );
  await pool.execute('DELETE FROM recovery_codes WHERE user_id = ?', [userId]);
  return true;
}

async function generateRecoveryCodes(userId: number, count = 8): Promise<string[]> {
  await pool.execute('DELETE FROM recovery_codes WHERE user_id = ?', [userId]);
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = generateRecoveryCode();
    codes.push(code);
    const codeHash = await bcrypt.hash(code, 10);
    await pool.execute('INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)', [userId, codeHash]);
  }

  return codes;
}

export async function get2faStatus(userId: number): Promise<{ enabled: boolean; email: string }> {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');
  return { enabled: user.totp_enabled === 1, email: user.email };
}
