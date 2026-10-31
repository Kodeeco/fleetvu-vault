/**
 * Default View Vault logo — persist under .data (writable on cPanel).
 * Prefer binary file + /api/crm/default-view/logo; fall back to data: URL
 * in the account JSON (same store as Save Profile).
 */

import fs from 'fs';
import path from 'path';
import { saveDefaultViewAccount, getDefaultViewAccount } from '@/lib/crm/default-view-store';

const DATA_DIR = path.join(process.cwd(), '.data');
const BRAND_DIR = path.join(DATA_DIR, 'branding');
const META_FILE = path.join(BRAND_DIR, 'default-view-logo.json');
const B64_FILE = path.join(BRAND_DIR, 'default-view-logo.b64');

function extForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('svg')) return 'svg';
  return 'jpg';
}

function stripDataUrl(base64: string): string {
  const i = base64.indexOf('base64,');
  return i >= 0 ? base64.slice(i + 7) : base64;
}

function toDataUrl(base64OrDataUrl: string, mime: string): string {
  if (base64OrDataUrl.startsWith('data:')) return base64OrDataUrl;
  return `data:${mime};base64,${base64OrDataUrl}`;
}

function ensureBrandDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BRAND_DIR)) fs.mkdirSync(BRAND_DIR, { recursive: true });
}

export type DefaultViewLogoMeta = {
  fileName: string;
  mimeType: string;
  updatedAt: string;
};

export function readDefaultViewLogoMeta(): DefaultViewLogoMeta | null {
  try {
    if (!fs.existsSync(META_FILE)) return null;
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8')) as DefaultViewLogoMeta;
  } catch {
    return null;
  }
}

export function readDefaultViewLogoBytes(): { bytes: Buffer; mimeType: string } | null {
  const meta = readDefaultViewLogoMeta();
  if (meta?.fileName) {
    const filePath = path.join(BRAND_DIR, meta.fileName);
    if (fs.existsSync(filePath)) {
      try {
        return { bytes: fs.readFileSync(filePath), mimeType: meta.mimeType || 'image/png' };
      } catch {
        /* fall through */
      }
    }
  }

  try {
    if (fs.existsSync(B64_FILE)) {
      const raw = fs.readFileSync(B64_FILE, 'utf8').trim();
      const mime =
        raw.startsWith('data:') && raw.includes(';')
          ? raw.slice(5, raw.indexOf(';'))
          : meta?.mimeType || 'image/png';
      const bytes = Buffer.from(stripDataUrl(raw), 'base64');
      if (bytes.length >= 32) return { bytes, mimeType: mime };
    }
  } catch {
    /* ignore */
  }

  const account = getDefaultViewAccount();
  if (account.logoUrl?.startsWith('data:image/')) {
    try {
      const mime = account.logoUrl.slice(5, account.logoUrl.indexOf(';')) || 'image/png';
      const bytes = Buffer.from(stripDataUrl(account.logoUrl), 'base64');
      if (bytes.length >= 32) return { bytes, mimeType: mime };
    } catch {
      /* ignore */
    }
  }

  return null;
}

/** Write logo bytes and return a cache-busted URL for Vault / CRM. */
export function saveDefaultViewLogoFile(input: {
  base64: string;
  mimeType?: string;
}): string {
  const mime = input.mimeType || 'image/png';
  const dataUrl = toDataUrl(input.base64, mime);
  const bytes = Buffer.from(stripDataUrl(dataUrl), 'base64');
  if (bytes.length < 32) {
    throw new Error('Logo file is too small or invalid');
  }
  if (bytes.length > 2_097_152) {
    throw new Error('Logo must be under 2MB — try a smaller PNG/JPG');
  }

  ensureBrandDir();

  for (const old of fs.readdirSync(BRAND_DIR)) {
    if (old.startsWith('default-view-logo.') && old !== 'default-view-logo.b64') {
      try {
        fs.unlinkSync(path.join(BRAND_DIR, old));
      } catch {
        /* ignore */
      }
    }
  }

  const ext = extForMime(mime);
  const fileName = `default-view-logo.${ext}`;
  let wroteBinary = false;
  try {
    fs.writeFileSync(path.join(BRAND_DIR, fileName), bytes);
    wroteBinary = true;
  } catch (e) {
    console.warn('[default-view-logo] binary write failed', e);
  }

  try {
    fs.writeFileSync(B64_FILE, dataUrl, 'utf8');
  } catch (e) {
    console.warn('[default-view-logo] b64 write failed', e);
  }

  if (wroteBinary) {
    const meta: DefaultViewLogoMeta = {
      fileName,
      mimeType: mime,
      updatedAt: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');
    } catch {
      /* ignore */
    }
  }

  // Always store data URL in account JSON — same path as Save Profile (reliable on cPanel).
  // Binary under .data/branding is optional cache for GET /logo.
  void wroteBinary;
  saveDefaultViewAccount({ logoUrl: dataUrl });
  return dataUrl;
}

export function clearDefaultViewLogoFile(): string {
  ensureBrandDir();
  try {
    if (fs.existsSync(META_FILE)) {
      const meta = readDefaultViewLogoMeta();
      if (meta?.fileName) {
        const fp = path.join(BRAND_DIR, meta.fileName);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      fs.unlinkSync(META_FILE);
    }
    if (fs.existsSync(B64_FILE)) fs.unlinkSync(B64_FILE);
  } catch {
    /* ignore */
  }
  const logoUrl = '/FV-Vault-logo-gold.png';
  saveDefaultViewAccount({ logoUrl });
  return logoUrl;
}

/** Ensure stored logoUrl points at a loadable image. */
export function resolveDefaultViewLogoUrl(): string {
  const account = getDefaultViewAccount();
  if (account.logoUrl?.startsWith('data:image/')) return account.logoUrl;
  if (readDefaultViewLogoBytes()) {
    const v = account.updatedAt ? new Date(account.updatedAt).getTime() : Date.now();
    return `/api/crm/default-view/logo?v=${v || Date.now()}`;
  }
  return account.logoUrl || '/FV-Vault-logo-gold.png';
}
