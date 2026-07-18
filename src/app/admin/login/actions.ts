"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { CANONICAL_TOURNAMENT_ID } from "@/config/tournament";
import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/auth-server";
import { getAuthorizedAdministrationContext } from "@/services/administration/admin-access";
import { ADMINISTRATION_REVIEW_COOKIE_NAME } from "@/services/administration/review-cookie";
import type { LoginActionState } from "../action-state";

const GENERIC_LOGIN_FAILURE =
  "Sign-in failed or this account does not have administrator access.";

export async function loginAction(
  _previous: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string" ||
    email.trim() === "" ||
    typeof password !== "string" ||
    password === ""
  ) {
    return { status: "error", message: GENERIC_LOGIN_FAILURE };
  }

  let client: Awaited<
    ReturnType<typeof createAuthenticatedServerSupabaseClient>
  > | null = null;
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
    client = await createAuthenticatedServerSupabaseClient();
    const signIn = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signIn.error !== null) {
      await client.auth.signOut({ scope: "local" });
      return { status: "error", message: GENERIC_LOGIN_FAILURE };
    }
    await getAuthorizedAdministrationContext(client, CANONICAL_TOURNAMENT_ID);
  } catch {
    if (client !== null) {
      try {
        await client.auth.signOut({ scope: "local" });
      } catch {
        // The generic failure below remains safe if cleanup is unavailable.
      }
    }
    return { status: "error", message: GENERIC_LOGIN_FAILURE };
  }
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  try {
    const client = await createAuthenticatedServerSupabaseClient();
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Return to the login route even when remote sign-out is unavailable.
  } finally {
    try {
      const cookieStore = await cookies();
      cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
    } catch {
      // The fixed pending review expires within the signed-review TTL even if
      // response-cookie cleanup is unexpectedly unavailable.
    }
  }
  redirect("/admin/login");
}
