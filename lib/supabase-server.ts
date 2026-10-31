/**
 * Server-only Supabase client (API routes / onboarding).
 * Never import `@/lib/supabase` from server code — that module is `'use client'`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _server: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (_server) return _server;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase URL / key missing on server (NEXT_PUBLIC_SUPABASE_URL).');
  }

  _server = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _server;
}
