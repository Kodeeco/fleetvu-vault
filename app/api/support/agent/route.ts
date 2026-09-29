import { NextRequest, NextResponse } from 'next/server';
import {
  generateSupportReply,
  sanitizeEscalationNote,
  type SupportChatMessage,
} from '@/lib/support-agent';
import { isFleetVuPlatformOperator, LEGAL_ISOLATION_DENIAL_MESSAGE } from '@/lib/legal-data-isolation';
import { dispatchCorporateEmail } from '@/lib/email';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

/**
 * Customer-tenant AI support agent.
 * Global Admin / FleetVu platform operators are denied — this is customer-side help only.
 */
export async function POST(req: NextRequest) {
  let body: {
    messages?: SupportChatMessage[];
    actor?: { email?: string; role?: string; companyId?: string | null; companyName?: string | null };
    escalate?: boolean;
    escalationNote?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  const role = body.actor?.role || '';
  const email = body.actor?.email || '';

  if (isFleetVuPlatformOperator({ role, email })) {
    return NextResponse.json(
      {
        error: LEGAL_ISOLATION_DENIAL_MESSAGE,
        code: 'CUSTOMER_SUPPORT_ONLY',
        hint: 'FleetVu Global Admin uses the business portal (provisioning / CRM). Customer AI support is tenant-exclusive.',
      },
      { status: 403, headers: corsHeaders },
    );
  }

  // Escalation ticket — product help only, sanitized
  if (body.escalate) {
    const note = sanitizeEscalationNote(body.escalationNote || 'Customer requested human support');
    const result = await dispatchCorporateEmail(
      {
        identity: 'support',
        to: 'support@fleetvu.org',
        subject: `Customer Support Ticket — ${body.actor?.companyName || 'Customer'} (product help)`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
            <div style="font-size:11px;color:#fb923c;font-weight:700;text-transform:uppercase;">Customer Product Support · No Legal Evidence</div>
            <h1 style="color:#fff;font-size:18px;">Support Ticket</h1>
            <p style="font-size:13px;color:#94a3b8;">From customer portal AI agent. Legal/accident evidence is intentionally excluded.</p>
            <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px;font-size:13px;">
              <div>Company: <strong>${escape(body.actor?.companyName || '—')}</strong></div>
              <div>Contact: <strong>${escape(email || '—')}</strong> (${escape(role || '—')})</div>
              <div style="margin-top:10px;">Issue:<br/>${escape(note)}</div>
            </div>
          </div>
        `,
        priority: 'high',
        metadata: {
          type: 'CUSTOMER_SUPPORT_ESCALATION',
          legal_isolation: 'no_evidence_payload',
          company_id: body.actor?.companyId ?? null,
        },
      },
      { awaitDelivery: true },
    );

    return NextResponse.json(
      {
        success: result.success,
        reply:
          'I opened a product-support ticket with FleetVu support. They can help with login, billing, hardware, and navigation — not with reviewing your accident files (those stay in your company portal).',
        matchedTopicId: 'escalate',
        deepLink: null,
        suggestEscalate: false,
        confidence: 'high',
        source: 'knowledge',
        dispatch: result,
      },
      { status: 200, headers: corsHeaders },
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: 'messages[] required' }, { status: 400, headers: corsHeaders });
  }

  const reply = await generateSupportReply(messages);
  return NextResponse.json({ success: true, ...reply }, { status: 200, headers: corsHeaders });
}

function escape(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
