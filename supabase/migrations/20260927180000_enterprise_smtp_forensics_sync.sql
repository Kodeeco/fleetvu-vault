/*
# FleetVu Enterprise — SMTP Dispatch, Forensics Custody, Sync Queues

## Purpose
Production-grade persistence for:
  1. email_dispatch_log — durable SMTP/HTTP dispatch audit with retry state
  2. chain_of_custody_events — litigation-grade SHA-256 chained custody trail
  3. reconstruction_packages — millisecond-accurate accident reconstruction seals
  4. legal_export_artifacts — tamper-evident legal discovery packages
  5. sync_event_log — portal↔mobile realtime sync acknowledgements

## Security
- RLS enabled; anon/authenticated policies consistent with existing FleetVu tables.
- email_dispatch_log and chain_of_custody_events are append-oriented (no DELETE for custody).
*/

-- ============================================================
-- email_dispatch_log
-- ============================================================
CREATE TABLE IF NOT EXISTS email_dispatch_log (
  id text PRIMARY KEY,
  identity text NOT NULL CHECK (identity IN ('support', 'welcome', 'safetyreport', 'notice')),
  from_address text NOT NULL,
  to_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  provider text,
  last_error text,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_dispatch_status ON email_dispatch_log(status);
CREATE INDEX IF NOT EXISTS idx_email_dispatch_identity ON email_dispatch_log(identity);
CREATE INDEX IF NOT EXISTS idx_email_dispatch_correlation ON email_dispatch_log(correlation_id);

ALTER TABLE email_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_email_dispatch" ON email_dispatch_log;
CREATE POLICY "anon_select_email_dispatch" ON email_dispatch_log FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_email_dispatch" ON email_dispatch_log;
CREATE POLICY "anon_insert_email_dispatch" ON email_dispatch_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_email_dispatch" ON email_dispatch_log;
CREATE POLICY "anon_update_email_dispatch" ON email_dispatch_log FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- chain_of_custody_events (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS chain_of_custody_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq bigint NOT NULL,
  artifact_type text NOT NULL,
  artifact_id text NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_account_id text,
  actor_email text,
  actor_role text,
  device_id text,
  device_platform text,
  app_version text,
  network_timestamp timestamptz NOT NULL,
  server_timestamp timestamptz NOT NULL DEFAULT now(),
  artifact_hash text,
  prev_hash text,
  record_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custody_artifact ON chain_of_custody_events(artifact_type, artifact_id);
CREATE INDEX IF NOT EXISTS idx_custody_company ON chain_of_custody_events(company_id);
CREATE INDEX IF NOT EXISTS idx_custody_seq ON chain_of_custody_events(seq);
CREATE UNIQUE INDEX IF NOT EXISTS idx_custody_record_hash ON chain_of_custody_events(record_hash);

ALTER TABLE chain_of_custody_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_custody" ON chain_of_custody_events;
CREATE POLICY "anon_select_custody" ON chain_of_custody_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_custody" ON chain_of_custody_events;
CREATE POLICY "anon_insert_custody" ON chain_of_custody_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- No UPDATE/DELETE — append-only for forensic integrity

-- ============================================================
-- reconstruction_packages
-- ============================================================
CREATE TABLE IF NOT EXISTS reconstruction_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  frame_count integer NOT NULL DEFAULT 0,
  start_ms bigint NOT NULL,
  end_ms bigint NOT NULL,
  duration_ms bigint NOT NULL DEFAULT 0,
  gap_count integer NOT NULL DEFAULT 0,
  max_gap_ms bigint NOT NULL DEFAULT 0,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  frames jsonb NOT NULL DEFAULT '[]'::jsonb,
  merkle_root text NOT NULL,
  package_hash text NOT NULL,
  sealed_at timestamptz NOT NULL DEFAULT now(),
  custody_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_incident ON reconstruction_packages(incident_id);
CREATE INDEX IF NOT EXISTS idx_recon_company ON reconstruction_packages(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recon_package_hash ON reconstruction_packages(package_hash);

ALTER TABLE reconstruction_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_recon" ON reconstruction_packages;
CREATE POLICY "anon_select_recon" ON reconstruction_packages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_recon" ON reconstruction_packages;
CREATE POLICY "anon_insert_recon" ON reconstruction_packages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- legal_export_artifacts
-- ============================================================
CREATE TABLE IF NOT EXISTS legal_export_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id text NOT NULL UNIQUE,
  case_id text NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  company_name text,
  incident_id text,
  manifest jsonb NOT NULL,
  seal_hash text NOT NULL,
  content_hash text NOT NULL,
  encrypted boolean NOT NULL DEFAULT false,
  exported_by_email text NOT NULL,
  exported_by_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_export_case ON legal_export_artifacts(case_id);
CREATE INDEX IF NOT EXISTS idx_legal_export_company ON legal_export_artifacts(company_id);

ALTER TABLE legal_export_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_legal_export" ON legal_export_artifacts;
CREATE POLICY "anon_select_legal_export" ON legal_export_artifacts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_legal_export" ON legal_export_artifacts;
CREATE POLICY "anon_insert_legal_export" ON legal_export_artifacts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- sync_event_log (portal ↔ mobile)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_event_log (
  id text PRIMARY KEY,
  channel text NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  device_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_timestamp_ms bigint NOT NULL,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'acked',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_device ON sync_event_log(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_company ON sync_event_log(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_channel ON sync_event_log(channel);
CREATE INDEX IF NOT EXISTS idx_sync_client_ts ON sync_event_log(client_timestamp_ms);

ALTER TABLE sync_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sync" ON sync_event_log;
CREATE POLICY "anon_select_sync" ON sync_event_log FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sync" ON sync_event_log;
CREATE POLICY "anon_insert_sync" ON sync_event_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);
