/**
 * Persist Default View Account (bare app.fleetvu.org Vault identity).
 */

import fs from 'fs';
import path from 'path';
import {
  DEFAULT_VIEW_ACCOUNT_ID,
  DEFAULT_VIEW_ACCOUNT_SEED,
  type DefaultViewAccount,
} from '@/lib/default-view-account';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'crm-default-view-account.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readRaw(): DefaultViewAccount | null {
  try {
    if (!fs.existsSync(STORE_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as DefaultViewAccount;
  } catch {
    return null;
  }
}

export function getDefaultViewAccount(): DefaultViewAccount {
  const raw = readRaw();
  if (!raw) return { ...DEFAULT_VIEW_ACCOUNT_SEED, updatedAt: new Date().toISOString() };
  return {
    ...DEFAULT_VIEW_ACCOUNT_SEED,
    ...raw,
    companyId: DEFAULT_VIEW_ACCOUNT_ID,
  };
}

export function saveDefaultViewAccount(
  patch: Partial<
    Pick<
      DefaultViewAccount,
      | 'companyName'
      | 'driverName'
      | 'depot'
      | 'truckNumber'
      | 'driverId'
      | 'sensorHardware'
      | 'logoUrl'
      | 'logoSize'
    >
  >,
): DefaultViewAccount {
  const current = getDefaultViewAccount();
  const next: DefaultViewAccount = {
    ...current,
    companyId: DEFAULT_VIEW_ACCOUNT_ID,
    companyName:
      patch.companyName !== undefined ? String(patch.companyName) : current.companyName,
    driverName:
      patch.driverName !== undefined ? String(patch.driverName) : current.driverName,
    depot: patch.depot !== undefined ? String(patch.depot) : current.depot,
    truckNumber:
      patch.truckNumber !== undefined ? String(patch.truckNumber) : current.truckNumber,
    driverId: patch.driverId !== undefined ? String(patch.driverId) : current.driverId,
    sensorHardware:
      patch.sensorHardware !== undefined
        ? String(patch.sensorHardware)
        : current.sensorHardware,
    logoUrl:
      patch.logoUrl !== undefined
        ? patch.logoUrl
          ? String(patch.logoUrl)
          : null
        : current.logoUrl,
    logoSize:
      patch.logoSize !== undefined
        ? patch.logoSize === 'small'
          ? 'small'
          : 'large'
        : current.logoSize === 'small'
          ? 'small'
          : 'large',
    updatedAt: new Date().toISOString(),
  };
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
