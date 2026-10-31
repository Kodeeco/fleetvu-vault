import { NextRequest, NextResponse } from 'next/server';
import { getRosterToken } from '@/lib/roster/token-store';
import { getFleetAccountSettings, saveFleetAccountSettings } from '@/lib/fleet-account/account-settings-store';
import { appendFleetAudit, listFleetAudit } from '@/lib/fleet-account/audit-store';
import {
  createPortalSession,
  findCredentialByEmail,
  hasPortalPassword,
  resolvePortalSession,
  setPortalPassword,
  verifyPortalPassword,
} from '@/lib/fleet-account/portal-auth';
import { listAllRosterTokens } from '@/lib/roster/token-store';
import {
  createIncidentShare,
  listIncidentShares,
  revokeIncidentShare,
} from '@/lib/fleet-account/share-store';
import { listLocalCompanies } from '@/lib/crm/companies-store';
import type { FleetAccountCadence, ReportKind, ReportRecipient } from '@/lib/fleet-account/types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Fleet-Session',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

function clientMeta(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = (fwd?.split(',')[0] || req.headers.get('x-real-ip') || '').trim() || null;
  const userAgent = req.headers.get('user-agent');
  return { ip, userAgent };
}

async function resolveCompanyFromToken(token: string) {
  const found = await getRosterToken(token);
  if (!found) return null;
  const portal = found.portal;
  const companyId = portal.company_id || `token:${token.slice(0, 12)}`;
  return {
    companyId,
    companyName: portal.company_name,
    contactEmail: portal.contact_email,
    contactName: portal.contact_name,
    token,
  };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const view = req.nextUrl.searchParams.get('view') || 'bootstrap';
  const sessionHeader = req.headers.get('x-fleet-session');

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400, headers: corsHeaders });
  }

  const ctx = await resolveCompanyFromToken(token);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid portal token' }, { status: 404, headers: corsHeaders });
  }

  const companies = listLocalCompanies();
  const company = companies.find((c) => c.id === ctx.companyId || c.name === ctx.companyName);
  const logoUrl = company?.logo_url || null;

  if (view === 'bootstrap') {
    const settings = await getFleetAccountSettings(ctx.companyId, ctx.companyName);
    const passwordSet = hasPortalPassword(ctx.companyId, ctx.contactEmail);
    const session = resolvePortalSession(sessionHeader);
    return NextResponse.json(
      {
        companyId: ctx.companyId,
        companyName: ctx.companyName,
        contactEmail: ctx.contactEmail,
        contactName: ctx.contactName,
        logoUrl,
        passwordSet,
        sessionEmail: session?.email || null,
        settings,
      },
      { headers: corsHeaders },
    );
  }

  if (view === 'audit') {
    const entries = await listFleetAudit(ctx.companyId, { limit: 500 });
    return NextResponse.json({ entries }, { headers: corsHeaders });
  }

  if (view === 'shares') {
    const shares = await listIncidentShares(ctx.companyId);
    return NextResponse.json({ shares }, { headers: corsHeaders });
  }

  if (view === 'settings') {
    const settings = await getFleetAccountSettings(ctx.companyId, ctx.companyName);
    return NextResponse.json({ settings }, { headers: corsHeaders });
  }

  return NextResponse.json({ error: 'Unknown view' }, { status: 400, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const token = String(body.token || '');
  const meta = clientMeta(req);

  /** Canonical /vault entrance — email + password, no invite token required after activation */
  if (action === 'login_email') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const cred = findCredentialByEmail(email);
    if (!cred) {
      return NextResponse.json(
        {
          error:
            'No Vault Portal password for this email yet. Open your welcome link once and set a password under Login.',
        },
        { status: 401, headers: corsHeaders },
      );
    }
    const verified = verifyPortalPassword(cred.companyId, email, password);
    if (!verified.ok) {
      await appendFleetAudit({
        companyId: cred.companyId,
        action: 'login_failed',
        actorEmail: email,
        ...meta,
        detail: 'Invalid portal password (vault entrance)',
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: corsHeaders });
    }

    const all = await listAllRosterTokens();
    const match =
      all.find((t) => t.contact_email?.toLowerCase() === email) ||
      all.find((t) => t.company_id === cred.companyId);

    if (!match?.token) {
      return NextResponse.json(
        {
          error:
            'Signed in, but no active roster portal was found for this company. Ask FleetVu to resend onboarding.',
        },
        { status: 409, headers: corsHeaders },
      );
    }

    const sessionToken = createPortalSession({
      companyId: cred.companyId,
      email,
      role: verified.role,
    });
    await appendFleetAudit({
      companyId: cred.companyId,
      token: match.token,
      action: 'login',
      actorEmail: email,
      ...meta,
      detail: 'Vault Portal entrance login',
    });
    return NextResponse.json(
      {
        ok: true,
        sessionToken,
        role: verified.role,
        portalToken: match.token,
        companyId: cred.companyId,
      },
      { headers: corsHeaders },
    );
  }

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400, headers: corsHeaders });
  }

  const ctx = await resolveCompanyFromToken(token);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid portal token' }, { status: 404, headers: corsHeaders });
  }

  if (action === 'set_password') {
    const password = String(body.password || '');
    const email = String(body.email || ctx.contactEmail || '').trim().toLowerCase();
    const result = setPortalPassword({
      companyId: ctx.companyId,
      email,
      password,
      role: 'super_admin',
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    await appendFleetAudit({
      companyId: ctx.companyId,
      token,
      action: 'password_set',
      actorEmail: email,
      actorName: ctx.contactName,
      ...meta,
      detail: 'Portal password set / updated',
    });
    const sessionToken = createPortalSession({
      companyId: ctx.companyId,
      email,
      role: 'super_admin',
    });
    return NextResponse.json({ ok: true, sessionToken }, { headers: corsHeaders });
  }

  if (action === 'login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const verified = verifyPortalPassword(ctx.companyId, email, password);
    if (!verified.ok) {
      await appendFleetAudit({
        companyId: ctx.companyId,
        token,
        action: 'login_failed',
        actorEmail: email,
        ...meta,
        detail: 'Invalid portal password',
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: corsHeaders });
    }
    const sessionToken = createPortalSession({
      companyId: ctx.companyId,
      email,
      role: verified.role,
    });
    await appendFleetAudit({
      companyId: ctx.companyId,
      token,
      action: 'login',
      actorEmail: email,
      ...meta,
      detail: 'Portal login success',
    });
    return NextResponse.json({
      ok: true,
      sessionToken,
      role: verified.role,
      portalToken: token,
      companyId: ctx.companyId,
    }, { headers: corsHeaders });
  }

  if (action === 'save_settings') {
    const cadence = body.safetyDigestCadence as FleetAccountCadence | undefined;
    const recipients = body.recipients as Partial<Record<ReportKind, ReportRecipient[]>> | undefined;
    const notifyDriverOnSensorFault =
      typeof body.notifyDriverOnSensorFault === 'boolean'
        ? body.notifyDriverOnSensorFault
        : undefined;
    const updatedBy = String(body.updatedBy || ctx.contactEmail || 'portal');
    const settings = await saveFleetAccountSettings({
      companyId: ctx.companyId,
      companyName: ctx.companyName,
      safetyDigestCadence: cadence,
      recipients,
      notifyDriverOnSensorFault,
      updatedBy,
    });
    await appendFleetAudit({
      companyId: ctx.companyId,
      token,
      action: 'settings_update',
      actorEmail: updatedBy,
      actorName: ctx.contactName,
      ...meta,
      detail: `Settings updated (cadence=${settings.safetyDigestCadence})`,
      meta: { safetyDigestCadence: settings.safetyDigestCadence },
    });
    return NextResponse.json({ ok: true, settings }, { headers: corsHeaders });
  }

  if (action === 'create_share') {
    const incidentId = String(body.incidentId || '').trim();
    const recipients = Array.isArray(body.recipients) ? body.recipients.map(String) : [];
    if (!incidentId) {
      return NextResponse.json({ error: 'incidentId required' }, { status: 400, headers: corsHeaders });
    }
    if (!recipients.length) {
      return NextResponse.json({ error: 'At least one recipient email required' }, { status: 400, headers: corsHeaders });
    }
    const createdBy = String(body.createdBy || ctx.contactEmail || 'portal');
    const share = await createIncidentShare({
      companyId: ctx.companyId,
      incidentId,
      incidentLabel: body.incidentLabel ? String(body.incidentLabel) : undefined,
      createdBy,
      recipients,
      expiresInDays: typeof body.expiresInDays === 'number' ? body.expiresInDays : 14,
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.fleetvu.org';
    const shareUrl = `${appUrl}/share/incident?t=${encodeURIComponent(share.token)}`;
    await appendFleetAudit({
      companyId: ctx.companyId,
      token,
      action: 'incident_share_create',
      actorEmail: createdBy,
      ...meta,
      detail: `Secure share created for incident ${incidentId}`,
      meta: { shareId: share.id, recipients: share.recipients, expiresAt: share.expiresAt },
    });
    return NextResponse.json({ ok: true, share, shareUrl }, { headers: corsHeaders });
  }

  if (action === 'revoke_share') {
    const shareId = String(body.shareId || '');
    const ok = await revokeIncidentShare(ctx.companyId, shareId);
    if (ok) {
      await appendFleetAudit({
        companyId: ctx.companyId,
        token,
        action: 'incident_share_revoke',
        actorEmail: String(body.updatedBy || ctx.contactEmail || ''),
        ...meta,
        detail: `Share revoked ${shareId}`,
      });
    }
    return NextResponse.json({ ok }, { headers: corsHeaders });
  }

  if (action === 'audit_event') {
    await appendFleetAudit({
      companyId: ctx.companyId,
      token,
      action: body.auditAction || 'report_view',
      actorEmail: body.actorEmail || ctx.contactEmail,
      ...meta,
      detail: body.detail || null,
    });
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders });
}
