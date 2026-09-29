/*
# Add invite tokens table and extend provisioned users for self-serve access management

## Summary
1. Extends `provisioned_users` to support 'pending_invitation' status and 'auditor' role
2. Adds new feature permission keys to the default JSONB
3. Creates `invite_tokens` table for single-use onboarding tokens (24-hour validity)

## Changes to provisioned_users
- Status CHECK extended: 'active' | 'suspended' | 'revoked' | 'pending_invitation'
- Role CHECK extended: 'admin' | 'manager' | 'standard_user' | 'auditor'
- feature_permissions default now includes: driver_management, incident_playback, edvir_approvals, pdf_downloads

## New Table: invite_tokens
- Stores single-use onboarding tokens for newly invited team members
- Each token is valid for 24 hours from creation
- Tracks whether the token has been used, expired, or is still active
Columns:
- id (uuid PK)
- token (text, unique) — the invite token string
- user_email (text) — email of the invited user
- user_id (uuid, FK to provisioned_users)
- company_id (uuid) — optional company scope
- created_by (text) — email of admin who created the invite
- created_at (timestamptz)
- expires_at (timestamptz) — 24 hours after creation
- used_at (timestamptz, nullable)
- status (text) — 'active' | 'used' | 'expired'

## Security
- RLS enabled on invite_tokens
- Same anon, authenticated pattern as other tables (app uses sessionStorage auth)
*/

-- Extend provisioned_users status CHECK
ALTER TABLE provisioned_users DROP CONSTRAINT IF EXISTS provisioned_users_status_check;
ALTER TABLE provisioned_users ADD CONSTRAINT provisioned_users_status_check
  CHECK (status IN ('active', 'suspended', 'revoked', 'pending_invitation'));

-- Extend provisioned_users role CHECK
ALTER TABLE provisioned_users DROP CONSTRAINT IF EXISTS provisioned_users_role_check;
ALTER TABLE provisioned_users ADD CONSTRAINT provisioned_users_role_check
  CHECK (role IN ('admin', 'manager', 'standard_user', 'auditor'));

-- Update feature_permissions default to include new permission keys
ALTER TABLE provisioned_users ALTER COLUMN feature_permissions SET DEFAULT '{
  "historical_reports": false,
  "accident_reconstruction": false,
  "live_gps": true,
  "risk_modeling": false,
  "driver_management": false,
  "incident_playback": false,
  "edvir_approvals": false,
  "pdf_downloads": false
}'::jsonb;

-- ============================================================
-- TABLE: invite_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE,
  user_email  text NOT NULL,
  user_id     uuid REFERENCES provisioned_users(id) ON DELETE CASCADE,
  company_id  uuid,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at     timestamptz,
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'used', 'expired'))
);

CREATE INDEX IF NOT EXISTS invite_tokens_token_idx ON invite_tokens (token);
CREATE INDEX IF NOT EXISTS invite_tokens_email_idx ON invite_tokens (user_email);
CREATE INDEX IF NOT EXISTS invite_tokens_status_idx ON invite_tokens (status);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_invite_tokens" ON invite_tokens;
CREATE POLICY "anon_select_invite_tokens" ON invite_tokens
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_invite_tokens" ON invite_tokens;
CREATE POLICY "anon_insert_invite_tokens" ON invite_tokens
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_invite_tokens" ON invite_tokens;
CREATE POLICY "anon_update_invite_tokens" ON invite_tokens
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_invite_tokens" ON invite_tokens;
CREATE POLICY "anon_delete_invite_tokens" ON invite_tokens
  FOR DELETE TO anon, authenticated USING (true);