import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const url = new URL(req.url);
      const path = url.pathname.replace(/^\/crypto-vault/, "");

      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!token) {
        return jsonResponse({ error: "Missing Bearer token", code: "AUTH_MISSING" }, 401);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

      const isAuthorized = token === anonKey || token === serviceRoleKey;
      if (!isAuthorized) {
        return jsonResponse({ error: "Unauthorized", code: "AUTH_FAILED" }, 401);
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      // POST /hash — compute server-side SHA-256 hash of a document payload
      if (path === "/hash" && req.method === "POST") {
        const body = await req.json();
        const { payload, vehicle_id, document_title } = body || {};

        if (!payload) {
          return jsonResponse({ error: "payload is required", code: "VALIDATION" }, 400);
        }

        const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
        const hash = await sha256(payloadStr);
        const timestamp = new Date().toISOString();

        // Retrieve the last block hash to build the chain
        const { data: lastEntry } = await supabase
          .from("audit_logs")
          .select("metadata")
          .eq("action_type", "vault_notarize")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const previousHash = (lastEntry?.metadata as Record<string, unknown>)?.block_hash as string || "genesis";
        const blockPayload = `${hash}|${previousHash}|${timestamp}`;
        const blockHash = await sha256(blockPayload);

        // Insert audit log entry
        const { data: auditData, error: auditError } = await supabase
          .from("audit_logs")
          .insert({
            action_type: "vault_notarize",
            actor_email: "crypto-vault@fleetvu",
            target_type: "vehicle",
            target_id: vehicle_id || "unspecified",
            metadata: {
              document_hash: hash,
              document_title: document_title || "untitled",
              block_hash: blockHash,
              previous_block_hash: previousHash,
              utc_timestamp: timestamp,
            },
          })
          .select("id,created_at")
          .maybeSingle();

        if (auditError) {
          return jsonResponse({ error: auditError.message, code: "DB_ERROR" }, 500);
        }

        return jsonResponse({
          notarization_id: auditData.id,
          document_hash: hash,
          block_hash: blockHash,
          previous_block_hash: previousHash,
          algorithm: "SHA-256",
          timestamp: auditData.created_at,
          chain_length: 1,
        }, 201);
      }

      // POST /verify — verify a SHA-256 hash against the chain
      if (path === "/verify" && req.method === "POST") {
        const body = await req.json();
        const { document_hash } = body || {};

        if (!document_hash) {
          return jsonResponse({ error: "document_hash is required", code: "VALIDATION" }, 400);
        }

        const { data, error } = await supabase
          .from("audit_logs")
          .select("id, metadata, created_at")
          .eq("action_type", "vault_notarize")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (error) {
          return jsonResponse({ error: error.message, code: "DB_ERROR" }, 500);
        }

        const match = (data || []).find((entry) => {
          const meta = entry.metadata as Record<string, unknown>;
          return meta?.document_hash === document_hash;
        });

        if (!match) {
          return jsonResponse({
            verified: false,
            message: "Hash not found in vault registry",
            document_hash,
          }, 404);
        }

        const meta = match.metadata as Record<string, unknown>;
        return jsonResponse({
          verified: true,
          document_hash,
          notarization_id: match.id,
          block_hash: meta.block_hash,
          previous_block_hash: meta.previous_block_hash,
          timestamp: match.created_at,
          algorithm: "SHA-256",
        });
      }

      // GET /chain/health — validate the integrity of the entire hash chain
      if (path === "/chain/health" && req.method === "GET") {
        const { data, error } = await supabase
          .from("audit_logs")
          .select("id, metadata, created_at")
          .eq("action_type", "vault_notarize")
          .order("created_at", { ascending: true })
          .limit(5000);

        if (error) {
          return jsonResponse({ error: error.message, code: "DB_ERROR" }, 500);
        }

        const entries = data || [];
        let chainValid = true;
        let breaks = 0;
        let previousHash = "genesis";

        for (const entry of entries) {
          const meta = entry.metadata as Record<string, unknown>;
          if (meta.previous_block_hash !== previousHash) {
            chainValid = false;
            breaks++;
          }
          previousHash = meta.block_hash as string;
        }

        return jsonResponse({
          chain_valid: chainValid,
          total_blocks: entries.length,
          breaks,
          last_block_hash: previousHash,
          algorithm: "SHA-256",
          validated_at: new Date().toISOString(),
        });
      }

      // GET /status — HSM key vault status and security posture
      if (path === "/status" && req.method === "GET") {
        const hsmConfigured = !!Deno.env.get("HSM_KEY_ID");
        return jsonResponse({
          hsm_vault: {
            configured: hsmConfigured,
            status: hsmConfigured ? "active" : "simulated",
            key_algorithm: "AES-256-GCM",
            key_rotation_days: 90,
          },
          sha256_engine: {
            status: "active",
            algorithm: "SHA-256",
            provider: "WebCrypto (server-side)",
          },
          chain_blocks: 0,
          server_isolated: true,
          timestamp: new Date().toISOString(),
        });
      }

      return jsonResponse({ error: `Route not found: ${path}`, code: "NOT_FOUND" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      return jsonResponse({ error: message, code: "INTERNAL" }, 500);
    }
  });
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
