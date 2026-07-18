"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";

import { readAdministrationPreviewEnvironment } from "@/config/server-environment-runtime";
import { CANONICAL_TOURNAMENT_ID } from "@/config/tournament";
import { createAuthenticatedServerSupabaseClient } from "@/lib/supabase/auth-server";
import { TOURNAMENT_CACHE_TAG } from "@/repositories/public-tournament-repository";
import { AdministrationAccessError } from "@/services/administration/admin-access";
import { validateAuthenticatedAdministrator } from "@/services/administration/admin-access";
import {
  applyResultReview,
  isConcurrentResultRejection,
  prepareResultReview,
  ResultEntryValidationError,
  type ResultEntryFields,
} from "@/services/administration/result-entry";
import { AdministrationReviewError } from "@/services/administration/review-envelope";
import {
  ADMINISTRATION_REVIEW_COOKIE_NAME,
  AdministrationReviewCookieError,
  assertAdministrationReviewCookieFits,
  administrationReviewCookieOptions,
  decryptAdministrationReviewCookie,
  encryptAdministrationReviewCookie,
} from "@/services/administration/review-cookie";
import { parseAdministrationReviewEnvelope } from "@/services/administration/review-envelope";
import { AdministrationRepositoryError } from "@/repositories/supabase-administration-repository";
import type { ApplyActionState, PreviewActionState } from "./action-state";

export async function previewResultAction(
  _previous: PreviewActionState,
  formData: FormData,
): Promise<PreviewActionState> {
  const matchId = formString(formData, "matchId");
  if (matchId === "") {
    return { status: "error", message: "The selected fixture is invalid." };
  }
  const fields: ResultEntryFields = {
    matchId,
    homeGoals: formString(formData, "homeGoals"),
    awayGoals: formString(formData, "awayGoals"),
    wentToExtraTime: formData.get("wentToExtraTime") === "on",
    homeShootoutGoals: formString(formData, "homeShootoutGoals"),
    awayShootoutGoals: formString(formData, "awayShootoutGoals"),
    advancingCountryId: formString(formData, "advancingCountryId"),
    correctionReason: formString(formData, "correctionReason"),
  };

  try {
    const client = await createAuthenticatedServerSupabaseClient();
    const { signingSecret } = readAdministrationPreviewEnvironment();
    const authenticatedUserId =
      await validateAuthenticatedAdministrator(client);
    const prepared = await prepareResultReview({
      client,
      tournamentId: CANONICAL_TOURNAMENT_ID,
      fields,
      signingSecret,
    });
    const { serializedReview, ...review } = prepared;
    const encryptedReview = encryptAdministrationReviewCookie(
      serializedReview,
      authenticatedUserId,
      signingSecret,
    );
    assertAdministrationReviewCookieFits(encryptedReview, review.expiresAt);
    const cookieStore = await cookies();
    cookieStore.set(
      ADMINISTRATION_REVIEW_COOKIE_NAME,
      encryptedReview,
      administrationReviewCookieOptions(review.expiresAt),
    );
    return { status: "ready", review };
  } catch (error) {
    if (error instanceof ResultEntryValidationError) {
      return {
        status: "error",
        message: error.message,
        fieldErrors: error.fieldErrors,
        issues: error.issues,
      };
    }
    if (error instanceof AdministrationReviewCookieError) {
      return {
        status: "error",
        message:
          "This review is too large to store safely. Shorten the correction reason and preview it again.",
      };
    }
    if (error instanceof AdministrationAccessError) {
      return {
        status: "error",
        message:
          error.kind === "unauthenticated"
            ? "Your administrator session has expired. Sign in again."
            : error.kind === "forbidden"
              ? "This account does not have administrator access."
              : "Administration is temporarily unavailable.",
      };
    }
    return {
      status: "error",
      message: "Administration is temporarily unavailable.",
    };
  }
}

export async function applyResultAction(
  _previous: ApplyActionState,
  formData: FormData,
): Promise<ApplyActionState> {
  const reviewId = formData.get("reviewId");
  if (typeof reviewId !== "string" || reviewId === "") {
    return {
      status: "error",
      discardReview: true,
      message: "The review is missing or malformed. Preview the result again.",
    };
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      reviewId,
    )
  ) {
    return {
      status: "error",
      discardReview: true,
      message: "The review is missing or malformed. Preview the result again.",
    };
  }
  const cookieStore = await cookies();
  const encryptedReview = cookieStore.get(
    ADMINISTRATION_REVIEW_COOKIE_NAME,
  )?.value;
  if (!encryptedReview) {
    return {
      status: "error",
      discardReview: true,
      message:
        "The review expired or is unavailable. Preview the result again.",
    };
  }
  let serializedReview: string;
  try {
    const client = await createAuthenticatedServerSupabaseClient();
    const authenticatedUserId =
      await validateAuthenticatedAdministrator(client);
    const { signingSecret } = readAdministrationPreviewEnvironment();
    serializedReview = decryptAdministrationReviewCookie(
      encryptedReview,
      authenticatedUserId,
      signingSecret,
    );
    const storedReview = parseAdministrationReviewEnvelope(serializedReview);
    if (storedReview.changeSetId !== reviewId) {
      return {
        status: "error",
        discardReview: true,
        message:
          "A newer preview replaced this review. Return to that preview or prepare this result again.",
      };
    }
  } catch (error) {
    if (error instanceof AdministrationAccessError) {
      cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
      return {
        status: "error",
        discardReview: true,
        message:
          error.kind === "unauthenticated"
            ? "Your administrator session has expired. Sign in again."
            : error.kind === "forbidden"
              ? "This account does not have administrator access."
              : "Administration is temporarily unavailable.",
      };
    }
    cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
    return {
      status: "error",
      discardReview: true,
      message: "This review is invalid. Preview the result again.",
    };
  }
  try {
    const client = await createAuthenticatedServerSupabaseClient();
    const result = await applyResultReview({
      client,
      tournamentId: CANONICAL_TOURNAMENT_ID,
      serializedReview,
    });
    if (result.status === "applied" || result.status === "already_applied") {
      cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
      updateTag(TOURNAMENT_CACHE_TAG);
      return {
        status: "success",
        revision: result.revision,
        message:
          result.status === "already_applied"
            ? "This reviewed result was already applied safely."
            : "The reviewed result was applied successfully.",
      };
    }
    cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
    return {
      status: "error",
      discardReview: true,
      message: "The result was not applied. Preview it again.",
    };
  } catch (error) {
    if (isConcurrentResultRejection(error)) {
      cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
      return {
        status: "error",
        discardReview: true,
        message:
          "Tournament data changed after this review. Reload and preview the result again.",
      };
    }
    if (error instanceof AdministrationReviewError) {
      cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
      return {
        status: "error",
        discardReview: true,
        message:
          error.code === "expired_review"
            ? "This review expired. Preview the result again."
            : "This review is invalid. Preview the result again.",
      };
    }
    if (error instanceof AdministrationAccessError) {
      cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
      return {
        status: "error",
        discardReview: true,
        message:
          error.kind === "unauthenticated"
            ? "Your administrator session has expired. Sign in again."
            : error.kind === "forbidden"
              ? "This account does not have administrator access."
              : "Administration is temporarily unavailable.",
      };
    }
    if (error instanceof AdministrationRepositoryError) {
      if (error.kind !== "internal")
        cookieStore.delete(ADMINISTRATION_REVIEW_COOKIE_NAME);
      return {
        status: "error",
        discardReview: error.kind !== "internal",
        message:
          error.kind === "idempotency_conflict" || error.kind === "validation"
            ? "The reviewed result was rejected. Preview it again."
            : "Administration is temporarily unavailable. The result was not confirmed.",
      };
    }
    return {
      status: "error",
      discardReview: false,
      message:
        "The result was not confirmed. You may safely retry this exact reviewed result.",
    };
  }
}

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
