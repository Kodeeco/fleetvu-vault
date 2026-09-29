/**
 * Safety Report Rollup Engine
 *
 * Admin/Manager chooses daily | weekly | monthly.
 * System collects driver safety activity for the period, builds ONE digest PDF,
 * archives it, and emails company Super Admin / Admin / Manager only.
 * Legal isolation: never FleetVu Global Admin / @fleetvu.org.
 */

import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import { sha256 } from '@/src/vault/merkle-chain';
import { isFleetVuPlatformOperator } from '@/lib/legal-data-isolation';
import { dispatchSafetyReport } from '@/lib/email';

export type RollupCadence = 'daily' | 'weekly' | 'monthly';

export const ROLLUP_RECIPIENT_ROLES = [
  'super_admin',
  'location_admin',
  'admin',
  'manager',
] as const;

export interface RollupPrefs {
  companyId: string;
  enabled: boolean;
  cadence: RollupCadence;
  weeklyWeekday: number;
  lastSentAt: string | null;
  updatedBy?: string | null;
}

export interface DriverRollupRow {
  driverName: string;
  driverId: string;
  truckNumber: string;
  safetyScore: number;
  incidentCount: number;
  postStatus: string;
}

export interface DigestResult {
  success: boolean;
  digestId?: string;
  archivedReportId?: string;
  recipientEmails: string[];
  driverCount: number;
  reportTitle?: string;
  packageSha256?: string;
  error?: string;
}

function periodWindow(cadence: RollupCadence, end = new Date()): { start: Date; end: Date; label: string } {
  const ms =
    cadence === 'daily'
      ? 24 * 60 * 60 * 1000
      : cadence === 'weekly'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  const start = new Date(end.getTime() - ms);
  const label =
    cadence === 'daily' ? 'Daily' : cadence === 'weekly' ? 'Weekly' : 'Monthly';
  return { start, end, label };
}

export async function getRollupPrefs(companyId: string): Promise<RollupPrefs | null> {
  const { data } = await supabase
    .from('safety_report_rollup_prefs')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (!data) return null;
  return {
    companyId: data.company_id,
    enabled: !!data.enabled,
    cadence: (data.cadence || 'weekly') as RollupCadence,
    weeklyWeekday: typeof data.weekly_weekday === 'number' ? data.weekly_weekday : 5,
    lastSentAt: data.last_sent_at || null,
    updatedBy: data.updated_by || null,
  };
}

export async function saveRollupPrefs(input: {
  companyId: string;
  enabled: boolean;
  cadence: RollupCadence;
  weeklyWeekday?: number;
  updatedBy?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('safety_report_rollup_prefs').upsert(
    {
      company_id: input.companyId,
      enabled: input.enabled,
      cadence: input.cadence,
      weekly_weekday: input.weeklyWeekday ?? 5,
      updated_by: input.updatedBy || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function resolveRollupRecipients(companyId: string): Promise<string[]> {
  const { data } = await supabase
    .from('provisioned_users')
    .select('email, role, company_id, scoped_company_ids, status')
    .in('role', [...ROLLUP_RECIPIENT_ROLES]);

  if (!data) return [];

  const emails = new Set<string>();
  for (const row of data) {
    const role = (row.role || '').toLowerCase();
    if (role === 'global_admin') continue;
    const email = (row.email || '').toLowerCase().trim();
    if (!email || isFleetVuPlatformOperator({ role: role, email })) continue;
    if (row.status && !['active', 'pending_invitation', 'pending_setup'].includes(row.status)) {
      continue;
    }
    const scoped: string[] = Array.isArray(row.scoped_company_ids) ? row.scoped_company_ids : [];
    const matches = row.company_id === companyId || scoped.includes(companyId);
    if (matches) emails.add(email);
  }
  return Array.from(emails);
}

async function loadDriverRows(companyId: string, periodStart: Date): Promise<DriverRollupRow[]> {
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, truck_number, assigned_driver_id, safety_score, status')
    .eq('company_id', companyId);

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name, driver_number, company_id')
    .eq('company_id', companyId);

  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, driver_id, vehicle_id, created_at')
    .eq('company_id', companyId)
    .gte('created_at', periodStart.toISOString());

  const driverById = new Map((drivers || []).map((d) => [d.id, d]));
  const incidentCountByDriver = new Map<string, number>();
  for (const inc of incidents || []) {
    const key = inc.driver_id || inc.vehicle_id || 'unknown';
    incidentCountByDriver.set(key, (incidentCountByDriver.get(key) || 0) + 1);
  }

  const rows: DriverRollupRow[] = [];
  for (const v of vehicles || []) {
    const driver = v.assigned_driver_id ? driverById.get(v.assigned_driver_id) : null;
    const driverKey = v.assigned_driver_id || v.id;
    rows.push({
      driverName: driver?.name || 'Unassigned',
      driverId: driver?.driver_number || driver?.id || '—',
      truckNumber: v.truck_number || '—',
      safetyScore: Number(v.safety_score) || 0,
      incidentCount:
        (v.assigned_driver_id ? incidentCountByDriver.get(v.assigned_driver_id) : 0) ||
        incidentCountByDriver.get(v.id) ||
        0,
      postStatus: 'included',
    });
  }

  // Include drivers with no vehicle assignment
  for (const d of drivers || []) {
    if (rows.some((r) => r.driverId === (d.driver_number || d.id))) continue;
    rows.push({
      driverName: d.name || 'Driver',
      driverId: d.driver_number || d.id,
      truckNumber: '—',
      safetyScore: 0,
      incidentCount: incidentCountByDriver.get(d.id) || 0,
      postStatus: 'included',
    });
  }

  return rows;
}

export async function buildDigestPdf(opts: {
  companyName: string;
  cadence: RollupCadence;
  periodStart: Date;
  periodEnd: Date;
  rows: DriverRollupRow[];
}): Promise<{ blob: Blob; fileName: string; reportHash: string; dataUrl: string; base64: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const label = opts.cadence === 'daily' ? 'Daily' : opts.cadence === 'weekly' ? 'Weekly' : 'Monthly';
  const title = `FleetVu ${label} Safety Digest — ${opts.companyName}`;
  const stamp = opts.periodEnd.toISOString().slice(0, 10);

  doc.setFillColor(8, 21, 34);
  doc.rect(0, 0, 216, 28, 'F');
  doc.setFillColor(245, 113, 24);
  doc.rect(0, 0, 216, 1.5, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title.slice(0, 72), 12, 12);
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 200);
  doc.text(
    `Period: ${opts.periodStart.toISOString().slice(0, 10)} → ${stamp} · Drivers: ${opts.rows.length} · Customer-tenant exclusive`,
    12,
    20,
  );

  let y = 38;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Compressed Admin Digest', 12, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Individual driver safety packages for this period were reviewed and compressed into this single report for company Admin / Manager delivery.',
    12,
    y,
    { maxWidth: 186 },
  );
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Driver', 12, y);
  doc.text('Truck', 70, y);
  doc.text('Safety', 100, y);
  doc.text('Incidents', 130, y);
  doc.text('Status', 165, y);
  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(12, y, 200, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  for (const row of opts.rows.slice(0, 40)) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(30, 41, 59);
    doc.text(String(row.driverName).slice(0, 28), 12, y);
    doc.text(String(row.truckNumber).slice(0, 12), 70, y);
    doc.text(row.safetyScore.toFixed(1), 100, y);
    doc.text(String(row.incidentCount), 130, y);
    doc.text(row.postStatus, 165, y);
    y += 6;
  }

  if (opts.rows.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('No driver packages in this period — digest recorded for schedule continuity.', 12, y);
    y += 8;
  }

  y = Math.max(y + 10, 250);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'LEGAL: FleetVu Global Admin does not receive this digest (customer legal isolation). SHA-256 seal applied when Vault is OPEN.',
    12,
    y,
    { maxWidth: 186 },
  );

  const payload = JSON.stringify({
    company: opts.companyName,
    cadence: opts.cadence,
    start: opts.periodStart.toISOString(),
    end: opts.periodEnd.toISOString(),
    rows: opts.rows,
  });
  const reportHash = await sha256(payload);
  const fileName = `FleetVu_${label}_Safety_Digest_${opts.companyName.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 24)}_${stamp}.pdf`;
  const arrayBuffer = doc.output('arraybuffer');
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(bytes).toString('base64')
      : btoa(binary);
  const dataUrl = `data:application/pdf;base64,${base64}`;
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return { blob, fileName, reportHash, dataUrl, base64 };
}

/**
 * Run rollup for one company: build digest → archive → email admins.
 */
export async function runCompanySafetyRollup(opts: {
  companyId: string;
  companyName?: string | null;
  cadence?: RollupCadence;
  force?: boolean;
  triggeredBy?: string;
}): Promise<DigestResult> {
  const prefs = await getRollupPrefs(opts.companyId);
  const cadence = opts.cadence || prefs?.cadence || 'weekly';

  if (!opts.force && prefs && !prefs.enabled) {
    return {
      success: false,
      recipientEmails: [],
      driverCount: 0,
      error: 'Rollup disabled for this company',
    };
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', opts.companyId)
    .maybeSingle();

  const companyName = opts.companyName || company?.name || 'Fleet';
  const { start, end, label } = periodWindow(cadence);
  const rows = await loadDriverRows(opts.companyId, start);
  const pdf = await buildDigestPdf({
    companyName,
    cadence,
    periodStart: start,
    periodEnd: end,
    rows,
  });

  const recipients = await resolveRollupRecipients(opts.companyId);

  const { data: archived, error: archErr } = await supabase
    .from('archived_reports')
    .insert({
      report_title: pdf.fileName,
      report_type: 'safety_log',
      scope: `${companyName} — ${label} Admin Digest · ${rows.length} drivers`,
      file_size_kb: Math.max(1, Math.round(pdf.blob.size / 1024)),
      generated_by: opts.triggeredBy || 'system:safety-rollup',
      pdf_url: pdf.dataUrl,
      metadata: {
        company_id: opts.companyId,
        cadence,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        driver_count: rows.length,
        package_sha256: pdf.reportHash,
        source: 'safety_report_rollup',
        legal_isolation: 'customer_tenant_exclusive',
      },
    })
    .select('id')
    .single();

  if (archErr) {
    return {
      success: false,
      recipientEmails: recipients,
      driverCount: rows.length,
      error: archErr.message,
    };
  }

  const { data: digest, error: digErr } = await supabase
    .from('safety_report_digests')
    .insert({
      company_id: opts.companyId,
      company_name: companyName,
      cadence,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      driver_count: rows.length,
      package_sha256: pdf.reportHash,
      report_title: pdf.fileName,
      pdf_data_url: pdf.dataUrl,
      recipient_emails: recipients,
      status: 'generated',
      archived_report_id: archived?.id || null,
    })
    .select('id')
    .single();

  if (digErr) {
    return {
      success: false,
      recipientEmails: recipients,
      driverCount: rows.length,
      archivedReportId: archived?.id,
      error: digErr.message,
    };
  }

  let emailed = 0;
  for (const to of recipients) {
    try {
      const result = await dispatchSafetyReport(
        {
          to,
          subject: `FleetVu ${label} Safety Digest — ${companyName}`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:28px;border-radius:12px;">
              <div style="font-size:11px;color:#fb923c;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Customer Digest · safetyreport@fleetvu.org</div>
              <h1 style="color:#fff;font-size:20px;margin:12px 0;">${label} Safety Digest Ready</h1>
              <p style="color:#94a3b8;font-size:14px;line-height:1.5;">
                ${rows.length} driver safety packages were compressed into <strong style="color:#e2e8f0;">one</strong> Admin report for ${companyName}.
              </p>
              <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px;margin:18px 0;font-size:13px;">
                <div>File: <strong>${pdf.fileName}</strong></div>
                <div>Period: <strong>${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}</strong></div>
                <div>Drivers included: <strong>${rows.length}</strong></div>
                <div>Seal: <strong style="font-family:monospace;font-size:11px;">${pdf.reportHash.slice(0, 24)}…</strong></div>
              </div>
              <p style="font-size:11px;color:#64748b;margin:0;">Delivered only to your company Super Admin / Admin / Manager accounts. FleetVu Global Admin does not receive this digest.</p>
            </div>
          `,
          attachments: [
            {
              filename: pdf.fileName,
              contentBase64: pdf.base64,
              contentType: 'application/pdf',
            },
          ],
          metadata: {
            type: 'SAFETY_REPORT_ROLLUP',
            company_id: opts.companyId,
            legal_isolation: 'customer_tenant_exclusive',
          },
        },
        { awaitDelivery: true },
      );
      if (result.success) emailed += 1;
    } catch {
      /* per-recipient best effort */
    }
  }

  if (emailed > 0) {
    await supabase
      .from('safety_report_digests')
      .update({ status: 'emailed' })
      .eq('id', digest.id);
  }

  await supabase.from('safety_report_rollup_prefs').upsert(
    {
      company_id: opts.companyId,
      enabled: prefs?.enabled ?? true,
      cadence,
      weekly_weekday: prefs?.weeklyWeekday ?? 5,
      last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' },
  );

  await supabase.from('audit_logs').insert({
    actor_role: 'system',
    actor_email: opts.triggeredBy || 'safety-rollup@system.fleetvu.local',
    action_type: 'SAFETY_REPORT_ROLLUP_SENT',
    entity_type: 'safety_report_digest',
    new_state: {
      company_id: opts.companyId,
      cadence,
      driver_count: rows.length,
      recipient_count: recipients.length,
      emailed,
      digest_id: digest.id,
      package_sha256: pdf.reportHash,
      fleetvu_global_admin_notified: false,
      legal_isolation: 'customer_tenant_exclusive',
    },
  });

  return {
    success: true,
    digestId: digest.id,
    archivedReportId: archived?.id,
    recipientEmails: recipients,
    driverCount: rows.length,
    reportTitle: pdf.fileName,
    packageSha256: pdf.reportHash,
  };
}

/**
 * Whether a scheduled run is due for saved prefs (used by cron).
 */
export function isRollupDue(prefs: RollupPrefs, now = new Date()): boolean {
  if (!prefs.enabled) return false;
  if (!prefs.lastSentAt) return true;
  const last = new Date(prefs.lastSentAt).getTime();
  const elapsed = now.getTime() - last;
  if (prefs.cadence === 'daily') return elapsed >= 20 * 60 * 60 * 1000; // ~20h grace
  if (prefs.cadence === 'weekly') {
    const weekdayOk = now.getDay() === prefs.weeklyWeekday;
    return weekdayOk && elapsed >= 5 * 24 * 60 * 60 * 1000;
  }
  // monthly
  return elapsed >= 28 * 24 * 60 * 60 * 1000;
}
