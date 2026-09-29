/*
# FleetVu Forensic Vault — Phase 1 Core Tables

## Purpose
Creates the database foundation for the isolated /src/vault module tree:
  1. SHA-256 Merkle-chain event blocks for tamper-proof telemetry custody
  2. Hardware serial-number licensing with 12-month complimentary timer
  3. Feature-tiering state for subscription enforcement guards

## New Tables

### vault_event_blocks
- Stores sealed telemetry event blocks linked into an unbroken SHA-256 Merkle chain.
- `id` (uuid PK)
- `block_seq` (integer, unique) — monotonically increasing block number
- `company_id` (uuid, FK companies) — owning fleet
- `vehicle_id` (uuid, FK vehicles, nullable) — source vehicle
- `event_count` (integer) — number of raw events sealed in this block
- `payload_hash` (text) — SHA-256 of the block's event payload JSON
- `prev_hash` (text) — SHA-256 of the previous block's record_hash (chain link)
- `record_hash` (text) — SHA-256(prev_hash + payload_hash + block_seq) — this block's chain fingerprint
- `merkle_root` (text) — root hash of the Merkle tree over all event hashes in this block
- `sealed_at` (timestamptz) — when the block was cryptographically sealed
- `created_at` (timestamptz)

### vault_licenses
- Hardware serial-number bound licenses with 12-month complimentary timer.
- `id` (uuid PK)
- `company_id` (uuid, FK companies) — owning fleet
- `hardware_serial` (text, unique) — pre-loaded device serial number the vault is bound to
- `license_key` (text, unique) — activation key issued to the hardware unit
- `tier` (text) — subscription tier: 'basic' | 'pro' | 'proplus'
- `status` (text) — 'pending_activation' | 'active' | 'expired' | 'suspended' | 'revoked'
- `activated_at` (timestamptz, nullable) — when the hardware was first activated
- `complimentary_until` (timestamptz, nullable) — 12-month complimentary end date from activation
- `subscription_until` (timestamptz, nullable) — paid subscription end date (null = complimentary period)
- `last_verification_at` (timestamptz, nullable) — last license check timestamp
- `metadata` (jsonb) — extensible license metadata
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### vault_feature_gates
- Per-company feature gate state snapshot used by the tiering middleware.
- `id` (uuid PK)
- `company_id` (uuid, FK companies, unique) — one gate record per fleet
- `tier` (text) — current effective tier
- `forensic_vault_enabled` (boolean) — enterprise forensic features unlocked
- `collision_reconstruction_enabled` (boolean)
- `insurance_modeling_enabled` (boolean)
- `pdf_export_enabled` (boolean)
- `live_gps_enabled` (boolean)
- `historical_reports_enabled` (boolean)
- `grace_period_until` (timestamptz, nullable) — soft-lock grace window after expiry
- `locked_down` (boolean) — true when enterprise features are hard-locked
- `last_evaluated_at` (timestamptz)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## Security
- RLS enabled on all three tables.
- Policies use `TO anon, authenticated` (single-tenant, no auth screen — consistent with existing tables).
- vault_event_blocks: SELECT only (append-only, no UPDATE/DELETE from client).
- vault_licenses: SELECT + INSERT + UPDATE (activation/verification updates).
- vault_feature_gates: SELECT + INSERT + UPDATE (gate state evaluation).

## Important Notes
1. vault_event_blocks is append-only — INSERT and SELECT only, no UPDATE or DELETE, to preserve chain integrity.
2. The 12-month complimentary timer is set by the licensing middleware upon activation (complimentary_until = activated_at + 12 months).
3. vault_feature_gates is evaluated by the feature-tiering middleware, not directly by client code.
4. All tables use the same anon/authenticated policy pattern as existing FleetVu tables for consistency.
*/

-- ============================================================
-- vault_event_blocks: SHA-256 Merkle-chain telemetry custody
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_event_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_seq integer NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  event_count integer NOT NULL DEFAULT 0,
  payload_hash text NOT NULL,
  prev_hash text,
  record_hash text NOT NULL,
  merkle_root text NOT NULL,
  sealed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Unique sequence so chain links are deterministic
CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_blocks_seq ON vault_event_blocks(block_seq);

-- Fast lookup by company for chain verification
CREATE INDEX IF NOT EXISTS idx_vault_blocks_company ON vault_event_blocks(company_id);

ALTER TABLE vault_event_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_vault_blocks" ON vault_event_blocks;
CREATE POLICY "anon_select_vault_blocks" ON vault_event_blocks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_vault_blocks" ON vault_event_blocks;
CREATE POLICY "anon_insert_vault_blocks" ON vault_event_blocks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- No UPDATE or DELETE — append-only for chain integrity

-- ============================================================
-- vault_licenses: Hardware serial-number binding + 12-month timer
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  hardware_serial text NOT NULL UNIQUE,
  license_key text NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'basic',
  status text NOT NULL DEFAULT 'pending_activation',
  activated_at timestamptz,
  complimentary_until timestamptz,
  subscription_until timestamptz,
  last_verification_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_licenses_company ON vault_licenses(company_id);
CREATE INDEX IF NOT EXISTS idx_vault_licenses_hardware ON vault_licenses(hardware_serial);
CREATE INDEX IF NOT EXISTS idx_vault_licenses_status ON vault_licenses(status);

ALTER TABLE vault_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_vault_licenses" ON vault_licenses;
CREATE POLICY "anon_select_vault_licenses" ON vault_licenses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_vault_licenses" ON vault_licenses;
CREATE POLICY "anon_insert_vault_licenses" ON vault_licenses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_vault_licenses" ON vault_licenses;
CREATE POLICY "anon_update_vault_licenses" ON vault_licenses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_vault_licenses" ON vault_licenses;
CREATE POLICY "anon_delete_vault_licenses" ON vault_licenses FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- vault_feature_gates: Feature-tiering authorization state
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_feature_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'basic',
  forensic_vault_enabled boolean NOT NULL DEFAULT false,
  collision_reconstruction_enabled boolean NOT NULL DEFAULT false,
  insurance_modeling_enabled boolean NOT NULL DEFAULT false,
  pdf_export_enabled boolean NOT NULL DEFAULT false,
  live_gps_enabled boolean NOT NULL DEFAULT true,
  historical_reports_enabled boolean NOT NULL DEFAULT false,
  grace_period_until timestamptz,
  locked_down boolean NOT NULL DEFAULT false,
  last_evaluated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_gates_company ON vault_feature_gates(company_id);

ALTER TABLE vault_feature_gates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_vault_gates" ON vault_feature_gates;
CREATE POLICY "anon_select_vault_gates" ON vault_feature_gates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_vault_gates" ON vault_feature_gates;
CREATE POLICY "anon_insert_vault_gates" ON vault_feature_gates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_vault_gates" ON vault_feature_gates;
CREATE POLICY "anon_update_vault_gates" ON vault_feature_gates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_vault_gates" ON vault_feature_gates;
CREATE POLICY "anon_delete_vault_gates" ON vault_feature_gates FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Seed default feature gates for existing companies
-- ============================================================
INSERT INTO vault_feature_gates (company_id, tier, forensic_vault_enabled, collision_reconstruction_enabled, insurance_modeling_enabled, pdf_export_enabled, live_gps_enabled, historical_reports_enabled)
SELECT c.id, COALESCE(c.plan_tier, 'basic'), 
  (COALESCE(c.plan_tier, 'basic') = 'proplus'),
  (COALESCE(c.plan_tier, 'basic') = 'proplus'),
  (COALESCE(c.plan_tier, 'basic') = 'proplus'),
  (COALESCE(c.plan_tier, 'basic') IN ('pro', 'proplus')),
  true,
  (COALESCE(c.plan_tier, 'basic') IN ('pro', 'proplus'))
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM vault_feature_gates g WHERE g.company_id = c.id);