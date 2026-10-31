/**
 * Local CRM company mirror — used when Supabase schema/RLS blocks staff reads
 * (Global Admin has no browser session; anon often cannot list companies).
 */

import fs from 'fs';
import path from 'path';
import type { Company } from '@/lib/types';
import { SCFUELS_TRIAL } from '@/lib/scfuels-trial';
import { THE_VAULT_COMPANY } from '@/lib/the-vault-company';
import { saveCompanyAccount, getCompanyAccount } from '@/lib/crm/company-account-store';
import { ensureCompanyRollupEnabled } from '@/lib/safety-report-rollup';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'crm-companies.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function vaultTermDates() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const startIso = `${y}-${m}-${day}`;
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + 1);
  const ey = end.getFullYear();
  const em = String(end.getMonth() + 1).padStart(2, '0');
  const ed = String(end.getDate()).padStart(2, '0');
  const endIso = `${ey}-${em}-${ed}`;
  return {
    created_at: now.toISOString(),
    plan_start_date: startIso,
    plan_end_date: endIso,
    contract_start_date: startIso,
    contract_end_date: endIso,
  };
}

/** Internal FleetVu test corporate entity */
function theVaultSeed(): Company {
  const dates = vaultTermDates();
  return {
    id: THE_VAULT_COMPANY.id,
    name: THE_VAULT_COMPANY.name,
    region: THE_VAULT_COMPANY.region,
    location: THE_VAULT_COMPANY.location,
    plan_tier: THE_VAULT_COMPANY.planTier,
    fleet_locations: [THE_VAULT_COMPANY.depot],
    account_status: 'active',
    fleet_size: 5,
    sales_rep: THE_VAULT_COMPANY.salesRep,
    industry: THE_VAULT_COMPANY.industry,
    notes: THE_VAULT_COMPANY.notes,
    logo_url: THE_VAULT_COMPANY.logoUrl,
    health_score: 95,
    ...dates,
  };
}

function scfuelsSeed(): Company {
  const dates = vaultTermDates();
  return {
    id: SCFUELS_TRIAL.companyId,
    name: SCFUELS_TRIAL.companyName,
    region: 'West Coast',
    location: SCFUELS_TRIAL.depot,
    plan_tier: 'fleet_insurance',
    fleet_locations: [SCFUELS_TRIAL.depot],
    account_status: 'active',
    fleet_size: 3,
    sales_rep: 'FleetVu Pilot',
    industry: 'Fuel distribution',
    notes: 'Legacy pilot row — prefer The Vault for internal QA',
    logo_url: null,
    ...dates,
  };
}

function ensureTheVaultAccountSettings(): void {
  try {
    const existing = getCompanyAccount(THE_VAULT_COMPANY.id);
    // Strip Bolt-era fake ops@fleetvu.org — digests must go to a real customer inbox.
    const reportEmails = (existing.reportEmails || []).filter((e) => {
      const lower = e.toLowerCase();
      return lower.includes('@') && !lower.endsWith('@fleetvu.org') && !lower.endsWith('@fleetvu.com');
    });
    const pocLower = (existing.pocEmail || '').toLowerCase();
    const pocIsPlatform =
      !pocLower || pocLower.endsWith('@fleetvu.org') || pocLower.endsWith('@fleetvu.com');
    saveCompanyAccount({
      companyId: THE_VAULT_COMPANY.id,
      productLine: existing.productLine || 'both',
      reportEmails,
      pocName: pocIsPlatform ? '' : existing.pocName || '',
      pocEmail: pocIsPlatform ? '' : existing.pocEmail || '',
      pocPhone: existing.pocPhone || '',
    });
    // Weekly Monday digest on by default for The Vault demo
    ensureCompanyRollupEnabled(THE_VAULT_COMPANY.id, 'system:the-vault-seed');
  } catch {
    /* non-fatal */
  }
}

function readStore(): Company[] {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Company[]) : [];
  } catch {
    return [];
  }
}

function writeStore(rows: Company[]): void {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

export function listLocalCompanies(): Company[] {
  const raw = readStore();
  let changed = false;
  let rows = [...raw];

  if (rows.length === 0) {
    const seed = [theVaultSeed(), scfuelsSeed()];
    writeStore(seed);
    ensureTheVaultAccountSettings();
    return seed.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (!rows.some((c) => c.id === THE_VAULT_COMPANY.id || c.name === THE_VAULT_COMPANY.name)) {
    rows = [theVaultSeed(), ...rows];
    changed = true;
    ensureTheVaultAccountSettings();
  }

  if (!rows.some((c) => c.id === SCFUELS_TRIAL.companyId || c.name === SCFUELS_TRIAL.companyName)) {
    rows = [...rows, scfuelsSeed()];
    changed = true;
  }

  // Keep The Vault logo pointed at Vault brand if empty
  rows = rows.map((c) => {
    if (
      (c.id === THE_VAULT_COMPANY.id || c.name === THE_VAULT_COMPANY.name) &&
      !c.logo_url
    ) {
      changed = true;
      return { ...c, logo_url: THE_VAULT_COMPANY.logoUrl, plan_tier: c.plan_tier || 'fleet_insurance' };
    }
    return c;
  });

  if (changed) writeStore(rows);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function upsertLocalCompany(company: Company): Company {
  const rows = listLocalCompanies();
  const idx = rows.findIndex((c) => c.id === company.id);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...company };
  else rows.push(company);
  writeStore(rows);
  return company;
}

export function patchLocalCompany(
  id: string,
  patch: Record<string, unknown>,
): Company | null {
  const rows = listLocalCompanies();
  const idx = rows.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const next = { ...rows[idx], ...patch } as Company;
  rows[idx] = next;
  writeStore(rows);
  return next;
}

export function removeLocalCompany(id: string): Company | null {
  const rows = listLocalCompanies();
  const idx = rows.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const [removed] = rows.splice(idx, 1);
  writeStore(rows);
  return removed;
}
