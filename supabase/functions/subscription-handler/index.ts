import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubscriptionRequestPayload {
  type: string;
  requestId: string;
  companyName: string;
  location: string | null;
  pocName: string;
  pocEmail: string;
  affectedUnitCount: number;
  hardwareSerials: string[];
  annualTotal: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = await req.json() as SubscriptionRequestPayload;

    // Build the notification email content
    const serialList = payload.hardwareSerials.length > 0
      ? payload.hardwareSerials.join(", ")
      : "All units";

    const emailSubject = `New Subscription Request — ${payload.companyName}`;
    const emailBody = [
      `New subscription request received from FleetVu portal.`,
      ``,
      `Company / Fleet Name: ${payload.companyName}`,
      `Location: ${payload.location ?? "Not specified"}`,
      `Point of Contact: ${payload.pocName} (${payload.pocEmail})`,
      `Affected Unit Count: ${payload.affectedUnitCount}`,
      `Hardware Serial Numbers: ${serialList}`,
      `Annual Total: $${payload.annualTotal.toFixed(2)} (${payload.affectedUnitCount} units x $119.40/unit)`,
      ``,
      `Request ID: ${payload.requestId}`,
      ``,
      `Next Steps:`,
      `1. Generate an annual invoice ($119.40 per unit / annual total, or custom adjusted contract rate)`,
      `2. Upon invoice payment, generate a 12-month cryptographic subscription key`,
      `3. Activate the vault features for the affected units`,
    ].join("\n");

    // Log the request to the database for audit trail
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);

      // Update the subscription request record
      await supabase
        .from("subscription_requests")
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("id", payload.requestId);

      // Insert an audit log entry
      await supabase.from("audit_logs").insert({
        actor_role: "system",
        actor_email: payload.pocEmail,
        action_type: "SUBSCRIPTION_REQUEST",
        entity_type: "subscription_request",
        entity_id: payload.requestId,
        new_state: {
          company_name: payload.companyName,
          poc_name: payload.pocName,
          poc_email: payload.pocEmail,
          affected_units: payload.affectedUnitCount,
          annual_total: payload.annualTotal,
          hardware_serials: payload.hardwareSerials,
        },
      });
    }

    // Send notification email via the communications API route
    const emailApiUrl = `${supabaseUrl}/api/communications/email`;
    if (supabaseUrl) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "")}/api/communications/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: "sales@fleetvu.org",
            subject: emailSubject,
            body: emailBody,
          }),
        });
      } catch {
        // Email dispatch is best-effort — the DB record is the source of truth
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Subscription request processed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
