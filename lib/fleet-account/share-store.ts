import fs from 'fs';
import path from 'path';
import { randomBytes, randomUUID } from 'crypto';
import type { IncidentShareLink } from './types';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'fleet-account-shares.json');

type Store = { shares: IncidentShareLink[] };

function readStore(): Store {
  try {
    if (!fs.existsSync(STORE_FILE)) return { shares: [] };
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as Store;
    return { shares: Array.isArray(parsed?.shares) ? parsed.shares : [] };
  } catch {
    return { shares: [] };
  }
}

function writeStore(store: Store): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export async function createIncidentShare(input: {
  companyId: string;
  incidentId: string;
  incidentLabel?: string;
  createdBy: string;
  recipients: string[];
  expiresInDays?: number;
}): Promise<IncidentShareLink> {
  const days = input.expiresInDays ?? 14;
  const share: IncidentShareLink = {
    id: randomUUID(),
    companyId: input.companyId,
    incidentId: input.incidentId,
    incidentLabel: input.incidentLabel,
    token: randomBytes(24).toString('hex'),
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    recipients: input.recipients.map((e) => e.trim().toLowerCase()).filter(Boolean),
    revokedAt: null,
    accessCount: 0,
  };
  const store = readStore();
  store.shares.unshift(share);
  writeStore(store);
  return share;
}

export async function listIncidentShares(companyId: string): Promise<IncidentShareLink[]> {
  return readStore().shares.filter((s) => s.companyId === companyId);
}

export async function revokeIncidentShare(
  companyId: string,
  shareId: string,
): Promise<boolean> {
  const store = readStore();
  const idx = store.shares.findIndex((s) => s.id === shareId && s.companyId === companyId);
  if (idx < 0) return false;
  store.shares[idx] = { ...store.shares[idx], revokedAt: new Date().toISOString() };
  writeStore(store);
  return true;
}
