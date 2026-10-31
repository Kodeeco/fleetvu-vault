import { NextRequest, NextResponse } from 'next/server';
import {
  clearDefaultViewLogoFile,
  readDefaultViewLogoBytes,
  saveDefaultViewLogoFile,
} from '@/lib/crm/default-view-logo';
import { resolveDefaultViewLogoUrl } from '@/lib/crm/default-view-logo';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

/** Serve the Default View Vault logo from .data/branding. */
export async function GET() {
  const custom = readDefaultViewLogoBytes();
  if (custom) {
    return new NextResponse(new Uint8Array(custom.bytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': custom.mimeType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  const gold = path.join(process.cwd(), 'public', 'FV-Vault-logo-gold.png');
  if (existsSync(gold)) {
    const bytes = readFileSync(gold);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return NextResponse.json({ error: 'Logo not found' }, { status: 404, headers: corsHeaders });
}

/**
 * Upload Default View logo.
 * Accepts multipart file OR JSON { base64, mimeType }.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let base64 = '';
    let mimeType = 'image/png';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('logo');
      if (!file || typeof file === 'string') {
        return NextResponse.json(
          { error: 'logo file required' },
          { status: 400, headers: corsHeaders },
        );
      }
      const blob = file as File;
      mimeType = blob.type || 'image/png';
      const buf = Buffer.from(await blob.arrayBuffer());
      if (buf.length < 32) {
        return NextResponse.json(
          { error: 'Logo file is empty or invalid' },
          { status: 400, headers: corsHeaders },
        );
      }
      if (buf.length > 2_097_152) {
        return NextResponse.json(
          { error: 'Logo must be under 2MB' },
          { status: 400, headers: corsHeaders },
        );
      }
      base64 = `data:${mimeType};base64,${buf.toString('base64')}`;
    } else {
      const body = await req.json().catch(() => null);
      if (!body?.base64) {
        return NextResponse.json(
          { error: 'base64 or multipart logo required' },
          { status: 400, headers: corsHeaders },
        );
      }
      base64 = String(body.base64);
      mimeType = String(body.mimeType || 'image/png');
    }

    const logoUrl = saveDefaultViewLogoFile({ base64, mimeType });
    return NextResponse.json(
      {
        success: true,
        logoUrl,
        previewUrl: resolveDefaultViewLogoUrl(),
        source: 'default-view',
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Logo upload failed' },
      { status: 400, headers: corsHeaders },
    );
  }
}

export async function DELETE() {
  const logoUrl = clearDefaultViewLogoFile();
  return NextResponse.json({ success: true, logoUrl }, { headers: corsHeaders });
}
