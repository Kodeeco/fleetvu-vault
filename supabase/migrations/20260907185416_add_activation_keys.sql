/*
# Add activation_keys table for key-based role provisioning

1. New Tables
- `activation_keys`
  - `id` (uuid, primary key)
  - `key_code` (text, unique, not null) — the activation key string, e.g. "FV-8849-SA"
  - `role_type` (text, not null) — what role this key grants: 'super_admin', 'global_admin', 'executive', 'driver'
  - `company_name` (text, nullable) — associated company for fleet keys
  - `company_id` (uuid, nullable, FK to companies)
  - `recipient_email` (text, nullable) — email the key was sent to
  - `status` (text, not null default 'active') — 'active', 'used', 'revoked'
  - `created_by_email` (text, nullable) — super-admin who generated the key
  - `used_by_email` (text, nullable) — email of the user who activated with this key
  - `created_at` (timestamptz, default now())
  - `used_at` (timestamptz, nullable)

2. Security
- RLS enabled on `activation_keys`.
- The app uses the anon key (no Supabase Auth session), so policies allow anon+authenticated to read active keys (needed for login lookup) and insert new keys (super-admin generates keys from the client).
- Update allowed for marking keys as used.
- Delete not needed.

3. Notes
- Keys are looked up by exact `key_code` match during login.
- Super-admin keys like "FV-8849-SA" grant super_admin role.
- Fleet/driver keys grant driver role and route to mobile HUD.
- A key is single-use: once `status = 'used'`, it can no longer authenticate.
*/

CREATE TABLE IF NOT EXISTS activation_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_code        text UNIQUE NOT NULL,
  role_type       text NOT NULL CHECK (role_type IN ('super_admin', 'global_admin', 'executive', 'driver')),
  company_name    text,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  recipient_email text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked')),
  created_by_email text,
  used_by_email   text,
  created_at      timestamptz DEFAULT now(),
  used_at         timestamptz
);

ALTER TABLE activation_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_activation_keys" ON activation_keys;
CREATE POLICY "anon_select_activation_keys"
ON activation_keys FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_activation_keys" ON activation_keys;
CREATE POLICY "anon_insert_activation_keys"
ON activation_keys FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_activation_keys" ON activation_keys;
CREATE POLICY "anon_update_activation_keys"
ON activation_keys FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS activation_keys_key_code_idx ON activation_keys (key_code);
CREATE INDEX IF NOT EXISTS activation_keys_status_idx ON activation_keys (status);
