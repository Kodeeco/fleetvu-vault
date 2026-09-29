import { supabase } from '@/lib/supabase';

export type CompanyLogoUpload = {
  /** Raw base64 or data-URL */
  base64: string;
  mimeType: string;
  fileName?: string;
};

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

/**
 * Upload a white/dark-UI wordmark and persist companies.logo_url.
 * Safe to call when the storage bucket or column is not yet migrated — returns null.
 */
export async function uploadCompanyLogo(
  companyId: string,
  logo: CompanyLogoUpload,
): Promise<string | null> {
  try {
    const mime = logo.mimeType || 'image/png';
    const ext = extForMime(mime);
    const path = `${companyId}/logo-white.${ext}`;
    const bytes = Buffer.from(stripDataUrl(logo.base64), 'base64');
    if (bytes.length < 32 || bytes.length > 2_097_152) {
      throw new Error('Logo must be between 32 bytes and 2MB');
    }

    const { error: upErr } = await supabase.storage
      .from('company-logos')
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from('company-logos').getPublicUrl(path);
    const logoUrl = pub?.publicUrl || null;
    if (!logoUrl) return null;

    const { error: updErr } = await supabase
      .from('companies')
      .update({ logo_url: logoUrl })
      .eq('id', companyId);
    if (updErr) throw updErr;

    return logoUrl;
  } catch (err) {
    console.warn('[company-logo] upload failed', err);
    return null;
  }
}
