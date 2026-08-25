import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAdminEnvironment } from "./environment";

export function createSupabaseAdminClient(
  environment: Record<string, string | undefined> = process.env,
): SupabaseClient {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
    requireSupabaseAdminEnvironment(environment);
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

const globalSupabase = globalThis as typeof globalThis & {
  careerSupabaseAdminClient?: SupabaseClient;
};

export function getSupabaseAdminClient(): SupabaseClient {
  if (!globalSupabase.careerSupabaseAdminClient) {
    globalSupabase.careerSupabaseAdminClient = createSupabaseAdminClient();
  }
  return globalSupabase.careerSupabaseAdminClient;
}
