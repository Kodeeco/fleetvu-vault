import { NextRequest, NextResponse } from 'next/server';
import {
  dispatchCorporateEmail,
  identityForEmailType,
  emailDispatchQueue,
  getTransportStats,
  type EmailIdentity,
} from '@/lib/email';
import type { DispatchQueueEntry } from '@/lib/email';
import { sendWithSmtpCredentials } from '@/lib/email/transport';
import { CORPORATE_IDENTITIES } from '@/lib/email/identities';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.fleetvu.org';

interface SmtpOverridePayload {
  host: string;
  port: number;
  tlsEnabled: boolean;
  username: string;
  password: string;
  fromEmail?: string;
  fromDisplayName?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

interface TeamInvitePayload {
  type: 'TEAM_INVITE';
  to_email: string;
  to_name: string;
  role: string;
  company_name: string | null;
  invite_token: string;
  provisioned_by_name: string;
}

interface ClientSetupLinkPayload {
  type: 'CLIENT_SETUP_LINK';
  to_email: string;
  to_name: string;
  organization_name: string;
  lead_role: string;
  activation_key: string;
  setup_token: string;
  primary_location: string;
  feature_entitlements: { radar: boolean; gps: boolean; vault: boolean; risk_scoring: boolean };
  plan_tier: string;
  welcome_message: string;
  deployed_by_name: string;
}

interface DriverReportPayload {
  type: 'DRIVER_FULL_REPORT';
  to_email: string;
  to_name: string;
  driver_name: string;
  company_name: string | null;
  report_type: string;
  report_summary: string;
  download_url?: string;
  attachments?: Array<{ filename: string; content_base64: string; content_type: string }>;
}

interface VaultServiceRequestPayload {
  type: 'VAULT_SERVICE_REQUEST';
  contact_name: string;
  company_name: string;
  location: string;
  vehicle_count: string;
  phone: string;
  email: string;
  preferred_call_time?: string;
  fleet_size?: string;
  notes?: string;
}

interface GenericDispatchPayload {
  type: 'GENERIC_DISPATCH';
  identity: EmailIdentity;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  correlationId?: string;
  priority?: 'critical' | 'high' | 'normal' | 'low';
}

interface WelcomeRosterPayload {
  type: 'WELCOME_ROSTER_PORTAL';
  to_email: string;
  to_name: string;
  organization_name: string;
  roster_token: string;
  driver_seat_limit: number;
  /** Portal link base — defaults to https://app.fleetvu.org */
  app_base_url?: string;
  company_id?: string | null;
  /** When LIVE, CRM SMTP credentials override env / dry_run. */
  live?: boolean;
  smtp_override?: SmtpOverridePayload;
}

interface TestSmtpPayload {
  type: 'TEST_SMTP_CONNECTION';
  smtp: SmtpOverridePayload;
}

type EmailPayload =
  | TeamInvitePayload
  | ClientSetupLinkPayload
  | DriverReportPayload
  | VaultServiceRequestPayload
  | GenericDispatchPayload
  | WelcomeRosterPayload
  | TestSmtpPayload;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Legal isolation: never deliver customer legal/safety evidence mail to FleetVu platform inboxes */
function isFleetVuPlatformMailbox(email: string): boolean {
  const e = email.toLowerCase().trim();
  return e.endsWith('@fleetvu.org') || e.endsWith('@fleetvu.com');
}

function filterCustomerOnlyRecipients(to: string | string[]): {
  allowed: string[];
  blocked: string[];
} {
  const list = Array.isArray(to) ? to : [to];
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const addr of list) {
    if (!addr) continue;
    if (isFleetVuPlatformMailbox(addr)) blocked.push(addr);
    else allowed.push(addr);
  }
  return { allowed, blocked };
}

function buildSetupLinkHtml(p: ClientSetupLinkPayload): string {
  const setupUrl = `${APP_URL}/accept-invite?token=${p.setup_token}`;
  const featureList = Object.entries(p.feature_entitlements)
    .filter(([, v]) => v)
    .map(([k]) => {
      const labels: Record<string, string> = {
        radar: 'Sensor Radar',
        gps: 'GPS Tracking',
        vault: 'Forensic Vault',
        risk_scoring: 'Risk Scoring',
      };
      return labels[k] || k;
    });
  const isSuperAdmin = p.lead_role === 'super_admin';
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <div style="font-size: 20px; font-weight: 700; color: #ffffff;">FleetVu</div>
      <div style="font-size: 11px; color: #fb923c; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 24px;">Client Onboarding · welcome@fleetvu.org</div>
      <h1 style="font-size: 24px; color: #ffffff; margin: 0 0 16px;">Welcome to FleetVu, ${escapeHtml(p.to_name)}</h1>
      <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px;">
        <strong style="color: #e2e8f0;">${escapeHtml(p.deployed_by_name)}</strong> has provisioned
        <strong style="color: #fb923c;">${escapeHtml(p.organization_name)}</strong> as
        <strong style="color: ${isSuperAdmin ? '#a78bfa' : '#60a5fa'};">${isSuperAdmin ? 'Super-Admin' : 'Location Admin'}</strong>.
      </p>
      ${p.welcome_message ? `<div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 24px;"><p style="font-size: 14px; color: #e2e8f0; margin: 0; font-style: italic;">${escapeHtml(p.welcome_message)}</p></div>` : ''}
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="margin-bottom: 8px;"><span style="color: #64748b; font-size: 13px;">Organization</span> · <span style="color: #e2e8f0; font-weight: 600;">${escapeHtml(p.organization_name)}</span></div>
        <div style="margin-bottom: 8px;"><span style="color: #64748b; font-size: 13px;">Primary Location</span> · <span style="color: #e2e8f0; font-weight: 600;">${escapeHtml(p.primary_location)}</span></div>
        <div style="margin-bottom: 8px;"><span style="color: #64748b; font-size: 13px;">Plan</span> · <span style="color: #e2e8f0; font-weight: 600; text-transform: uppercase;">${escapeHtml(p.plan_tier)}</span></div>
        <div><span style="color: #64748b; font-size: 13px;">Features</span> · <span style="color: #e2e8f0; font-size: 13px;">${escapeHtml(featureList.join(' · '))}</span></div>
      </div>
      <div style="background: #1e293b; border: 1px solid #f97316; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 12px; color: #fb923c; font-weight: 600; margin-bottom: 8px;">ACTIVATION KEY</div>
        <code style="font-size: 18px; font-family: monospace; color: #f97316; font-weight: 700;">${escapeHtml(p.activation_key)}</code>
      </div>
      <a href="${setupUrl}" style="display: inline-block; background: #f97316; color: #ffffff; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">Launch Setup Wizard</a>
      <p style="font-size: 11px; color: #475569; margin-top: 32px;">FleetVu — Sent via welcome@fleetvu.org. Do not reply to this automated message.</p>
    </div>
  `;
}

function buildInviteHtml(p: TeamInvitePayload): string {
  const inviteUrl = `${APP_URL}/accept-invite?token=${p.invite_token}`;
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <div style="font-size: 20px; font-weight: 700; color: #ffffff;">FleetVu</div>
      <div style="font-size: 11px; color: #fb923c; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 24px;">Team Invite · welcome@fleetvu.org</div>
      <h1 style="font-size: 24px; color: #ffffff; margin: 0 0 16px;">You're Invited to FleetVu</h1>
      <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px;">
        <strong style="color: #e2e8f0;">${escapeHtml(p.provisioned_by_name)}</strong> invited you
        ${p.company_name ? ` at <strong>${escapeHtml(p.company_name)}</strong>` : ''} as
        <strong style="color: #fb923c;">${escapeHtml(p.role)}</strong>.
      </p>
      <a href="${inviteUrl}" style="display: inline-block; background: #f97316; color: #ffffff; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">Activate Your Account</a>
      <p style="font-size: 11px; color: #475569; margin-top: 32px;">FleetVu — Sent via welcome@fleetvu.org.</p>
    </div>
  `;
}

function buildReportHtml(p: DriverReportPayload): string {
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <div style="font-size: 20px; font-weight: 700; color: #ffffff;">FleetVu</div>
      <div style="font-size: 11px; color: #fb923c; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 24px;">Safety Report · safetyreport@fleetvu.org</div>
      <h1 style="font-size: 22px; color: #ffffff; margin: 0 0 16px;">${escapeHtml(p.report_type)}</h1>
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="margin-bottom: 8px;"><span style="color: #64748b;">Driver</span> · <strong>${escapeHtml(p.driver_name)}</strong></div>
        <div style="margin-bottom: 8px;"><span style="color: #64748b;">Company</span> · <strong>${escapeHtml(p.company_name || '—')}</strong></div>
        <div><span style="color: #64748b;">Report</span> · <strong>${escapeHtml(p.report_type)}</strong></div>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #94a3b8;">${escapeHtml(p.report_summary)}</p>
      ${p.download_url ? `<a href="${p.download_url}" style="display: inline-block; background: #f97316; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Download Full Report</a>` : ''}
      <p style="font-size: 11px; color: #475569; margin-top: 32px;">FleetVu — Sent via safetyreport@fleetvu.org.</p>
    </div>
  `;
}

/** Wire queue persistence to Supabase when available (best-effort). */
async function persistDispatch(entry: DispatchQueueEntry): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const sb = createClient(url, key);
    await sb.from('email_dispatch_log').upsert({
      id: entry.id,
      identity: entry.message.identity,
      from_address: `${entry.message.identity}@fleetvu.org`,
      to_addresses: Array.isArray(entry.message.to) ? entry.message.to : [entry.message.to],
      subject: entry.message.subject,
      status: entry.status,
      attempts: entry.attempts,
      max_attempts: entry.maxAttempts,
      provider: entry.result?.provider ?? null,
      last_error: entry.lastError,
      correlation_id: entry.message.correlationId ?? null,
      metadata: entry.message.metadata ?? {},
      queued_at: entry.createdAt,
      sent_at: entry.result?.sentAt ?? null,
      updated_at: entry.updatedAt,
    });
  } catch (err) {
    console.error('[FleetVu Email] DB persist skipped:', err);
  }
}

emailDispatchQueue.setPersistence(persistDispatch);

export async function GET() {
  return NextResponse.json(
    {
      identities: ['support@fleetvu.org', 'welcome@fleetvu.org', 'safetyreport@fleetvu.org', 'notice@fleetvu.org'],
      queue: emailDispatchQueue.getQueueSnapshot(),
      transport: getTransportStats(),
    },
    { headers: corsHeaders },
  );
}

export async function POST(req: NextRequest) {
  let payload: EmailPayload;
  try {
    payload = (await req.json()) as EmailPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: corsHeaders });
  }

  try {
    if (payload.type === 'CLIENT_SETUP_LINK') {
      const result = await dispatchCorporateEmail(
        {
          identity: identityForEmailType(payload.type),
          to: payload.to_email,
          subject: `Welcome to FleetVu — ${payload.organization_name} setup`,
          html: buildSetupLinkHtml(payload),
          correlationId: payload.setup_token,
          metadata: { type: payload.type, organization: payload.organization_name },
          priority: 'high',
        },
        { awaitDelivery: true },
      );
      if (!result.success && result.status === 'dead_letter') {
        return NextResponse.json({ error: result.error }, { status: 502, headers: corsHeaders });
      }
      return NextResponse.json(
        { success: true, message: `Setup link sent to ${payload.to_email}`, dispatch: result },
        { status: 200, headers: corsHeaders },
      );
    }

    if (payload.type === 'TEST_SMTP_CONNECTION') {
      const smtp = payload.smtp;
      if (!smtp?.host || !smtp?.username || !smtp?.password) {
        return NextResponse.json(
          { error: 'SMTP host, username, and password are required.' },
          { status: 400, headers: corsHeaders },
        );
      }
      const result = await sendWithSmtpCredentials(
        {
          from: smtp.fromEmail || smtp.username,
          fromName: smtp.fromDisplayName || 'FleetVu SMTP Test',
          to: [smtp.username],
          subject: 'FleetVu SMTP connection test',
          html: '<p>SMTP TLS connection verified by FleetVu CRM.</p>',
          text: 'SMTP TLS connection verified by FleetVu CRM.',
          cc: [],
          bcc: [],
        },
        {
          host: smtp.host,
          port: smtp.port || 465,
          tlsEnabled: smtp.tlsEnabled !== false,
          username: smtp.username,
          password: smtp.password,
        },
      );
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error, latencyMs: result.latencyMs },
          { status: 502, headers: corsHeaders },
        );
      }
      return NextResponse.json(
        {
          success: true,
          message: `SMTP OK · ${smtp.host}:${smtp.port || 465} · TLS ${smtp.tlsEnabled !== false ? 'on' : 'off'}`,
          providerMessageId: result.providerMessageId,
          latencyMs: result.latencyMs,
        },
        { status: 200, headers: corsHeaders },
      );
    }

    if (payload.type === 'WELCOME_ROSTER_PORTAL') {
      const { buildWelcomeRosterEmail } = await import('@/lib/email/welcome-roster-template');
      const appBase =
        (payload.app_base_url || APP_URL).trim().replace(/\/+$/, '') || 'https://app.fleetvu.org';

      // Persist roster token (Supabase table, or local .data fallback if migration not applied)
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
      const companyId =
        payload.company_id &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          payload.company_id,
        )
          ? payload.company_id
          : null;

      const { upsertRosterToken } = await import('@/lib/roster/token-store');
      const persist = await upsertRosterToken({
        token: payload.roster_token,
        company_id: companyId,
        company_name: payload.organization_name,
        contact_email: payload.to_email,
        contact_name: payload.to_name,
        driver_seat_limit: Math.max(1, Math.min(500, payload.driver_seat_limit || 25)),
        status: 'active',
        expires_at: expires,
      });

      if (!persist.ok) {
        return NextResponse.json(
          {
            error: `Roster portal link could not be saved: ${persist.error}`,
            code: 'ROSTER_TOKEN_PERSIST_FAILED',
          },
          { status: 500, headers: corsHeaders },
        );
      }

      const built = buildWelcomeRosterEmail({
        organizationName: payload.organization_name,
        contactName: payload.to_name,
        rosterToken: payload.roster_token,
        driverSeatLimit: payload.driver_seat_limit,
        appBaseUrl: appBase,
      });
      const { html, attachments, portalUrl } = built;
      const subject = `Welcome aboard — Access your FleetVu Roster Portal (${payload.organization_name})`;
      const welcomeIdentity = CORPORATE_IDENTITIES.welcome;
      const fromEmail =
        payload.smtp_override?.fromEmail || welcomeIdentity.address;
      const fromName =
        payload.smtp_override?.fromDisplayName || welcomeIdentity.displayName;

      if (payload.live && payload.smtp_override) {
        const smtp = payload.smtp_override;
        if (!smtp.host || !smtp.username || !smtp.password) {
          return NextResponse.json(
            {
              error:
                'LIVE SMTP requires host, username, and password. Save SMTP Config with your password, then retry.',
              code: 'SMTP_CREDENTIALS_REQUIRED',
            },
            { status: 400, headers: corsHeaders },
          );
        }
        const result = await sendWithSmtpCredentials(
          {
            from: fromEmail,
            fromName,
            to: [payload.to_email],
            subject,
            html,
            cc: [],
            bcc: [],
            replyTo: fromEmail,
            attachments,
          },
          {
            host: smtp.host,
            port: smtp.port || 465,
            tlsEnabled: smtp.tlsEnabled !== false,
            username: smtp.username,
            password: smtp.password,
          },
        );
        if (!result.success) {
          return NextResponse.json(
            { error: result.error, latencyMs: result.latencyMs },
            { status: 502, headers: corsHeaders },
          );
        }
        return NextResponse.json(
          {
            success: true,
            message: `Welcome roster email sent to ${payload.to_email}`,
            portal_url: portalUrl,
            storage: persist.storage,
            dispatch: {
              success: true,
              status: 'sent',
              provider: 'smtp',
              providerMessageId: result.providerMessageId,
              latencyMs: result.latencyMs,
            },
          },
          { status: 200, headers: corsHeaders },
        );
      }

      const result = await dispatchCorporateEmail(
        {
          identity: 'welcome',
          to: payload.to_email,
          subject,
          html,
          attachments,
          correlationId: payload.roster_token,
          metadata: {
            type: payload.type,
            organization: payload.organization_name,
            driver_seat_limit: payload.driver_seat_limit,
            app_base_url: appBase,
            storage: persist.storage,
          },
          priority: 'high',
        },
        { awaitDelivery: true },
      );
      if (!result.success && result.status === 'dead_letter') {
        return NextResponse.json({ error: result.error }, { status: 502, headers: corsHeaders });
      }
      return NextResponse.json(
        {
          success: true,
          message: `Welcome roster email sent to ${payload.to_email}`,
          portal_url: portalUrl,
          storage: persist.storage,
          dispatch: result,
        },
        { status: 200, headers: corsHeaders },
      );
    }

    if (payload.type === 'TEAM_INVITE') {
      const result = await dispatchCorporateEmail(
        {
          identity: identityForEmailType(payload.type),
          to: payload.to_email,
          subject: `You're invited to FleetVu — Set up your account`,
          html: buildInviteHtml(payload),
          correlationId: payload.invite_token,
          metadata: { type: payload.type },
          priority: 'high',
        },
        { awaitDelivery: true },
      );
      if (!result.success && result.status === 'dead_letter') {
        return NextResponse.json({ error: result.error }, { status: 502, headers: corsHeaders });
      }
      return NextResponse.json(
        { success: true, message: `Invitation sent to ${payload.to_email}`, dispatch: result },
        { status: 200, headers: corsHeaders },
      );
    }

    if (payload.type === 'VAULT_SERVICE_REQUEST') {
      const html = `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
          <div style="font-size: 20px; font-weight: 700;">FleetVu</div>
          <div style="font-size: 11px; color: #fb923c; margin-bottom: 24px;">Vault Service Request · notice@fleetvu.org</div>
          <h1 style="font-size: 22px; color: #ffffff;">New Vault Service Request</h1>
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <div>Contact: <strong>${escapeHtml(payload.contact_name)}</strong></div>
            <div>Company: <strong>${escapeHtml(payload.company_name)}</strong></div>
            <div>Location: <strong>${escapeHtml(payload.location || '—')}</strong></div>
            <div>Fleet size / vehicles: <strong>${escapeHtml(payload.fleet_size || payload.vehicle_count)}</strong></div>
            <div>Phone: <strong>${escapeHtml(payload.phone)}</strong></div>
            <div>Email: <strong>${escapeHtml(payload.email)}</strong></div>
            <div>Preferred call time: <strong>${escapeHtml(payload.preferred_call_time || '—')}</strong></div>
            ${payload.notes ? `<div style="margin-top: 12px;">Notes: ${escapeHtml(payload.notes)}</div>` : ''}
          </div>
        </div>
      `;
      const result = await dispatchCorporateEmail(
        {
          identity: 'notice',
          to: 'sales@fleetvu.org',
          subject: `Vault Service Request — ${payload.company_name} (${payload.contact_name})`,
          html,
          priority: 'high',
          metadata: { type: payload.type },
        },
        { awaitDelivery: true },
      );
      if (!result.success && result.status === 'dead_letter') {
        return NextResponse.json({ error: result.error }, { status: 502, headers: corsHeaders });
      }
      return NextResponse.json(
        { success: true, message: 'Vault service request sent to FleetVu sales team.', dispatch: result },
        { status: 200, headers: corsHeaders },
      );
    }

    if (payload.type === 'DRIVER_FULL_REPORT') {
      // LEGAL ISOLATION: safety reports never go to FleetVu Global Admin / @fleetvu.org
      if (isFleetVuPlatformMailbox(payload.to_email)) {
        return NextResponse.json(
          {
            error:
              'Legal isolation: safety reports cannot be delivered to FleetVu platform mailboxes. Send only to customer Super Admin / Admin.',
            code: 'LEGAL_ISOLATION_DENIED',
          },
          { status: 403, headers: corsHeaders },
        );
      }
      const result = await dispatchCorporateEmail(
        {
          identity: identityForEmailType(payload.type),
          to: payload.to_email,
          subject: `FleetVu Safety Report — ${payload.report_type} for ${payload.driver_name}`,
          html: buildReportHtml(payload),
          attachments: payload.attachments?.map((a) => ({
            filename: a.filename,
            contentBase64: a.content_base64,
            contentType: a.content_type,
          })),
          priority: 'high',
          metadata: { type: payload.type, driver: payload.driver_name, legal_isolation: 'customer_tenant_exclusive' },
        },
        { awaitDelivery: true },
      );
      if (!result.success && result.status === 'dead_letter') {
        return NextResponse.json({ error: result.error }, { status: 502, headers: corsHeaders });
      }
      return NextResponse.json(
        { success: true, message: `Report sent to ${payload.to_email}`, dispatch: result },
        { status: 200, headers: corsHeaders },
      );
    }

    if (payload.type === 'GENERIC_DISPATCH') {
      const isLegalIdentity =
        payload.identity === 'notice' || payload.identity === 'safetyreport';
      const looksLikeIncident =
        /incident|accident|reconstruction|safety report|forensic/i.test(payload.subject || '');

      let recipients = payload.to;
      if (isLegalIdentity || looksLikeIncident) {
        const { allowed, blocked } = filterCustomerOnlyRecipients(payload.to);
        if (blocked.length > 0) {
          console.warn(
            '[FleetVu Legal Isolation] Blocked platform recipients from legal alert:',
            blocked,
          );
        }
        if (allowed.length === 0) {
          return NextResponse.json(
            {
              error:
                'Legal isolation: no customer recipients remain after filtering FleetVu platform mailboxes.',
              code: 'LEGAL_ISOLATION_DENIED',
              blocked,
            },
            { status: 403, headers: corsHeaders },
          );
        }
        recipients = allowed.length === 1 ? allowed[0] : allowed;
      }

      const result = await dispatchCorporateEmail(
        {
          identity: payload.identity,
          to: recipients,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          correlationId: payload.correlationId,
          priority: payload.priority,
        },
        { awaitDelivery: true },
      );
      return NextResponse.json({ success: result.success, dispatch: result }, { status: 200, headers: corsHeaders });
    }

    return NextResponse.json({ error: 'Unknown email type.' }, { status: 400, headers: corsHeaders });
  } catch (err) {
    console.error('[FleetVu Email API]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Email dispatch failed' },
      { status: 500, headers: corsHeaders },
    );
  }
}
