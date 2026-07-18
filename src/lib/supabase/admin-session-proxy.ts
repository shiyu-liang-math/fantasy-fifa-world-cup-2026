import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { readSupabaseServerEnvironment } from "@/config/server-environment-runtime";
import { adminAuthCookieOptions } from "./auth-cookie-options";

export async function refreshAdminSession(request: NextRequest) {
  const environment = readSupabaseServerEnvironment();
  let response = NextResponse.next({ request });
  const client = createServerClient(environment.url, environment.anonymousKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
    },
    cookieOptions: adminAuthCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  // This validates the access token and refreshes it when necessary. Route
  // authorization remains in Server Components and the allowlisted RPC.
  await client.auth.getUser();
  return applyAdminNoStoreHeaders(response);
}

export function applyAdminNoStoreHeaders(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
