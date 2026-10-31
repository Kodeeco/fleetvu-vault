/**
 * Shared FleetVu transactional email chrome — matches Welcome roster template:
 * light outer pad, 560px navy card, gold frame eyebrow, inset body, footer band.
 * Outlook-safe table layout (no edge-slammed blocks).
 *
 * Client-safe: no Node fs. Logo CID attachment helpers live in email-logo-server.ts.
 */

export const VAULT_EMAIL_LOGO_CID = 'vault-logo';

const FALLBACK_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.fleetvu.org';

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function vaultEmailLogoSrc(opts?: {
  useCid?: boolean;
  logoUrl?: string;
  appBaseUrl?: string;
}): string {
  if (opts?.logoUrl) return opts.logoUrl;
  if (opts?.useCid !== false) return `cid:${VAULT_EMAIL_LOGO_CID}`;
  const base = (opts?.appBaseUrl || FALLBACK_APP_URL).replace(/\/+$/, '');
  return `${base}/FV-Vault3.png`;
}

export type FleetVuEmailChromeInput = {
  /** Small gold framed label, e.g. SAFETY REPORT */
  eyebrow: string;
  /** Optional mailbox line under eyebrow */
  fromLine?: string;
  title: string;
  /** Intro paragraph under title (plain or trusted HTML) */
  introHtml?: string;
  /** Main body HTML (rows, cards) — already escaped by caller */
  bodyHtml: string;
  /** Optional CTA */
  cta?: { href: string; label: string };
  /** Secondary note above legal footer */
  supportHtml?: string;
  /** Outer gray band under card */
  outerFooter?: string;
  /** Legal / identity line inside card */
  legalLine?: string;
  /** Prefer cid: when attachment is included */
  logoUrl?: string;
  /** Document title for <title> */
  documentTitle?: string;
};

/**
 * Full HTML document — Welcome-grade card with padding away from edges.
 */
export function buildFleetVuEmailHtml(input: FleetVuEmailChromeInput): string {
  const year = new Date().getFullYear();
  const logoSrc = input.logoUrl || `cid:${VAULT_EMAIL_LOGO_CID}`;
  const eyebrow = escapeEmailHtml(input.eyebrow);
  const fromLine = input.fromLine ? escapeEmailHtml(input.fromLine) : '';
  const title = escapeEmailHtml(input.title);
  const legal =
    input.legalLine ||
    `This message was sent by FleetVu Forensic Vault.<br />&copy; ${year} FleetVu. All rights reserved.`;
  const outer =
    input.outerFooter ||
    'This is an automated FleetVu message. Please do not reply directly unless instructed.';
  const docTitle = escapeEmailHtml(input.documentTitle || input.title);

  const ctaBlock = input.cta
    ? `
          <tr>
            <td align="center" style="padding:20px 36px 8px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;">
                <tr>
                  <td align="center" bgcolor="#d4a017" style="background-color:#d4a017;border-radius:4px;mso-padding-alt:16px 28px;">
                    <a href="${escapeEmailHtml(input.cta.href)}" target="_blank" style="display:inline-block;background-color:#d4a017;color:#0b132b;font-size:15px;font-weight:700;line-height:1.2;text-align:center;text-decoration:none;padding:16px 28px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.03em;">
                      ${escapeEmailHtml(input.cta.label)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${docTitle}</title>
<!--[if mso]><style>table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#e8edf3;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e8edf3;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#0b132b;border-collapse:collapse;border:1px solid #243044;">
          <!-- Logo + framed eyebrow -->
          <tr>
            <td align="center" style="padding:28px 36px 10px 36px;background:#0b132b;">
              <img src="${logoSrc}" alt="FleetVu Vault" width="260" height="auto" style="display:block;width:260px;max-width:260px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;background-color:#0b132b;" />
              <table role="presentation" width="368" cellpadding="0" cellspacing="0" border="0" align="center" style="width:368px;max-width:368px;margin:20px auto 0 auto;border-collapse:collapse;">
                <tr>
                  <td align="center" style="border:1px solid #c9a227;padding:10px 16px;mso-padding-alt:10px 16px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:#d4a017;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;line-height:1.25;mso-line-height-rule:exactly;">
                      ${eyebrow}
                    </div>
                    ${
                      fromLine
                        ? `<div style="font-size:10px;color:#9aa8bc;margin-top:4px;letter-spacing:0.04em;font-family:Arial,Helvetica,sans-serif;">${fromLine}</div>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:22px 36px 8px 36px;font-family:Arial,Helvetica,sans-serif;">
              <h1 style="margin:0 0 14px 0;color:#ffffff;font-size:24px;line-height:1.3;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
                ${title}
              </h1>
              ${
                input.introHtml
                  ? `<div style="margin:0 0 20px 0;color:#c5d0de;font-size:15px;line-height:1.65;font-family:Arial,Helvetica,sans-serif;">${input.introHtml}</div>`
                  : ''
              }
              ${input.bodyHtml}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px 0;">
                <tr>
                  <td style="height:1px;line-height:1px;font-size:0;background:#243044;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          ${ctaBlock}

          <tr>
            <td style="padding:16px 36px 28px 36px;font-family:Arial,Helvetica,sans-serif;">
              ${
                input.supportHtml
                  ? `<div style="margin:0 0 16px 0;color:#c5d0de;font-size:13px;line-height:1.55;">${input.supportHtml}</div>`
                  : ''
              }
              <p style="margin:0;color:#6b7a90;font-size:11px;line-height:1.55;">
                ${legal}
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#dce3ec;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:14px 24px;color:#334155;font-size:11px;font-family:Arial,Helvetica,sans-serif;line-height:1.45;">
              ${escapeEmailHtml(outer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Inset detail card used inside bodyHtml */
export function emailDetailCard(rows: Array<{ label: string; value: string }>): string {
  const lines = rows
    .map(
      (r, i) => `
      <tr>
        <td style="padding:${i === 0 ? '0' : '10px'} 0 ${i === rows.length - 1 ? '0' : '0'} 0;font-family:Arial,Helvetica,sans-serif;">
          <span style="color:#9aa8bc;font-size:12px;">${escapeEmailHtml(r.label)}</span>
          <span style="color:#6b7a90;font-size:12px;"> · </span>
          <strong style="color:#ffffff;font-size:14px;font-weight:700;">${escapeEmailHtml(r.value)}</strong>
        </td>
      </tr>`,
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;border-collapse:collapse;">
      <tr>
        <td style="background:#111827;border:1px solid #334155;padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lines}</table>
        </td>
      </tr>
    </table>`;
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 16px 0;color:#c5d0de;font-size:15px;line-height:1.65;font-family:Arial,Helvetica,sans-serif;">${escapeEmailHtml(text)}</p>`;
}

/** Horizontal metric strip for executive digests (3–4 KPIs). */
export function emailMetricStrip(
  metrics: Array<{ label: string; value: string }>,
): string {
  const cells = metrics
    .slice(0, 4)
    .map(
      (m, i) => `
      <td width="${Math.floor(100 / Math.min(metrics.length, 4))}%" align="center" valign="top" style="padding:12px 8px;${
        i > 0 ? 'border-left:1px solid #334155;' : ''
      }font-family:Arial,Helvetica,sans-serif;">
        <div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:0.02em;">${escapeEmailHtml(m.value)}</div>
        <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#d4a017;margin-top:6px;">${escapeEmailHtml(m.label)}</div>
      </td>`,
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;border-collapse:collapse;">
      <tr>
        <td style="background:#111827;border:1px solid #334155;padding:4px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>${cells}</tr>
          </table>
        </td>
      </tr>
    </table>`;
}
