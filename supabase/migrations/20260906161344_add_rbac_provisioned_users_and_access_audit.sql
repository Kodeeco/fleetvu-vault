/*
# RBAC: Provisioned Users & Access Audit Log Tables

## Summary
Adds two tables to support role-based access control (RBAC), user provisioning,
and a tamper-evident audit trail for all permission and login events.

## New Tables

### `provisioned_users`
Stores every user account created through the "Provision New User" workflow
by a Super-Admin or Global Admin. Each row represents a provisioned identity
with their assigned role, location scopes, hardware, plan, and delegated
feature permissions.

Columns:
- `id` — UUID primary key
- `full_name` — User's full legal name
- `email` — Unique corporate email address
- `phone` — Phone number (optional)
- `corporate_title` — Job title (e.g. "Fleet Safety Manager")
- `company_id` — FK to companies table (which tenant they belong to)
- `company_name` — Denormalized for display without a join
- `role` — RBAC role: 'admin' | 'manager' | 'standard_user'
- `assigned_locations` — JSON array of assigned city/terminal strings
- `assigned_vehicle_count` — Number of vehicles capacity at their locations
- `deployment_hardware` — Hardware kit assigned: 'c55_pro' | 'c93_dual'
- `plan_tier` — FleetVu plan: 'basic' | 'pro' | 'proplus'
- `feature_permissions` — JSON object of delegated feature flags
  (historical_reports, accident_reconstruction, live_gps, risk_modeling)
- `temp_password` — Temporary password shown once at provisioning (hashed indicator)
- `status` — 'active' | 'suspended' | 'revoked'
- `provisioned_by` — Email of the Super-Admin or Global Admin who created this user
- `provisioned_by_role` — Role of the provisioner at time of creation
- `last_login_at` — ISO timestamp of most recent login
- `created_at` — ISO timestamp of provisioning

### `access_audit_log`
Tamper-evident, append-only log of every security event: logins, permission
changes, role promotions/demotions, account suspensions, and deletions.
Each row carries a SHA-256 chain hash linking it to the previous record,
enabling cryptographic integrity verification.

Columns:
- `id` — UUID primary key
- `seq` — Auto-incrementing sequence number for ordering without trusting timestamps
- `actor_email` — Email of the user who performed the action
- `actor_role` — Role of the actor at time of action
- `action_type` — Event category (LOGIN, PROVISION_USER, ROLE_CHANGE, PERMISSION_UPDATE,
  ACCOUNT_SUSPEND, ACCOUNT_REVOKE, ACCOUNT_DELETE, LOGOUT, ACCESS_DENIED)
- `target_user_email` — Email of the user the action was performed on (if applicable)
- `target_user_role` — Role of the target user (if applicable)
- `previous_state` — JSONB snapshot of state before the change
- `new_state` — JSONB snapshot of state after the change
- `ip_address` — Client IP address (simulated for demo)
- `user_agent` — Client user agent string
- `record_hash` — SHA-256 of this row's data (256-bit cryptographic indicator)
- `prev_hash` — SHA-256 of the previous row (chain link for tamper detection)
- `metadata` — Additional JSONB context
- `utc_timestamp` — Exact ISO timestamp of the event
- `created_at` — Database insert timestamp

## Security
- RLS enabled on both tables
- Both tables use `TO anon, authenticated` policies since the app uses
  sessionStorage auth (no Supabase Auth session), so the anon key must
  be able to read/write
- Audit log is append-only by policy: no UPDATE or DELETE permitted
- Index on `access_audit_log.utc_timestamp` and `actor_email` for fast search
- Index on `provisioned_users.email` for uniqueness lookups

## Notes
1. The `record_hash` is computed client-side as a SHA-256 digest of the
   serialized row contents — this is a cryptographic indicator, not enforced
   by the DB trigger (trigger can be added in a future migration).
2. The `access_audit_log` has no UPDATE or DELETE policies intentionally:
   the audit trail must be append-only.
3. `provisioned_users.role` uses a text CHECK constraint limited to the
   three non-super roles that can be provisioned ('admin', 'manager', 'standard_user').
   Super-Admins and Global Admins are provisioned through a separate system
   flow (not the self-service form).
*/

-- ============================================================
-- TABLE: provisioned_users
-- ============================================================
CREATE TABLE IF NOT EXISTS provisioned_users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             text NOT NULL,
  email                 text NOT NULL,
  phone                 text,
  corporate_title       text,
  company_id            uuid REFERENCES companies(id) ON DELETE SET NULL,
  company_name          text,
  role                  text NOT NULL DEFAULT 'standard_user'
                        CHECK (role IN ('admin', 'manager', 'standard_user')),
  assigned_locations    jsonb NOT NULL DEFAULT '[]',
  assigned_vehicle_count integer NOT NULL DEFAULT 0,
  deployment_hardware   text NOT NULL DEFAULT 'c55_pro'
                        CHECK (deployment_hardware IN ('c55_pro', 'c93_dual')),
  plan_tier             text NOT NULL DEFAULT 'basic'
                        CHECK (plan_tier IN ('basic', 'pro', 'proplus')),
  feature_permissions   jsonb NOT NULL DEFAULT '{
    "historical_reports": false,
    "accident_reconstruction": false,
    "live_gps": true,
    "risk_modeling": false
  }',
  temp_password         text,
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'revoked')),
  provisioned_by        text,
  provisioned_by_role   text,
  last_login_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provisioned_users_email_idx ON provisioned_users (email);
CREATE INDEX IF NOT EXISTS provisioned_users_company_idx ON provisioned_users (company_id);
CREATE INDEX IF NOT EXISTS provisioned_users_role_idx ON provisioned_users (role);
CREATE INDEX IF NOT EXISTS provisioned_users_status_idx ON provisioned_users (status);

ALTER TABLE provisioned_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_provisioned_users" ON provisioned_users;
CREATE POLICY "anon_select_provisioned_users" ON provisioned_users
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_provisioned_users" ON provisioned_users;
CREATE POLICY "anon_insert_provisioned_users" ON provisioned_users
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_provisioned_users" ON provisioned_users;
CREATE POLICY "anon_update_provisioned_users" ON provisioned_users
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_provisioned_users" ON provisioned_users;
CREATE POLICY "anon_delete_provisioned_users" ON provisioned_users
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- TABLE: access_audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS access_audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq               bigserial,
  actor_email       text,
  actor_role        text,
  action_type       text NOT NULL,
  target_user_email text,
  target_user_role  text,
  previous_state    jsonb,
  new_state         jsonb,
  ip_address        text,
  user_agent        text,
  record_hash       text,
  prev_hash         text,
  metadata          jsonb,
  utc_timestamp     timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_audit_log_timestamp_idx ON access_audit_log (utc_timestamp DESC);
CREATE INDEX IF NOT EXISTS access_audit_log_actor_idx     ON access_audit_log (actor_email);
CREATE INDEX IF NOT EXISTS access_audit_log_action_idx    ON access_audit_log (action_type);
CREATE INDEX IF NOT EXISTS access_audit_log_target_idx    ON access_audit_log (target_user_email);

ALTER TABLE access_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: open (audit logs are readable by all authenticated sessions)
DROP POLICY IF EXISTS "anon_select_access_audit_log" ON access_audit_log;
CREATE POLICY "anon_select_access_audit_log" ON access_audit_log
  FOR SELECT TO anon, authenticated USING (true);

-- INSERT only — no UPDATE or DELETE: append-only by design
DROP POLICY IF EXISTS "anon_insert_access_audit_log" ON access_audit_log;
CREATE POLICY "anon_insert_access_audit_log" ON access_audit_log
  FOR INSERT TO anon, authenticated WITH CHECK (true);
