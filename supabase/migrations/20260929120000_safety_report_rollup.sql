/*
  Safety Report Rollup — Admin/Manager cadence prefs + digest archive.

  Drivers' weekly/daily/monthly safety packages are collected by company,
  compressed into ONE Admin digest PDF, emailed to Super Admin / Admin / Manager
  only (legal isolation — never FleetVu Global Admin).
*/

CREATE TABLE IF NOT EXISTS safety_report_rollup_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  cadence text NOT NULL DEFAULT 'weekly'
    CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  -- Preferred send weekday for weekly (0=Sun … 5=Fri … 6=Sat). Default Friday.
  weekly_weekday integer NOT NULL DEFAULT 5
    CHECK (weekly_weekday BETWEEN 0 AND 6),
  last_sent_at timestamptz,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_rollup_prefs_enabled
  ON safety_report_rollup_prefs (enabled) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS safety_report_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  company_name text,
  cadence text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  driver_count integer NOT NULL DEFAULT 0,
  package_sha256 text,
  report_title text NOT NULL,
  pdf_data_url text,
  recipient_emails text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'emailed', 'failed')),
  error_message text,
  archived_report_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_digests_company
  ON safety_report_digests (company_id, created_at DESC);

ALTER TABLE safety_report_rollup_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_report_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_rollup_prefs" ON safety_report_rollup_prefs;
CREATE POLICY "anon_select_rollup_prefs" ON safety_report_rollup_prefs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_upsert_rollup_prefs" ON safety_report_rollup_prefs;
CREATE POLICY "anon_upsert_rollup_prefs" ON safety_report_rollup_prefs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_safety_digests" ON safety_report_digests;
CREATE POLICY "anon_select_safety_digests" ON safety_report_digests
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_safety_digests" ON safety_report_digests;
CREATE POLICY "anon_insert_safety_digests" ON safety_report_digests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_safety_digests" ON safety_report_digests;
CREATE POLICY "anon_update_safety_digests" ON safety_report_digests
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE safety_report_rollup_prefs IS
  'Customer Admin/Manager preference: daily|weekly|monthly safety digest email. Customer-tenant exclusive.';
COMMENT ON TABLE safety_report_digests IS
  'Compressed multi-driver safety digests emailed to company Admins. Never routed to FleetVu Global Admin.';
