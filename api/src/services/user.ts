import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';

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
