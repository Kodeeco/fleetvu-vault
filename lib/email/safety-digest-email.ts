/**
 * Monday / scheduled Safety Digest email — Welcome-grade chrome,
 * same standard as DRIVER_FULL_REPORT safety emails.
 */

import { formatDate } from '@/lib/fleetvu-report';
import {
  buildFleetVuEmailHtml,
  emailDetailCard,
  emailMetricStrip,
  emailParagraph,
  escapeEmailHtml,
  vaultEmailLogoSrc,
} from '@/lib/email/fleetvu-email-chrome';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.fleetvu.org').replace(/\/+$/, '');

export type DigestEmailCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type DigestEmailDriverRow = {
  driverName: string;
  safetyScore: number;
  incidentCount: number;
};

export function buildSafetyDigestEmailHtml(opts: {
  companyName: string;
  label: string;
  cadence: DigestEmailCadence;
  periodStart: Date;
  periodEnd: Date;
  rows: DigestEmailDriverRow[];
  fileName: string;
  reportHash: string;
  logoUrl?: string;
}): string {
  const totalEvents = opts.rows.reduce((n, r) => n + (r.incidentCount || 0), 0);
  const scored = opts.rows.filter((r) => Number.isFinite(r.safetyScore) && r.safetyScore > 0);
  const avgScore =
    scored.length > 0
      ? (scored.reduce((n, r) => n + r.safetyScore, 0) / scored.length).toFixed(1)
      : '—';
  const periodLabel = `${formatDate(opts.periodStart)} – ${formatDate(opts.periodEnd)}`;
  const cadenceStory =
    opts.cadence === 'weekly'
      ? 'Friday phone intake is sealed over the weekend. This Monday package is the single executive view for your Admins and Managers.'
      : opts.cadence === 'monthly'
        ? 'This monthly package consolidates sealed driver activity into one executive PDF for your Admins and Managers.'
        : opts.cadence === 'quarterly'
          ? 'This quarterly package consolidates sealed driver activity into one executive PDF for your Admins and Managers.'
          : 'This daily package consolidates sealed driver activity into one PDF for your Admins and Managers.';

  return buildFleetVuEmailHtml({
    eyebrow: `${opts.label} Safety Digest`,
    fromLine: 'safetyreport@fleetvu.org',
    title: `${opts.label} Safety Report — ${opts.companyName}`,
    introHtml: `Your sealed Vault PDF is attached. ${escapeEmailHtml(cadenceStory)}`,
    bodyHtml: [
      emailMetricStrip([
        { label: 'Drivers', value: String(opts.rows.length) },
        { label: 'Events', value: String(totalEvents) },
        { label: 'Avg Score', value: avgScore },
        { label: 'Package', value: 'Sealed' },
      ]),
      emailDetailCard([
        { label: 'Company', value: opts.companyName },
        { label: 'Report', value: `${opts.label} Safety Digest` },
        { label: 'Period', value: periodLabel },
        { label: 'File', value: opts.fileName },
        { label: 'Seal', value: `${opts.reportHash.slice(0, 24)}…` },
      ]),
      emailParagraph(
        'Open the attachment to review the full fleet digest. One sealed PDF replaces dozens of driver emails.',
      ),
    ].join(''),
    cta: { href: `${APP_URL}/#desktop`, label: 'OPEN COMPANY COMMAND' },
    supportHtml:
      'Need help? Contact <a href="mailto:safetyreport@fleetvu.org" style="color:#d4a017;text-decoration:none;font-weight:700;">safetyreport@fleetvu.org</a>',
    legalLine:
      'FleetVu Forensic Vault — Sent via safetyreport@fleetvu.org. Customer-tenant exclusive.',
    outerFooter:
      'Automated fleet digest. The sealed PDF is attached to this message. Only your company Admins and Managers receive this.',
    logoUrl: opts.logoUrl || vaultEmailLogoSrc({ useCid: true }),
    documentTitle: `FleetVu ${opts.label} Safety Digest`,
  });
}
