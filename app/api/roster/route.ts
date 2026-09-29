import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dispatchCorporateEmail } from '@/lib/email';
import { buildDriverKeycodeWelcomeHtml } from '@/lib/email/welcome-roster-template';
import {
  getRosterToken,
  listRosterEntries,
  replaceRosterEntries,
  updateRosterTokenStatus,
} from '@/lib/roster/token-store';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

function makeKeycode(role: string): string {
  const prefix = role === 'desktop_user' || role === 'manager' ? 'TMP' : 'FV';
  const n = Math.floor(1000 + Math.random() * 9000);
  const letters = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${n}-${letters}`;
}

/** GET ?token= — load portal session + entries */
export async function GET(req: NextRequest) {
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
  if (portal.expires_at && new Date(portal.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'This roster link has expired' }, { status: 410, headers: corsHeaders });
  }

  const entries = await listRosterEntries(token);

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
 */
export async function POST(req: NextRequest) {
  let body: {
    action?: 'save_entries' | 'submit' | 'approve';
    token?: string;
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
    if (entries.length > limit) {
      return NextResponse.json(
        { error: `Seat limit is ${limit} drivers. Remove ${entries.length - limit} before saving.` },
        { status: 400, headers: corsHeaders },
      );
    }

    const rows = entries.map((e) => ({
      token,
      company_id: portal.company_id,
      full_name: e.full_name.trim(),
      email: e.email.trim().toLowerCase(),
      role: e.role || 'driver',
      location: e.location || null,
      sensor_serial: e.sensor_serial || null,
      truck_number: e.truck_number || null,
      status: 'draft',
    }));

    const result = await replaceRosterEntries(token, rows, portal.company_id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json(
      { success: true, count: entries.length, seatLimit: limit, storage: result.storage },
      { headers: corsHeaders },
    );
  }

  if (body.action === 'submit') {
    const entries = await listRosterEntries(token);
    if (!entries.length) {
      return NextResponse.json(
        { error: 'Add at least one employee before submitting.' },
        { status: 400, headers: corsHeaders },
      );
    }

    await replaceRosterEntries(
      token,
      entries.map((e) => ({ ...e, status: 'submitted' })),
      portal.company_id,
    );

    const statusResult = await updateRosterTokenStatus(token, {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    });
    if (!statusResult.ok) {
      return NextResponse.json({ error: statusResult.error }, { status: 500, headers: corsHeaders });
    }

    await dispatchCorporateEmail(
      {
        identity: 'welcome',
        to: 'welcome@fleetvu.org',
        subject: `Roster submitted — ${portal.company_name} (${entries.length} seats used)`,
        html: `<p>${entries.length} employees submitted for ${portal.company_name}. Review in CRM → approve to dispatch one-time keycodes.</p>`,
        priority: 'high',
        metadata: { type: 'ROSTER_SUBMITTED', company_id: portal.company_id, count: entries.length },
      },
      { awaitDelivery: true },
    );

    return NextResponse.json({ success: true, submitted: entries.length }, { headers: corsHeaders });
  }

  if (body.action === 'approve') {
    const client = sb();
    const entries = await listRosterEntries(token);
    const pending = entries.filter((e) => e.status === 'submitted' || e.status === 'draft' || !e.status);
    if (!pending.length) {
      return NextResponse.json({ error: 'No entries to approve' }, { status: 400, headers: corsHeaders });
    }

    let sent = 0;
    const updated = [...entries];
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
        try {
          await client.from('driver_access_keycodes').insert({
            keycode,
            driver_name: entry.full_name,
            company_id: portal.company_id,
            company_name: portal.company_name,
            status: 'active',
            truck_number: entry.truck_number,
          });
        } catch {
          // ignore keycode persist failures
        }
      }

      await dispatchCorporateEmail(
        {
          identity: 'welcome',
          to: entry.email,
          subject: `Your FleetVu ${isDesktop ? 'TEMP' : 'one-time'} login keycode — ${portal.company_name}`,
          html: buildDriverKeycodeWelcomeHtml({
            driverName: entry.full_name,
            companyName: portal.company_name,
            keycode,
            isDesktop,
          }),
          priority: 'high',
          correlationId: entry.id,
          metadata: { type: 'DRIVER_KEYCODE', company_id: portal.company_id },
        },
        { awaitDelivery: true },
      );
      sent += 1;
    }

    await replaceRosterEntries(token, updated, portal.company_id);
    await updateRosterTokenStatus(token, {
      status: 'approved',
      approved_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, keycodesSent: sent }, { headers: corsHeaders });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders });
}
