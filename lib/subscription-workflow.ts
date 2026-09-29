'use client';

import { supabase } from '@/lib/supabase';
import { verifyLicense } from '@/src/vault/licensing';

/**
 * Subscription Request Workflow (Items 12-14)
 *
 * 12. Role-Restricted POC Expiration Banner & "Start Subscription" Action
 * 13. In-App Acknowledgment & Status Update
 * 14. Automated Subscription Request Trigger & Detailed Email
 *
 * The 30-day warning banner appears ONLY on POC and Admin/Super screens —
 * completely hidden from standard drivers. The [ Start Subscription ] button
 * (deliberately avoiding "Renewal" terminology) triggers:
 *   1. On-screen confirmation message ("Subscription Request Submitted Successfully!")
 *   2. Status shifts to "Subscription Pending"
 *   3. Email dispatched to sales@fleetvu.org with company/fleet details
 */

export const ANNUAL_PRICE_PER_UNIT = 119.40;
export const SALES_EMAIL = 'sales@fleetvu.org';

export type SubscriptionRequestStatus =
  | 'pending'
  | 'submitted'
  | 'invoiced'
  | 'paid'
  | 'active';

export interface SubscriptionRequestInput {
  companyId: string;
  companyName: string;
  location: string | null;
  pocName: string;
  pocEmail: string;
  affectedUnitCount: number;
  hardwareSerials: string[];
  notes?: string;
}

export interface SubscriptionRequestResult {
  success: boolean;
  requestId: string | null;
  status: SubscriptionRequestStatus;
  annualTotal: number;
  error?: string;
}

/**
 * Check if a company's license is within 30 days of expiration.
 * Used to determine whether to show the POC expiration banner.
 *
 * Important: missing hardware license ≠ expired. Demo / pre-bind units
 * must not scream "Subscription Has Expired" while Vault still shows OPEN.
 */
export async function checkExpirationStatus(
  hardwareSerial: string,
): Promise<{
  expiringSoon: boolean;
  daysRemaining: number;
  expired: boolean;
  licenseBound: boolean;
}> {
  const verification = await verifyLicense(hardwareSerial);
  const unbound =
    !verification.valid &&
    typeof verification.error === 'string' &&
    verification.error.toLowerCase().includes('no license bound');

  if (unbound) {
    return {
      expiringSoon: false,
      daysRemaining: 0,
      expired: false,
      licenseBound: false,
    };
  }

  return {
    expiringSoon:
      verification.valid &&
      verification.complimentary_remaining_days <= 30 &&
      verification.complimentary_remaining_days > 0,
    daysRemaining: verification.complimentary_remaining_days,
    expired: !verification.valid && verification.status === 'expired',
    licenseBound: true,
  };
}

/**
 * Submit a subscription request.
 * Creates a record in subscription_requests and dispatches a notification
 * email to sales@fleetvu.org via the edge function.
 */
export async function submitSubscriptionRequest(
  input: SubscriptionRequestInput,
): Promise<SubscriptionRequestResult> {
  const annualTotal = input.affectedUnitCount * ANNUAL_PRICE_PER_UNIT;

  const { data, error } = await supabase
    .from('subscription_requests')
    .insert({
      company_id: input.companyId,
      company_name: input.companyName,
      location: input.location,
      poc_name: input.pocName,
      poc_email: input.pocEmail,
      affected_unit_count: input.affectedUnitCount,
      hardware_serials: input.hardwareSerials,
      status: 'submitted',
      annual_total: annualTotal,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return {
      success: false,
      requestId: null,
      status: 'pending',
      annualTotal: 0,
      error: error?.message ?? 'Failed to submit subscription request',
    };
  }

  // Dispatch notification email — prefer Next.js email API (sales@), fallback to edge function
  try {
    const serialList =
      input.hardwareSerials.length > 0 ? input.hardwareSerials.join(', ') : 'All units';
    await fetch('/api/communications/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'GENERIC_DISPATCH',
        identity: 'notice',
        to: SALES_EMAIL,
        subject: `New Subscription Request — ${input.companyName}`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:28px;border-radius:12px;">
            <div style="font-size:11px;color:#fb923c;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Subscription Request · notice@fleetvu.org</div>
            <h1 style="color:#fff;font-size:20px;margin:12px 0;">Start Subscription — Invoice Needed</h1>
            <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px;font-size:13px;">
              <div>Company / Fleet: <strong>${escapeHtml(input.companyName)}</strong></div>
              <div>Location: <strong>${escapeHtml(input.location || 'Not specified')}</strong></div>
              <div>POC: <strong>${escapeHtml(input.pocName)}</strong> (${escapeHtml(input.pocEmail)})</div>
              <div>Affected units: <strong>${input.affectedUnitCount}</strong></div>
              <div>Hardware serials: <strong>${escapeHtml(serialList)}</strong></div>
              <div>Annual total: <strong>$${annualTotal.toFixed(2)}</strong> (${input.affectedUnitCount} × $${ANNUAL_PRICE_PER_UNIT.toFixed(2)})</div>
              <div>Request ID: <strong>${escapeHtml(data.id)}</strong></div>
            </div>
            <p style="font-size:12px;color:#94a3b8;margin-top:16px;">Generate annual invoice, then issue 12-month cryptographic subscription key on payment.</p>
          </div>
        `,
        priority: 'high',
        correlationId: data.id,
      }),
    });
  } catch {
    // Best-effort — subscription_requests row is source of truth
  }

  return {
    success: true,
    requestId: data.id,
    status: 'submitted',
    annualTotal,
  };
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fetch the current subscription request status for a company.
 * Used to show "Subscription Pending" status in the UI.
 */
export async function getSubscriptionRequestStatus(
  companyId: string,
): Promise<{ status: SubscriptionRequestStatus | null; requestId: string | null }> {
  const { data } = await supabase
    .from('subscription_requests')
    .select('id, status')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { status: null, requestId: null };
  return { status: data.status as SubscriptionRequestStatus, requestId: data.id };
}
