/**
 * Server-side CRM email config — shared by Welcome SMTP and driver Safety Log email.
 * Browser CRM saves to localStorage AND POSTs here so phone / API can send LIVE.
 */

import fs from 'fs';
import path from 'path';
import {
  DEFAULT_EMAIL_CONFIG,
  type EmailConfigState,
  type SmtpConfig,
  type TriggerKey,
} from '@/lib/crm/email-config';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'crm-email-config.json');

export type ServerEmailConfig = EmailConfigState;

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadServerEmailConfig(): ServerEmailConfig | null {
  try {
    if (!fs.existsSync(STORE_FILE)) return null;
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<EmailConfigState> & { smtp?: Partial<SmtpConfig> };
    return {
      ...DEFAULT_EMAIL_CONFIG,
      ...parsed,
      liveEnabled: parsed.liveEnabled ?? DEFAULT_EMAIL_CONFIG.liveEnabled,
      deployedSiteUrl: parsed.deployedSiteUrl || DEFAULT_EMAIL_CONFIG.deployedSiteUrl,
      smtp: { ...DEFAULT_EMAIL_CONFIG.smtp, ...parsed.smtp },
      profiles: parsed.profiles?.length ? parsed.profiles : DEFAULT_EMAIL_CONFIG.profiles,
      triggers: { ...DEFAULT_EMAIL_CONFIG.triggers, ...parsed.triggers },
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.error('[FleetVu CRM Email] Failed to read server config:', err);
    return null;
  }
}

export function saveServerEmailConfig(state: EmailConfigState): { ok: true } | { ok: false; error: string } {
  try {
    ensureDir();
    const next: EmailConfigState = {
      ...state,
      smtp: {
        ...state.smtp,
        host: state.smtp.host.trim(),
        username: state.smtp.username.trim(),
        password: state.smtp.password,
        defaultFromEmail: state.smtp.defaultFromEmail.trim(),
        defaultDisplayName: state.smtp.defaultDisplayName.trim(),
      },
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(next, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Write failed' };
  }
}

/** LIVE CRM SMTP ready for outbound (password present). */
export function getLiveCrmSmtp(opts?: { trigger?: TriggerKey }): {
  smtp: SmtpConfig;
  fromEmail: string;
  fromDisplayName: string;
  profileLabel: string;
} | null {
  const cfg = loadServerEmailConfig();
  if (!cfg?.liveEnabled) return null;
  if (!cfg.smtp.host || !cfg.smtp.username || !cfg.smtp.password) return null;

  const triggerKey = opts?.trigger || 'driver_reports';
  const triggerId = cfg.triggers[triggerKey] || cfg.triggers.driver_reports || 'compliance';
  const profile =
    cfg.profiles.find((p) => p.id === triggerId) ||
    cfg.profiles.find((p) => p.id === 'welcome') ||
    cfg.profiles.find((p) => p.id === 'compliance');
  return {
    smtp: cfg.smtp,
    fromEmail: (profile?.fromAddress || cfg.smtp.defaultFromEmail || cfg.smtp.username).trim(),
    fromDisplayName: (profile?.displayName || cfg.smtp.defaultDisplayName || 'FleetVu').trim(),
    profileLabel: profile?.label || 'Welcome',
  };
}
