/**
 * Customer-only Incident Alert Dispatcher
 *
 * When a Vault driver submits an incident, alerts go EXCLUSIVELY to the
 * owning customer's Super Admin / Admin accounts.
 *
 * FleetVu Global Admin is NEVER a recipient — legal isolation firewall.
 */

import { supabase } from '@/lib/supabase';
import { INCIDENT_ALERT_RECIPIENT_ROLES } from '@/lib/legal-data-isolation';

export interface CustomerIncidentAlertInput {
  caseId: string;
  companyId: string | null;
  companyName: string | null;
  driverName: string | null;
  driverId: string | null;
  truckNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  speedMph: number | null;
  submittedAt: string;
  reportFileName?: string | null;
  packageSha256?: string | null;
}

export interface CustomerIncidentAlertResult {
  notifiedEmails: string[];
  skippedPlatformOperators: number;
  success: boolean;
  error?: string;
}

/**
 * Resolve customer Super Admin / Admin emails for a company.
 * Explicitly excludes global_admin and any @fleetvu.org platform staff.
 */
export async function resolveCustomerIncidentRecipients(
  companyId: string | null,
): Promise<string[]> {
  if (!companyId) return [];

  const { data, error } = await supabase
    .from('provisioned_users')
    .select('email, role, company_id, scoped_company_ids, status')
    .in('role', [...INCIDENT_ALERT_RECIPIENT_ROLES]);

  if (error || !data) return [];

  const emails = new Set<string>();

  for (const row of data) {
    const role = (row.role || '').toLowerCase();
    if (role === 'global_admin') continue; // belt-and-suspenders

    const email = (row.email || '').toLowerCase();
    if (!email) continue;
    // Never notify FleetVu platform mailboxes
    if (email.endsWith('@fleetvu.org') || email.endsWith('@fleetvu.com')) continue;

    const scoped: string[] = Array.isArray(row.scoped_company_ids)
      ? row.scoped_company_ids
      : [];
    const matches =
      row.company_id === companyId || scoped.includes(companyId);

    if (!matches) continue;
    if (row.status && !['active', 'pending_invitation', 'pending_setup'].includes(row.status)) {
      continue;
    }

    emails.add(email);
  }

  return Array.from(emails);
}

/**
 * Dispatch incident alert to customer admins only.
 * Records a non-evidentiary notification log (metadata only — no evidence payload).
 */
export async function dispatchCustomerIncidentAlert(
  input: CustomerIncidentAlertInput,
): Promise<CustomerIncidentAlertResult> {
  try {
    const recipients = await resolveCustomerIncidentRecipients(input.companyId);

    // Metadata-only audit for the CUSTOMER tenant — never for platform operators
    await supabase.from('audit_logs').insert({
      actor_role: 'system',
      actor_email: 'incident-alert@system.fleetvu.local',
      action_type: 'CUSTOMER_INCIDENT_ALERT_DISPATCHED',
      entity_type: 'incident',
      new_state: {
        case_id: input.caseId,
        company_id: input.companyId,
        recipient_count: recipients.length,
        recipients, // customer admins only
        driver_name: input.driverName,
        truck_number: input.truckNumber,
        // Explicit isolation marker
        fleetvu_global_admin_notified: false,
        legal_isolation: 'customer_tenant_exclusive',
      },
    });

    // Best-effort email to each customer admin via notice identity
    // (operational alert — not evidence transfer to FleetVu)
    for (const to of recipients) {
      try {
        await fetch('/api/communications/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'GENERIC_DISPATCH',
            identity: 'notice',
            to,
            subject: `FleetVu Incident Completed — ${input.reportFileName || input.caseId}`,
            html: buildCustomerAlertHtml(input),
            priority: 'critical',
            correlationId: input.caseId,
          }),
        });
      } catch {
        /* per-recipient best effort */
      }
    }

    return {
      notifiedEmails: recipients,
      skippedPlatformOperators: 0,
      success: true,
    };
  } catch (err) {
    return {
      notifiedEmails: [],
      skippedPlatformOperators: 0,
      success: false,
      error: err instanceof Error ? err.message : 'Alert dispatch failed',
    };
  }
}

function buildCustomerAlertHtml(input: CustomerIncidentAlertInput): string {
  const esc = (v: string | null | undefined) =>
    (v || '—')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 28px; border-radius: 12px;">
      <div style="font-size: 11px; color: #fb923c; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Customer Portal Alert · notice@fleetvu.org</div>
      <h1 style="color: #fff; font-size: 20px; margin: 12px 0;">New Incident Submitted</h1>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
        A driver has submitted an incident report to <strong style="color:#e2e8f0;">your</strong> FleetVu company portal.
        Open Accident Reconstruction in your Super Admin / Admin account to review.
      </p>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px;margin:18px 0;font-size:13px;">
        <div>File: <strong>${esc(input.reportFileName || input.caseId)}</strong></div>
        <div>Case ID: <strong>${esc(input.caseId)}</strong></div>
        <div>Company: <strong>${esc(input.companyName)}</strong></div>
        <div>Driver: <strong>${esc(input.driverName)}</strong> (${esc(input.driverId)})</div>
        <div>Truck #: <strong>${esc(input.truckNumber)}</strong></div>
        <div>GPS: <strong>${input.latitude?.toFixed(5) ?? '—'}, ${input.longitude?.toFixed(5) ?? '—'}</strong></div>
        <div>Submitted: <strong>${esc(input.submittedAt)}</strong></div>
        ${input.packageSha256 ? `<div>Package seal: <strong style="font-family:monospace;font-size:11px;">${esc(input.packageSha256.slice(0, 16))}…</strong></div>` : ''}
      </div>
      <p style="font-size:11px;color:#64748b;margin:0;">
        This alert is delivered only to your company&apos;s Super Admin / Admin accounts.
        FleetVu Global Admin does not receive incident evidence or this alert content (legal isolation firewall).
      </p>
    </div>
  `;
}
