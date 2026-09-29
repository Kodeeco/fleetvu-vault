import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WebhookDispatchPayload {
  companyId: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json() as WebhookDispatchPayload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all active webhooks for this company that subscribe to this event
    const { data: webhooks, error } = await supabase
      .from("enterprise_webhooks")
      .select("*")
      .eq("company_id", payload.companyId)
      .eq("is_active", true)
      .contains("events", [payload.eventType]);

    if (error || !webhooks || webhooks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, delivered: 0, message: "No matching webhooks" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build the webhook payload
    const webhookBody = JSON.stringify({
      event_type: payload.eventType,
      company_id: payload.companyId,
      timestamp: payload.timestamp,
      data: payload.data,
    });

    // Deliver to each webhook with HMAC-SHA256 signature
    const deliveryResults = await Promise.all(
      webhooks.map(async (webhook) => {
        try {
          // Compute HMAC-SHA256 signature
          const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(webhook.secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          );
          const signature = await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(webhookBody),
          );
          const sigHex = Array.from(new Uint8Array(signature))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          // Deliver
          const response = await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-FleetVu-Signature": `sha256=${sigHex}`,
              "X-FleetVu-Event": payload.eventType,
            },
            body: webhookBody,
          });

          const success = response.ok;
          const status = success ? "delivered" : `failed_${response.status}`;

          // Update webhook delivery status
          await supabase
            .from("enterprise_webhooks")
            .update({
              last_delivery_at: new Date().toISOString(),
              last_delivery_status: status,
              failure_count: success ? 0 : (webhook.failure_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", webhook.id);

          return { webhookId: webhook.id, success, status };
        } catch (err) {
          // Delivery failed — update failure count
          await supabase
            .from("enterprise_webhooks")
            .update({
              last_delivery_at: new Date().toISOString(),
              last_delivery_status: "delivery_error",
              failure_count: (webhook.failure_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", webhook.id);

          return { webhookId: webhook.id, success: false, status: "delivery_error" };
        }
      }),
    );

    const delivered = deliveryResults.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({ success: true, delivered, total: webhooks.length, results: deliveryResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
