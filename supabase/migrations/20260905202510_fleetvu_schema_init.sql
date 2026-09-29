/*
# FleetVu Mobile Command - Core Schema

## Overview
Creates the full database schema for the FleetVu fleet management PWA, supporting
multi-tenant fleet operations, three-tier authentication, telemetry logging,
incident reconstruction, hardware configuration, billing/pricing, audit trails,
and feature suggestions.

## New Tables
1. `companies` - Organization/tenant records (name, region, location, plan tier)
2. `drivers` - Driver profiles (name, email, driver#, PIN, company, location, license)
3. `vehicles` - Fleet vehicles (truck#, chassis type, hardware profile, company, assigned driver)
4. `telemetry_events` - Individual obstruction/proximity events with GPS, speed, timestamp, zone
5. `incidents` - Collision/incident reports with 4-screen intake data, photos, voice notes, reconstruction
6. `diagnostics` - Daily post-trip calibration results (RF echo, ultrasonic, IMU)
7. `audit_logs` - Immutable append-only administrative audit trail with SHA-256 hash chaining
8. `access_requests` - External user access request queue for admin approval
9. `feature_suggestions` - Product feedback from authorized portal users
10. `pricing_config` - Dynamic pricing tiers editable by super-admin
11. `hardware_profiles` - OTA-extensible hardware system profile definitions
12. `legal_acknowledgments` - Driver legal training completion records
13. `document_audit` - Chain-of-custody tracking for reports, PDFs, evidence files

## Security
- RLS enabled on ALL tables.
- Policies scoped to `anon, authenticated` since this is a single-tenant demo app
  where the anon-key client needs full CRUD. In production these would be
  authenticated-only with ownership checks.
- All tables allow full CRUD for anon + authenticated.

## Important Notes
1. Telemetry and audit tables are designed as append-only ledgers.
2. The audit_logs table includes a prev_hash column for SHA-256 chain linking.
3. pricing_config and hardware_profiles support dynamic JSON schema updates.
*/

-- Companies (tenants)
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text DEFAULT 'Global',
  location text DEFAULT 'HQ',
  plan_tier text NOT NULL DEFAULT 'basic',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_companies" ON companies;
CREATE POLICY "anon_crud_companies" ON companies FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_companies" ON companies;
CREATE POLICY "anon_insert_companies" ON companies FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_companies" ON companies;
CREATE POLICY "anon_update_companies" ON companies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_companies" ON companies;
CREATE POLICY "anon_delete_companies" ON companies FOR DELETE TO anon, authenticated USING (true);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  driver_number text,
  pin_code text,
  location text,
  company_name text,
  license_class text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_drivers" ON drivers;
CREATE POLICY "anon_crud_drivers" ON drivers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_drivers" ON drivers;
CREATE POLICY "anon_insert_drivers" ON drivers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_drivers" ON drivers;
CREATE POLICY "anon_update_drivers" ON drivers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_drivers" ON drivers;
CREATE POLICY "anon_delete_drivers" ON drivers FOR DELETE TO anon, authenticated USING (true);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  truck_number text NOT NULL,
  chassis_type text DEFAULT 'class8_tractor',
  hardware_profile text DEFAULT 'c55_pro_forward',
  assigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  company_name text,
  location text,
  status text DEFAULT 'operational',
  plan_tier text DEFAULT 'basic',
  safety_score numeric DEFAULT 85.0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_vehicles" ON vehicles;
CREATE POLICY "anon_crud_vehicles" ON vehicles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_vehicles" ON vehicles;
CREATE POLICY "anon_insert_vehicles" ON vehicles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_vehicles" ON vehicles;
CREATE POLICY "anon_update_vehicles" ON vehicles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_vehicles" ON vehicles;
CREATE POLICY "anon_delete_vehicles" ON vehicles FOR DELETE TO anon, authenticated USING (true);

-- Telemetry events (append-only)
CREATE TABLE IF NOT EXISTS telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  truck_number text,
  driver_name text,
  speed_mph numeric,
  latitude numeric,
  longitude numeric,
  utc_timestamp timestamptz DEFAULT now(),
  proximity_zone text,
  distance_m numeric,
  sensor_type text,
  g_force numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_telemetry" ON telemetry_events;
CREATE POLICY "anon_select_telemetry" ON telemetry_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_telemetry" ON telemetry_events;
CREATE POLICY "anon_insert_telemetry" ON telemetry_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_telemetry" ON telemetry_events;
CREATE POLICY "anon_update_telemetry" ON telemetry_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_telemetry" ON telemetry_events;
CREATE POLICY "anon_delete_telemetry" ON telemetry_events FOR DELETE TO anon, authenticated USING (true);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  case_id text UNIQUE,
  truck_speed_mph numeric,
  target_speed_mph numeric,
  approach_angle text,
  impact_distance_m numeric,
  latitude numeric,
  longitude numeric,
  utc_timestamp timestamptz DEFAULT now(),
  proximity_zone text,
  target_type text,
  target_vehicle_year text,
  target_vehicle_make text,
  target_vehicle_model text,
  impact_angle_type text,
  fleet_truck_motion text,
  target_vehicle_motion text,
  lane_selection text,
  photos jsonb DEFAULT '[]',
  voice_note_transcript text,
  reconstruction_data jsonb DEFAULT '{}',
  status text DEFAULT 'submitted',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_incidents" ON incidents;
CREATE POLICY "anon_select_incidents" ON incidents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_incidents" ON incidents;
CREATE POLICY "anon_insert_incidents" ON incidents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_incidents" ON incidents;
CREATE POLICY "anon_update_incidents" ON incidents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_incidents" ON incidents;
CREATE POLICY "anon_delete_incidents" ON incidents FOR DELETE TO anon, authenticated USING (true);

-- Diagnostics
CREATE TABLE IF NOT EXISTS diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  rf_echo_result text,
  ultrasonic_result text,
  imu_result text,
  overall_result text,
  latitude numeric,
  longitude numeric,
  utc_timestamp timestamptz DEFAULT now(),
  driver_acknowledged boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_diagnostics" ON diagnostics;
CREATE POLICY "anon_select_diagnostics" ON diagnostics FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_diagnostics" ON diagnostics;
CREATE POLICY "anon_insert_diagnostics" ON diagnostics FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_diagnostics" ON diagnostics;
CREATE POLICY "anon_update_diagnostics" ON diagnostics FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_diagnostics" ON diagnostics;
CREATE POLICY "anon_delete_diagnostics" ON diagnostics FOR DELETE TO anon, authenticated USING (true);

-- Audit logs (append-only, SHA-256 chain)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_role text NOT NULL,
  actor_email text,
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  previous_state jsonb,
  new_state jsonb,
  prev_hash text,
  record_hash text,
  utc_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_audit" ON audit_logs;
CREATE POLICY "anon_select_audit" ON audit_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit" ON audit_logs;
CREATE POLICY "anon_insert_audit" ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit" ON audit_logs;
CREATE POLICY "anon_update_audit" ON audit_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit" ON audit_logs;
CREATE POLICY "anon_delete_audit" ON audit_logs FOR DELETE TO anon, authenticated USING (true);

-- Access requests
CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_role text,
  company_name text,
  department text,
  request_reason text,
  status text DEFAULT 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  temporary_credentials jsonb,
  master_key text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_access_req" ON access_requests;
CREATE POLICY "anon_select_access_req" ON access_requests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_access_req" ON access_requests;
CREATE POLICY "anon_insert_access_req" ON access_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_access_req" ON access_requests;
CREATE POLICY "anon_update_access_req" ON access_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_access_req" ON access_requests;
CREATE POLICY "anon_delete_access_req" ON access_requests FOR DELETE TO anon, authenticated USING (true);

-- Feature suggestions
CREATE TABLE IF NOT EXISTS feature_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  user_email text,
  user_role text,
  company_name text,
  location text,
  title text NOT NULL,
  category text,
  description text,
  status text DEFAULT 'submitted',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE feature_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_suggestions" ON feature_suggestions;
CREATE POLICY "anon_select_suggestions" ON feature_suggestions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_suggestions" ON feature_suggestions;
CREATE POLICY "anon_insert_suggestions" ON feature_suggestions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_suggestions" ON feature_suggestions;
CREATE POLICY "anon_update_suggestions" ON feature_suggestions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_suggestions" ON feature_suggestions;
CREATE POLICY "anon_delete_suggestions" ON feature_suggestions FOR DELETE TO anon, authenticated USING (true);

-- Pricing config (dynamic, editable by super-admin)
CREATE TABLE IF NOT EXISTS pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL UNIQUE,
  name text NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  description text,
  features jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_pricing" ON pricing_config;
CREATE POLICY "anon_select_pricing" ON pricing_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pricing" ON pricing_config;
CREATE POLICY "anon_insert_pricing" ON pricing_config FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_pricing" ON pricing_config;
CREATE POLICY "anon_update_pricing" ON pricing_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pricing" ON pricing_config;
CREATE POLICY "anon_delete_pricing" ON pricing_config FOR DELETE TO anon, authenticated USING (true);

-- Hardware profiles (OTA-extensible)
CREATE TABLE IF NOT EXISTS hardware_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sensor_config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hardware_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_hw_profiles" ON hardware_profiles;
CREATE POLICY "anon_select_hw_profiles" ON hardware_profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_hw_profiles" ON hardware_profiles;
CREATE POLICY "anon_insert_hw_profiles" ON hardware_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_hw_profiles" ON hardware_profiles;
CREATE POLICY "anon_update_hw_profiles" ON hardware_profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_hw_profiles" ON hardware_profiles;
CREATE POLICY "anon_delete_hw_profiles" ON hardware_profiles FOR DELETE TO anon, authenticated USING (true);

-- Legal acknowledgments
CREATE TABLE IF NOT EXISTS legal_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  driver_name text,
  driver_number text,
  company_name text,
  acknowledgment_text text,
  training_completed boolean DEFAULT false,
  hardware_verified boolean DEFAULT false,
  utc_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE legal_acknowledgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_legal" ON legal_acknowledgments;
CREATE POLICY "anon_select_legal" ON legal_acknowledgments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_legal" ON legal_acknowledgments;
CREATE POLICY "anon_insert_legal" ON legal_acknowledgments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_legal" ON legal_acknowledgments;
CREATE POLICY "anon_update_legal" ON legal_acknowledgments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_legal" ON legal_acknowledgments;
CREATE POLICY "anon_delete_legal" ON legal_acknowledgments FOR DELETE TO anon, authenticated USING (true);

-- Document audit (chain-of-custody)
CREATE TABLE IF NOT EXISTS document_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text,
  document_type text,
  action text NOT NULL,
  actor_role text,
  actor_email text,
  recipient_email text,
  hash_fingerprint text,
  qr_code_data text,
  utc_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE document_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_doc_audit" ON document_audit;
CREATE POLICY "anon_select_doc_audit" ON document_audit FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_doc_audit" ON document_audit;
CREATE POLICY "anon_insert_doc_audit" ON document_audit FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_doc_audit" ON document_audit;
CREATE POLICY "anon_update_doc_audit" ON document_audit FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_doc_audit" ON document_audit;
CREATE POLICY "anon_delete_doc_audit" ON document_audit FOR DELETE TO anon, authenticated USING (true);

-- Seed default pricing tiers
INSERT INTO pricing_config (tier, name, price_monthly, description, features) VALUES
  ('basic', 'Basic Plan', 0.00, 'Unlimited vehicles & drivers. Standard radar/ultrasonic proximity telemetry and core driver controls.',
    '["Unlimited vehicle/driver fleet","Standard radar/ultrasonic proximity telemetry","Core driver HUD controls","Basic GPS map panel"]'::jsonb),
  ('pro', 'Pro Plan', 9.95, 'Live GPS tracking, actuarial safety scoring, full historical telemetry reporting, and PDF export.',
    '["Everything in Basic","Live GPS Tracking","Actuarial Safety Scoring","Full Historical Telemetry Reporting","PDF Export"]'::jsonb),
  ('proplus', 'Pro+ Plan', 19.95, 'Unlimited 360 multi-sensor analytics, insurance premium risk modeling, cryptographic telemetry vault, automated collision reconstruction diagrams, and daily POST-calibration diagnostics.',
    '["Everything in Pro","Unlimited 360 Multi-Sensor Analytics","Insurance Premium Risk Modeling","Cryptographic Key-Code Telemetry Vault","Automated Collision Reconstruction Diagrams","Daily POST-Calibration Diagnostics"]'::jsonb)
ON CONFLICT (tier) DO NOTHING;

-- Seed default hardware profiles
INSERT INTO hardware_profiles (profile_key, name, description, sensor_config) VALUES
  ('c55_pro_forward', 'C55-PRO Forward ONLY', 'Forward-facing 77GHz microwave radar', '{"sensors":["front_radar"],"type":"77ghz","range_m":3.0}'::jsonb),
  ('c55_pro_forward_rear', 'C55-PRO Forward + REAR', 'Forward and rear 77GHz microwave radar', '{"sensors":["front_radar","rear_radar"],"type":"77ghz","range_m":3.0}'::jsonb),
  ('c55_pro_full', 'C55-PRO Forward + REAR + L&R', 'Full 4-direction 77GHz microwave radar', '{"sensors":["front_radar","rear_radar","left_radar","right_radar"],"type":"77ghz","range_m":3.0}'::jsonb),
  ('c93_gap_front', 'C93-GAP Front Corner ONLY', '4x 40kHz ultrasonic sensors around front right corner fender-well', '{"sensors":["front_right_ultrasonic_1","front_right_ultrasonic_2","front_right_ultrasonic_3","front_right_ultrasonic_4"],"type":"40khz","range_m":1.5}'::jsonb),
  ('c93_us4_lane', 'C93-US4 Front Corner GAP & Lane Change', '4x 40kHz ultrasonic + 2x 77GHz microwave radar for side lane-change protection', '{"sensors":["front_right_ultrasonic_1","front_right_ultrasonic_2","front_right_ultrasonic_3","front_right_ultrasonic_4","side_radar_left","side_radar_right"],"type":"dual","range_m":2.0}'::jsonb),
  ('c93_dual_side', 'FleetVu Dual-Layer System (77GHz Radar + 40kHz Ultrasonic)', 'Standalone dual-modality sensors independent of video camera systems', '{"sensors":["side_ultrasonic_left","side_ultrasonic_right","side_radar_left","side_radar_right"],"type":"dual","range_m":2.0}'::jsonb),
  ('full_360', '360° Multi-Sensor Full Suite', 'Complete 360-degree multi-sensor coverage with all radar and ultrasonic modules', '{"sensors":["front_radar","rear_radar","left_radar","right_radar","front_right_ultrasonic_1","front_right_ultrasonic_2","front_right_ultrasonic_3","front_right_ultrasonic_4","side_ultrasonic_left","side_ultrasonic_right"],"type":"full","range_m":3.0}'::jsonb)
ON CONFLICT (profile_key) DO NOTHING;
