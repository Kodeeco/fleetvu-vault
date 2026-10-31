/**
 * Roster portal token persistence.
 * Prefers Supabase `roster_portal_tokens`; falls back to a local JSON file when
 * the migration has not been applied yet (common on fresh / localhost setups).
 */

import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface RosterPortalTokenRow {
  token: string;
  company_id: string | null;
  company_name: string;
  contact_email: string;
  contact_name: string | null;
  driver_seat_limit: number;
  status: string;
  expires_at: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RosterPortalEntryRow {
  id?: string;
  token: string;
  company_id?: string | null;
  full_name: string;
  email: string;
  role: string;
  location?: string | null;
  sensor_serial?: string | null;
  truck_number?: string | null;
  status?: string;
  one_time_keycode?: string | null;
  keycode_sent_at?: string | null;
  created_at?: string;
}

type LocalStore = {
  tokens: Record<string, RosterPortalTokenRow>;
  entries: Record<string, RosterPortalEntryRow[]>;
};

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'roster-portal-local.json');
/** Tokens removed from CRM queue even when Supabase UPDATE/DELETE fails (fetch failed). */
const PURGED_FILE = path.join(DATA_DIR, 'roster-purged-tokens.json');

function getSb(): SupabaseClient | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const ctrl = new AbortController();
        const ms = 4_000;
        const timer = setTimeout(() => ctrl.abort(), ms);
        const parent = init?.signal;
        if (parent) {
          if (parent.aborted) ctrl.abort();
          else parent.addEventListener('abort', () => ctrl.abort(), { once: true });
        }
        return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      },
    },
  });
}

type PurgedStore = { tokens: Record<string, string> }; // token -> ISO timestamp

function readPurged(): PurgedStore {
  try {
    if (!fs.existsSync(PURGED_FILE)) return { tokens: {} };
    const parsed = JSON.parse(fs.readFileSync(PURGED_FILE, 'utf8')) as PurgedStore;
    return { tokens: parsed?.tokens && typeof parsed.tokens === 'object' ? parsed.tokens : {} };
  } catch {
    return { tokens: {} };
  }
}

function writePurged(store: PurgedStore): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PURGED_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function markTokenPurged(token: string): void {
  try {
    const store = readPurged();
    store.tokens[token] = new Date().toISOString();
    writePurged(store);
  } catch (err) {
    console.warn('[roster] could not write purged tombstone', err);
  }
}

function isTokenPurged(token: string): boolean {
  return Boolean(readPurged().tokens[token]);
}

function isMissingTableError(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('roster_portal_tokens') ||
    m.includes('roster_portal_entries') ||
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('could not find the table')
  );
}

const HIDDEN_ROSTER_STATUSES = new Set(['deleted', 'purged', 'revoked']);

/** Queue / CRM should not show soft-deleted or revoked tokens. */
export function isRosterTokenVisible(status: string | null | undefined): boolean {
  return !HIDDEN_ROSTER_STATUSES.has(String(status || '').toLowerCase());
}

function sbFetchErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || '');
  const cause =
    err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : err instanceof Error && err.cause
        ? String(err.cause)
        : '';
  const combined = `${msg} ${cause}`.toLowerCase();
  if (
    combined.includes('fetch failed') ||
    combined.includes('econnrefused') ||
    combined.includes('enotfound') ||
    combined.includes('network') ||
    combined.includes('certificate')
  ) {
    return 'Cannot reach Supabase (network). Check NEXT_PUBLIC_SUPABASE_URL and connectivity.';
  }
  return msg || 'Supabase request failed';
}

function readLocal(): LocalStore {
  try {
    if (!fs.existsSync(STORE_FILE)) return { tokens: {}, entries: {} };
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as LocalStore;
    return {
      tokens: parsed.tokens || {},
      entries: parsed.entries || {},
    };
  } catch {
    return { tokens: {}, entries: {} };
  }
}

function writeLocal(store: LocalStore): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export async function upsertRosterToken(
  row: RosterPortalTokenRow,
): Promise<{ ok: true; storage: 'supabase' | 'local' } | { ok: false; error: string }> {
  const sb = getSb();
  if (sb) {
    const payload = {
      token: row.token,
      company_id: row.company_id,
      company_name: row.company_name,
      contact_email: row.contact_email,
      contact_name: row.contact_name,
      driver_seat_limit: row.driver_seat_limit,
      status: row.status || 'active',
      expires_at: row.expires_at,
      updated_at: new Date().toISOString(),
    };

    let { error } = await sb.from('roster_portal_tokens').upsert(payload);
    if (error && row.company_id) {
      const retry = await sb.from('roster_portal_tokens').upsert({ ...payload, company_id: null });
      error = retry.error;
    }
    if (!error) return { ok: true, storage: 'supabase' };
    if (!isMissingTableError(error.message)) {
      return { ok: false, error: error.message };
    }
    // fall through to local store
  }

  const store = readLocal();
  const now = new Date().toISOString();
  store.tokens[row.token] = {
    ...row,
    company_id: row.company_id,
    created_at: store.tokens[row.token]?.created_at || now,
    updated_at: now,
  };
  if (!store.entries[row.token]) store.entries[row.token] = [];
  writeLocal(store);
  return { ok: true, storage: 'local' };
}

export async function getRosterToken(
  token: string,
): Promise<{ portal: RosterPortalTokenRow; storage: 'supabase' | 'local' } | null> {
  const sb = getSb();
  if (sb) {
    const { data, error } = await sb
      .from('roster_portal_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (!error && data) {
      const portal = data as RosterPortalTokenRow;
      if (isTokenPurged(token) || !isRosterTokenVisible(portal.status)) return null;
      return { portal, storage: 'supabase' };
    }
    if (error && !isMissingTableError(error.message)) {
      return null;
    }
  }

  if (isTokenPurged(token)) return null;
  const store = readLocal();
  const portal = store.tokens[token];
  if (!portal || !isRosterTokenVisible(portal.status)) return null;
  return { portal, storage: 'local' };
}

export async function listRosterEntries(token: string): Promise<RosterPortalEntryRow[]> {
  const sb = getSb();
  if (sb) {
    const { data, error } = await sb
      .from('roster_portal_entries')
      .select('*')
      .eq('token', token)
      .order('created_at', { ascending: true });
    if (!error) return (data || []) as RosterPortalEntryRow[];
    if (!isMissingTableError(error.message)) return [];
  }

  const store = readLocal();
  return store.entries[token] || [];
}

export async function replaceRosterEntries(
  token: string,
  entries: RosterPortalEntryRow[],
  companyId?: string | null,
): Promise<{ ok: true; storage: 'supabase' | 'local' } | { ok: false; error: string }> {
  const sb = getSb();
  if (sb) {
    const del = await sb.from('roster_portal_entries').delete().eq('token', token);
    if (del.error && !isMissingTableError(del.error.message)) {
      return { ok: false, error: del.error.message };
    }
    if (!del.error) {
      if (entries.length) {
        const { error } = await sb.from('roster_portal_entries').insert(
          entries.map((e) => ({
            token,
            company_id: companyId ?? null,
            full_name: e.full_name,
            email: e.email,
            role: e.role || 'driver',
            location: e.location || null,
            sensor_serial: e.sensor_serial || null,
            truck_number: e.truck_number || null,
            status: e.status || 'draft',
            one_time_keycode: e.one_time_keycode || null,
            keycode_sent_at: e.keycode_sent_at || null,
          })),
        );
        if (error) return { ok: false, error: error.message };
      }
      return { ok: true, storage: 'supabase' };
    }
  }

  const store = readLocal();
  if (!store.tokens[token]) {
    return { ok: false, error: 'Unknown roster token' };
  }
  store.entries[token] = entries.map((e, i) => ({
    ...e,
    id: e.id || `local_${token}_${i}`,
    token,
    status: e.status || 'draft',
    created_at: e.created_at || new Date().toISOString(),
  }));
  writeLocal(store);
  return { ok: true, storage: 'local' };
}

export async function updateRosterTokenStatus(
  token: string,
  patch: Partial<Pick<RosterPortalTokenRow, 'status' | 'submitted_at' | 'approved_at'>>,
): Promise<{ ok: true; storage: 'supabase' | 'local' } | { ok: false; error: string }> {
  const sb = getSb();
  if (sb) {
    const { error } = await sb
      .from('roster_portal_tokens')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('token', token);
    if (!error) return { ok: true, storage: 'supabase' };
    if (!isMissingTableError(error.message)) return { ok: false, error: error.message };
  }

  const store = readLocal();
  if (!store.tokens[token]) return { ok: false, error: 'Unknown roster token' };
  store.tokens[token] = {
    ...store.tokens[token],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  writeLocal(store);
  return { ok: true, storage: 'local' };
}

/**
 * Remove one roster portal token from the CRM queue.
 * Tombstone + local purge first (always succeeds, no network).
 * Supabase soft-delete is best-effort and must never block / fail CRM Delete.
 */
export async function deleteRosterToken(
  token: string,
): Promise<
  | { ok: true; storage: 'supabase' | 'local' | 'both' | 'tombstone'; mode: 'hard' | 'soft' | 'tombstone' }
  | { ok: false; error: string }
> {
  const t = token?.trim();
  if (!t) return { ok: false, error: 'token required' };

  // 1) Local first — CRM queue hides this token even if Supabase is down
  markTokenPurged(t);
  let removedLocal = false;
  const store = readLocal();
  if (store.tokens[t]) {
    delete store.tokens[t];
    delete store.entries[t];
    writeLocal(store);
    removedLocal = true;
  }

  let removedRemote = false;
  let mode: 'hard' | 'soft' | 'tombstone' = 'tombstone';
  const sb = getSb();

  // 2) Best-effort remote (short; never throws out)
  if (sb) {
    try {
      const { data: softRows, error: softErr } = await sb
        .from('roster_portal_tokens')
        .update({
          status: 'deleted',
          updated_at: new Date().toISOString(),
        })
        .eq('token', t)
        .select('token');

      if (!softErr && (softRows?.length ?? 0) > 0) {
        removedRemote = true;
        mode = 'soft';
        try {
          await sb.from('roster_portal_entries').delete().eq('token', t);
          const hard = await sb
            .from('roster_portal_tokens')
            .delete()
            .eq('token', t)
            .select('token');
          if (!hard.error && (hard.data?.length ?? 0) > 0) mode = 'hard';
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn('[roster] deleteRosterToken supabase best-effort failed', err);
    }
  }

  return {
    ok: true,
    storage: removedRemote && removedLocal ? 'both' : removedRemote ? 'supabase' : removedLocal ? 'local' : 'tombstone',
    mode: removedRemote ? mode : 'tombstone',
  };
}

/**
 * Trim stale queue rows:
 * - awaiting submit (active/pending/expired, never submitted)
 * - approved (keycodes already sent) when `includeApproved`
 * Optional `olderThanDays` limits by created/submitted age.
 */
export async function trimRosterTokens(opts?: {
  includeAwaiting?: boolean;
  includeApproved?: boolean;
  olderThanDays?: number;
}): Promise<{ ok: true; removed: number; tokens: string[] } | { ok: false; error: string }> {
  const includeAwaiting = opts?.includeAwaiting !== false;
  const includeApproved = Boolean(opts?.includeApproved);
  const olderThanDays = opts?.olderThanDays;
  const all = await listAllRosterTokens();
  const cutoff =
    typeof olderThanDays === 'number' && olderThanDays > 0
      ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000
      : null;

  const toRemove: string[] = [];
  for (const row of all) {
    const st = (row.status || '').toLowerCase();
    const awaiting =
      st !== 'submitted' && st !== 'approved' && !row.submitted_at;
    const approved = st === 'approved';
    if (awaiting && !includeAwaiting) continue;
    if (approved && !includeApproved) continue;
    if (!awaiting && !approved) continue;
    if (cutoff != null) {
      const stamp = row.submitted_at || row.updated_at || row.created_at;
      const t = stamp ? new Date(stamp).getTime() : NaN;
      if (!Number.isNaN(t) && t > cutoff) continue;
    }
    toRemove.push(row.token);
  }

  const removed: string[] = [];
  for (const token of toRemove) {
    const res = await deleteRosterToken(token);
    if (res.ok) removed.push(token);
  }
  return { ok: true, removed: removed.length, tokens: removed };
}

/** After CRM renames a company, keep roster portal tokens' company_name in sync. */
export async function propagateRosterCompanyName(
  companyId: string,
  companyName: string,
): Promise<number> {
  if (!companyId || !companyName.trim()) return 0;
  const name = companyName.trim();
  let changed = 0;

  const sb = getSb();
  if (sb) {
    const { data, error } = await sb
      .from('roster_portal_tokens')
      .update({ company_name: name, updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .select('token');
    if (!error && data) changed += data.length;
  }

  const store = readLocal();
  let localDirty = false;
  for (const token of Object.keys(store.tokens)) {
    const row = store.tokens[token];
    if (row.company_id === companyId && row.company_name !== name) {
      store.tokens[token] = {
        ...row,
        company_name: name,
        updated_at: new Date().toISOString(),
      };
      localDirty = true;
      changed += 1;
    }
  }
  if (localDirty) writeLocal(store);
  return changed;
}

/** CRM review queue — merge Supabase + local `.data` fallback tokens. */
export async function listAllRosterTokens(): Promise<
  Array<RosterPortalTokenRow & { storage: 'supabase' | 'local' }>
> {
  const merged = new Map<string, RosterPortalTokenRow & { storage: 'supabase' | 'local' }>();

  const sb = getSb();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('roster_portal_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        for (const row of data as RosterPortalTokenRow[]) {
          merged.set(row.token, { ...row, storage: 'supabase' });
        }
      } else if (error && !isMissingTableError(error.message)) {
        console.warn('[roster] listAllRosterTokens', error.message);
      }
    } catch (err) {
      console.warn('[roster] listAllRosterTokens fetch failed', err);
    }
  }

  const store = readLocal();
  for (const row of Object.values(store.tokens)) {
    if (!merged.has(row.token)) {
      merged.set(row.token, { ...row, storage: 'local' });
    }
  }

  return Array.from(merged.values())
    .filter((row) => isRosterTokenVisible(row.status) && !isTokenPurged(row.token))
    .sort((a, b) => {
      const at = a.submitted_at || a.updated_at || a.created_at || '';
      const bt = b.submitted_at || b.updated_at || b.created_at || '';
      return bt.localeCompare(at);
    });
}

/** Clear one-time keycode from roster after Vault bind (burn) — blocks reuse. */
export async function clearRosterKeycode(keycode: string): Promise<number> {
  const normalized = keycode.trim().toUpperCase();
  if (!normalized) return 0;
  let cleared = 0;

  const sb = getSb();
  if (sb) {
    const { data, error } = await sb
      .from('roster_portal_entries')
      .update({ one_time_keycode: null })
      .eq('one_time_keycode', normalized)
      .select('id');
    if (!error && Array.isArray(data)) cleared += data.length;
  }

  const store = readLocal();
  let localDirty = false;
  for (const token of Object.keys(store.entries)) {
    const rows = store.entries[token] || [];
    let changed = false;
    store.entries[token] = rows.map((e) => {
      if ((e.one_time_keycode || '').toUpperCase() !== normalized) return e;
      changed = true;
      cleared += 1;
      return { ...e, one_time_keycode: null };
    });
    if (changed) localDirty = true;
  }
  if (localDirty) writeLocal(store);
  return cleared;
}

/** Look up a dispatched keycode from roster entries (local or Supabase). */
export async function findRosterKeycode(keycode: string): Promise<{
  keycode: string;
  driver_name: string;
  email: string;
  company_id: string | null;
  company_name: string;
  truck_number: string | null;
  token: string;
  entry_id?: string;
  storage: 'supabase' | 'local';
} | null> {
  const normalized = keycode.trim().toUpperCase();
  if (!normalized) return null;

  const sb = getSb();
  if (sb) {
    const { data, error } = await sb
      .from('roster_portal_entries')
      .select('id, token, full_name, email, company_id, truck_number, one_time_keycode, status')
      .eq('one_time_keycode', normalized)
      .limit(1)
      .maybeSingle();
    if (!error && data?.one_time_keycode) {
      const tok = await getRosterToken(data.token);
      return {
        keycode: normalized,
        driver_name: data.full_name,
        email: data.email,
        company_id: data.company_id ?? tok?.portal.company_id ?? null,
        company_name: tok?.portal.company_name || 'FleetVu Partner',
        truck_number: data.truck_number ?? null,
        token: data.token,
        entry_id: data.id,
        storage: 'supabase',
      };
    }
  }

  const store = readLocal();
  for (const [token, entries] of Object.entries(store.entries)) {
    const hit = entries.find((e) => (e.one_time_keycode || '').toUpperCase() === normalized);
    if (hit) {
      const portal = store.tokens[token];
      return {
        keycode: normalized,
        driver_name: hit.full_name,
        email: hit.email,
        company_id: hit.company_id ?? portal?.company_id ?? null,
        company_name: portal?.company_name || 'FleetVu Partner',
        truck_number: hit.truck_number ?? null,
        token,
        entry_id: hit.id,
        storage: 'local',
      };
    }
  }
  return null;
}
