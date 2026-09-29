/**
 * Driver device enrollment + lost-phone recovery.
 *
 * Biometrics stay on the phone. Server stores enrollment flags + device
 * fingerprints so a Super Admin can revoke a lost device and reissue a
 * one-time keycode for the replacement handset.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type DevicePlatform = 'mobile' | 'desktop';

export interface DeviceEnrollment {
  id: string;
  driver_id: string;
  company_id: string | null;
  device_fingerprint: string;
  platform: DevicePlatform;
  device_label: string | null;
  biometric_enrolled: boolean;
  status: 'active' | 'revoked' | 'replaced';
}

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function randomKeycode(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

/** Register or refresh an active device after biometric bind / login. */
export async function upsertDeviceEnrollment(input: {
  driverId: string;
  companyId?: string | null;
  deviceFingerprint: string;
  platform?: DevicePlatform;
  deviceLabel?: string;
  biometricEnrolled?: boolean;
  keycodeId?: string | null;
}): Promise<{ ok: boolean; enrollmentId?: string; error?: string }> {
  const client = getAdminClient();
  if (!client) return { ok: false, error: 'Database unavailable' };

  const now = new Date().toISOString();
  const { data: existing } = await client
    .from('driver_device_enrollments')
    .select('id, status')
    .eq('driver_id', input.driverId)
    .eq('device_fingerprint', input.deviceFingerprint)
    .maybeSingle();

  if (existing?.status === 'revoked') {
    return { ok: false, error: 'This device was revoked. Request a replacement keycode from your company admin.' };
  }

  if (existing) {
    const { error } = await client
      .from('driver_device_enrollments')
      .update({
        biometric_enrolled: input.biometricEnrolled ?? true,
        biometric_enrolled_at: input.biometricEnrolled === false ? null : now,
        last_seen_at: now,
        updated_at: now,
        platform: input.platform || 'mobile',
        device_label: input.deviceLabel || null,
        keycode_id: input.keycodeId || null,
        status: 'active',
      })
      .eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, enrollmentId: existing.id };
  }

  const { data, error } = await client
    .from('driver_device_enrollments')
    .insert({
      driver_id: input.driverId,
      company_id: input.companyId || null,
      device_fingerprint: input.deviceFingerprint,
      platform: input.platform || 'mobile',
      device_label: input.deviceLabel || null,
      biometric_enrolled: input.biometricEnrolled ?? true,
      biometric_enrolled_at: input.biometricEnrolled === false ? null : now,
      last_seen_at: now,
      keycode_id: input.keycodeId || null,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, enrollmentId: data.id };
}

/**
 * Lost / stolen phone recovery:
 * 1. Revoke all active mobile enrollments for the driver
 * 2. Issue a fresh one-time keycode (email sent by caller)
 */
export async function revokeDevicesAndIssueReplacementKeycode(input: {
  driverId: string;
  companyId: string;
  driverName: string;
  driverEmail: string;
  reason?: string;
}): Promise<{ ok: boolean; keycode?: string; keycodeId?: string; revoked?: number; error?: string }> {
  const client = getAdminClient();
  if (!client) return { ok: false, error: 'Database unavailable' };

  const now = new Date().toISOString();

  const { data: activeDevices } = await client
    .from('driver_device_enrollments')
    .select('id')
    .eq('driver_id', input.driverId)
    .eq('status', 'active');

  if (activeDevices?.length) {
    await client
      .from('driver_device_enrollments')
      .update({
        status: 'revoked',
        revoked_at: now,
        revoked_reason: input.reason || 'Device replacement requested',
        updated_at: now,
      })
      .in(
        'id',
        activeDevices.map((d) => d.id),
      );
  }

  const keycode = randomKeycode();
  const { data: keyRow, error: keyErr } = await client
    .from('driver_access_keycodes')
    .insert({
      keycode,
      driver_id: input.driverId,
      driver_name: input.driverName,
      company_id: input.companyId,
      company_name: null,
      lifecycle_status: 'active',
      biometric_bound: false,
    })
    .select('id')
    .single();

  if (keyErr) return { ok: false, error: keyErr.message };

  try {
    await client.from('audit_logs').insert({
      actor_role: 'company_admin',
      action_type: 'DEVICE_REPLACEMENT_KEYCODE',
      entity_type: 'driver_device_enrollment',
      entity_id: input.driverId,
      new_state: {
        driver_email: input.driverEmail,
        revoked_count: activeDevices?.length || 0,
        keycode_id: keyRow.id,
        reason: input.reason || 'Device replacement',
        timestamp: now,
      },
    });
  } catch {
    // non-fatal
  }

  return {
    ok: true,
    keycode,
    keycodeId: keyRow.id,
    revoked: activeDevices?.length || 0,
  };
}

export async function recordDailyPost(driverId: string, deviceFingerprint: string): Promise<void> {
  const client = getAdminClient();
  if (!client) return;
  const now = new Date().toISOString();
  await client
    .from('driver_device_enrollments')
    .update({ last_post_at: now, last_seen_at: now, updated_at: now })
    .eq('driver_id', driverId)
    .eq('device_fingerprint', deviceFingerprint)
    .eq('status', 'active');
}
