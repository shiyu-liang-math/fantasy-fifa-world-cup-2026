import type { CookieOptionsWithName } from "@supabase/ssr";

export function adminAuthCookieOptions(): CookieOptionsWithName {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
