import fs from 'fs';
import path from 'path';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { FleetPortalCredential } from './types';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'fleet-account-credentials.json');
const SESSION_FILE = path.join(DATA_DIR, 'fleet-account-sessions.json');

type CredStore = Record<string, FleetPortalCredential>; // key = companyId::email
type SessionStore = Record<
  string,
  { companyId: string; email: string; role: string; expiresAt: string }
>;

function readCreds(): CredStore {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as CredStore;
  } catch {
    return {};
  }
}

function writeCreds(store: CredStore): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function readSessions(): SessionStore {
  try {
    if (!fs.existsSync(SESSION_FILE)) return {};
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) as SessionStore;
  } catch {
    return {};
  }
}

function writeSessions(store: SessionStore): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function credKey(companyId: string, email: string): string {
  return `${companyId}::${email.trim().toLowerCase()}`;
}

function hashPassword(password: string, salt: Buffer): string {
  return scryptSync(password, salt, 64).toString('hex');
}

export function hasPortalPassword(companyId: string, email: string): boolean {
  return !!readCreds()[credKey(companyId, email)];
}

export function setPortalPassword(input: {
  companyId: string;
  email: string;
  password: string;
  role?: FleetPortalCredential['role'];
}): { ok: true } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.companyId) return { ok: false, error: 'company and email required' };
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters' };
  }
  const salt = randomBytes(16);
  const passwordHash = hashPassword(input.password, salt);
  const store = readCreds();
  const key = credKey(input.companyId, email);
  const prev = store[key];
  store[key] = {
    companyId: input.companyId,
    email,
    passwordHash,
    passwordSalt: salt.toString('hex'),
    role: input.role || prev?.role || 'super_admin',
    createdAt: prev?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeCreds(store);
  return { ok: true };
}

export function verifyPortalPassword(
  companyId: string,
  email: string,
  password: string,
): { ok: true; role: string } | { ok: false } {
  const row = readCreds()[credKey(companyId, email)];
  if (!row) return { ok: false };
  const salt = Buffer.from(row.passwordSalt, 'hex');
  const attempt = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(row.passwordHash, 'hex');
  if (attempt.length !== expected.length || !timingSafeEqual(attempt, expected)) {
    return { ok: false };
  }
  return { ok: true, role: row.role };
}

export function createPortalSession(input: {
  companyId: string;
  email: string;
  role: string;
}): string {
  const token = randomBytes(32).toString('hex');
  const store = readSessions();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  store[token] = {
    companyId: input.companyId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    expiresAt,
  };
  writeSessions(store);
  return token;
}

export function resolvePortalSession(
  sessionToken: string | null | undefined,
): { companyId: string; email: string; role: string } | null {
  if (!sessionToken) return null;
  const row = readSessions()[sessionToken];
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  return row;
}

/** Find credential by email across companies (canonical /vault login). */
export function findCredentialByEmail(
  email: string,
): FleetPortalCredential | null {
  const want = email.trim().toLowerCase();
  if (!want) return null;
  const store = readCreds();
  for (const row of Object.values(store)) {
    if (row.email === want) return row;
  }
  return null;
}
