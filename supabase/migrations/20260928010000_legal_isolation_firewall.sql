/*
# FleetVu Legal Isolation Firewall (Subpoena Boundary)

## HARD RULE
FleetVu platform operators (Global Admin / @fleetvu.org staff) must have
ZERO access to customer legal / forensic / accident / safety-report data.

Incident alerts and reconstruction packages belong exclusively to the
owning customer's Super Admin / Admin portal accounts.

## What this migration does
1. Documents the isolation boundary on evidentiary tables.
2. Adds `legal_isolation_audit` append-only log for denied access attempts
   (metadata only — never stores evidence payloads).
3. Stamps evidentiary tables with ownership comments for compliance review.

NOTE: Application + API layers enforce denial today (anon-key architecture).
When JWT role claims are wired, replace open SELECT policies with
tenant-scoped policies that permanently deny role = 'global_admin'.
*/

-- ============================================================
-- legal_isolation_audit (denied-access / policy markers — NOT evidence)
-- ============================================================
CREATE TABLE IF NOT EXISTS legal_isolation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- e.g. GLOBAL_ADMIN_DENIED_INCIDENT_READ
  actor_role text,
  actor_email text,
  target_table text,
  target_company_id uuid,
  reason text NOT NULL DEFAULT 'FleetVu platform operators have zero access to customer legal data',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_isolation_audit_created ON legal_isolation_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_isolation_audit_actor ON legal_isolation_audit(actor_role, actor_email);

ALTER TABLE legal_isolation_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_legal_isolation_audit" ON legal_isolation_audit;
CREATE POLICY "anon_insert_legal_isolation_audit" ON legal_isolation_audit FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_legal_isolation_audit" ON legal_isolation_audit;
CREATE POLICY "anon_select_legal_isolation_audit" ON legal_isolation_audit FOR SELECT
  TO anon, authenticated USING (true);

-- No UPDATE/DELETE — append-only compliance log

COMMENT ON TABLE legal_isolation_audit IS
  'Subpoena firewall audit: records denied FleetVu Global Admin access attempts to customer legal data. Never stores evidence payloads.';

COMMENT ON TABLE incidents IS
  'CUSTOMER LEGAL DATA — exclusive to customer Super Admin / Admin. FleetVu Global Admin has ZERO access (legal isolation / subpoena firewall). Alerts route to customer portal only.';

COMMENT ON TABLE chain_of_custody_events IS
  'CUSTOMER LEGAL DATA — evidentiary chain of custody. FleetVu Global Admin has ZERO read/export rights.';

COMMENT ON TABLE reconstruction_packages IS
  'CUSTOMER LEGAL DATA — accident reconstruction seals. Delivered only to owning customer tenant admins.';

COMMENT ON TABLE legal_export_artifacts IS
  'CUSTOMER LEGAL DATA — litigation export packages. Export API denies global_admin and @fleetvu.org exporters.';

COMMENT ON TABLE vault_event_blocks IS
  'CUSTOMER FORENSIC TELEMETRY — tenant-owned Vault blocks. Not accessible to FleetVu Global Admin for legal discovery.';

COMMENT ON TABLE archived_reports IS
  'CUSTOMER SAFETY / FORENSIC REPORTS — tenant-exclusive. FleetVu Global Admin denied.';

-- Marker row documenting the policy for auditors
INSERT INTO legal_isolation_audit (event_type, actor_role, actor_email, target_table, reason, metadata)
VALUES (
  'POLICY_DECLARED',
  'system',
  'legal-isolation@system.fleetvu.local',
  'incidents',
  'FleetVu Global Admin has zero access to customer accident files, safety reports, and forensic evidence. Incident alerts go only to customer Super Admin / Admin.',
  jsonb_build_object(
    'alert_recipients', jsonb_build_array('super_admin', 'location_admin', 'admin'),
    'denied_roles', jsonb_build_array('global_admin'),
    'denied_domains', jsonb_build_array('@fleetvu.org', '@fleetvu.com'),
    'purpose', 'subpoena_firewall'
  )
);
