import { validateMatch } from "../domain/match-validation";
import type { TournamentDataSnapshot } from "./types";

export type CanonicalDataIssue = Readonly<{
  code: string;
  message: string;
  severity: "error" | "incomplete";
}>;

const VALID_GROUP_CODES = new Set("ABCDEFGHIJKL".split(""));

export function validateCanonicalData(
  snapshot: TournamentDataSnapshot,
): CanonicalDataIssue[] {
  const issues: CanonicalDataIssue[] = [];

  if (snapshot.tournament === null) {
    issues.push(
      error("missing_tournament", "The tournament record is missing."),
    );
    return issues;
  }

  checkUnique(snapshot.participants, "id", "participant_id", issues);
  checkUnique(snapshot.participants, "slug", "participant_slug", issues);
  checkUnique(
    snapshot.participants,
    "abbreviation",
    "participant_abbreviation",
    issues,
  );
  checkUnique(
    snapshot.participants,
    "displayOrder",
    "participant_display_order",
    issues,
  );
  checkUnique(snapshot.countries, "id", "country_id", issues);
  checkUnique(snapshot.countries, "fifaCode", "country_fifa_code", issues);
  checkUnique(snapshot.matches, "id", "match_id", issues);
  checkUnique(snapshot.matches, "matchNumber", "match_number", issues);

  const participantIds = new Set(snapshot.participants.map(({ id }) => id));
  const countryIds = new Set(snapshot.countries.map(({ id }) => id));
  const matchIds = new Set(snapshot.matches.map(({ id }) => id));
  const roundIds = new Set(snapshot.rounds.map(({ id }) => id));
  const draftedCountryIds = new Set<string>();
  const qualifiedCountryIds = new Set<string>();

  for (const country of snapshot.countries) {
    if (
      country.groupCode !== null &&
      !VALID_GROUP_CODES.has(country.groupCode)
    ) {
      issues.push(
        error("invalid_group_code", `${country.id} has an invalid group code.`),
      );
    }
    if (!/^[A-Z]{3}$/.test(country.fifaCode)) {
      issues.push(
        error(
          "invalid_fifa_code",
          `${country.id} requires a three-letter FIFA code.`,
        ),
      );
    }
  }

  for (const pick of snapshot.draftPicks) {
    if (!participantIds.has(pick.participantId)) {
      issues.push(
        error(
          "unknown_pick_participant",
          `${pick.id} references an unknown participant.`,
        ),
      );
    }
    if (!countryIds.has(pick.countryId)) {
      issues.push(
        error(
          "unknown_pick_country",
          `${pick.id} references an unknown country.`,
        ),
      );
    }
    if (draftedCountryIds.has(pick.countryId)) {
      issues.push(
        error(
          "duplicate_country_owner",
          `${pick.countryId} has more than one fantasy owner.`,
        ),
      );
    }
    draftedCountryIds.add(pick.countryId);
    if (
      pick.draftValue !== 1 &&
      pick.draftValue !== 2 &&
      pick.draftValue !== 3
    ) {
      issues.push(
        error("invalid_draft_value", `${pick.id} has an invalid draft value.`),
      );
    }
  }

  for (const group of snapshot.groups) {
    if (!VALID_GROUP_CODES.has(group.code)) {
      issues.push(
        error("invalid_group_code", `Group ${group.code} is invalid.`),
      );
    }
    for (const countryId of group.countryIds) {
      if (!countryIds.has(countryId)) {
        issues.push(
          error(
            "unknown_group_country",
            `Group ${group.code} references ${countryId}.`,
          ),
        );
      }
    }
  }

  for (const qualification of snapshot.groupQualifications) {
    if (!countryIds.has(qualification.countryId)) {
      issues.push(
        error(
          "unknown_qualification_country",
          `Group qualification references unknown country ${qualification.countryId}.`,
        ),
      );
    }
    if (qualifiedCountryIds.has(qualification.countryId)) {
      issues.push(
        error(
          "duplicate_group_qualification",
          `${qualification.countryId} has multiple group qualification records.`,
        ),
      );
    }
    qualifiedCountryIds.add(qualification.countryId);
  }

  for (const override of snapshot.groupOverrides) {
    if (!countryIds.has(override.countryId)) {
      issues.push(
        error(
          "unknown_override_country",
          `${override.id} references unknown country ${override.countryId}.`,
        ),
      );
    }
    if (!VALID_GROUP_CODES.has(override.groupCode)) {
      issues.push(
        error(
          "invalid_override_group",
          `${override.id} references invalid group ${override.groupCode}.`,
        ),
      );
    }
    if (override.reason.trim() === "" || override.source.trim() === "") {
      issues.push(
        error(
          "invalid_group_override",
          `${override.id} requires a reason and source.`,
        ),
      );
    }
  }

  for (const match of snapshot.matches) {
    if (!roundIds.has(match.roundId)) {
      issues.push(
        error(
          "unknown_match_round",
          `${match.id} references an unknown round.`,
        ),
      );
    }
    for (const countryId of [
      match.homeCountryId,
      match.awayCountryId,
      match.advancingCountryId,
    ]) {
      if (countryId !== null && !countryIds.has(countryId)) {
        issues.push(
          error(
            "unknown_match_country",
            `${match.id} references ${countryId}.`,
          ),
        );
      }
    }
    for (const slot of [match.homeSourceSlot, match.awaySourceSlot]) {
      if (slot === null) continue;
      if (slot.outcome !== "winner" && slot.outcome !== "loser") {
        issues.push(
          error(
            "invalid_source_outcome",
            `${match.id} has an invalid source outcome.`,
          ),
        );
      }
      if (!matchIds.has(slot.sourceMatchId)) {
        issues.push(
          error(
            "unknown_source_match",
            `${match.id} references unknown source ${slot.sourceMatchId}.`,
          ),
        );
      }
      if (slot.sourceMatchId === match.id) {
        issues.push(
          error(
            "self_source_match",
            `${match.id} cannot source a slot from itself.`,
          ),
        );
      }
    }
    for (const validationIssue of validateMatch(match)) {
      issues.push(
        error(
          `invalid_match_${validationIssue.code}`,
          `${match.id}: ${validationIssue.message}`,
        ),
      );
    }
  }

  for (const cycle of findSourceCycles(snapshot)) {
    issues.push(
      error(
        "cyclic_source_matches",
        `Match-source cycle detected: ${cycle.join(" -> ")} -> ${cycle[0]}.`,
      ),
    );
  }

  const expectedClassification =
    snapshot.datasetKind === "fictional_development"
      ? "fictional_development"
      : "official_reference";
  if (
    snapshot.matches.some(
      (match) => match.dataClassification !== expectedClassification,
    )
  ) {
    issues.push(
      error(
        "mixed_data_classification",
        "Match data classification does not match its dataset.",
      ),
    );
  }

  if (snapshot.countries.length < 48) {
    issues.push(
      snapshot.tournament.referenceDataComplete
        ? error(
            "false_completeness_claim",
            "A complete tournament must contain all 48 countries.",
          )
        : incomplete(
            "missing_countries",
            `Only ${snapshot.countries.length} of 48 countries are authoritative.`,
          ),
    );
  }

  if (snapshot.groups.some((group) => group.countryIds.length !== 4)) {
    issues.push(
      snapshot.tournament.referenceDataComplete
        ? error(
            "false_group_completeness_claim",
            "A complete tournament must contain four countries in every group.",
          )
        : incomplete(
            "missing_group_assignments",
            "Official group assignments are incomplete.",
          ),
    );
  }

  if (
    !snapshot.tournament.referenceDataComplete &&
    snapshot.tournament.missingOfficialData.length === 0
  ) {
    issues.push(
      error(
        "missing_incompleteness_reasons",
        "An incomplete reference dataset must explain what is missing.",
      ),
    );
  }

  return issues;
}

function findSourceCycles(snapshot: TournamentDataSnapshot): string[][] {
  const matchesById = new Map(
    snapshot.matches.map((match) => [match.id, match]),
  );
  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];
  const reportedCycles = new Set<string>();
  const cycles: string[][] = [];

  const visit = (matchId: string): void => {
    state.set(matchId, "visiting");
    stack.push(matchId);
    const match = matchesById.get(matchId);

    for (const slot of [match?.homeSourceSlot, match?.awaySourceSlot]) {
      const sourceId = slot?.sourceMatchId;
      if (
        sourceId === undefined ||
        sourceId === matchId ||
        !matchesById.has(sourceId)
      ) {
        continue;
      }

      if (state.get(sourceId) === "visiting") {
        const cycle = stack.slice(stack.indexOf(sourceId));
        const key = [...cycle].sort().join("|");
        if (!reportedCycles.has(key)) {
          reportedCycles.add(key);
          cycles.push(cycle);
        }
      } else if (state.get(sourceId) !== "visited") {
        visit(sourceId);
      }
    }

    stack.pop();
    state.set(matchId, "visited");
  };

  for (const match of snapshot.matches) {
    if (state.get(match.id) === undefined) visit(match.id);
  }

  return cycles;
}

function checkUnique<T, K extends keyof T>(
  records: readonly T[],
  key: K,
  label: string,
  issues: CanonicalDataIssue[],
): void {
  const values = new Set<unknown>();
  for (const record of records) {
    const value = record[key];
    if (values.has(value)) {
      issues.push(
        error(`duplicate_${label}`, `Duplicate ${label}: ${String(value)}.`),
      );
    }
    values.add(value);
  }
}

const error = (code: string, message: string): CanonicalDataIssue => ({
  code,
  message,
  severity: "error",
});

const incomplete = (code: string, message: string): CanonicalDataIssue => ({
  code,
  message,
  severity: "incomplete",
});
