/*
  Seed sample forensic PDF archive rows so prior safety reports exist
  alongside newly generated FleetVu_Forensic_Report_* downloads.
  Also open anon policies so mobile demo clients can archive PDFs.
*/

DROP POLICY IF EXISTS "anon_select_archived_reports" ON archived_reports;
CREATE POLICY "anon_select_archived_reports"
ON archived_reports FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_insert_archived_reports" ON archived_reports;
CREATE POLICY "anon_insert_archived_reports"
ON archived_reports FOR INSERT TO anon WITH CHECK (true);

INSERT INTO archived_reports (report_title, report_type, scope, file_size_kb, generated_by, pdf_url, metadata, created_at)
SELECT
  'FleetVu_Forensic_Report_2026-09-25_DRV-4821.pdf',
  'safety_log',
  'Acme Logistics — Truck #072 · Marcus Reyes',
  186,
  'marcus.reyes@driver.fleetvu.com',
  null,
  jsonb_build_object(
    'driver_number', 'DRV-4821',
    'driver_name', 'Marcus Reyes',
    'truck_number', '#072',
    'source', 'seed_prior_report',
    'report_hash', 'seed-2026-09-25-drv-4821'
  ),
  '2026-09-25T18:22:00Z'
WHERE NOT EXISTS (
  SELECT 1 FROM archived_reports
  WHERE report_title = 'FleetVu_Forensic_Report_2026-09-25_DRV-4821.pdf'
);

INSERT INTO archived_reports (report_title, report_type, scope, file_size_kb, generated_by, pdf_url, metadata, created_at)
SELECT
  'FleetVu_Forensic_Report_2026-09-20_DRV-4821.pdf',
  'safety_log',
  'Acme Logistics — Truck #072 · Marcus Reyes',
  172,
  'marcus.reyes@driver.fleetvu.com',
  null,
  jsonb_build_object(
    'driver_number', 'DRV-4821',
    'driver_name', 'Marcus Reyes',
    'truck_number', '#072',
    'source', 'seed_prior_report',
    'report_hash', 'seed-2026-09-20-drv-4821'
  ),
  '2026-09-20T14:10:00Z'
WHERE NOT EXISTS (
  SELECT 1 FROM archived_reports
  WHERE report_title = 'FleetVu_Forensic_Report_2026-09-20_DRV-4821.pdf'
);
