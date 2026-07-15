import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseServerEnvironment } from "../../config/server-environment";

export function createServerSupabaseClient(
  environment: SupabaseServerEnvironment,
) {
  return createClient(environment.url, environment.anonymousKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
