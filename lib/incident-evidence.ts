/**
 * Incident evidence capture helpers — camera files, SHA-256, storage upload.
 * Customer-tenant exclusive; never route evidence to FleetVu Global Admin.
 */

import { supabase } from '@/lib/supabase';

export const INCIDENT_EVIDENCE_BUCKET = 'incident-evidence';

export interface CapturedEvidence {
  slotKey: string;
  label: string;
  /** Local preview (data URL or object URL) */
  previewUrl: string;
  /** Raw file for upload */
  file: File;
  /** SHA-256 hex of file bytes */
  sha256: string;
  /** Path in storage after upload (set later) */
  storagePath?: string;
  /** Public/signed URL after upload */
  storageUrl?: string;
  capturedAt: string;
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Extremely rare fallback — not cryptographically strong
  let h = 0;
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) h = (Math.imul(31, h) + bytes[i]) | 0;
  return `legacy_${(h >>> 0).toString(16)}`;
}

export async function fileToCapturedEvidence(
  slotKey: string,
  label: string,
  file: File,
): Promise<CapturedEvidence> {
  const buffer = await file.arrayBuffer();
  const sha256 = await sha256Hex(buffer);
  const previewUrl = URL.createObjectURL(file);
  return {
    slotKey,
    label,
    previewUrl,
    file,
    sha256,
    capturedAt: new Date().toISOString(),
  };
}

export async function uploadIncidentEvidence(opts: {
  companyId: string | null;
  caseId: string;
  evidence: CapturedEvidence;
}): Promise<{ storagePath: string; sha256: string }> {
  const safeCompany = (opts.companyId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
  const ext = opts.evidence.file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const storagePath = `${safeCompany}/${opts.caseId}/${opts.evidence.slotKey}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(INCIDENT_EVIDENCE_BUCKET)
    .upload(storagePath, opts.evidence.file, {
      cacheControl: '3600',
      upsert: true,
      contentType: opts.evidence.file.type || 'image/jpeg',
    });

  if (error) {
    // Fallback: embed small compressed data URL metadata path marker (caller may persist bytes in jsonb)
    throw new Error(error.message);
  }

  return { storagePath, sha256: opts.evidence.sha256 };
}

/** Compress image for jsonb fallback when Storage bucket is not provisioned yet. */
export async function fileToDataUrlCompressed(file: File, maxEdge = 1280, quality = 0.72): Promise<string> {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

export function buildIncidentFileName(opts: {
  companyName?: string | null;
  driverName?: string | null;
  caseId: string;
  submittedAt: Date;
}): string {
  const d = opts.submittedAt;
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    '-',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join('');
  const company = (opts.companyName || 'Fleet').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 24);
  const driver = (opts.driverName || 'Driver').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 24);
  return `INCIDENT_${stamp}_${company}_${driver}_${opts.caseId}`;
}

export async function sha256OfJson(payload: unknown): Promise<string> {
  const text = JSON.stringify(payload);
  const buffer = new TextEncoder().encode(text);
  return sha256Hex(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}
