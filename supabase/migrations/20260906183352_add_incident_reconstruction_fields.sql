/*
# Add Incident Reconstruction Fields

1. Modified Tables
- `incidents` table — adds three new columns to support the reconstruction case architecture:
  - `severity_grade` (text, nullable) — stores the severity grade of the incident (e.g. 'S1', 'S2', 'S3', 'S4'). Used for multi-filtering in the Forensic Incident Vault.
  - `triage_status` (text, nullable) — stores the triage status of the incident case (e.g. 'pending', 'under_review', 'resolved', 'escalated'). Distinct from the existing `status` column which tracks the submission workflow.
  - `investigator_notes` (text, nullable) — stores notes entered by investigators/safety admins during case review in the reconstruction workspace.
2. Security
- No RLS policy changes. The existing open CRUD policies on incidents remain unchanged (single-tenant app model).
3. Important Notes
- All three columns are nullable so existing incident rows remain valid without backfill.
- `triage_status` is intentionally separate from `status` to distinguish the clinical triage workflow from the case submission workflow.
- `reconstruction_data` (existing jsonb column) will be used to persist scrub positions, vector configs, and other interactive workspace state — no additional column needed for that.
*/