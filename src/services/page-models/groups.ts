import {
  calculateGroupStandings,
  rankGroupStandings,
} from "../../domain/group-standings";
import { isCompletedMatch } from "../../domain/match-validation";
import type { GroupQualification } from "../../domain/types";
import type { MatchRecord } from "../../data/types";
import type { TournamentRepository } from "../../repositories/tournament-repository";
import {
  loadPageContext,
  passthroughContextFailure,
  resultForContext,
} from "./shared";
import type {
  GroupsPageModel,
  MatchSummaryModel,
  PageModelResult,
} from "./types";

export async function getGroupsPageModel(
  repository: TournamentRepository,
): Promise<PageModelResult<GroupsPageModel>> {
  const loaded = await loadPageContext(repository);
  if (loaded.status !== "ok") return passthroughContextFailure(loaded);

  const { snapshot } = loaded.context;
  const countriesById = new Map(
    snapshot.countries.map((country) => [country.id, country]),
  );
  const participantsById = new Map(
    snapshot.participants.map((participant) => [participant.id, participant]),
  );
  const picksByCountry = new Map(
    snapshot.draftPicks.map((pick) => [pick.countryId, pick]),
  );
  const qualificationsByCountry = new Map(
    snapshot.groupQualifications.map((qualification) => [
      qualification.countryId,
      qualification,
    ]),
  );

  const groups = snapshot.groups
    .map((group) => {
      const groupCountryIds = new Set(group.countryIds);
      const matches = snapshot.matches.filter(
        (match) =>
          match.stage === "group" &&
          match.homeCountryId !== null &&
          match.awayCountryId !== null &&
          groupCountryIds.has(match.homeCountryId) &&
          groupCountryIds.has(match.awayCountryId),
      );
      const standings = calculateGroupStandings(group.countryIds, matches);
      const overrides = snapshot.groupOverrides
        .filter(({ groupCode }) => groupCode === group.code)
        .map((override) => ({
          countryId: override.countryId,
          officialRank: override.officialRank,
          qualifiedForRoundOf32: override.qualifiedForRoundOf32,
          reason: override.reason,
          source: override.source,
        }));
      const ranked = rankGroupStandings(standings, overrides);

      return {
        code: group.code,
        countries: ranked.flatMap((row) => {
          const country = countriesById.get(row.standing.countryId);
          if (country === undefined) return [];
          const pick = picksByCountry.get(country.id);
          const participant =
            pick === undefined
              ? undefined
              : participantsById.get(pick.participantId);
          const qualification = qualificationForRow(
            row.qualifiedForRoundOf32,
            qualificationsByCountry.get(country.id),
          );

          return [
            {
              countryId: country.id,
              name: country.name,
              fifaCode: country.fifaCode,
              owner:
                participant === undefined
                  ? null
                  : {
                      participantId: participant.id,
                      name: participant.name,
                      abbreviation: participant.abbreviation,
                    },
              standing: row.standing,
              calculatedRank: row.calculatedRank,
              officialRank: row.officialRank,
              qualificationStatus: qualification,
              resolutionSource: row.resolutionSource,
              overrideReason: row.resolutionReason,
            },
          ];
        }),
        completedMatches: matches.filter(isCompletedMatch).map(matchSummary),
        upcomingMatches: matches
          .filter((match) => !isCompletedMatch(match))
          .map(matchSummary),
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code));

  return resultForContext(
    { groups },
    loaded.context,
    groups.every(({ countries }) => countries.length === 0),
  );
}

function qualificationForRow(
  override: boolean | undefined,
  qualification: GroupQualification | undefined,
): "qualified" | "not_qualified" | "unresolved" {
  const resolved = override ?? qualification?.qualifiedForRoundOf32;
  return resolved === undefined
    ? "unresolved"
    : resolved
      ? "qualified"
      : "not_qualified";
}

function matchSummary(match: MatchRecord): MatchSummaryModel {
  return {
    id: match.id,
    matchNumber: match.matchNumber,
    status: match.status,
    homeCountryId: match.homeCountryId,
    awayCountryId: match.awayCountryId,
    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals,
    homeShootoutGoals: match.homeShootoutGoals,
    awayShootoutGoals: match.awayShootoutGoals,
    advancingCountryId: match.advancingCountryId,
    scheduledAt: match.scheduledAt,
  };
}
