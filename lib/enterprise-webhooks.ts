'use client';

import { supabase } from '@/lib/supabase';

/**
 * Enterprise OpenAPI & TMS Integration Framework (Item 8)
 *
 * HMAC-SHA256 signed real-time webhooks allowing enterprise fleets to
 * pipe operational telemetry, daily POST statuses, and safety alerts
 * directly into their existing TMS or telematics platforms.
 *
 * The webhook signing uses HMAC-SHA256 with a per-company secret.
 * Each delivery includes a signature header that the receiver verifies.
 */

export type WebhookEventType =
  | 'telemetry_event'
  | 'post_check_complete'
  | 'collision_detected'
  | 'near_miss_detected'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'license_activated'
  | 'vault_block_sealed';

export interface WebhookConfig {
  id: string;
  companyId: string;
  url: string;
  events: WebhookEventType[];
  isActive: boolean;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  failureCount: number;
}

export interface WebhookPayload {
  event_type: WebhookEventType;
  company_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Compute HMAC-SHA256 signature for a webhook payload.
 */
export async function computeHmacSignature(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const bytes = new Uint8Array(signature);
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
  return hex.join('');
}

/**
 * Register a new webhook endpoint for a company.
 */
export async function registerWebhook(
  companyId: string,
  url: string,
  events: WebhookEventType[],
): Promise<{ id: string; secret: string } | null> {
  // Generate a cryptographically random secret
  const secretBytes = new Uint8Array(32);
  crypto.getRandomValues(secretBytes);
  const secret = Array.from(secretBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const { data, error } = await supabase
    .from('enterprise_webhooks')
    .insert({
      company_id: companyId,
      url,
      secret,
      events,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !data) return null;
  return { id: data.id, secret };
}

/**
 * Fetch all webhooks for a company.
 */
export async function fetchWebhooks(companyId: string): Promise<WebhookConfig[]> {
  const { data } = await supabase
    .from('enterprise_webhooks')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    url: row.url,
    events: row.events as WebhookEventType[],
    isActive: row.is_active,
    lastDeliveryAt: row.last_delivery_at,
    lastDeliveryStatus: row.last_delivery_status,
    failureCount: row.failure_count,
  }));
}

/**
 * Trigger a webhook delivery for an event.
 * This is called from the edge function, not directly from the client.
 * The client calls the edge function which dispatches the webhook.
 */
export async function triggerWebhookEvent(
  companyId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  try {
    await fetch(`${supabaseUrl}/functions/v1/enterprise-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        companyId,
        eventType,
        data,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Webhook dispatch is best-effort
  }
}

/**
 * Update webhook status (activate/deactivate).
 */
export async function toggleWebhook(
  webhookId: string,
  isActive: boolean,
): Promise<void> {
  await supabase
    .from('enterprise_webhooks')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', webhookId);
}

/**
 * Delete a webhook endpoint.
 */
export async function deleteWebhook(webhookId: string): Promise<void> {
  await supabase
    .from('enterprise_webhooks')
    .delete()
    .eq('id', webhookId);
}
