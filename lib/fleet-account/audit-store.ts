import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { FleetAuditEntry, FleetAuditAction } from './types';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'fleet-account-audit.json');

type Store = { entries: FleetAuditEntry[] };

function readStore(): Store {
  try {
    if (!fs.existsSync(STORE_FILE)) return { entries: [] };
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as Store;
    return { entries: Array.isArray(parsed?.entries) ? parsed.entries : [] };
  } catch {
    return { entries: [] };
  }
}

function writeStore(store: Store): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

/** Append-only audit — customers may view/export, never delete via API. */
export async function appendFleetAudit(input: {
  companyId: string;
  token?: string;
  action: FleetAuditAction;
  actorEmail?: string | null;
  actorName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
  meta?: Record<string, unknown>;
}): Promise<FleetAuditEntry> {
  const entry: FleetAuditEntry = {
    id: randomUUID(),
    companyId: input.companyId,
    token: input.token,
    at: new Date().toISOString(),
    action: input.action,
    actorEmail: input.actorEmail || null,
    actorName: input.actorName || null,
    ip: input.ip || null,
    userAgent: input.userAgent || null,
    detail: input.detail || null,
    meta: input.meta,
  };
  const store = readStore();
  store.entries.unshift(entry);
  // Cap local file growth
  if (store.entries.length > 20_000) store.entries = store.entries.slice(0, 20_000);
  writeStore(store);
  return entry;
}

export async function listFleetAudit(
  companyId: string,
  opts?: { limit?: number },
): Promise<FleetAuditEntry[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 2000);
  return readStore()
    .entries.filter((e) => e.companyId === companyId)
    .slice(0, limit);
}
