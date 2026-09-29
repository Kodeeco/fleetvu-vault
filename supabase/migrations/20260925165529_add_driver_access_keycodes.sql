/*
# Add driver disposable keycodes table

## Purpose
Creates a dedicated table for driver disposable one-time-use access keycodes
in the FV-XXXX-XXXX format. These are separate from activation_keys (which are
org-level permanent keys) — driver keycodes are burned on use and have full
lifecycle tracking: generated -> dispatched -> burned.

## New Table: `driver_access_keycodes`
- `id` (uuid, PK)
- `keycode` (text, unique) — the FV-XXXX-XXXX format code
- `driver_id` (uuid, FK to drivers) — which driver this keycode is for
- `driver_name` (text) — denormalized for audit
- `driver_number` (text) — denormalized for audit
- `company_id` (uuid, FK to companies) — which company issued it
- `company_name` (text) — denormalized
- `issued_by` (text) — email of the admin who generated it
- `issued_by_name` (text) — display name of issuer
- `lifecycle_status` (text) — 'generated', 'dispatched', 'burned', 'revoked'
- `dispatch_method` (text) — 'sms', 'email', 'manual', 'print'
- `dispatch_destination` (text) — phone number or email it was sent to
- `dispatched_at` (timestamptz)
- `burned_at` (timestamptz) — when the driver consumed it
- `burned_by_device` (text) — device fingerprint that consumed it
- `biometric_bound` (boolean) — whether biometric binding completed
- `expires_at` (timestamptz) — keycode expiry
- `created_at` (timestamptz)

## Security
- RLS enabled with anon+authenticated CRUD (shared FleetVu operational data).
*/

CREATE TABLE IF NOT EXISTS driver_access_keycodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keycode text UNIQUE NOT NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  driver_name text,
  driver_number text,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  company_name text,
  issued_by text,
  issued_by_name text,
  lifecycle_status text NOT NULL DEFAULT 'generated' CHECK (lifecycle_status IN ('generated', 'dispatched', 'burned', 'revoked')),
  dispatch_method text,
  dispatch_destination text,
  dispatched_at timestamptz,
  burned_at timestamptz,
  burned_by_device text,
  biometric_bound boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE driver_access_keycodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_keycodes" ON driver_access_keycodes;
CREATE POLICY "anon_select_keycodes" ON driver_access_keycodes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_keycodes" ON driver_access_keycodes;
CREATE POLICY "anon_insert_keycodes" ON driver_access_keycodes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_keycodes" ON driver_access_keycodes;
CREATE POLICY "anon_update_keycodes" ON driver_access_keycodes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_keycodes" ON driver_access_keycodes;
CREATE POLICY "anon_delete_keycodes" ON driver_access_keycodes FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_driver_keycodes_driver_id ON driver_access_keycodes(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_keycodes_company_id ON driver_access_keycodes(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_keycodes_lifecycle ON driver_access_keycodes(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_driver_keycodes_keycode ON driver_access_keycodes(keycode);