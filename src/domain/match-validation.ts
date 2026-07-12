import type { DomainMatch, ValidationIssue } from "./types";

export function isCompletedMatch(match: DomainMatch): boolean {
  return match.status === "completed";
}

export function validateMatch(match: DomainMatch): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const isGroupMatch = match.stage === "group";
  const hasHomeShootout = match.homeShootoutGoals !== null;
  const hasAwayShootout = match.awayShootoutGoals !== null;

  validateScore(match.homeGoals, "homeGoals", issues);
  validateScore(match.awayGoals, "awayGoals", issues);
  validateScore(match.homeShootoutGoals, "homeShootoutGoals", issues);
  validateScore(match.awayShootoutGoals, "awayShootoutGoals", issues);

  if (
    match.homeCountryId !== null &&
    match.homeCountryId === match.awayCountryId
  ) {
    issues.push({
      code: "same_country",
      field: "awayCountryId",
      message: "Home and away countries must differ.",
    });
  }

  if (hasHomeShootout !== hasAwayShootout) {
    issues.push({
      code: "incomplete_shootout",
      message: "Both shootout scores must be present or both must be absent.",
    });
  }

  if (
    hasHomeShootout &&
    hasAwayShootout &&
    match.homeShootoutGoals === match.awayShootoutGoals
  ) {
    issues.push({
      code: "tied_shootout",
      message: "A completed shootout cannot finish tied.",
    });
  }

  if ((hasHomeShootout || hasAwayShootout) && !match.wentToExtraTime) {
    issues.push({
      code: "shootout_without_extra_time",
      field: "wentToExtraTime",
      message: "A shootout requires the match to have gone to extra time.",
    });
  }

  if (isGroupMatch && (hasHomeShootout || hasAwayShootout)) {
    issues.push({
      code: "group_shootout",
      message: "Group-stage matches cannot have a shootout.",
    });
  }

  if (isGroupMatch && match.advancingCountryId !== null) {
    issues.push({
      code: "group_advancing_country",
      field: "advancingCountryId",
      message: "Group-stage matches do not identify an advancing country.",
    });
  }

  if (!isCompletedMatch(match)) {
    if (match.advancingCountryId !== null) {
      issues.push({
        code: "advancement_before_completion",
        field: "advancingCountryId",
        message: "Only a completed match can identify an advancing country.",
      });
    }

    return issues;
  }

  if (match.homeCountryId === null) {
    issues.push({
      code: "missing_home_country",
      field: "homeCountryId",
      message: "A completed match requires a home country.",
    });
  }

  if (match.awayCountryId === null) {
    issues.push({
      code: "missing_away_country",
      field: "awayCountryId",
      message: "A completed match requires an away country.",
    });
  }

  if (match.homeGoals === null) {
    issues.push({
      code: "missing_home_goals",
      field: "homeGoals",
      message: "A completed match requires a home score.",
    });
  }

  if (match.awayGoals === null) {
    issues.push({
      code: "missing_away_goals",
      field: "awayGoals",
      message: "A completed match requires an away score.",
    });
  }

  if (!isGroupMatch) {
    if (match.advancingCountryId === null) {
      issues.push({
        code: "missing_advancing_country",
        field: "advancingCountryId",
        message: "A completed knockout match requires an advancing country.",
      });
    } else if (
      match.advancingCountryId !== match.homeCountryId &&
      match.advancingCountryId !== match.awayCountryId
    ) {
      issues.push({
        code: "invalid_advancing_country",
        field: "advancingCountryId",
        message: "The advancing country must belong to the match.",
      });
    }
  }

  return issues;
}

function validateScore(
  score: number | null,
  field: keyof Pick<
    DomainMatch,
    "homeGoals" | "awayGoals" | "homeShootoutGoals" | "awayShootoutGoals"
  >,
  issues: ValidationIssue[],
): void {
  if (score === null) {
    return;
  }

  if (!Number.isInteger(score) || score < 0) {
    issues.push({
      code: "invalid_score",
      field,
      message: "Scores must be non-negative integers.",
    });
  }
}
