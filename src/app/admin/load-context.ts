import "server-only";

import { CANONICAL_TOURNAMENT_ID } from "@/config/tournament";
import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/auth-server";
import type { AdministrationContext } from "@/repositories/supabase-administration-repository";
import {
  AdministrationAccessError,
  getAuthorizedAdministrationContext,
} from "@/services/administration/admin-access";

export type AdminPageContextResult =
  | Readonly<{ status: "authorized"; context: AdministrationContext }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "unavailable" }>;

export async function loadAdminPageContext(): Promise<AdminPageContextResult> {
  try {
    const client = await createAuthenticatedServerSupabaseClient();
    const context = await getAuthorizedAdministrationContext(
      client,
      CANONICAL_TOURNAMENT_ID,
    );
    return { status: "authorized", context };
  } catch (error) {
    if (error instanceof AdministrationAccessError) {
      return { status: error.kind };
    }
    return { status: "unavailable" };
  }
}
