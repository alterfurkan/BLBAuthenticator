import { generate, generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../config/env.js';

export function generateTotpSecret(): string {
  return generateSecret();
}

export async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  const result = await verify({ secret, token });
  return result.valid;
}

export function generateTotpUri(secret: string, label: string, issuer: string): string {
  return generateURI({
    issuer: issuer.trim() || config.APP_NAME,
    label: label.trim(),
    secret,
  });
}

export function getRemainingSeconds(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, { width: 256, margin: 2 });
}

export async function getCurrentTotpToken(secret: string): Promise<string> {
  return generate({ secret });
}
