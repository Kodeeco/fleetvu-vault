/**
 * Time-limited resume links for Fleet unlock thank-you email.
 * Bare APP_URL loses sessionStorage when mobile mail opens a fresh browser —
 * CTA must carry a signed token that re-opens The Vault.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { getPublicVaultOpenSecret } from '@/lib/public-vault-gate';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function resumeSecret(): string {
  const fromEnv = (process.env.FLEETVU_VAULT_RESUME_SECRET || '').trim();
  if (fromEnv.length >= 12) return fromEnv;
  return getPublicVaultOpenSecret();
}

function sign(payloadB64: string): string {
  return createHmac('sha256', resumeSecret()).update(payloadB64).digest('base64url');
}

export function mintVaultResumeToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      e: email.trim().toLowerCase(),
      exp: Date.now() + TTL_MS,
    }),
    'utf8',
  ).toString('base64url');
  return `${payload}-${sign(payload)}`;
}

export function verifyVaultResumeToken(
  token: string | null | undefined,
): { ok: true; email: string } | { ok: false } {
  const raw = (token || '').trim();
  const dash = raw.lastIndexOf('-');
  if (dash < 8) return { ok: false };
  const payloadB64 = raw.slice(0, dash);
  const sig = raw.slice(dash + 1);
  if (!payloadB64 || !sig) return { ok: false };

  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  } catch {
    return { ok: false };
  }

  try {
    const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      e?: string;
      exp?: number;
    };
    if (!data.e || typeof data.exp !== 'number') return { ok: false };
    if (Date.now() > data.exp) return { ok: false };
    return { ok: true, email: data.e };
  } catch {
    return { ok: false };
  }
}
