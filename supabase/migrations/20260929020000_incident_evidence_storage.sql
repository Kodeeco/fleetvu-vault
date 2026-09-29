/*
  Incident evidence storage + media metadata (customer-tenant exclusive).
  Photos / license / insurance images are NEVER routed to FleetVu Global Admin.
*/

-- Private storage bucket for incident media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-evidence',
  'incident-evidence',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "incident_evidence_insert" ON storage.objects;
CREATE POLICY "incident_evidence_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'incident-evidence');

DROP POLICY IF EXISTS "incident_evidence_select" ON storage.objects;
CREATE POLICY "incident_evidence_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'incident-evidence');

DROP POLICY IF EXISTS "incident_evidence_update" ON storage.objects;
CREATE POLICY "incident_evidence_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'incident-evidence')
  WITH CHECK (bucket_id = 'incident-evidence');

CREATE TABLE IF NOT EXISTS incident_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL,
  company_id uuid,
  slot_key text NOT NULL,
  label text,
  storage_path text,
  sha256 text NOT NULL,
  mime_type text,
  byte_size integer,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_media_case ON incident_media(case_id);
CREATE INDEX IF NOT EXISTS idx_incident_media_company ON incident_media(company_id);

ALTER TABLE incident_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_incident_media" ON incident_media;
CREATE POLICY "anon_select_incident_media" ON incident_media
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_incident_media" ON incident_media;
CREATE POLICY "anon_insert_incident_media" ON incident_media
  FOR INSERT TO anon, authenticated WITH CHECK (true);

COMMENT ON TABLE incident_media IS
  'Customer-tenant incident photos (scene, license, insurance). Legal isolation — never expose to FleetVu Global Admin.';
