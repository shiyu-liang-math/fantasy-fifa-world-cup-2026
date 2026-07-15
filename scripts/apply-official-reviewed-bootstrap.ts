import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import reviewedBundle from "../data/official/fifa-world-cup-2026.reviewed-commands.json";
import { OFFICIAL_TOURNAMENT_SNAPSHOT } from "../src/data/official/snapshot";
import {
  prepareAdministrationUpdate,
  type AdministrationCommand,
} from "../src/domain/admin";
import { SupabaseAdministrationRepository } from "../src/repositories/supabase-administration-repository";
import { applyReviewedAdministrationChange } from "../src/services/administration/apply-reviewed-change";
import { createAdministrationReviewEnvelope } from "../src/services/administration/review-envelope";
import type { TournamentDataSnapshot } from "../src/data/types";

const expectedCutoff = "2026-07-15T05:56:29Z";
const commands = reviewedBundle.commands as readonly AdministrationCommand[];

async function main(): Promise<void> {
  if (process.argv.includes("--validate-only")) {
    const proposal = prepareAdministrationUpdate(
      structuralSnapshot(),
      commands,
    );
    if (!proposal.safeToApply || proposal.proposedSnapshot === null) {
      throw new Error(formatProposalErrors(proposal.errors));
    }
    console.log(
      `Reviewed bootstrap payload is valid (${commands.length} commands; cutoff ${expectedCutoff}).`,
    );
    return;
  }

  if (!process.argv.includes(`--confirm-official-cutoff=${expectedCutoff}`)) {
    throw new Error(
      `Refusing to apply without --confirm-official-cutoff=${expectedCutoff}.`,
    );
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must not be supplied.");
  }

  const url = requiredEnvironment("SUPABASE_URL");
  const anonKey = requiredEnvironment("SUPABASE_ANON_KEY");
  const signingSecret = requiredEnvironment("ADMIN_PREVIEW_SIGNING_SECRET");
  const email = requiredEnvironment("ADMIN_EMAIL");
  const password = requiredEnvironment("ADMIN_PASSWORD");
  const parsedUrl = new URL(url);
  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname.endsWith(".supabase.co") ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== ""
  ) {
    throw new Error(
      "SUPABASE_URL must be a credential-free hosted Supabase URL.",
    );
  }
  if (Buffer.byteLength(signingSecret, "utf8") < 32) {
    throw new Error(
      "ADMIN_PREVIEW_SIGNING_SECRET must contain at least 32 bytes.",
    );
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Administrator sign-in failed.");

    const repository = new SupabaseAdministrationRepository(client);
    const context = await repository.getContext(reviewedBundle.tournamentId);
    const proposal = prepareAdministrationUpdate(context.snapshot, commands);
    if (!proposal.safeToApply || proposal.proposedSnapshot === null) {
      throw new Error(formatProposalErrors(proposal.errors));
    }

    const issuedAt = new Date();
    const review = createAdministrationReviewEnvelope({
      tournamentId: reviewedBundle.tournamentId,
      databaseRevision: context.revision,
      changeSetId: randomUUID(),
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + 10 * 60 * 1000).toISOString(),
      proposal,
      signingSecret,
    });
    const result = await applyReviewedAdministrationChange(client, review);
    console.log(
      JSON.stringify({
        status: result.status,
        tournamentId: result.tournamentId,
        revision: result.revision,
        changeSetId: result.changeSetId,
        officialAsOf: reviewedBundle.officialAsOf,
      }),
    );
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Reviewed bootstrap failed.",
  );
  process.exitCode = 1;
});

function structuralSnapshot(): TournamentDataSnapshot {
  return {
    ...OFFICIAL_TOURNAMENT_SNAPSHOT,
    tournament: {
      ...OFFICIAL_TOURNAMENT_SNAPSHOT.tournament!,
      status: "planned",
      currentRoundId: "group",
      referenceDataComplete: false,
      missingOfficialData: ["Fixtures and results await reviewed apply"],
    },
    matches: [],
    groupQualifications: [],
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function formatProposalErrors(
  errors: readonly Readonly<{ code: string; message: string }>[],
): string {
  if (errors.length === 0) return "Reviewed bootstrap proposal is invalid.";
  return `Reviewed bootstrap proposal is invalid: ${errors
    .map(({ code }) => code)
    .join(", ")}.`;
}
