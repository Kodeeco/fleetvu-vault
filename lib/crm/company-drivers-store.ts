/**
 * Company-scoped driver roster mirror (from Welcome → portal submit / approve).
 * Truck # optional — CRM or driver Edit can fill later.
 */

import fs from 'fs';
import path from 'path';

export interface CompanyDriverRecord {
  id: string;
  companyId: string;
  companyName: string;
  fullName: string;
  email: string;
  role: string;
  location: string;
  sensorSerial: string;
  truckNumber: string;
  status: string;
  keycode?: string | null;
  source: 'roster';
  updatedAt: string;
  createdAt: string;
}

type Store = Record<string, CompanyDriverRecord[]>;

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'crm-company-drivers.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): Store {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function driverId(companyId: string, email: string): string {
  return `${companyId}:${email.trim().toLowerCase()}`;
}

export function listCompanyDrivers(companyId: string): CompanyDriverRecord[] {
  if (!companyId) return [];
  const rows = readStore()[companyId] || [];
  return [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function listAllCompanyDrivers(): CompanyDriverRecord[] {
  const store = readStore();
  return Object.values(store)
    .flat()
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function upsertCompanyDrivers(
  companyId: string,
  companyName: string,
  entries: Array<{
    full_name: string;
    email: string;
    role?: string;
    location?: string | null;
    sensor_serial?: string | null;
    truck_number?: string | null;
    status?: string;
    one_time_keycode?: string | null;
  }>,
): CompanyDriverRecord[] {
  if (!companyId) return [];
  const store = readStore();
  const existing = store[companyId] || [];
  const byEmail = new Map(existing.map((d) => [d.email.trim().toLowerCase(), d]));
  const now = new Date().toISOString();

  for (const e of entries) {
    const email = (e.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    const prev = byEmail.get(email);
    const next: CompanyDriverRecord = {
      id: prev?.id || driverId(companyId, email),
      companyId,
      companyName: companyName || prev?.companyName || '',
      fullName: (e.full_name || prev?.fullName || '').trim() || email,
      email,
      role: (e.role || prev?.role || 'driver').trim() || 'driver',
      location: (e.location || prev?.location || '').trim(),
      sensorSerial: (e.sensor_serial || prev?.sensorSerial || '').trim(),
      truckNumber: (e.truck_number ?? prev?.truckNumber ?? '').toString().trim(),
      status: (e.status || prev?.status || 'submitted').trim(),
      keycode: e.one_time_keycode ?? prev?.keycode ?? null,
      source: 'roster',
      createdAt: prev?.createdAt || now,
      updatedAt: now,
    };
    byEmail.set(email, next);
  }

  const rows = Array.from(byEmail.values());
  store[companyId] = rows;
  writeStore(store);
  return rows;
}

export function patchCompanyDriver(
  companyId: string,
  driverIdOrEmail: string,
  patch: Partial<Pick<CompanyDriverRecord, 'truckNumber' | 'fullName' | 'location' | 'sensorSerial' | 'status'>>,
): CompanyDriverRecord | null {
  const store = readStore();
  const rows = store[companyId] || [];
  const key = driverIdOrEmail.trim().toLowerCase();
  const idx = rows.findIndex(
    (d) => d.id === driverIdOrEmail || d.email.trim().toLowerCase() === key,
  );
  if (idx < 0) return null;
  const next = {
    ...rows[idx],
    ...('truckNumber' in patch ? { truckNumber: (patch.truckNumber || '').trim() } : {}),
    ...('fullName' in patch ? { fullName: (patch.fullName || rows[idx].fullName).trim() } : {}),
    ...('location' in patch ? { location: (patch.location || '').trim() } : {}),
    ...('sensorSerial' in patch ? { sensorSerial: (patch.sensorSerial || '').trim() } : {}),
    ...('status' in patch ? { status: (patch.status || rows[idx].status).trim() } : {}),
    updatedAt: new Date().toISOString(),
  };
  rows[idx] = next;
  store[companyId] = rows;
  writeStore(store);
  return next;
}

export function findDriverByEmail(
  companyId: string | null | undefined,
  email: string,
): CompanyDriverRecord | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  if (companyId) {
    return listCompanyDrivers(companyId).find((d) => d.email === e) || null;
  }
  return listAllCompanyDrivers().find((d) => d.email === e) || null;
}

/** Look up a driver by one-time keycode stored on the company-drivers mirror. */
export function findDriverByKeycode(keycode: string): CompanyDriverRecord | null {
  const normalized = keycode.trim().toUpperCase();
  if (!normalized) return null;
  return (
    listAllCompanyDrivers().find(
      (d) => (d.keycode || '').trim().toUpperCase() === normalized,
    ) || null
  );
}

/** Clear one-time keycode after first successful Vault bind (burn). */
export function clearDriverKeycode(keycode: string): number {
  const normalized = keycode.trim().toUpperCase();
  if (!normalized) return 0;
  const store = readStore();
  let cleared = 0;
  const now = new Date().toISOString();
  for (const companyId of Object.keys(store)) {
    store[companyId] = (store[companyId] || []).map((d) => {
      if ((d.keycode || '').trim().toUpperCase() !== normalized) return d;
      cleared += 1;
      return { ...d, keycode: null, updatedAt: now };
    });
  }
  if (cleared) writeStore(store);
  return cleared;
}

/**
 * After CRM renames a company or changes HQ/depot location, push into the
 * roster driver mirror so Vault keycode verify + CRM Drivers list stay current.
 * Location syncs when a driver's depot is empty or still matches the previous HQ.
 */
export function propagateCompanyIdentity(
  companyId: string,
  opts: {
    companyName?: string;
    location?: string;
  },
): number {
  if (!companyId) return 0;
  const store = readStore();
  const rows = store[companyId] || [];
  if (!rows.length) return 0;

  const now = new Date().toISOString();
  const newName =
    opts.companyName !== undefined ? String(opts.companyName || '').trim() : null;
  const newLoc = opts.location !== undefined ? String(opts.location || '').trim() : null;

  let changed = 0;
  store[companyId] = rows.map((d) => {
    let next = { ...d };
    let dirty = false;
    if (newName !== null && next.companyName !== newName) {
      next.companyName = newName;
      dirty = true;
    }
    if (newLoc !== null && (next.location || '').trim() !== newLoc) {
      // CRM company location/depot is source of truth for the fleet profile.
      next.location = newLoc;
      dirty = true;
    }
    if (dirty) {
      next.updatedAt = now;
      changed += 1;
    }
    return next;
  });

  if (changed) writeStore(store);
  return changed;
}
