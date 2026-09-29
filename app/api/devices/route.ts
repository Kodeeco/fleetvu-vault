import { NextRequest, NextResponse } from 'next/server';
import {
  revokeDevicesAndIssueReplacementKeycode,
  upsertDeviceEnrollment,
} from '@/lib/auth/device-enrollment';
import { buildDriverKeycodeWelcomeHtml } from '@/lib/email/welcome-roster-template';

export const dynamic = 'force-dynamic';

/**
 * POST /api/devices
 *  - enroll: after biometric bind on phone
 *  - replace: lost phone → revoke devices + email new one-time keycode
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'enroll') {
      const result = await upsertDeviceEnrollment({
        driverId: body.driver_id,
        companyId: body.company_id,
        deviceFingerprint: body.device_fingerprint,
        platform: body.platform || 'mobile',
        deviceLabel: body.device_label,
        biometricEnrolled: body.biometric_enrolled !== false,
        keycodeId: body.keycode_id,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, enrollmentId: result.enrollmentId });
    }

    if (action === 'replace') {
      if (!body.driver_id || !body.company_id || !body.driver_email || !body.driver_name) {
        return NextResponse.json(
          { error: 'driver_id, company_id, driver_name, and driver_email are required' },
          { status: 400 },
        );
      }

      const result = await revokeDevicesAndIssueReplacementKeycode({
        driverId: body.driver_id,
        companyId: body.company_id,
        driverName: body.driver_name,
        driverEmail: body.driver_email,
        reason: body.reason,
      });

      if (!result.ok || !result.keycode) {
        return NextResponse.json({ error: result.error || 'Replace failed' }, { status: 500 });
      }

      // Dispatch replacement keycode via existing email route shape
      try {
        const html = buildDriverKeycodeWelcomeHtml({
          driverName: body.driver_name,
          companyName: body.company_name || 'Your fleet',
          keycode: result.keycode,
          isDesktop: false,
        });
        await fetch(`${req.nextUrl.origin}/api/communications/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: 'DRIVER_KEYCODE_WELCOME',
            to_email: body.driver_email,
            subject: 'FleetVu — Replacement Vault Access Keycode',
            html,
            from_profile: 'welcome',
          }),
        });
      } catch {
        // Keycode still issued even if email transport fails in dev
      }

      return NextResponse.json({
        success: true,
        revoked: result.revoked,
        keycodeId: result.keycodeId,
        message: `Revoked ${result.revoked || 0} device(s). Replacement keycode emailed to ${body.driver_email}.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Device API error' },
      { status: 500 },
    );
  }
}
