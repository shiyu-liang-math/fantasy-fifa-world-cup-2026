export type SupabaseServerEnvironment = Readonly<{
  url: string;
  anonymousKey: string;
}>;

export type AdministrationPreviewEnvironment = Readonly<{
  signingSecret: string;
}>;

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

export function parseSupabaseServerEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): SupabaseServerEnvironment {
  const rawUrl = environment.SUPABASE_URL?.trim();
  const anonymousKey = environment.SUPABASE_ANON_KEY?.trim();

  if (!rawUrl) {
    throw new SupabaseConfigurationError("SUPABASE_URL is not configured.");
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SupabaseConfigurationError("SUPABASE_URL must be a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SupabaseConfigurationError(
      "SUPABASE_URL must use HTTP or HTTPS.",
    );
  }
  if (!anonymousKey || !isPublicAnonymousKey(anonymousKey)) {
    throw new SupabaseConfigurationError(
      "SUPABASE_ANON_KEY is not configured or is malformed.",
    );
  }

  return { url: url.toString().replace(/\/$/, ""), anonymousKey };
}

export function parseAdministrationPreviewEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): AdministrationPreviewEnvironment {
  const signingSecret = environment.ADMIN_PREVIEW_SIGNING_SECRET;
  if (
    signingSecret === undefined ||
    Buffer.byteLength(signingSecret, "utf8") < 32
  ) {
    throw new SupabaseConfigurationError(
      "ADMIN_PREVIEW_SIGNING_SECRET must contain at least 32 bytes.",
    );
  }
  return { signingSecret };
}

function isPublicAnonymousKey(key: string): boolean {
  if (key.startsWith("sb_publishable_") && key.length > 25) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const encodedPayload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (encodedPayload.length % 4)) % 4);
    const payload: unknown = JSON.parse(atob(encodedPayload + padding));
    return (
      payload !== null &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      "role" in payload &&
      payload.role === "anon"
    );
  } catch {
    return false;
  }
}
