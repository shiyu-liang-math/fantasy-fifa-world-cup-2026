import type { TournamentDataSnapshot } from "../data/types";

export function snapshotPayload(snapshot: TournamentDataSnapshot) {
  if (snapshot.tournament === null) {
    return {
      tournament: null,
      participants: [],
      countries: [],
      rounds: [],
      groups: [],
      group_memberships: [],
      draft_picks: [],
      matches: [],
      match_source_slots: [],
      group_override_sets: [],
      group_override_entries: [],
      dataset_kind: snapshot.datasetKind,
    };
  }
  const { tournament, rules } = snapshot;
  const sets = new Map(
    snapshot.groupOverrides.map((override) => [
      override.setId ?? override.id,
      {
        id: override.setId ?? override.id,
        tournament_id: override.tournamentId,
        group_code: override.groupCode,
        reason: override.reason,
        source: override.source,
      },
    ]),
  );
  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      year: tournament.year,
      status: tournament.status,
      current_round_id: tournament.currentRoundId,
      last_updated_at: tournament.lastUpdatedAt,
      reference_data_complete: tournament.referenceDataComplete,
      missing_official_data: tournament.missingOfficialData,
      rules_version: rules.version,
      rules_updated_at: rules.updatedAt,
      golden_goal_includes_group_stage: rules.goldenGoalIncludesGroupStage,
      shootout_kicks_excluded: rules.shootoutKicksExcluded,
      ranking_method: rules.rankingMethod,
      star_ranking_tolerance: rules.starRankingTolerance,
    },
    participants: snapshot.participants.map((participant) => ({
      id: participant.id,
      slug: participant.slug,
      name: participant.name,
      abbreviation: participant.abbreviation,
      display_order: participant.displayOrder,
    })),
    countries: snapshot.countries.map((country) => ({
      id: country.id,
      name: country.name,
      fifa_code: country.fifaCode,
    })),
    rounds: snapshot.rounds.map((round) => ({
      id: round.id,
      tournament_id: round.tournamentId,
      stage: round.stage,
      name: round.name,
      phase: round.phase,
      display_order: round.displayOrder,
    })),
    groups: snapshot.groups.map((group) => ({
      tournament_id: group.tournamentId,
      code: group.code,
      display_order: group.displayOrder,
    })),
    group_memberships: snapshot.groups.flatMap((group) =>
      group.countryIds.map((countryId, index) => ({
        tournament_id: group.tournamentId,
        group_code: group.code,
        country_id: countryId,
        display_order: index + 1,
      })),
    ),
    draft_picks: snapshot.draftPicks.map((pick) => ({
      id: pick.id,
      tournament_id: pick.tournamentId,
      participant_id: pick.participantId,
      country_id: pick.countryId,
      draft_value: pick.draftValue,
    })),
    matches: snapshot.matches.map((match) => ({
      tournament_id: match.tournamentId,
      id: match.id,
      round_id: match.roundId,
      stage: match.stage,
      match_number: match.matchNumber,
      status: match.status,
      scheduled_at: match.scheduledAt,
      home_country_id: match.homeCountryId,
      away_country_id: match.awayCountryId,
      home_goals: match.homeGoals,
      away_goals: match.awayGoals,
      went_to_extra_time: match.wentToExtraTime,
      home_shootout_goals: match.homeShootoutGoals,
      away_shootout_goals: match.awayShootoutGoals,
      advancing_country_id: match.advancingCountryId,
      data_classification: match.dataClassification,
    })),
    match_source_slots: snapshot.matches.flatMap((match) =>
      (["home", "away"] as const).flatMap((slot) => {
        const source =
          slot === "home" ? match.homeSourceSlot : match.awaySourceSlot;
        return source === null
          ? []
          : [
              {
                tournament_id: match.tournamentId,
                match_id: match.id,
                slot,
                source_match_id: source.sourceMatchId,
                outcome: source.outcome,
              },
            ];
      }),
    ),
    group_override_sets: [...sets.values()],
    group_override_entries: snapshot.groupOverrides.map((override) => ({
      override_set_id: override.setId ?? override.id,
      tournament_id: override.tournamentId,
      group_code: override.groupCode,
      country_id: override.countryId,
      official_rank: override.officialRank ?? null,
      qualified_for_round_of_32: override.qualifiedForRoundOf32 ?? null,
    })),
    dataset_kind: snapshot.datasetKind,
  };
}
