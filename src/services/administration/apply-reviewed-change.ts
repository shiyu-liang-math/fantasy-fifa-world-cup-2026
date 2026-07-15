import "server-only";

import { readAdministrationPreviewEnvironment } from "../../config/server-environment-runtime";
import {
  SupabaseAdministrationRepository,
  AdministrationRepositoryError,
  type AdministrationApplyResult,
  type AdministrationRpcClient,
} from "../../repositories/supabase-administration-repository";
import {
  parseAdministrationReviewEnvelope,
  verifyAdministrationReview,
} from "./review-envelope";

/**
 * The sole server orchestration boundary for a reviewed administration write.
 * Callers supply neither tournament state nor commands; both come from the
 * strictly parsed review and a freshly loaded authenticated database context.
 */
export async function applyReviewedAdministrationChange(
  client: AdministrationRpcClient,
  serializedReview: unknown,
): Promise<AdministrationApplyResult> {
  const parsed = parseAdministrationReviewEnvelope(serializedReview);
  const repository = new SupabaseAdministrationRepository(client);
  const context = await repository.getContext(parsed.tournamentId);
  if (
    context.tournamentId !== parsed.tournamentId ||
    context.snapshot.tournament?.id !== parsed.tournamentId
  ) {
    throw new AdministrationRepositoryError("internal");
  }

  const { signingSecret } = readAdministrationPreviewEnvironment();
  const verified = verifyAdministrationReview({
    serialized: parsed,
    signingSecret,
    currentSnapshot: context.snapshot,
    currentDatabaseRevision: context.revision,
  });

  return repository.apply({
    tournamentId: verified.envelope.tournamentId,
    expectedRevision: verified.envelope.baseRevision,
    changeSetId: verified.envelope.changeSetId,
    commands: verified.recomputedProposal.commands,
    reviewFingerprint: verified.envelope.signature,
  });
}
