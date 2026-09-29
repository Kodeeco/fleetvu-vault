/*
# Add Archived Reports Repository Table

1. New Tables
- `archived_reports`
  - `id` (uuid, primary key)
  - `report_title` (text, not null) — display name of the report
  - `report_type` (text, not null) — one of: 'safety_log', 'risk_scorecard', 'insurance_scorecard'
  - `scope` (text, nullable) — fleet/trucks scope description (e.g. "Acme Logistics — All Trucks")
  - `file_size_kb` (integer, nullable) — estimated file size in KB
  - `generated_by` (text, nullable) — email of the user who generated the report
  - `pdf_url` (text, nullable) — URL to the generated PDF (if stored)
  - `metadata` (jsonb, nullable) — additional report metadata (filters, date range, etc.)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `archived_reports`.
- Authenticated users can read all archived reports (shared within org).
- Authenticated users can insert new archived reports.
- Authenticated users can update and delete archived reports.
- No anon access — this is a signed-in app.

3. Audit Trail
- No changes to existing `access_audit_log` table structure needed.
- New action types will be logged via existing columns: 'REPORT_VIEWED', 'REPORT_DOWNLOADED', 'REPORT_FORWARDED'.
- These are written as rows with action_type text and actor_email/actor_role fields.
*/ 

CREATE TABLE IF NOT EXISTS archived_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_title text NOT NULL,
  report_type text NOT NULL DEFAULT 'safety_log',
  scope text,
  file_size_kb integer,
  generated_by text,
  pdf_url text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE archived_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_archived_reports" ON archived_reports;
CREATE POLICY "select_archived_reports"
ON archived_reports FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_archived_reports" ON archived_reports;
CREATE POLICY "insert_archived_reports"
ON archived_reports FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_archived_reports" ON archived_reports;
CREATE POLICY "update_archived_reports"
ON archived_reports FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_archived_reports" ON archived_reports;
CREATE POLICY "delete_archived_reports"
ON archived_reports FOR DELETE
TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_archived_reports_created_at ON archived_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_reports_type ON archived_reports (report_type);
