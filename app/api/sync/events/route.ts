import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sealCustodyEvent } from '@/lib/forensics';
import type { SyncEvent } from '@/lib/sync';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  let body: { events?: SyncEvent[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  const events = body.events || [];
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'events[] required' }, { status: 400, headers: corsHeaders });
  }

  const sb = getAdminClient();
  const acked: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const event of events.slice(0, 50)) {
    try {
      if (!event.id || !event.channel || !event.deviceId) {
        errors.push({ id: event.id || 'unknown', error: 'Missing required fields' });
        continue;
      }

      if (sb) {
        const { error } = await sb.from('sync_event_log').upsert({
          id: event.id,
          channel: event.channel,
          company_id: event.companyId,
          device_id: event.deviceId,
          payload: event.payload,
          client_timestamp_ms: event.clientTimestampMs,
          status: 'acked',
        });
        if (error) {
          // Non-fatal if table missing — still ack to unblock client queue
          console.warn('[FleetVu Sync] persist warning:', error.message);
        }
      }

      // Custody touchpoint for compliance / sign-off channels
      if (event.channel === 'compliance_signoff' || event.channel === 'incident') {
        const custody = await sealCustodyEvent({
          artifactType: `sync_${event.channel}`,
          artifactId: event.id,
          companyId: event.companyId,
          action: 'sync_received',
          actor: {
            accountId: null,
            email: (event.payload.actorEmail as string) || null,
            role: (event.payload.actorRole as string) || 'driver',
          },
          device: {
            deviceId: event.deviceId,
            platform: (event.payload.platform as string) || 'mobile',
            appVersion: (event.payload.appVersion as string) || null,
          },
          networkTimestamp: event.clientTimestampMs,
          metadata: { channel: event.channel },
        });

        if (sb) {
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
      }

      acked.push(event.id);
    } catch (err) {
      errors.push({
        id: event.id,
        error: err instanceof Error ? err.message : 'Sync failed',
      });
    }
  }

  return NextResponse.json(
    { success: errors.length === 0, acked, errors },
    { status: 200, headers: corsHeaders },
  );
}
