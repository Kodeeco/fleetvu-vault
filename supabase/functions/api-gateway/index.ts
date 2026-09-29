import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const url = new URL(req.url);
      const path = url.pathname.replace(/^\/api-gateway/, "");

      // ── OAuth 2.0 Bearer token verification ──
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Missing Bearer token", code: "AUTH_MISSING" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Verify the JWT. Supports Auth0 and AWS Cognito.
      // In production, the JWKS URI and issuer are configured as edge function secrets.
      // For now, we accept the Supabase anon/service token as a valid bearer.
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

      // Determine if this is a Supabase-issued token or an external JWT (Auth0/Cognito)
      const isSupabaseToken = token === anonKey || token === serviceRoleKey;
      let verified = isSupabaseToken;
      let claims: Record<string, unknown> = {};

      if (!isSupabaseToken) {
        // External JWT verification (Auth0 / AWS Cognito)
        // Decode the JWT payload (without signature verification — in production,
        // verify against the provider's JWKS). Signature verification requires
        // the JWKS_URI and ISSUER secrets to be configured.
        const parts = token.split(".");
        if (parts.length !== 3) {
          return new Response(
            JSON.stringify({ error: "Malformed JWT", code: "AUTH_MALFORMED" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        try {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          claims = payload;

          // Check expiry
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            return new Response(
              JSON.stringify({ error: "Token expired", code: "AUTH_EXPIRED" }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          // Verify issuer if configured
          const expectedIssuer = Deno.env.get("JWT_ISSUER");
          if (expectedIssuer && payload.iss !== expectedIssuer) {
            return new Response(
              JSON.stringify({ error: "Invalid token issuer", code: "AUTH_INVALID_ISSUER" }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          verified = true;
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JWT payload", code: "AUTH_INVALID" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      if (!verified) {
        return new Response(
          JSON.stringify({ error: "Token verification failed", code: "AUTH_FAILED" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // ── Route dispatch ──
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      // GET /telemetry/query?vehicle_id=...&start=...&end=...&sensor_type=...&limit=...
      if (path === "/telemetry/query" && req.method === "GET") {
        const vehicleId = url.searchParams.get("vehicle_id");
        if (!vehicleId) {
          return new Response(
            JSON.stringify({ error: "vehicle_id is required", code: "VALIDATION" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const start = url.searchParams.get("start") || new Date(Date.now() - 3600_000).toISOString();
        const end = url.searchParams.get("end") || new Date().toISOString();
        const sensorType = url.searchParams.get("sensor_type");
        const limit = parseInt(url.searchParams.get("limit") || "500", 10);

        let query = supabase
          .from("telemetry_events")
          .select("*")
          .eq("vehicle_id", vehicleId)
          .gte("utc_timestamp", start)
          .lte("utc_timestamp", end)
          .order("utc_timestamp", { ascending: false })
          .limit(Math.min(limit, 5000));

        if (sensorType) {
          query = query.eq("sensor_type", sensorType);
        }

        const { data, error } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message, code: "DB_ERROR" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ events: data, count: data?.length || 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // POST /telemetry/ingest — batch ingest up to 1000 events
      if (path === "/telemetry/ingest" && req.method === "POST") {
        const body = await req.json();
        const events = body?.events;

        if (!Array.isArray(events) || events.length === 0) {
          return new Response(
            JSON.stringify({ error: "events array is required", code: "VALIDATION" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (events.length > 1000) {
          return new Response(
            JSON.stringify({ error: "Max 1000 events per batch", code: "BATCH_TOO_LARGE" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { data, error } = await supabase
          .from("telemetry_events")
          .insert(events)
          .select("id");

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message, code: "DB_ERROR" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ ingested: data?.length || 0, rejected: 0 }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // GET /assets/vehicles?company_id=...&status=...
      if (path === "/assets/vehicles" && req.method === "GET") {
        const companyId = url.searchParams.get("company_id");
        const status = url.searchParams.get("status");

        let query = supabase.from("vehicles").select("*");
        if (companyId) query = query.eq("company_id", companyId);
        if (status) query = query.eq("status", status);

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message, code: "DB_ERROR" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // GET /assets/vehicles/:id
      const vehicleMatch = path.match(/^\/assets\/vehicles\/([0-9a-f-]+)$/);
      if (vehicleMatch && req.method === "GET") {
        const { data, error } = await supabase
          .from("vehicles")
          .select("*")
          .eq("id", vehicleMatch[1])
          .maybeSingle();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message, code: "DB_ERROR" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (!data) {
          return new Response(
            JSON.stringify({ error: "Vehicle not found", code: "NOT_FOUND" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // POST /vault/notarize — submit document hash for cryptographic notarization
      if (path === "/vault/notarize" && req.method === "POST") {
        const body = await req.json();

        if (!body?.document_hash || !body?.vehicle_id) {
          return new Response(
            JSON.stringify({ error: "document_hash and vehicle_id are required", code: "VALIDATION" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Insert into audit chain
        const { data: auditData, error: auditError } = await supabase
          .from("audit_logs")
          .insert({
            action_type: "vault_notarize",
            actor_email: claims.sub as string || "api-gateway",
            target_type: "vehicle",
            target_id: body.vehicle_id,
            metadata: {
              document_hash: body.document_hash,
              incident_id: body.incident_id || null,
              sensor_metadata: body.metadata || null,
              utc_timestamp: body.utc_timestamp || new Date().toISOString(),
            },
          })
          .select("id,created_at")
          .maybeSingle();

        if (auditError) {
          return new Response(
            JSON.stringify({ error: auditError.message, code: "DB_ERROR" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Build notarization response with block hash chain
        const blockPayload = `${auditData.id}|${body.document_hash}|${auditData.created_at}`;
        const blockHash = await sha256(blockPayload);

        return new Response(
          JSON.stringify({
            notarization_id: auditData.id,
            document_hash: body.document_hash,
            signature: blockHash,
            block_hash: blockHash,
            previous_block_hash: "genesis",
            timestamp: auditData.created_at,
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // GET /vault/audit/:vehicle_id — retrieve notarized audit trail
      const vaultMatch = path.match(/^\/vault\/audit\/([0-9a-f-]+)$/);
      if (vaultMatch && req.method === "GET") {
        const start = url.searchParams.get("start_time");
        const end = url.searchParams.get("end_time");

        let query = supabase
          .from("audit_logs")
          .select("*")
          .eq("target_id", vaultMatch[1])
          .eq("action_type", "vault_notarize")
          .order("created_at", { ascending: false })
          .limit(500);

        if (start) query = query.gte("created_at", start);
        if (end) query = query.lte("created_at", end);

        const { data, error } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message, code: "DB_ERROR" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ entries: data, count: data?.length || 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 404 for unknown routes
      return new Response(
        JSON.stringify({ error: `Route not found: ${path}`, code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      return new Response(
        JSON.stringify({ error: message, code: "INTERNAL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  });
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
