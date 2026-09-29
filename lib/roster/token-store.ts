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

function getSb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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
      return { portal: data as RosterPortalTokenRow, storage: 'supabase' };
    }
    if (error && !isMissingTableError(error.message)) {
      return null;
    }
  }

  const store = readLocal();
  const portal = store.tokens[token];
  if (!portal) return null;
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
