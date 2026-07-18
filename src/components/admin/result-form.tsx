"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import {
  INITIAL_APPLY_STATE,
  INITIAL_PREVIEW_STATE,
} from "@/app/admin/action-state";
import { applyResultAction, previewResultAction } from "@/app/admin/actions";
import type {
  AdminMatchSummary,
  ResultEntryField,
  ResultReview,
} from "@/services/administration/result-entry";
import { MAXIMUM_CORRECTION_REASON_BYTES } from "@/services/administration/result-entry-constraints";

const inputClassName =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";

export function ResultEntryForm({ match }: { match: AdminMatchSummary }) {
  const [previewState, previewAction, previewPending] = useActionState(
    previewResultAction,
    INITIAL_PREVIEW_STATE,
  );
  const [applyState, applyAction, applyPending] = useActionState(
    applyResultAction,
    INITIAL_APPLY_STATE,
  );
  const statusRef = useRef<HTMLDivElement>(null);
  const review = previewState.status === "ready" ? previewState.review : null;
  const reviewDiscarded =
    applyState.status === "error" && applyState.discardReview;

  useEffect(() => {
    if (previewState.status !== "idle" || applyState.status !== "idle") {
      statusRef.current?.focus();
    }
  }, [previewState.status, applyState.status]);

  if (applyState.status === "success") {
    return (
      <div
        aria-live="polite"
        className="space-y-4 rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950"
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        <h2 className="text-xl font-black">Result saved</h2>
        <p>{applyState.message}</p>
        <p className="text-sm">Tournament revision {applyState.revision}.</p>
        <Link className="font-bold underline" href="/admin">
          Return to administration
        </Link>
      </div>
    );
  }

  if (reviewDiscarded) {
    return (
      <div
        aria-live="assertive"
        className="space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950"
        ref={statusRef}
        role="alert"
        tabIndex={-1}
      >
        <h2 className="text-xl font-black">Fresh preview required</h2>
        <p>{applyState.message}</p>
        <Link
          className="font-bold underline"
          href={`/admin/matches/${match.id}`}
        >
          Reload this fixture
        </Link>
      </div>
    );
  }

  if (review !== null) {
    return (
      <ResultReviewPanel
        applyAction={applyAction}
        applyMessage={
          applyState.status === "error" ? applyState.message : undefined
        }
        applyPending={applyPending}
        matchPath={`/admin/matches/${match.id}`}
        review={review}
        statusRef={statusRef}
      />
    );
  }

  const errors =
    previewState.status === "error" ? (previewState.fieldErrors ?? {}) : {};
  return (
    <form action={previewAction} className="space-y-7" noValidate>
      <input name="matchId" type="hidden" value={match.id} />
      {previewState.status === "error" && (
        <ActionError
          issues={previewState.issues}
          message={previewState.message}
          statusRef={statusRef}
        />
      )}

      <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-lg font-bold">Official score</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreField
            country={match.homeCountryName}
            defaultValue={match.homeGoals}
            error={errors.homeGoals}
            field="homeGoals"
            label="Home score"
          />
          <ScoreField
            country={match.awayCountryName}
            defaultValue={match.awayGoals}
            error={errors.awayGoals}
            field="awayGoals"
            label="Away score"
          />
        </div>
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            className="size-5"
            defaultChecked={match.wentToExtraTime}
            name="wentToExtraTime"
            type="checkbox"
          />
          Score includes extra time
        </label>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-lg font-bold">Penalty shootout</legend>
        <p className="text-sm leading-6 text-slate-600">
          Leave both blank when there was no shootout. Shootout kicks do not
          count toward Golden Goal.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreField
            country={match.homeCountryName}
            defaultValue={match.homeShootoutGoals}
            error={errors.homeShootoutGoals}
            field="homeShootoutGoals"
            label="Home shootout score"
            required={false}
          />
          <ScoreField
            country={match.awayCountryName}
            defaultValue={match.awayShootoutGoals}
            error={errors.awayShootoutGoals}
            field="awayShootoutGoals"
            label="Away shootout score"
            required={false}
          />
        </div>
      </fieldset>

      {match.stage !== "group" && (
        <fieldset
          aria-describedby={
            errors.advancingCountryId ? "advancingCountryId-error" : undefined
          }
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
        >
          <legend className="px-1 text-lg font-bold">Advancing country</legend>
          <AdvancingOption
            countryId={match.homeCountryId}
            countryName={match.homeCountryName}
            defaultCountryId={match.advancingCountryId}
          />
          <AdvancingOption
            countryId={match.awayCountryId}
            countryName={match.awayCountryName}
            defaultCountryId={match.advancingCountryId}
          />
          <FieldError
            error={errors.advancingCountryId}
            field="advancingCountryId"
          />
        </fieldset>
      )}

      {match.status === "completed" && (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <label className="block font-bold" htmlFor="correctionReason">
            Correction reason
          </label>
          <p className="text-sm text-amber-950" id="correctionReason-help">
            A nonblank reason is required when replacing a completed result.
            Keep it to {MAXIMUM_CORRECTION_REASON_BYTES} UTF-8 bytes or fewer.
          </p>
          <textarea
            aria-describedby={`correctionReason-help${errors.correctionReason ? " correctionReason-error" : ""}`}
            aria-invalid={errors.correctionReason ? true : undefined}
            className={`${inputClassName} min-h-28`}
            id="correctionReason"
            maxLength={MAXIMUM_CORRECTION_REASON_BYTES}
            name="correctionReason"
            required
          />
          <FieldError
            error={errors.correctionReason}
            field="correctionReason"
          />
        </div>
      )}

      <button
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-700 px-4 py-3 font-bold text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        disabled={previewPending}
        type="submit"
      >
        {previewPending ? "Preparing review…" : "Preview changes"}
      </button>
    </form>
  );
}

function ResultReviewPanel({
  review,
  applyAction,
  applyPending,
  applyMessage,
  matchPath,
  statusRef,
}: {
  review: ResultReview;
  applyAction: (formData: FormData) => void;
  applyPending: boolean;
  applyMessage?: string;
  matchPath: string;
  statusRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="space-y-6" aria-labelledby="review-title">
      <div
        aria-live="polite"
        className="rounded-xl border border-sky-300 bg-sky-50 p-5 text-sky-950"
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        <h2 className="text-xl font-black" id="review-title">
          Review before applying
        </h2>
        <p className="mt-2 text-sm">
          This signed review expires at {formatTimestamp(review.expiresAt)}.
        </p>
      </div>
      {applyMessage && (
        <div
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-950"
          role="alert"
        >
          {applyMessage}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <MatchStateCard label="Before" match={review.before} />
        <MatchStateCard label="After" match={review.after} />
      </div>
      {review.correctionReason && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h3 className="font-bold">Correction reason</h3>
          <p className="mt-1 leading-7">{review.correctionReason}</p>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">Calculated effects</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {review.summary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Public pages affected:{" "}
          {review.affected.publicPageModelsChanged ? "yes" : "no"}. Awards
          affected: {review.affected.awardsChanged ? "yes" : "no"}.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={applyAction}>
          <input name="reviewId" type="hidden" value={review.reviewId} />
          <button
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-700 px-4 py-3 font-bold text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            disabled={applyPending}
            type="submit"
          >
            {applyPending
              ? "Applying reviewed result…"
              : "Apply reviewed result"}
          </button>
        </form>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 font-bold text-slate-900"
          href={matchPath}
        >
          Edit values
        </Link>
      </div>
    </section>
  );
}

function MatchStateCard({
  label,
  match,
}: {
  label: string;
  match: AdminMatchSummary;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold">{label}</h3>
      <p className="mt-3 text-2xl font-black numeric">
        {match.homeCountryName} {match.homeGoals ?? "—"}–
        {match.awayGoals ?? "—"} {match.awayCountryName}
      </p>
      <p className="mt-2 text-sm text-slate-600">Status: {match.status}</p>
      {match.homeShootoutGoals !== null && match.awayShootoutGoals !== null && (
        <p className="mt-1 text-sm text-slate-600">
          Shootout: {match.homeShootoutGoals}–{match.awayShootoutGoals}
        </p>
      )}
      <p className="mt-1 text-sm text-slate-600">
        Extra time: {match.wentToExtraTime ? "yes" : "no"}
      </p>
    </section>
  );
}

function ScoreField({
  field,
  label,
  country,
  defaultValue,
  error,
  required = true,
}: {
  field: ResultEntryField;
  label: string;
  country: string;
  defaultValue: number | null;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block font-semibold" htmlFor={field}>
        {label}{" "}
        <span className="block text-sm font-normal text-slate-600">
          {country}
        </span>
      </label>
      <input
        aria-describedby={error ? `${field}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className={inputClassName}
        defaultValue={defaultValue ?? ""}
        id={field}
        inputMode="numeric"
        min="0"
        name={field}
        required={required}
        step="1"
        type="number"
      />
      <FieldError error={error} field={field} />
    </div>
  );
}

function AdvancingOption({
  countryId,
  countryName,
  defaultCountryId,
}: {
  countryId: string;
  countryName: string;
  defaultCountryId: string | null;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 font-semibold">
      <input
        className="size-5"
        defaultChecked={defaultCountryId === countryId}
        name="advancingCountryId"
        type="radio"
        value={countryId}
      />
      {countryName}
    </label>
  );
}

function FieldError({
  field,
  error,
}: {
  field: ResultEntryField;
  error?: string;
}) {
  return error ? (
    <p className="text-sm font-semibold text-red-800" id={`${field}-error`}>
      {error}
    </p>
  ) : null;
}

function ActionError({
  message,
  issues,
  statusRef,
}: {
  message?: string;
  issues?: readonly string[];
  statusRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      aria-live="assertive"
      className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-950"
      ref={statusRef}
      role="alert"
      tabIndex={-1}
    >
      <p className="font-bold">{message}</p>
      {issues && issues.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
