/**
 * Per-company Business Portal account settings (product flip, report emails, POC).
 * Stored server-side so any FleetVu staff browser can load them.
 */

import fs from 'fs';
import path from 'path';
import {
  normalizeProductLine,
  type ProductLine,
} from '@/lib/crm/product-line';

export type { ProductLine } from '@/lib/crm/product-line';
export { normalizeProductLine, productLineLabel } from '@/lib/crm/product-line';

export interface CompanyAccountSettings {
  companyId: string;
  productLine: ProductLine;
  /** Where Safety / Scorecard reports are emailed */
  reportEmails: string[];
  pocName: string;
  pocEmail: string;
  pocPhone: string;
  updatedAt: string;
}

type Store = Record<string, CompanyAccountSettings>;

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'crm-company-accounts.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): Store {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export function defaultCompanyAccount(companyId: string): CompanyAccountSettings {
  return {
    companyId,
    productLine: 'fleet',
    reportEmails: [],
    pocName: '',
    pocEmail: '',
    pocPhone: '',
    updatedAt: new Date().toISOString(),
  };
}

export function getCompanyAccount(companyId: string): CompanyAccountSettings {
  const store = readStore();
  const row = store[companyId] || defaultCompanyAccount(companyId);
  return { ...row, productLine: normalizeProductLine(row.productLine) };
}

export function saveCompanyAccount(
  input: Omit<CompanyAccountSettings, 'updatedAt'> & { updatedAt?: string },
): { ok: true; settings: CompanyAccountSettings } | { ok: false; error: string } {
  try {
    const emails = (input.reportEmails || [])
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    const settings: CompanyAccountSettings = {
      companyId: input.companyId,
      productLine: normalizeProductLine(input.productLine),
      reportEmails: [...new Set(emails)],
      pocName: (input.pocName || '').trim(),
      pocEmail: (input.pocEmail || '').trim().toLowerCase(),
      pocPhone: (input.pocPhone || '').trim(),
      updatedAt: new Date().toISOString(),
    };
    const store = readStore();
    store[settings.companyId] = settings;
    writeStore(store);
    return { ok: true, settings };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Save failed' };
  }
}

export function listCompanyAccounts(): CompanyAccountSettings[] {
  return Object.values(readStore()).map((row) => ({
    ...row,
    productLine: normalizeProductLine(row.productLine),
  }));
}

export function removeCompanyAccount(companyId: string): boolean {
  const store = readStore();
  if (!store[companyId]) return false;
  delete store[companyId];
  writeStore(store);
  return true;
}
