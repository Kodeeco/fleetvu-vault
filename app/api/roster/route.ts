import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dispatchCorporateEmail } from '@/lib/email';
import { sendWithSmtpCredentials } from '@/lib/email/transport';
import { getLiveCrmSmtp } from '@/lib/crm/email-config-server';
import { buildDriverKeycodeWelcomeHtml } from '@/lib/email/welcome-roster-template';
import {
  buildFleetVuEmailHtml,
  emailDetailCard,
  vaultEmailLogoSrc,
} from '@/lib/email/fleetvu-email-chrome';
import { vaultEmailLogoAttachment } from '@/lib/email/email-logo-server';
import {
  clearRosterKeycode,
  deleteRosterToken,
  findRosterKeycode,
  getRosterToken,
  listAllRosterTokens,
  listRosterEntries,
  replaceRosterEntries,
  trimRosterTokens,
  updateRosterTokenStatus,
} from '@/lib/roster/token-store';
import {
  clearDriverKeycode,
  findDriverByEmail,
  findDriverByKeycode,
  upsertCompanyDrivers,
} from '@/lib/crm/company-drivers-store';
import { listLocalCompanies } from '@/lib/crm/companies-store';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.fleetvu.org';

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** FV-XXXX-XXXX — second segment digits only (matches driver Vault onboarding regex). */
function makeKeycode(role: string): string {
  const prefix = role === 'desktop_user' || role === 'manager' ? 'TMP' : 'FV';
  const a = Math.floor(1000 + Math.random() * 9000);
  const b = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${a}-${b}`;
}

async function sendKeycodeEmail(opts: {
  to: string;
  subject: string;
  html: string;
  correlationId?: string;
  companyId?: string | null;
}): Promise<{ ok: boolean; provider: string; error?: string }> {
  const liveCrm = getLiveCrmSmtp({ trigger: 'driver_keycodes' });
  if (liveCrm) {
    const result = await sendWithSmtpCredentials(
      {
        from: liveCrm.fromEmail,
        fromName: liveCrm.fromDisplayName,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        cc: [],
        bcc: [],
        replyTo: liveCrm.fromEmail,
      },
      {
        host: liveCrm.smtp.host,
        port: liveCrm.smtp.port || 465,
        tlsEnabled: liveCrm.smtp.tlsEnabled !== false,
        username: liveCrm.smtp.username,
        password: liveCrm.smtp.password,
      },
    );
    if (!result.success) {
      return { ok: false, provider: 'smtp', error: result.error || 'SMTP send failed' };
    }
    return { ok: true, provider: 'smtp' };
  }

  const result = await dispatchCorporateEmail(
    {
      identity: 'welcome',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      priority: 'high',
      correlationId: opts.correlationId,
      metadata: { type: 'DRIVER_KEYCODE', company_id: opts.companyId },
    },
    { awaitDelivery: true },
  );
  if (!result.success && result.status === 'dead_letter') {
    return { ok: false, provider: result.provider || 'dispatch', error: result.error };
  }
  if (result.provider === 'dry_run') {
    return {
      ok: false,
      provider: 'dry_run',
      error:
        'Keycode email not delivered — SMTP is not LIVE. Open CRM → Email → Save SMTP Config (LIVE on).',
    };
  }
  return { ok: true, provider: result.provider || 'dispatch' };
}

/** GET ?token= — portal session · GET ?queue=1 — CRM review list */
export async function GET(req: NextRequest) {
  const queue = req.nextUrl.searchParams.get('queue');
  if (queue === '1' || queue === 'true') {
    try {
      const tokens = await listAllRosterTokens();
      return NextResponse.json(
        {
          tokens: tokens.map((t) => ({
            token: t.token,
            company_name: t.company_name,
            contact_email: t.contact_email,
            driver_seat_limit: t.driver_seat_limit,
            status: t.status,
            submitted_at: t.submitted_at ?? null,
            created_at: t.created_at ?? null,
            storage: t.storage,
          })),
        },
        { headers: corsHeaders },
      );
    } catch (err) {
      console.error('[api/roster] queue', err);
      return NextResponse.json(
        {
          error:
            err instanceof Error && /fetch failed/i.test(err.message)
              ? 'Cannot reach Supabase while loading roster queue.'
              : err instanceof Error
                ? err.message
                : 'Failed to load roster queue',
          tokens: [],
        },
        { status: 502, headers: corsHeaders },
      );
    }
  }

  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400, headers: corsHeaders });
  }

  const found = await getRosterToken(token);
  if (!found) {
    return NextResponse.json(
      {
        error:
          'Invalid or expired roster link. Ask FleetVu to resend your welcome email, then use the newest link.',
      },
      { status: 404, headers: corsHeaders },
    );
  }

  const portal = found.portal;
  // Expired links still open — Fleet Account Portal is permanent until Ops revokes the token.
  // (Legacy onboarding used 14-day / 24h expires_at; those are ignored for access.)

  const entries = await listRosterEntries(token);

  let logoUrl: string | null = null;
  try {
    const companies = listLocalCompanies();
    const match = companies.find(
      (c) =>
        (portal.company_id && c.id === portal.company_id) ||
        c.name === portal.company_name,
    );
    logoUrl = match?.logo_url || null;
  } catch {
    /* optional branding */
  }

  return NextResponse.json(
    {
      portal: {
        token: portal.token,
        companyId: portal.company_id,
        companyName: portal.company_name,
        contactEmail: portal.contact_email,
        contactName: portal.contact_name,
        driverSeatLimit: portal.driver_seat_limit,
        status: portal.status,
        expiresAt: portal.expires_at,
        logoUrl,
      },
      entries,
      storage: found.storage,
    },
    { headers: corsHeaders },
  );
}

/**
 * POST actions:
 *  - save_entries: replace draft rows (capped by seat limit)
 *  - submit: mark portal submitted for FleetVu review
 *  - approve: Global Admin — issue one-time keycodes + welcome emails
 *  - resend_keycode: CRM — new one-time keycode email for one driver (lost phone / used code)
 *  - verify_keycode: driver onboarding — validate issued keycode
 *  - burn_keycode: after biometric bind — mark used + clear roster mirrors
 */
export async function POST(req: NextRequest) {
  let body: {
    action?:
      | 'save_entries'
      | 'submit'
      | 'approve'
      | 'resend_keycode'
      | 'verify_keycode'
      | 'burn_keycode'
      | 'delete_token'
      | 'trim_queue';
    token?: string;
    keycode?: string;
    keycodeId?: string;
    deviceFingerprint?: string;
    companyId?: string;
    email?: string;
    driverId?: string;
    includeAwaiting?: boolean;
    includeApproved?: boolean;
    olderThanDays?: number;
    entries?: Array<{
      full_name: string;
      email: string;
      role?: string;
      location?: string;
      sensor_serial?: string;
      truck_number?: string;
    }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  if (body.action === 'delete_token') {
    if (!body.token) {
      return NextResponse.json({ error: 'token required' }, { status: 400, headers: corsHeaders });
    }
    try {
      const result = await deleteRosterToken(body.token);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404, headers: corsHeaders });
      }
      return NextResponse.json(
        {
          success: true,
          storage: result.storage,
          mode: result.mode,
          token: body.token,
        },
        { headers: corsHeaders },
      );
    } catch (err) {
      const message =
        err instanceof Error && /fetch failed/i.test(err.message)
          ? 'Cannot reach Supabase (network). Delete aborted — check SUPABASE URL / connectivity.'
          : err instanceof Error
            ? err.message
            : 'Delete failed';
      console.error('[api/roster] delete_token', err);
      return NextResponse.json({ error: message }, { status: 502, headers: corsHeaders });
    }
  }

  if (body.action === 'trim_queue') {
    const result = await trimRosterTokens({
      includeAwaiting: body.includeAwaiting !== false,
      includeApproved: Boolean(body.includeApproved),
      olderThanDays: typeof body.olderThanDays === 'number' ? body.olderThanDays : undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500, headers: corsHeaders });
    }
    return NextResponse.json(
      { success: true, removed: result.removed, tokens: result.tokens },
      { headers: corsHeaders },
    );
  }

  if (body.action === 'burn_keycode') {
    const code = (body.keycode || '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: 'keycode required' }, { status: 400, headers: corsHeaders });
    }
    const deviceFingerprint = (body.deviceFingerprint || '').trim() || null;
    const keycodeId = (body.keycodeId || '').trim();
    const client = sb();
    let burnedRows = 0;

    if (client) {
      const patch = {
        lifecycle_status: 'burned',
        burned_at: new Date().toISOString(),
        burned_by_device: deviceFingerprint,
        biometric_bound: true,
      };
      if (keycodeId && !keycodeId.startsWith('roster_') && keycodeId !== 'demo-keycode') {
        const { data } = await client
          .from('driver_access_keycodes')
          .update(patch)
          .eq('id', keycodeId)
          .select('id');
        burnedRows += Array.isArray(data) ? data.length : 0;
      }
      const { data: byCode } = await client
        .from('driver_access_keycodes')
        .update(patch)
        .eq('keycode', code)
        .neq('lifecycle_status', 'burned')
        .select('id');
      burnedRows += Array.isArray(byCode) ? byCode.length : 0;
    }

    const rosterCleared = await clearRosterKeycode(code);
    const mirrorCleared = clearDriverKeycode(code);

    return NextResponse.json(
      {
        ok: true,
        burnedRows,
        rosterCleared,
        mirrorCleared,
      },
      { headers: corsHeaders },
    );
  }

  if (body.action === 'verify_keycode') {
    const code = (body.keycode || '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: 'keycode required' }, { status: 400, headers: corsHeaders });
    }
    if (!/^FV-\d{4}-\d{4}$/.test(code) && !/^TMP-\d{4}-\d{4}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid format. Keycode must be FV-XXXX-XXXX.' },
        { status: 400, headers: corsHeaders },
      );
    }

    const client = sb();
    if (client) {
      const { data, error } = await client
        .from('driver_access_keycodes')
        .select('*')
        .eq('keycode', code)
        .maybeSingle();
      if (!error && data) {
        if (data.lifecycle_status === 'burned') {
          return NextResponse.json(
            { error: 'This keycode has already been used. Request a new one from your administrator.' },
            { status: 410, headers: corsHeaders },
          );
        }
        if (data.lifecycle_status === 'revoked') {
          return NextResponse.json(
            { error: 'This keycode has been revoked. Contact your administrator.' },
            { status: 410, headers: corsHeaders },
          );
        }
        if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
          return NextResponse.json(
            { error: 'This keycode has expired. Request a new one from your administrator.' },
            { status: 410, headers: corsHeaders },
          );
        }
        const email = data.dispatch_destination || null;
        const rosterHit = await findRosterKeycode(code);
        const stored =
          email && data.company_id
            ? findDriverByEmail(data.company_id, email)
            : email
              ? findDriverByEmail(null, email)
              : null;
        // Prefer real truck from roster/company store; never treat truck as driver_number.
        const truckNumber =
          (rosterHit?.truck_number || stored?.truckNumber || '').trim() || null;
        const liveCompany = data.company_id
          ? listLocalCompanies().find((c) => c.id === data.company_id)
          : null;
        const companyName =
          liveCompany?.name || stored?.companyName || data.company_name || null;
        const location =
          (stored?.location || '').trim() ||
          (liveCompany?.location || '').trim() ||
          null;

        return NextResponse.json(
          {
            ok: true,
            source: 'driver_access_keycodes',
            record: {
              id: data.id,
              keycode: data.keycode,
              driver_name: data.driver_name || stored?.fullName || null,
              driver_number: stored?.id || data.driver_number || null,
              company_id: data.company_id,
              company_name: companyName,
              truck_number: truckNumber,
              location,
              sensor_serial: stored?.sensorSerial || null,
              lifecycle_status: data.lifecycle_status,
              email,
            },
          },
          { headers: corsHeaders },
        );
      }
    }

    const rosterHit = await findRosterKeycode(code);
    if (rosterHit) {
      const stored = findDriverByEmail(rosterHit.company_id, rosterHit.email);
      const liveCompany = rosterHit.company_id
        ? listLocalCompanies().find((c) => c.id === rosterHit.company_id)
        : null;
      const companyName =
        liveCompany?.name || stored?.companyName || rosterHit.company_name || null;
      const location =
        (stored?.location || '').trim() ||
        (liveCompany?.location || '').trim() ||
        null;
      return NextResponse.json(
        {
          ok: true,
          source: 'roster_portal',
          record: {
            id: rosterHit.entry_id || `roster_${rosterHit.token}`,
            keycode: rosterHit.keycode,
            driver_name: rosterHit.driver_name,
            driver_number: stored?.id || null,
            company_id: rosterHit.company_id,
            company_name: companyName,
            truck_number: (rosterHit.truck_number || stored?.truckNumber || '').trim() || null,
            location,
            sensor_serial: stored?.sensorSerial || null,
            lifecycle_status: 'dispatched',
            email: rosterHit.email,
          },
        },
        { headers: corsHeaders },
      );
    }

    // CRM Resend Key-Code may only have written the company-drivers mirror.
    const mirrored = findDriverByKeycode(code);
    if (mirrored) {
      const liveCompany = listLocalCompanies().find((c) => c.id === mirrored.companyId);
      return NextResponse.json(
        {
          ok: true,
          source: 'company_drivers',
          record: {
            id: mirrored.id,
            keycode: code,
            driver_name: mirrored.fullName,
            driver_number: mirrored.id,
            company_id: mirrored.companyId,
            company_name: liveCompany?.name || mirrored.companyName || null,
            truck_number: (mirrored.truckNumber || '').trim() || null,
            location:
              (mirrored.location || '').trim() ||
              (liveCompany?.location || '').trim() ||
              null,
            sensor_serial: mirrored.sensorSerial || null,
            lifecycle_status: 'dispatched',
            email: mirrored.email,
          },
        },
        { headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { error: 'Keycode not found. Contact your fleet administrator.' },
      { status: 404, headers: corsHeaders },
    );
  }

  if (body.action === 'resend_keycode') {
    try {
      const companyId = (body.companyId || '').trim();
      const email = (body.email || body.driverId || '').trim().toLowerCase();
      const emailOnly = email.includes('@')
        ? email
        : email.includes(':')
          ? email.split(':').slice(1).join(':')
          : email;

      if (!companyId || !emailOnly || !emailOnly.includes('@')) {
        return NextResponse.json(
          { error: 'companyId and driver email required' },
          { status: 400, headers: corsHeaders },
        );
      }

      const driver = findDriverByEmail(companyId, emailOnly);
      const tokens = await listAllRosterTokens();
      let rosterToken: string | null = null;
      let rosterEntryIndex = -1;
      let rosterEntries: Awaited<ReturnType<typeof listRosterEntries>> = [];
      let companyName =
        driver?.companyName ||
        listLocalCompanies().find((c) => c.id === companyId)?.name ||
        'FleetVu customer';

      for (const t of tokens) {
        if (t.company_id && t.company_id !== companyId) continue;
        const entries = await listRosterEntries(t.token);
        const idx = entries.findIndex((e) => (e.email || '').trim().toLowerCase() === emailOnly);
        if (idx >= 0) {
          rosterToken = t.token;
          rosterEntryIndex = idx;
          rosterEntries = entries;
          companyName = t.company_name || companyName;
          break;
        }
      }

      const fullName =
        driver?.fullName ||
        (rosterEntryIndex >= 0 ? rosterEntries[rosterEntryIndex].full_name : '') ||
        emailOnly;
      const role =
        driver?.role ||
        (rosterEntryIndex >= 0 ? rosterEntries[rosterEntryIndex].role : '') ||
        'driver';
      const isDesktop = role === 'desktop_user' || role === 'manager';
      const keycode = makeKeycode(role);
      const client = sb();
      const vaultUrl = `${APP_URL.replace(/\/+$/, '')}/#driver`;

      // Persist FIRST so verify_keycode can find the code (email only after store succeeds).
      try {
        if (rosterToken && rosterEntryIndex >= 0) {
          const next = [...rosterEntries];
          next[rosterEntryIndex] = {
            ...next[rosterEntryIndex],
            status: 'keycode_sent',
            one_time_keycode: keycode,
            keycode_sent_at: new Date().toISOString(),
          };
          await replaceRosterEntries(rosterToken, next, companyId);
          upsertCompanyDrivers(companyId, companyName, next);
        } else {
          upsertCompanyDrivers(companyId, companyName, [
            {
              full_name: fullName,
              email: emailOnly,
              role,
              location: driver?.location || null,
              truck_number: driver?.truckNumber || null,
              status: 'keycode_sent',
              one_time_keycode: keycode,
            },
          ]);
        }
      } catch (err) {
        console.error('[FleetVu Roster] resend persist failed:', err);
        return NextResponse.json(
          { error: 'Could not save the new keycode. Try again or check server .data permissions.' },
          { status: 500, headers: corsHeaders },
        );
      }

      if (client && !isDesktop) {
        try {
          await client
            .from('driver_access_keycodes')
            .update({ lifecycle_status: 'revoked' })
            .eq('dispatch_destination', emailOnly)
            .eq('lifecycle_status', 'dispatched');
        } catch (err) {
          console.error('[FleetVu Roster] revoke prior keycodes failed:', err);
        }

        // Do not set company_id — CRM local ids are often not UUIDs / not in companies FK.
        const { error: kcErr } = await client.from('driver_access_keycodes').insert({
          keycode,
          driver_name: fullName,
          driver_number: emailOnly,
          company_name: companyName,
          issued_by: 'crm@fleetvu.org',
          issued_by_name: 'FleetVu CRM',
          lifecycle_status: 'dispatched',
          dispatch_method: 'email',
          dispatch_destination: emailOnly,
          dispatched_at: new Date().toISOString(),
          biometric_bound: false,
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (kcErr) {
          console.error('[FleetVu Roster] resend keycode supabase persist failed:', kcErr.message);
          // Non-fatal — company-drivers + roster mirrors still hold the code for verify.
        }
      }

      const mail = await sendKeycodeEmail({
        to: emailOnly,
        subject: `Your new FleetVu ${isDesktop ? 'TEMP' : 'one-time'} login keycode — ${companyName}`,
        html: buildDriverKeycodeWelcomeHtml({
          driverName: fullName,
          companyName,
          keycode,
          isDesktop,
          vaultUrl,
        }),
        correlationId: `resend:${companyId}:${emailOnly}`,
        companyId,
      });

      if (!mail.ok) {
        return NextResponse.json(
          { error: mail.error || 'Keycode email failed to send' },
          { status: 502, headers: corsHeaders },
        );
      }

      return NextResponse.json(
        {
          success: true,
          email: emailOnly,
          companyId,
          provider: mail.provider,
          message: `New keycode emailed to ${emailOnly}`,
        },
        { headers: corsHeaders },
      );
    } catch (err) {
      console.error('[FleetVu Roster] resend_keycode failed:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Resend keycode failed' },
        { status: 500, headers: corsHeaders },
      );
    }
  }

  const token = body.token;
  if (!token || !body.action) {
    return NextResponse.json({ error: 'token and action required' }, { status: 400, headers: corsHeaders });
  }

  const found = await getRosterToken(token);
  if (!found) {
    return NextResponse.json({ error: 'Invalid roster token' }, { status: 404, headers: corsHeaders });
  }
  const portal = found.portal;

  if (body.action === 'save_entries') {
    const entries = body.entries || [];
    const limit = portal.driver_seat_limit || 25;
    const existing = await listRosterEntries(token);
    const byEmail = new Map(
      existing.map((e) => [(e.email || '').trim().toLowerCase(), e]),
    );
    const capped = entries.slice(0, limit).map((e) => {
      const email = (e.email || '').trim().toLowerCase();
      const prev = byEmail.get(email);
      const keepKeycode = Boolean(prev?.one_time_keycode);
      return {
        token,
        company_id: portal.company_id,
        full_name: (e.full_name || '').trim(),
        email,
        role: e.role || prev?.role || 'driver',
        location: e.location || null,
        sensor_serial: e.sensor_serial || null,
        truck_number: e.truck_number || null,
        // Preserve issued keycodes when customer edits the live roster.
        status: keepKeycode ? prev?.status || 'keycode_sent' : 'draft',
        one_time_keycode: prev?.one_time_keycode || null,
        keycode_sent_at: prev?.keycode_sent_at || null,
        id: prev?.id,
      };
    });
    const invalid = capped.filter((e) => !e.full_name || !e.email);
    if (invalid.length) {
      return NextResponse.json(
        { error: 'Each row needs a name and email' },
        { status: 400, headers: corsHeaders },
      );
    }
    const result = await replaceRosterEntries(token, capped, portal.company_id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500, headers: corsHeaders });
    }
    if (portal.company_id) {
      try {
        upsertCompanyDrivers(portal.company_id, portal.company_name, capped);
      } catch {
        /* non-fatal */
      }
    }
    return NextResponse.json(
      { success: true, saved: capped.length, storage: result.storage },
      { headers: corsHeaders },
    );
  }

  if (body.action === 'submit') {
    const entries = await listRosterEntries(token);
    if (!entries.length) {
      return NextResponse.json({ error: 'Add at least one driver before submitting' }, { status: 400, headers: corsHeaders });
    }
    const nextEntries = entries.map((e) => ({
      ...e,
      // Keep keycode_sent rows; mark everyone else submitted for FleetVu review.
      status: e.one_time_keycode ? e.status || 'keycode_sent' : 'submitted',
    }));
    await replaceRosterEntries(token, nextEntries, portal.company_id);
    await updateRosterTokenStatus(token, {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    });

    // Populate company driver list in CRM as soon as the customer submits the roster.
    if (portal.company_id) {
      try {
        upsertCompanyDrivers(portal.company_id, portal.company_name, nextEntries);
      } catch (err) {
        console.error('[FleetVu Roster] company drivers upsert failed:', err);
      }
    }

    const newForReview = nextEntries.filter((e) => !e.one_time_keycode).length;
    const rosterLogo = vaultEmailLogoAttachment();
    const rosterStatus =
      portal.status === 'approved' || portal.status === 'submitted' ? 'updated' : 'submitted';
    await dispatchCorporateEmail(
      {
        identity: 'welcome',
        to: 'welcome@fleetvu.org',
        subject: `Roster ${rosterStatus} — ${portal.company_name} (${entries.length} drivers)`,
        html: buildFleetVuEmailHtml({
          eyebrow: 'Roster Portal',
          fromLine: 'welcome@fleetvu.org',
          title: `Roster ${rosterStatus}`,
          introHtml: `<strong style="color:#ffffff;">${portal.company_name}</strong> saved their driver roster. Open CRM → Roster to issue keycodes.`,
          bodyHtml: emailDetailCard([
            { label: 'Company', value: portal.company_name },
            { label: 'Drivers saved', value: String(entries.length) },
            { label: 'Need keycodes', value: String(newForReview) },
            {
              label: 'Contact',
              value: `${portal.contact_name || '—'} <${portal.contact_email || '—'}>`,
            },
          ]),
          supportHtml:
            'Customers manage add / edit / remove themselves via the roster portal link — no phone call needed.',
          legalLine: 'FleetVu — Internal notice via welcome@fleetvu.org.',
          logoUrl: vaultEmailLogoSrc({ useCid: Boolean(rosterLogo), appBaseUrl: APP_URL }),
          documentTitle: 'FleetVu Roster Update',
        }),
        attachments: rosterLogo ? [rosterLogo] : undefined,
        priority: 'high',
        metadata: { type: 'ROSTER_SUBMITTED', company_id: portal.company_id, count: entries.length },
      },
      { awaitDelivery: true },
    );

    return NextResponse.json(
      { success: true, submitted: entries.length, pendingKeycodes: newForReview },
      { headers: corsHeaders },
    );
  }

  if (body.action === 'approve') {
    const client = sb();
    const entries = await listRosterEntries(token);
    // Only issue keycodes for rows that do not already have one (self-serve roster updates).
    const pending = entries.filter(
      (e) =>
        !e.one_time_keycode &&
        (e.status === 'submitted' || e.status === 'draft' || !e.status),
    );
    if (!pending.length) {
      return NextResponse.json(
        { error: 'No new drivers awaiting keycodes (roster may already be approved)' },
        { status: 400, headers: corsHeaders },
      );
    }

    let sent = 0;
    const errors: string[] = [];
    const updated = [...entries];
    const vaultUrl = `${APP_URL.replace(/\/+$/, '')}/#driver`;

    for (let i = 0; i < updated.length; i++) {
      const entry = updated[i];
      if (!(entry.status === 'submitted' || entry.status === 'draft' || !entry.status)) continue;

      const keycode = makeKeycode(entry.role || 'driver');
      const isDesktop = entry.role === 'desktop_user' || entry.role === 'manager';
      updated[i] = {
        ...entry,
        status: 'keycode_sent',
        one_time_keycode: keycode,
        keycode_sent_at: new Date().toISOString(),
      };

      if (!isDesktop && client) {
        const { error: kcErr } = await client.from('driver_access_keycodes').insert({
          keycode,
          driver_name: entry.full_name,
          // Keep driver_number as identity hint — truck lives on roster / company-drivers store.
          driver_number: entry.email || null,
          company_id: portal.company_id,
          company_name: portal.company_name,
          issued_by: 'crm@fleetvu.org',
          issued_by_name: 'FleetVu CRM',
          lifecycle_status: 'dispatched',
          dispatch_method: 'email',
          dispatch_destination: entry.email,
          dispatched_at: new Date().toISOString(),
          biometric_bound: false,
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (kcErr) {
          console.error('[FleetVu Roster] keycode persist failed:', kcErr.message);
          // Roster entry still holds the keycode for verify_keycode fallback
        }
      }

      const mail = await sendKeycodeEmail({
        to: entry.email,
        subject: `Your FleetVu ${isDesktop ? 'TEMP' : 'one-time'} login keycode — ${portal.company_name}`,
        html: buildDriverKeycodeWelcomeHtml({
          driverName: entry.full_name,
          companyName: portal.company_name,
          keycode,
          isDesktop,
          vaultUrl,
        }),
        correlationId: entry.id,
        companyId: portal.company_id,
      });
      if (!mail.ok) {
        errors.push(`${entry.email}: ${mail.error || 'send failed'}`);
      } else {
        sent += 1;
      }
    }

    await replaceRosterEntries(token, updated, portal.company_id);
    await updateRosterTokenStatus(token, {
      status: 'approved',
      approved_at: new Date().toISOString(),
    });

    if (portal.company_id) {
      try {
        upsertCompanyDrivers(portal.company_id, portal.company_name, updated);
      } catch (err) {
        console.error('[FleetVu Roster] company drivers upsert on approve failed:', err);
      }
    }

    if (sent === 0 && errors.length) {
      return NextResponse.json(
        { error: errors[0], keycodesSent: 0, details: errors },
        { status: 502, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { success: true, keycodesSent: sent, warnings: errors.length ? errors : undefined },
      { headers: corsHeaders },
    );
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders });
}
