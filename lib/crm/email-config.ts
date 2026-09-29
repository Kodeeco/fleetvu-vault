/**
 * FleetVu CRM Email Config — persisted for Global Admin Email Config tab.
 * Commercial / operational mail only — never incident evidence payloads.
 * Defaults mirror Bolt LIVE SMTP (mail.fleetvu.org:465 + TLS).
 */

export type SenderProfileId = 'compliance' | 'welcome' | 'notices';

export interface SmtpConfig {
  host: string;
  port: number;
  tlsEnabled: boolean;
  username: string;
  password: string;
  defaultFromEmail: string;
  defaultDisplayName: string;
}

export interface SenderProfile {
  id: SenderProfileId;
  label: string;
  fromAddress: string;
  displayName: string;
}

export type TriggerKey =
  | 'compliance_audit'
  | 'welcome_onboarding'
  | 'expiration_notices'
  | 'team_invitations'
  | 'password_resets'
  | 'driver_keycodes'
  | 'driver_reports';

export interface EmailConfigState {
  /** When true, CRM sends use the SMTP credentials below (LIVE outbound). */
  liveEnabled: boolean;
  /** Base URL for portal / renewal links in outbound mail. */
  deployedSiteUrl: string;
  smtp: SmtpConfig;
  profiles: SenderProfile[];
  triggers: Record<TriggerKey, SenderProfileId>;
  updatedAt: string;
}

export const DEFAULT_DEPLOYED_SITE_URL = 'https://app.fleetvu.org';

export const DEFAULT_EMAIL_CONFIG: EmailConfigState = {
  liveEnabled: true,
  deployedSiteUrl: DEFAULT_DEPLOYED_SITE_URL,
  smtp: {
    host: 'mail.fleetvu.org',
    port: 465,
    tlsEnabled: true,
    username: 'welcome@fleetvu.org',
    password: '',
    defaultFromEmail: 'welcome@fleetvu.org',
    defaultDisplayName: 'FleetVu Onboarding',
  },
  profiles: [
    {
      id: 'compliance',
      label: 'Compliance Audit',
      fromAddress: 'safetyreport@fleetvu.org',
      displayName: 'FleetVu Forensic Vault Compliance',
    },
    {
      id: 'welcome',
      label: 'Welcome & Onboarding',
      fromAddress: 'welcome@fleetvu.org',
      displayName: 'FleetVu Onboarding & Dispatch',
    },
    {
      id: 'notices',
      label: 'Expiration Notices',
      fromAddress: 'notices@fleetvu.org',
      displayName: 'FleetVu Notices',
    },
  ],
  triggers: {
    compliance_audit: 'compliance',
    welcome_onboarding: 'welcome',
    expiration_notices: 'notices',
    team_invitations: 'welcome',
    password_resets: 'welcome',
    driver_keycodes: 'welcome',
    driver_reports: 'compliance',
  },
  updatedAt: new Date().toISOString(),
};

export const TRIGGER_LABELS: Record<TriggerKey, string> = {
  compliance_audit: 'Compliance Audit',
  welcome_onboarding: 'Welcome & Onboarding',
  expiration_notices: 'Expiration Notices',
  team_invitations: 'Team Invitations',
  password_resets: 'Password Resets',
  driver_keycodes: 'Driver Keycodes',
  driver_reports: 'Driver Reports',
};

const STORAGE_KEY = 'fleetvu_crm_email_config_v2';
const LEGACY_STORAGE_KEY = 'fleetvu_crm_email_config_v1';

function normalizeSiteUrl(url: string): string {
  const trimmed = (url || DEFAULT_DEPLOYED_SITE_URL).trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_DEPLOYED_SITE_URL;
}

export function loadEmailConfig(): EmailConfigState {
  if (typeof window === 'undefined') return DEFAULT_EMAIL_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EMAIL_CONFIG, smtp: { ...DEFAULT_EMAIL_CONFIG.smtp } };
    const parsed = JSON.parse(raw) as Partial<EmailConfigState> & { smtp?: Partial<SmtpConfig> };
    const merged: EmailConfigState = {
      ...DEFAULT_EMAIL_CONFIG,
      ...parsed,
      liveEnabled: parsed.liveEnabled ?? DEFAULT_EMAIL_CONFIG.liveEnabled,
      deployedSiteUrl: normalizeSiteUrl(
        parsed.deployedSiteUrl || DEFAULT_EMAIL_CONFIG.deployedSiteUrl,
      ),
      smtp: { ...DEFAULT_EMAIL_CONFIG.smtp, ...parsed.smtp },
      profiles: parsed.profiles?.length ? parsed.profiles : DEFAULT_EMAIL_CONFIG.profiles,
      triggers: { ...DEFAULT_EMAIL_CONFIG.triggers, ...parsed.triggers },
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
    // Migrate legacy host/user defaults to Bolt LIVE values when still on old placeholders
    if (
      !parsed.smtp?.host ||
      parsed.smtp.host === 'smtp.fleetvu.org' ||
      parsed.smtp.username === 'smtp@fleetvu.com'
    ) {
      merged.smtp.host = DEFAULT_EMAIL_CONFIG.smtp.host;
      merged.smtp.username = DEFAULT_EMAIL_CONFIG.smtp.username;
      merged.smtp.defaultFromEmail = DEFAULT_EMAIL_CONFIG.smtp.defaultFromEmail;
      merged.smtp.defaultDisplayName = DEFAULT_EMAIL_CONFIG.smtp.defaultDisplayName;
      if (!parsed.smtp?.port) merged.smtp.port = 465;
      if (parsed.smtp?.tlsEnabled === undefined) merged.smtp.tlsEnabled = true;
    }
    return merged;
  } catch {
    return { ...DEFAULT_EMAIL_CONFIG, smtp: { ...DEFAULT_EMAIL_CONFIG.smtp } };
  }
}

export function saveEmailConfig(state: EmailConfigState): void {
  if (typeof window === 'undefined') return;
  const next = {
    ...state,
    deployedSiteUrl: normalizeSiteUrl(state.deployedSiteUrl),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function profileIdToIdentity(id: SenderProfileId): 'welcome' | 'safetyreport' | 'notice' {
  if (id === 'compliance') return 'safetyreport';
  if (id === 'notices') return 'notice';
  return 'welcome';
}

export function normalizeDeployedSiteUrl(url?: string | null): string {
  return normalizeSiteUrl(url || DEFAULT_DEPLOYED_SITE_URL);
}
