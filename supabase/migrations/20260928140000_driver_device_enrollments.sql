/*
  Driver device enrollments — phone recovery without storing biometrics.

  Biometric templates (fingerprint / FaceID) NEVER leave the driver's phone.
  Supabase only stores:
    - device fingerprint / platform
    - biometric_enrolled flag (boolean)
    - last Daily POST acknowledgement
    - revoke + reissue history for lost-phone recovery

  Recovery flow:
    1. Company Super Admin (or FleetVu ops) revokes the lost device
    2. System issues a new one-time keycode email (welcome@fleetvu.org)
    3. Driver opens Vault on the new phone → keycode once → re-bind biometrics
    4. Old device is denied even if recovered later
*/

CREATE TABLE IF NOT EXISTS driver_device_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id text NOT NULL,
  company_id uuid,
  device_fingerprint text NOT NULL,
  platform text NOT NULL DEFAULT 'mobile',
  device_label text,
  biometric_enrolled boolean NOT NULL DEFAULT false,
  biometric_enrolled_at timestamptz,
  last_post_at timestamptz,
  last_seen_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'replaced')),
  revoked_at timestamptz,
  revoked_reason text,
  replaced_by_enrollment_id uuid REFERENCES driver_device_enrollments(id) ON DELETE SET NULL,
  keycode_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_device_driver ON driver_device_enrollments(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_device_company ON driver_device_enrollments(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_device_status ON driver_device_enrollments(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_device_active_fp
  ON driver_device_enrollments(driver_id, device_fingerprint)
  WHERE status = 'active';

ALTER TABLE driver_device_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_driver_devices" ON driver_device_enrollments;
CREATE POLICY "anon_select_driver_devices" ON driver_device_enrollments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_driver_devices" ON driver_device_enrollments;
CREATE POLICY "anon_insert_driver_devices" ON driver_device_enrollments
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_driver_devices" ON driver_device_enrollments;
CREATE POLICY "anon_update_driver_devices" ON driver_device_enrollments
  FOR UPDATE USING (true);

COMMENT ON TABLE driver_device_enrollments IS
  'Device enrollment registry. Biometric templates stay on-device; only flags + fingerprints stored server-side for recovery.';
