/**
 * FleetVu Welcome Email — Roster Portal invite
 * Matches Welcome email.jpg mock; Vault logo embedded via CID for Outlook.
 */

import fs from 'fs';
import path from 'path';
import type { EmailAttachment } from './types';

const FALLBACK_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.fleetvu.org';

export const WELCOME_LOGO_CID = 'vault-logo';

export interface WelcomeRosterEmailInput {
  organizationName: string;
  contactName: string;
  rosterToken: string;
  driverSeatLimit: number;
  /** Production portal base, e.g. https://app.fleetvu.org */
  appBaseUrl?: string;
  /** Override logo URL; default uses cid:vault-logo when attachment is present */
  logoUrl?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '') || FALLBACK_APP_URL;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Load Vault wordmark from /public for inline CID embedding. */
export function loadWelcomeLogoAttachment(): EmailAttachment | null {
  const candidates: Array<{ file: string; contentType: string; filename: string }> = [
    {
      file: path.join(process.cwd(), 'public', 'FV-Vault3.png'),
      contentType: 'image/png',
      filename: 'FV-Vault3.png',
    },
    {
      file: path.join(process.cwd(), 'public', 'FV-Vault3.jpg'),
      contentType: 'image/jpeg',
      filename: 'FV-Vault3.jpg',
    },
    {
      file: path.join(process.cwd(), 'public', 'FV-Vault-brand.jpg'),
      contentType: 'image/jpeg',
      filename: 'FV-Vault-brand.jpg',
    },
    {
      file: path.join(process.cwd(), 'public', 'FV-Vault-logo-gold.png'),
      contentType: 'image/png',
      filename: 'FV-Vault-logo-gold.png',
    },
  ];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate.file)) continue;
      const buf = fs.readFileSync(candidate.file);
      if (!buf.length) continue;
      return {
        filename: candidate.filename,
        contentBase64: buf.toString('base64'),
        contentType: candidate.contentType,
        contentId: WELCOME_LOGO_CID,
        disposition: 'inline',
      };
    } catch {
      /* try next */
    }
  }
  return null;
}

export function buildWelcomeRosterEmailHtml(input: WelcomeRosterEmailInput): string {
  const base = normalizeBaseUrl(input.appBaseUrl || FALLBACK_APP_URL);
  const portalUrl = `${base}/portal?token=${encodeURIComponent(input.rosterToken)}`;
  // Prefer CID (embedded) so Outlook does not depend on app.fleetvu.org hosting
  const logoSrc = input.logoUrl || `cid:${WELCOME_LOGO_CID}`;
  const year = new Date().getFullYear();
  const org = escapeHtml(input.organizationName);
  const seats = Math.max(1, Number(input.driverSeatLimit) || 25);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Welcome aboard — FleetVu Roster Portal</title>
<!--[if mso]><style>table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#e8edf3;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e8edf3;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#0b132b;border-collapse:collapse;">
          <!-- Logo + Secure Onboarding frame -->
          <tr>
            <td align="center" style="padding:28px 0 12px 0;background:#0b132b;">
              <img src="${logoSrc}" alt="FleetVu Vault" width="300" height="auto" style="display:block;width:300px;max-width:300px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;background-color:#0b132b;" />

              <!-- ~1" inset from each edge of 560px card → ~368px frame -->
              <table role="presentation" width="368" cellpadding="0" cellspacing="0" border="0" align="center" style="width:368px;max-width:368px;margin:20px auto 6px auto;border-collapse:collapse;">
                <tr>
                  <td align="center" style="border:1px solid #c9a227;padding:9px 14px;mso-padding-alt:9px 14px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.22em;color:#d4a017;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;line-height:1.2;mso-line-height-rule:exactly;">
                      SECURE ONBOARDING
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:22px 36px 8px 36px;font-family:Arial,Helvetica,sans-serif;">
              <h1 style="margin:0 0 14px 0;color:#ffffff;font-size:26px;line-height:1.25;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
                Welcome aboard, Fleet Partner
              </h1>
              <p style="margin:0 0 26px 0;color:#c5d0de;font-size:15px;line-height:1.65;font-family:Arial,Helvetica,sans-serif;">
                Your organization${org ? ` <strong style="color:#ffffff;">${org}</strong>` : ''} is now enrolled in the FleetVu Forensic Vault.
                This platform provides real-time data, diagnostics, compliance reporting, and driver keycode management for your entire fleet.
              </p>

              <div style="font-size:12px;font-weight:700;letter-spacing:0.16em;color:#d4a017;text-transform:uppercase;margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;">
                GETTING STARTED
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
                <tr>
                  <td valign="top" width="28" style="color:#d4a017;font-size:15px;font-weight:700;line-height:1.55;padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;">1.</td>
                  <td valign="top" style="color:#ffffff;font-size:15px;line-height:1.55;padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;">
                    Click the secure access link below to open your <strong style="color:#f5f5f5;">Fleet Account Portal</strong> (roster, report recipients, incident shares, and audit log).
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="28" style="color:#d4a017;font-size:15px;font-weight:700;line-height:1.55;padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;">2.</td>
                  <td valign="top" style="color:#ffffff;font-size:15px;line-height:1.55;padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;">
                    <strong style="color:#d4a017;">Your fleet backend</strong> — manage drivers, who receives Safety/Insurance reports, and secure incident forwards. Set a portal password after first open so you can return anytime.
                    Add up to <strong style="color:#d4a017;">${seats} drivers</strong> — one seat per unit on your plan.
                    ${
                      seats >= 10
                        ? ` For larger fleets, use <strong style="color:#d4a017;">Excel / CSV upload</strong> in the portal (download the template, fill rows, upload) so you are not entering names one by one.`
                        : ` Enter drivers manually or upload an Excel / CSV file. Assign each driver a sensor serial from your provisioned pool when hardware arrives.`
                    }
                    The portal shows seats filled vs remaining so you can finish at the paid seat count.
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="28" style="color:#d4a017;font-size:15px;font-weight:700;line-height:1.55;padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;">3.</td>
                  <td valign="top" style="color:#ffffff;font-size:15px;line-height:1.55;padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;">
                    Submit (or re-submit after changes). New drivers receive one-time login keycodes after FleetVu approval — keep this email so you can return to the portal whenever your roster changes.
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 8px 0;">
                <tr>
                  <td style="height:1px;line-height:1px;font-size:0;background:#243044;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA — Outlook-safe table button (no VML truncation) -->
          <tr>
            <td align="center" style="padding:20px 28px 12px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;">
                <tr>
                  <td align="center" bgcolor="#d4a017" style="background-color:#d4a017;border-radius:4px;mso-padding-alt:16px 28px;">
                    <a href="${portalUrl}" target="_blank" style="display:inline-block;background-color:#d4a017;color:#0b132b;font-size:15px;font-weight:700;line-height:1.2;text-align:center;text-decoration:none;padding:16px 28px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.03em;">
                      ACCESS YOUR ROSTER PORTAL
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback link + support -->
          <tr>
            <td style="padding:16px 36px 28px 36px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 8px 0;color:#9aa8bc;font-size:12px;line-height:1.5;">
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 22px 0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${portalUrl}" style="color:#4da3ff;text-decoration:underline;">${portalUrl}</a>
              </p>
              <p style="margin:0 0 18px 0;color:#c5d0de;font-size:13px;line-height:1.55;">
                <strong style="color:#ffffff;">Need help?</strong>
                Reply to this email or contact our support team directly at
                <a href="mailto:welcome@fleetvu.org" style="color:#d4a017;text-decoration:none;font-weight:700;">welcome@fleetvu.org</a>
              </p>
              <p style="margin:0;color:#6b7a90;font-size:11px;line-height:1.55;">
                This message was sent by FleetVu Forensic Vault on behalf of FleetVu Onboarding.<br />
                &copy; ${year} FleetVu. All rights reserved. AES-256 Encrypted Session.
              </p>
            </td>
          </tr>
        </table>

        <!-- Outer footer band -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#dce3ec;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:14px 20px;color:#334155;font-size:11px;font-family:Arial,Helvetica,sans-serif;line-height:1.45;">
              This is an automated onboarding email. Please do not reply directly to this message.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildWelcomeRosterEmail(input: WelcomeRosterEmailInput): {
  html: string;
  attachments: EmailAttachment[];
  portalUrl: string;
} {
  const logo = loadWelcomeLogoAttachment();
  const base = normalizeBaseUrl(input.appBaseUrl || FALLBACK_APP_URL);
  const portalUrl = `${base}/portal?token=${encodeURIComponent(input.rosterToken)}`;
  const html = buildWelcomeRosterEmailHtml({
    ...input,
    logoUrl: logo ? `cid:${WELCOME_LOGO_CID}` : `${base}/FV-Vault3.png`,
  });
  return {
    html,
    attachments: logo ? [logo] : [],
    portalUrl,
  };
}

export function buildDriverKeycodeWelcomeHtml(input: {
  driverName: string;
  companyName: string;
  keycode: string;
  isDesktop?: boolean;
  /** Open Vault driver onboarding, e.g. https://app.fleetvu.org/#driver */
  vaultUrl?: string;
}): string {
  const openUrl = (input.vaultUrl || `${FALLBACK_APP_URL}/#driver`).replace(/\/+$/, '');
  // Lazy import keeps this module free of circular init with email chrome
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const chrome = require('@/lib/email/fleetvu-email-chrome') as typeof import('@/lib/email/fleetvu-email-chrome');

  return chrome.buildFleetVuEmailHtml({
    eyebrow: 'Driver Vault Access',
    fromLine: 'welcome@fleetvu.org',
    title: `Hello ${input.driverName}`,
    introHtml: `Your <strong style="color:#ffffff;">${escapeHtml(input.companyName)}</strong> FleetVu Vault access is ready.
      ${
        input.isDesktop
          ? 'Use this one-time TEMP keycode on desktop, then set your own password.'
          : 'Open the Vault on your phone, enter this one-time keycode once, then bind fingerprint / Face ID.'
      }`,
    bodyHtml: [
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;"><tr><td style="background:#111827;border:1px solid #c9a227;padding:18px;text-align:center;">
        <div style="font-size:11px;color:#d4a017;font-weight:700;letter-spacing:0.12em;margin-bottom:10px;">ONE-TIME LOGIN KEYCODE</div>
        <code style="font-size:22px;font-family:Consolas,monospace;color:#d4a017;font-weight:800;letter-spacing:0.08em;">${escapeHtml(input.keycode)}</code>
      </td></tr></table>`,
      chrome.emailDetailCard([
        { label: 'Company', value: input.companyName },
        { label: 'Access', value: input.isDesktop ? 'Desktop TEMP keycode' : 'Mobile Vault keycode' },
      ]),
      `<p style="margin:0;color:#9aa8bc;font-size:12px;line-height:1.5;">This code burns after first use. Do not share it.</p>`,
    ].join(''),
    cta: input.isDesktop ? undefined : { href: openUrl, label: 'OPEN FLEETVU VAULT' },
    supportHtml: input.isDesktop
      ? undefined
      : `Or paste this link on your phone:<br/><a href="${escapeHtml(openUrl)}" style="color:#4da3ff;word-break:break-all;">${escapeHtml(openUrl)}</a>`,
    legalLine: 'FleetVu — Sent via welcome@fleetvu.org.',
    logoUrl: chrome.vaultEmailLogoSrc({ useCid: false, appBaseUrl: FALLBACK_APP_URL }),
    documentTitle: 'FleetVu Vault Access',
  });
}
