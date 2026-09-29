/*
  Company brand logos for Vault / HUD (public read — shown on driver lock screen).
*/

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN companies.logo_url IS
  'Public URL for customer wordmark (dark UI). Shown on Vault lock screen and HUD like SCFuels trial branding.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
CREATE POLICY "company_logos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_insert" ON storage.objects;
CREATE POLICY "company_logos_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_update" ON storage.objects;
CREATE POLICY "company_logos_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'company-logos')
  WITH CHECK (bucket_id = 'company-logos');
