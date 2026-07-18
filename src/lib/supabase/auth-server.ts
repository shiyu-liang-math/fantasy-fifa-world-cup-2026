import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readSupabaseServerEnvironment } from "@/config/server-environment-runtime";
import { adminAuthCookieOptions } from "./auth-cookie-options";

export async function createAuthenticatedServerSupabaseClient() {
  const environment = readSupabaseServerEnvironment();
  const cookieStore = await cookies();

  return createServerClient(environment.url, environment.anonymousKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
    },
    cookieOptions: adminAuthCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The narrowly scoped proxy
          // refreshes admin sessions before those components render.
        }
      },
    },
  });
}
