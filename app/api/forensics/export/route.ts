import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildLegalExport,
  serializeLegalArtifact,
  sealCustodyEvent,
  type CustodyEvent,
  type ReconstructionPackage,
} from '@/lib/forensics';
import {
  isFleetVuPlatformOperator,
  LEGAL_ISOLATION_DENIAL_MESSAGE,
} from '@/lib/legal-data-isolation';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

function isPlatformEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return e.endsWith('@fleetvu.org') || e.endsWith('@fleetvu.com');
}

export async function POST(req: NextRequest) {
  let body: {
    caseId?: string;
    companyId?: string | null;
    companyName?: string | null;
    incidentId?: string | null;
    exportedBy?: { email: string; role: string; accountId?: string | null };
    custodyEvents?: CustodyEvent[];
    reconstruction?: ReconstructionPackage | null;
    eventLogs?: Array<Record<string, unknown>>;
    vaultBlockHashes?: string[];
    notes?: string;
    encrypt?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  if (!body.caseId || !body.exportedBy?.email) {
    return NextResponse.json(
      { error: 'caseId and exportedBy.email are required' },
      { status: 400, headers: corsHeaders },
    );
  }

  // LEGAL ISOLATION FIREWALL — FleetVu Global Admin / platform staff cannot export evidence
  if (
    isFleetVuPlatformOperator({ role: body.exportedBy.role, email: body.exportedBy.email }) ||
    isPlatformEmail(body.exportedBy.email)
  ) {
    return NextResponse.json(
      {
        error: LEGAL_ISOLATION_DENIAL_MESSAGE,
        code: 'LEGAL_ISOLATION_DENIED',
      },
      { status: 403, headers: corsHeaders },
    );
  }

  try {
    const artifact = await buildLegalExport({
      caseId: body.caseId,
      companyId: body.companyId ?? null,
      companyName: body.companyName ?? null,
      incidentId: body.incidentId ?? null,
      exportedBy: body.exportedBy,
      custodyEvents: body.custodyEvents ?? [],
      reconstruction: body.reconstruction ?? null,
      eventLogs: body.eventLogs ?? [],
      vaultBlockHashes: body.vaultBlockHashes ?? [],
      notes: body.notes,
      encrypt: body.encrypt === true,
    });

    const custody = await sealCustodyEvent({
      artifactType: 'legal_export',
      artifactId: artifact.manifest.exportId,
      companyId: body.companyId ?? null,
      action: 'exported',
      actor: {
        accountId: body.exportedBy.accountId ?? null,
        email: body.exportedBy.email,
        role: body.exportedBy.role,
      },
      device: {
        deviceId: 'legal-export-api',
        platform: 'server',
        appVersion: '1.0.0',
      },
      artifactHash: artifact.sealHash,
      metadata: { case_id: body.caseId, encrypted: body.encrypt === true },
    });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const sb = createClient(url, key);
      try {
        await sb.from('legal_export_artifacts').insert({
          export_id: artifact.manifest.exportId,
          case_id: body.caseId,
          company_id: body.companyId ?? null,
          company_name: body.companyName ?? null,
          incident_id: body.incidentId ?? null,
          manifest: artifact.manifest,
          seal_hash: artifact.sealHash,
          content_hash: artifact.manifest.integrity.contentHash,
          encrypted: body.encrypt === true,
          exported_by_email: body.exportedBy.email,
          exported_by_role: body.exportedBy.role,
        });
      } catch (err) {
        console.warn('[Legal Export] persist:', err);
      }

      await sb.from('chain_of_custody_events').insert({
        id: custody.id,
        seq: custody.seq,
        artifact_type: custody.artifact_type,
        artifact_id: custody.artifact_id,
        company_id: custody.company_id,
        action: custody.action,
        actor_account_id: custody.actor_account_id,
        actor_email: custody.actor_email,
        actor_role: custody.actor_role,
        device_id: custody.device_id,
        device_platform: custody.device_platform,
        app_version: custody.app_version,
        network_timestamp: custody.network_timestamp,
        server_timestamp: custody.server_timestamp,
        artifact_hash: custody.artifact_hash,
        prev_hash: custody.prev_hash,
        record_hash: custody.record_hash,
        metadata: custody.metadata,
      }).then(() => undefined).catch(() => undefined);
    }

    return NextResponse.json(
      {
        success: true,
        artifact: {
          ...artifact,
        },
        downloadJson: serializeLegalArtifact(artifact),
        custodyEventId: custody.id,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error('[FleetVu Legal Export]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500, headers: corsHeaders },
    );
  }
}
