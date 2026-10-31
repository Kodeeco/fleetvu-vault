/**
 * Shared Vault PDF chrome — badge art, brand colors, letter masthead helpers.
 * Matches Fleet-Ins SafetyReports SAMPLE_v6 standard (Oct 2, 2026).
 * Note: no top-level Node `fs` import — this module is used from client PDF downloads.
 */

import type { jsPDF } from 'jspdf';

export const VAULT_PDF = {
  NAVY: [15, 23, 42] as [number, number, number],
  INK: [30, 41, 59] as [number, number, number],
  MUTED: [100, 116, 139] as [number, number, number],
  RULE: [203, 213, 225] as [number, number, number],
  PAPER: [255, 255, 255] as [number, number, number],
  WASH: [248, 250, 252] as [number, number, number],
  ACCENT: [248, 111, 8] as [number, number, number],
  GREEN: [5, 150, 105] as [number, number, number],
  AMBER: [180, 83, 9] as [number, number, number],
  RED: [185, 28, 28] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
  EDGE: 28,
  M: 40,
};

export type VaultBadgeAsset = { dataUrl: string; format: 'PNG' | 'JPEG'; aspect: number };

let badgeCache: VaultBadgeAsset | null | undefined;
let wordmarkCache: VaultBadgeAsset | null | undefined;

type AssetCandidate = { name: string; format: 'PNG' | 'JPEG'; aspect: number };

async function loadPublicAsset(
  files: AssetCandidate[],
  cache: { current: VaultBadgeAsset | null | undefined },
): Promise<VaultBadgeAsset | null> {
  if (cache.current !== undefined) return cache.current;

  // Node / server — read from public/ (dynamic require so webpack client build skips fs)
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path') as typeof import('path');
      const publicDir = path.join(process.cwd(), 'public');
      for (const f of files) {
        const full = path.join(publicDir, f.name);
        if (fs.existsSync(full)) {
          const b64 = fs.readFileSync(full).toString('base64');
          const mime = f.format === 'PNG' ? 'image/png' : 'image/jpeg';
          cache.current = {
            dataUrl: `data:${mime};base64,${b64}`,
            format: f.format,
            aspect: f.aspect,
          };
          return cache.current;
        }
      }
    } catch {
      /* fall through to fetch */
    }
  }

  // Browser — fetch static assets
  for (const f of files) {
    try {
      const res = await fetch(`/${f.name}`);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      cache.current = { dataUrl, format: f.format, aspect: f.aspect };
      return cache.current;
    } catch {
      /* try next */
    }
  }

  cache.current = null;
  return null;
}

/** Load winged V badge from public/ — seal marks / compact brand chip. */
export async function loadVaultBadgeAsset(): Promise<VaultBadgeAsset | null> {
  const box = { current: badgeCache };
  const asset = await loadPublicAsset(
    [
      { name: 'vault-v-badge-pdf.jpg', format: 'JPEG', aspect: 1 },
      { name: 'vault-v-badge-round.jpg', format: 'JPEG', aspect: 1 },
      { name: 'FleetVu-VaultBadge.jpg', format: 'JPEG', aspect: 1 },
      { name: 'vault-v-badge.png', format: 'PNG', aspect: 1.18 },
    ],
    box,
  );
  badgeCache = box.current;
  return asset;
}

/** Full gold “Vault” wordmark for report mastheads (not the V-only badge). */
export async function loadVaultWordmarkAsset(): Promise<VaultBadgeAsset | null> {
  const box = { current: wordmarkCache };
  const asset = await loadPublicAsset(
    [
      // Approved Vault combo mark — transparent PNG (no black plate)
      { name: 'vault-wordmark-combo.png', format: 'PNG', aspect: 3.21 },
      { name: 'vault-wordmark-combo.jpg', format: 'JPEG', aspect: 3.21 },
      { name: 'vault-wordmark-pdf.jpg', format: 'JPEG', aspect: 3.21 },
      { name: 'FV-Vault-wordmark.png', format: 'PNG', aspect: 3.55 },
      { name: 'FV-Vault-logo-gold.png', format: 'PNG', aspect: 3.55 },
      { name: 'FV-Vault3.png', format: 'PNG', aspect: 3.2 },
    ],
    box,
  );
  wordmarkCache = box.current;
  return asset;
}

export function drawVaultVBadge(
  doc: jsPDF,
  x: number,
  y: number,
  height: number,
  badge: VaultBadgeAsset | null,
): number {
  const { ACCENT, WHITE, NAVY } = VAULT_PDF;
  if (badge) {
    const w = height * badge.aspect;
    doc.addImage(badge.dataUrl, badge.format, x, y, w, height);
    return w;
  }
  const r = height / 2;
  doc.setFillColor(...ACCENT);
  doc.circle(x + r, y + r, r, 'F');
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.5);
  doc.circle(x + r, y + r, r - 1, 'S');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(height * 0.55);
  doc.text('V', x + r, y + r + height * 0.18, { align: 'center' });
  return height;
}

/** Draw full Vault wordmark; falls back to text “Vault” if asset missing. */
export function drawVaultWordmark(
  doc: jsPDF,
  x: number,
  y: number,
  height: number,
  wordmark: VaultBadgeAsset | null,
): number {
  if (wordmark) {
    const w = height * wordmark.aspect;
    doc.addImage(wordmark.dataUrl, wordmark.format, x, y, w, height);
    return w;
  }
  doc.setTextColor(...VAULT_PDF.WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.max(14, height * 0.55));
  doc.text('Vault', x, y + height * 0.72);
  return doc.getTextWidth('Vault');
}

export function paintVaultPageWash(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...VAULT_PDF.WASH);
  doc.rect(0, 0, pageW, pageH, 'F');
}

export function drawSecureShaBadge(
  doc: jsPDF,
  x: number,
  y: number,
  sealShort: string,
): number {
  const { ACCENT, WHITE, NAVY } = VAULT_PDF;
  const secureW = 52;
  const hashW = 128;
  doc.setFillColor(...ACCENT);
  doc.roundedRect(x, y, secureW, 16, 3, 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SECURE', x + secureW / 2, y + 11.5, { align: 'center' });
  doc.setFillColor(...NAVY);
  doc.roundedRect(x + secureW + 6, y, hashW, 16, 3, 3, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...ACCENT);
  doc.text(`SHA-256 #${sealShort}`, x + secureW + 6 + hashW / 2, y + 11.5, {
    align: 'center',
  });
  return secureW + 6 + hashW;
}

export function drawVaultSectionTitle(doc: jsPDF, text: string, y: number, m = VAULT_PDF.M): number {
  const { NAVY, ACCENT } = VAULT_PDF;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(text, m, y);
  doc.setFillColor(...ACCENT);
  doc.rect(m, y + 5, 80, 2.5, 'F');
  return y + 20;
}

export interface VaultMastheadOpts {
  title: string;
  /** Orange line under title — e.g. evaluation window */
  subtitle: string;
  reportId: string;
  generatedAt: Date;
  preparedBy?: string;
  sealShort: string;
  /** Compact V badge — used only if wordmark missing */
  badge: VaultBadgeAsset | null;
  /** Full Vault wordmark (preferred brand mark in masthead) */
  wordmark?: VaultBadgeAsset | null;
  /** Left masthead band label (yellow) — omit when sealed badge is shown instead */
  bandLabel?: string;
  showSecureBadge?: boolean;
  /** Faint diagonal FORENSIC watermark (insurance / litigation packs only) */
  forensicWatermark?: boolean;
}

/**
 * Shared Final-Final report header — match uploaded template:
 * orange L-frame, large Vault combo mark (no black plate), title to the right,
 * 7-day window left-justified under the logo, meta + SECURE on the right.
 */
export function drawVaultLetterMasthead(doc: jsPDF, opts: VaultMastheadOpts): number {
  const { NAVY, ACCENT, WHITE, EDGE, M } = VAULT_PDF;
  const pageW = doc.internal.pageSize.getWidth();
  const rule = 2.5;
  const leftBarW = 3.5;
  // Left orange bar = body margin (template left edge — do not shift inward)
  const marginX = M;
  // Logo size matches Final Report Header template (full combo mark, not a chip)
  const markH = 40;
  const markX = marginX + leftBarW + 5;
  const markY = 9;
  const rightMetaW = 150;
  // Band tall enough for logo + window under logo + verify row
  const headerH = 102;

  paintVaultPageWash(doc);

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, headerH, 'F');

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageW, rule, 'F');
  doc.rect(0, headerH - rule, pageW, rule, 'F');
  doc.rect(marginX, rule, leftBarW, headerH - rule * 2, 'F');

  if (opts.forensicWatermark) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(40, 55, 80);
    doc.text('FORENSIC', pageW * 0.42, 62, { angle: 14 });
  }

  const markW = opts.wordmark
    ? drawVaultWordmark(doc, markX, markY, markH, opts.wordmark)
    : drawVaultVBadge(doc, markX, markY, markH, opts.badge);

  // Title sits to the RIGHT of the logo, vertically centered on the mark
  const titleX = markX + markW + 8;
  const titleMax = Math.max(90, pageW - titleX - EDGE - rightMetaW);
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  let titleDraw = `— ${opts.title}`;
  if (doc.getTextWidth(titleDraw) > titleMax) {
    while (titleDraw.length > 8 && doc.getTextWidth(`${titleDraw}…`) > titleMax) {
      titleDraw = titleDraw.slice(0, -1);
    }
    titleDraw = `${titleDraw}…`;
  }
  doc.text(titleDraw, titleX, markY + markH * 0.62);

  // Window line — LEFT under the Vault logo (same X as logo), one line only
  const windowLine = (opts.subtitle || '').replace(/\s+/g, ' ').trim();
  const windowY = markY + markH + 11;
  const windowMax = Math.max(100, pageW - markX - EDGE - rightMetaW);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...ACCENT);
  let winSize = 7.25;
  doc.setFontSize(winSize);
  let winDraw = windowLine;
  while (winSize > 5.5 && doc.getTextWidth(winDraw) > windowMax) {
    winSize -= 0.25;
    doc.setFontSize(winSize);
  }
  if (doc.getTextWidth(winDraw) > windowMax) {
    const parts = winDraw.split(/\s[—–-]\s/);
    if (parts.length === 2) {
      let left = parts[0];
      let right = parts[1];
      winDraw = `${left} — ${right}`;
      while (doc.getTextWidth(winDraw) > windowMax && (left.length > 12 || right.length > 12)) {
        if (left.length >= right.length) left = left.slice(0, -1);
        else right = right.slice(0, -1);
        winDraw = `${left}… — ${right}`;
      }
    } else {
      while (winDraw.length > 10 && doc.getTextWidth(`${winDraw}…`) > windowMax) {
        winDraw = winDraw.slice(0, -1);
      }
      winDraw = `${winDraw}…`;
    }
  }
  doc.text(winDraw, markX, windowY);

  // Right meta
  doc.setTextColor(186, 198, 214);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const genLong = opts.generatedAt.toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  [
    `Generated ${genLong}`,
    `Prepared by: ${opts.preparedBy || 'The Vault'}`,
    `Report ID ${opts.reportId}`,
  ].forEach((line, i) => doc.text(line, pageW - EDGE, 22 + i * 10, { align: 'right' }));

  const rowY = headerH - 12;
  if (opts.showSecureBadge !== false) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(186, 198, 214);
    const verifiedAt = opts.generatedAt.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    doc.text(`Generated: ${verifiedAt}  ·  SHA-256 Verified`, markX, rowY);

    const secureBlockW = 52 + 6 + 128;
    drawSecureShaBadge(doc, pageW - EDGE - secureBlockW, rowY - 9, opts.sealShort);
  } else if (opts.bandLabel) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(253, 224, 71);
    doc.text(opts.bandLabel, markX, rowY);
  }

  return headerH + 10;
}
