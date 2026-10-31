import fs from 'fs';
import path from 'path';
import type {
  FleetAccountCadence,
  FleetAccountSettings,
  ReportKind,
  ReportRecipient,
} from './types';
import { saveRollupPrefs } from '@/lib/safety-report-rollup';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'fleet-account-settings.json');

type Store = Record<string, FleetAccountSettings>;

function readStore(): Store {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function defaultSettings(companyId: string, companyName: string): FleetAccountSettings {
  return {
    companyId,
    companyName,
    safetyDigestCadence: 'weekly',
    recipients: {
      safety_digest: [],
      sensor_fault_alerts: [],
      incident_packages: [],
    },
    notifyDriverOnSensorFault: true,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
  };
}

export async function getFleetAccountSettings(
  companyId: string,
  companyName?: string,
): Promise<FleetAccountSettings> {
  const store = readStore();
  if (store[companyId]) return store[companyId];
  return defaultSettings(companyId, companyName || companyId);
}

function mapCadenceToRollup(
  c: FleetAccountCadence,
): 'weekly' | 'monthly' | 'quarterly' {
  if (c === 'monthly') return 'monthly';
  if (c === 'quarterly') return 'quarterly';
  // biweekly uses weekly engine with 12-day min gap via lastSent — rollup weekly for now
  return 'weekly';
}

export async function saveFleetAccountSettings(input: {
  companyId: string;
  companyName?: string;
  safetyDigestCadence?: FleetAccountCadence;
  recipients?: Partial<Record<ReportKind, ReportRecipient[]>>;
  notifyDriverOnSensorFault?: boolean;
  updatedBy?: string | null;
}): Promise<FleetAccountSettings> {
  const store = readStore();
  const prev = store[input.companyId] || defaultSettings(input.companyId, input.companyName || '');
  const next: FleetAccountSettings = {
    ...prev,
    companyName: input.companyName || prev.companyName,
    safetyDigestCadence: input.safetyDigestCadence ?? prev.safetyDigestCadence,
    recipients: input.recipients ? { ...prev.recipients, ...input.recipients } : prev.recipients,
    notifyDriverOnSensorFault:
      input.notifyDriverOnSensorFault !== undefined
        ? input.notifyDriverOnSensorFault
        : prev.notifyDriverOnSensorFault,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? prev.updatedBy,
  };
  store[input.companyId] = next;
  writeStore(store);

  // Keep digest job prefs in sync (biweekly → weekly cadence flag for scheduler)
  await saveRollupPrefs({
    companyId: input.companyId,
    enabled: true,
    cadence: mapCadenceToRollup(next.safetyDigestCadence),
    updatedBy: input.updatedBy || 'fleet-account-portal',
  });

  return next;
}
