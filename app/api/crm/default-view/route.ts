import { NextRequest, NextResponse } from 'next/server';
import {
  getDefaultViewAccount,
  saveDefaultViewAccount,
} from '@/lib/crm/default-view-store';
import {
  clearDefaultViewLogoFile,
  resolveDefaultViewLogoUrl,
  saveDefaultViewLogoFile,
} from '@/lib/crm/default-view-logo';
import { toDefaultViewAuthUser } from '@/lib/default-view-account';
import { normalizeCompanyLogoSize } from '@/lib/company-branding';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

/** Public read — bare Vault + CRM panel. */
export async function GET() {
  const account = {
    ...getDefaultViewAccount(),
    logoUrl: resolveDefaultViewLogoUrl(),
  };
  return NextResponse.json(
    {
      success: true,
      account,
      authUser: toDefaultViewAuthUser(account),
    },
    { headers: corsHeaders },
  );
}

/** Staff CRM: update dummy profile shown on bare app.fleetvu.org. */
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  // Logo: persist via same JSON store as profile (multipart /logo often fails on host).
  if (typeof body.logoUrl === 'string') {
    const logo = body.logoUrl.trim();
    try {
      if (!logo || logo.includes('FV-Vault-logo-gold')) {
        clearDefaultViewLogoFile();
      } else if (logo.startsWith('data:image/')) {
        const mimeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(logo);
        saveDefaultViewLogoFile({
          base64: logo,
          mimeType: mimeMatch?.[1] || 'image/png',
        });
      } else if (logo.startsWith('/api/crm/default-view/logo') || logo.startsWith('data:')) {
        saveDefaultViewAccount({ logoUrl: logo });
      }
      // Ignore other absolute/external URLs from stale form state
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Logo save failed' },
        { status: 400, headers: corsHeaders },
      );
    }
  }

  const saved = saveDefaultViewAccount({
    ...(body.companyName !== undefined ? { companyName: String(body.companyName ?? '') } : {}),
    ...(body.driverName !== undefined ? { driverName: String(body.driverName ?? '') } : {}),
    ...(body.depot !== undefined ? { depot: String(body.depot ?? '') } : {}),
    ...(body.truckNumber !== undefined ? { truckNumber: String(body.truckNumber ?? '') } : {}),
    ...(body.driverId !== undefined ? { driverId: String(body.driverId ?? '') } : {}),
    ...(body.sensorHardware !== undefined
      ? { sensorHardware: String(body.sensorHardware ?? '') }
      : {}),
    ...(body.logoSize !== undefined
      ? { logoSize: normalizeCompanyLogoSize(body.logoSize) }
      : {}),
  });
  const account = { ...saved, logoUrl: resolveDefaultViewLogoUrl() };

  return NextResponse.json(
    {
      success: true,
      account,
      authUser: toDefaultViewAuthUser(account),
    },
    { headers: corsHeaders },
  );
}
