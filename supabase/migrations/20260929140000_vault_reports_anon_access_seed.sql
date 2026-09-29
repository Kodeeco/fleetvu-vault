/*
  Ensure archived_reports is readable by the portal anon client
  (demo / localStorage auth does not mint a Supabase JWT).
  Re-seed sample forensic PDF rows if missing.
*/

DROP POLICY IF EXISTS "anon_select_archived_reports" ON archived_reports;
CREATE POLICY "anon_select_archived_reports"
ON archived_reports FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_archived_reports" ON archived_reports;
CREATE POLICY "anon_insert_archived_reports"
ON archived_reports FOR INSERT TO anon, authenticated WITH CHECK (true);

INSERT INTO archived_reports (report_title, report_type, scope, file_size_kb, generated_by, pdf_url, metadata, created_at)
SELECT
  'FleetVu_Forensic_Report_2026-09-25_TRK-101.pdf',
  'safety_log',
  'Apex Logistics — Truck TRK-101 · Marcus Chen',
  186,
  'info@fleetmasterusa.com',
  null,
  jsonb_build_object('source', 'seed_vault_reports_fix', 'report_hash', 'seed-2026-09-25-trk-101'),
  '2026-09-25T18:22:00Z'
WHERE NOT EXISTS (
  SELECT 1 FROM archived_reports
  WHERE report_title = 'FleetVu_Forensic_Report_2026-09-25_TRK-101.pdf'
);

INSERT INTO archived_reports (report_title, report_type, scope, file_size_kb, generated_by, pdf_url, metadata, created_at)
SELECT
  'Risk_Safety_Scorecard_Apex_2026-09-22.pdf',
  'risk_scorecard',
  'Apex Logistics — All Trucks',
  142,
  'info@fleetmasterusa.com',
  null,
  jsonb_build_object('source', 'seed_vault_reports_fix'),
  '2026-09-22T14:10:00Z'
WHERE NOT EXISTS (
  SELECT 1 FROM archived_reports
  WHERE report_title = 'Risk_Safety_Scorecard_Apex_2026-09-22.pdf'
);

INSERT INTO archived_reports (report_title, report_type, scope, file_size_kb, generated_by, pdf_url, metadata, created_at)
SELECT
  'Insurance_Scorecard_Apex_2026-09-20.pdf',
  'insurance_scorecard',
  'Apex Logistics — Fleet underwriting packet',
  168,
  'info@fleetmasterusa.com',
  null,
  jsonb_build_object('source', 'seed_vault_reports_fix'),
  '2026-09-20T11:05:00Z'
WHERE NOT EXISTS (
  SELECT 1 FROM archived_reports
  WHERE report_title = 'Insurance_Scorecard_Apex_2026-09-20.pdf'
);
