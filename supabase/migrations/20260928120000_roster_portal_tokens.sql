/*
# FleetVu Roster Portal — customer driver onboarding seats

## Purpose
Global Admin welcome email issues a roster portal token with a capped driver seat count.
Customer Super Admin uploads / adds drivers (Excel), submits for FleetVu review.
Approved roster rows receive one-time login keycodes (mobile biometric / desktop TEMP).

## Zero-access
No accident / forensic payloads — commercial roster metadata only.
*/

CREATE TABLE IF NOT EXISTS roster_portal_tokens (
  token text PRIMARY KEY,
  company_id uuid,
  company_name text NOT NULL,
  contact_email text NOT NULL,
  contact_name text,
  driver_seat_limit integer NOT NULL DEFAULT 25 CHECK (driver_seat_limit > 0 AND driver_seat_limit <= 500),
  status text NOT NULL DEFAULT 'active', -- active | submitted | approved | revoked | expired
  expires_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roster_tokens_company ON roster_portal_tokens(company_id);
CREATE INDEX IF NOT EXISTS idx_roster_tokens_status ON roster_portal_tokens(status);

CREATE TABLE IF NOT EXISTS roster_portal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL REFERENCES roster_portal_tokens(token) ON DELETE CASCADE,
  company_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'driver', -- driver | desktop_user | manager
  location text,
  sensor_serial text,
  truck_number text,
  status text NOT NULL DEFAULT 'draft', -- draft | submitted | approved | keycode_sent
  one_time_keycode text,
  keycode_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roster_entries_token ON roster_portal_entries(token);
CREATE INDEX IF NOT EXISTS idx_roster_entries_company ON roster_portal_entries(company_id);

ALTER TABLE roster_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_portal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_roster_tokens" ON roster_portal_tokens;
CREATE POLICY "anon_select_roster_tokens" ON roster_portal_tokens FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_roster_tokens" ON roster_portal_tokens;
CREATE POLICY "anon_insert_roster_tokens" ON roster_portal_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_roster_tokens" ON roster_portal_tokens;
CREATE POLICY "anon_update_roster_tokens" ON roster_portal_tokens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upsert_all_roster_tokens" ON roster_portal_tokens;
CREATE POLICY "anon_upsert_all_roster_tokens" ON roster_portal_tokens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_roster_entries" ON roster_portal_entries;
CREATE POLICY "anon_select_roster_entries" ON roster_portal_entries FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_roster_entries" ON roster_portal_entries;
CREATE POLICY "anon_insert_roster_entries" ON roster_portal_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_roster_entries" ON roster_portal_entries;
CREATE POLICY "anon_update_roster_entries" ON roster_portal_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_roster_entries" ON roster_portal_entries;
CREATE POLICY "anon_delete_roster_entries" ON roster_portal_entries FOR DELETE TO anon, authenticated USING (true);

COMMENT ON TABLE roster_portal_tokens IS 'Customer roster onboarding seats issued via welcome@fleetvu.org — commercial only.';
COMMENT ON TABLE roster_portal_entries IS 'Driver/employee rows uploaded by customer admin; keycodes issued after FleetVu approve.';
