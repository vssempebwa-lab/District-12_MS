import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Supabase renamed the server key; accept both names so existing deployments
// do not silently drop into demo storage.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export function hasSupabaseEnv(): boolean {
  return Boolean(url && anonKey);
}

export function hasServiceRoleEnv(): boolean {
  return Boolean(url && serviceKey);
}

export function createAnonClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let serviceClient: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  if (!serviceClient) {
    serviceClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-d12-service": "hub" } },
    });
  }
  return serviceClient;
}
