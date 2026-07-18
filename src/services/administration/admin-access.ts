import "server-only";

import {
  AdministrationRepositoryError,
  SupabaseAdministrationRepository,
  type AdministrationContext,
  type AdministrationRpcClient,
} from "@/repositories/supabase-administration-repository";

export type AuthenticatedAdministrationClient = AdministrationRpcClient &
  Readonly<{
    auth: Readonly<{
      getUser(): PromiseLike<
        Readonly<{
          data: Readonly<{ user: Readonly<{ id: string }> | null }>;
          error: unknown;
        }>
      >;
    }>;
  }>;

export type AdministrationAccessErrorKind =
  "unauthenticated" | "forbidden" | "unavailable";

export class AdministrationAccessError extends Error {
  readonly kind: AdministrationAccessErrorKind;

  constructor(kind: AdministrationAccessErrorKind) {
    super(
      kind === "unauthenticated"
        ? "Authentication is required."
        : kind === "forbidden"
          ? "Administrator access is required."
          : "Administration is temporarily unavailable.",
    );
    this.name = "AdministrationAccessError";
    this.kind = kind;
  }
}

export async function validateAuthenticatedAdministrator(
  client: AuthenticatedAdministrationClient,
): Promise<string> {
  let response: Awaited<ReturnType<typeof client.auth.getUser>>;
  try {
    response = await client.auth.getUser();
  } catch {
    throw new AdministrationAccessError("unavailable");
  }
  if (response.error !== null || response.data.user === null) {
    throw new AdministrationAccessError("unauthenticated");
  }
  return response.data.user.id;
}

export async function getAuthorizedAdministrationContext(
  client: AuthenticatedAdministrationClient,
  tournamentId: string,
): Promise<AdministrationContext> {
  await validateAuthenticatedAdministrator(client);
  try {
    return await new SupabaseAdministrationRepository(client).getContext(
      tournamentId,
    );
  } catch (error) {
    if (error instanceof AdministrationRepositoryError) {
      if (error.kind === "unauthorized") {
        throw new AdministrationAccessError("unauthenticated");
      }
      if (error.kind === "forbidden") {
        throw new AdministrationAccessError("forbidden");
      }
    }
    throw new AdministrationAccessError("unavailable");
  }
}
