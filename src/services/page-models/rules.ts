import { calculateCountryStars } from "../../domain/scoring";
import type { CountryResult } from "../../domain/types";
import type { TournamentRepository } from "../../repositories/tournament-repository";
import {
  loadPageContext,
  passthroughContextFailure,
  resultForContext,
} from "./shared";
import type { PageModelResult, RulesPageModel } from "./types";

const STAR_STAGE_LABELS: readonly Readonly<{
  result: CountryResult;
  label: string;
}>[] = [
  { result: "before_round_of_32", label: "Before Round of 32" },
  { result: "round_of_32", label: "Round of 32" },
  { result: "round_of_16", label: "Round of 16" },
  { result: "quarterfinal", label: "Quarterfinal" },
  { result: "semifinal", label: "Semifinal / final 4" },
  { result: "fourth_place", label: "Fourth place" },
  { result: "third_place", label: "Third place" },
  { result: "runner_up", label: "Runner-up" },
  { result: "champion", label: "Champion" },
];

export async function getRulesPageModel(
  repository: TournamentRepository,
): Promise<PageModelResult<RulesPageModel>> {
  const loaded = await loadPageContext(repository);
  if (loaded.status !== "ok") return passthroughContextFailure(loaded);

  const { rules } = loaded.context.snapshot;
  const data: RulesPageModel = {
    version: rules.version,
    updatedAt: rules.updatedAt,
    draftValues: [1, 2, 3],
    draftValueExplanation:
      "Every drafted country has a value of 1, 2, or 3 that multiplies its Golden Star result.",
    starStages: STAR_STAGE_LABELS.map(({ result, label }) => ({
      result,
      label,
      valueOneStars: calculateCountryStars(1, result),
    })),
    goldenGoal: {
      includesGroupStage: rules.goldenGoalIncludesGroupStage,
      shootoutKicksExcluded: rules.shootoutKicksExcluded,
      completedMatchesOnly: true,
    },
    goldenCupRule:
      "The Golden Cup is awarded to the participant who drafted the World Cup champion.",
    rankingMethod: rules.rankingMethod,
    starRankingTolerance: rules.starRankingTolerance,
  };

  return resultForContext(data, loaded.context);
}
