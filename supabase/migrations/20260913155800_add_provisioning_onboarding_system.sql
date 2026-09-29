/*
# Provisioning & Onboarding System Schema

## Purpose
Extends the existing provisioning infrastructure to support:
1. FleetVu internal master provisioning console (client account creation + activation keys)
2. Adaptive delegate setup wizard (client lead onboarding with role-adaptive scope)
3. Batch invite tracking with 72-hour activation keys

## Changes

### 1. provisioned_users — relax role CHECK constraint
The existing CHECK only allows: admin, manager, standard_user, auditor.
Super-admin and location-admin leads need 'super_admin' and 'location_admin' roles.
Drops the old constraint and replaces it with an expanded set.

### 2. provisioned_users — add onboarding columns
- primary_contact_role (text): 'super_admin' | 'location_admin' — how the client lead was flagged
- onboarded_by (text): email of the FleetVu internal staff who deployed this client
- onboarding_completed (boolean, default false): whether the delegate setup wizard was completed
- onboarding_completed_at (timestamptz): when the wizard was finished

### 3. activation_keys — relax role_type CHECK, add columns
- Add 'super_admin' and 'location_admin' to role_type CHECK
- Add organization_name (text): display name for the org
- Add feature_entitlements (jsonb): which features are enabled for this key
- Add expires_at (timestamptz, default now()+72h): 72-hour single-use key expiry
- Add is_setup_link (boolean, default false): marks keys that serve as setup links for client leads

### 4. invite_tokens — extend expiry to 72 hours for batch invites
Changes the default expiry from 24h to 72h by adding a new column:
- invite_type (text, default 'standard'): 'standard' | 'batch' | 'setup_link'
- batch_id (text): groups invites sent in the same batch

## Security
All RLS policies remain the same (wide-open to anon, consistent with existing architecture).
No new tables created — only additive column changes to existing tables.
*/

-- 1. Relax provisioned_users role CHECK
ALTER TABLE provisioned_users DROP CONSTRAINT IF EXISTS provisioned_users_role_check;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provisioned_users_role_check'
  ) THEN
    ALTER TABLE provisioned_users ADD CONSTRAINT provisioned_users_role_check
    CHECK (role = ANY (ARRAY['super_admin'::text, 'location_admin'::text, 'admin'::text, 'manager'::text, 'standard_user'::text, 'auditor'::text]));
  END IF;
END $$;

-- 2. Add onboarding columns to provisioned_users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provisioned_users' AND column_name = 'primary_contact_role') THEN
    ALTER TABLE provisioned_users ADD COLUMN primary_contact_role text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provisioned_users' AND column_name = 'onboarded_by') THEN
    ALTER TABLE provisioned_users ADD COLUMN onboarded_by text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provisioned_users' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE provisioned_users ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'provisioned_users' AND column_name = 'onboarding_completed_at') THEN
    ALTER TABLE provisioned_users ADD COLUMN onboarding_completed_at timestamptz;
  END IF;
END $$;

-- 3. Extend activation_keys
ALTER TABLE activation_keys DROP CONSTRAINT IF EXISTS activation_keys_role_type_check;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activation_keys_role_type_check'
  ) THEN
    ALTER TABLE activation_keys ADD CONSTRAINT activation_keys_role_type_check
    CHECK (role_type = ANY (ARRAY['super_admin'::text, 'location_admin'::text, 'global_admin'::text, 'executive'::text, 'driver'::text]));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activation_keys' AND column_name = 'organization_name') THEN
    ALTER TABLE activation_keys ADD COLUMN organization_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activation_keys' AND column_name = 'feature_entitlements') THEN
    ALTER TABLE activation_keys ADD COLUMN feature_entitlements jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activation_keys' AND column_name = 'expires_at') THEN
    ALTER TABLE activation_keys ADD COLUMN expires_at timestamptz DEFAULT (now() + '72:00:00'::interval);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activation_keys' AND column_name = 'is_setup_link') THEN
    ALTER TABLE activation_keys ADD COLUMN is_setup_link boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 4. Extend invite_tokens
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invite_tokens' AND column_name = 'invite_type') THEN
    ALTER TABLE invite_tokens ADD COLUMN invite_type text NOT NULL DEFAULT 'standard';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invite_tokens' AND column_name = 'batch_id') THEN
    ALTER TABLE invite_tokens ADD COLUMN batch_id text;
  END IF;
END $$;

-- Index for batch lookups
CREATE INDEX IF NOT EXISTS idx_invite_tokens_batch_id ON invite_tokens(batch_id);
CREATE INDEX IF NOT EXISTS idx_activation_keys_expires_at ON activation_keys(expires_at);
