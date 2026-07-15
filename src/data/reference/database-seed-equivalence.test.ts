import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { REFERENCE_SNAPSHOT } from "./snapshot";

const databaseIt =
  process.env.npm_lifecycle_event === "test:db-equivalence" ||
  process.env.DATABASE_EQUIVALENCE === "1"
    ? it
    : it.skip;

describe("stable database seed equivalence", () => {
  databaseIt("matches the authoritative TypeScript reference snapshot", () => {
    const output = execFileSync(
      "docker",
      [
        "exec",
        "supabase_db_Fantasy-FIFA-World-Cup-2026",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-At",
        "-c",
        SNAPSHOT_QUERY,
      ],
      { encoding: "utf8" },
    ).trim();

    expect(normalize(JSON.parse(output))).toEqual(
      normalize(structuredClone(REFERENCE_SNAPSHOT)),
    );
  });
});

function normalize(snapshot: typeof REFERENCE_SNAPSHOT) {
  return {
    ...snapshot,
    participants: [...snapshot.participants].sort(
      (left, right) => left.displayOrder - right.displayOrder,
    ),
    countries: [...snapshot.countries].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    draftPicks: [...snapshot.draftPicks].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    rounds: [...snapshot.rounds].sort(
      (left, right) => left.displayOrder - right.displayOrder,
    ),
    groups: [...snapshot.groups]
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((group) => ({ ...group, countryIds: [...group.countryIds] })),
    matches: [...snapshot.matches].sort(
      (left, right) => left.matchNumber - right.matchNumber,
    ),
    groupQualifications: [...snapshot.groupQualifications].sort((left, right) =>
      left.countryId.localeCompare(right.countryId),
    ),
    groupOverrides: [...snapshot.groupOverrides].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}

const SNAPSHOT_QUERY = String.raw`
select jsonb_build_object(
  'tournament', (
    select jsonb_build_object(
      'id', id,
      'name', name,
      'year', year,
      'status', status,
      'currentRoundId', current_round_id,
      'lastUpdatedAt', to_char(
        last_updated_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'referenceDataComplete', reference_data_complete,
      'missingOfficialData', to_jsonb(missing_official_data)
    )
    from public.tournaments
    where id = 'fifa-world-cup-2026'
  ),
  'participants', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'slug', slug,
      'name', name,
      'abbreviation', abbreviation,
      'displayOrder', display_order
    ) order by display_order), '[]'::jsonb)
    from public.participants
  ),
  'countries', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'fifaCode', c.fifa_code,
      'groupCode', m.group_code
    ) order by c.id), '[]'::jsonb)
    from public.countries c
    left join public.group_memberships m
      on m.tournament_id = 'fifa-world-cup-2026' and m.country_id = c.id
  ),
  'draftPicks', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'tournamentId', tournament_id,
      'participantId', participant_id,
      'countryId', country_id,
      'draftValue', draft_value
    ) order by id), '[]'::jsonb)
    from public.draft_picks
    where tournament_id = 'fifa-world-cup-2026'
  ),
  'rounds', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'tournamentId', tournament_id,
      'stage', stage,
      'name', name,
      'phase', phase,
      'displayOrder', display_order
    ) order by display_order), '[]'::jsonb)
    from public.tournament_rounds
    where tournament_id = 'fifa-world-cup-2026'
  ),
  'groups', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'code', g.code,
      'tournamentId', g.tournament_id,
      'displayOrder', g.display_order,
      'countryIds', coalesce((
        select jsonb_agg(m.country_id order by m.display_order)
        from public.group_memberships m
        where m.tournament_id = g.tournament_id and m.group_code = g.code
      ), '[]'::jsonb)
    ) order by g.display_order), '[]'::jsonb)
    from public.tournament_groups g
    where g.tournament_id = 'fifa-world-cup-2026'
  ),
  'matches', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'stage', m.stage,
      'status', m.status,
      'homeCountryId', m.home_country_id,
      'awayCountryId', m.away_country_id,
      'homeGoals', m.home_goals,
      'awayGoals', m.away_goals,
      'wentToExtraTime', m.went_to_extra_time,
      'homeShootoutGoals', m.home_shootout_goals,
      'awayShootoutGoals', m.away_shootout_goals,
      'advancingCountryId', m.advancing_country_id,
      'tournamentId', m.tournament_id,
      'roundId', m.round_id,
      'matchNumber', m.match_number,
      'scheduledAt', case when m.scheduled_at is null then null else to_char(
        m.scheduled_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) end,
      'homeSourceSlot', (
        select jsonb_build_object(
          'sourceMatchId', s.source_match_id,
          'outcome', s.outcome
        )
        from public.match_source_slots s
        where s.tournament_id = m.tournament_id
          and s.match_id = m.id
          and s.slot = 'home'
      ),
      'awaySourceSlot', (
        select jsonb_build_object(
          'sourceMatchId', s.source_match_id,
          'outcome', s.outcome
        )
        from public.match_source_slots s
        where s.tournament_id = m.tournament_id
          and s.match_id = m.id
          and s.slot = 'away'
      ),
      'dataClassification', m.data_classification
    ) order by m.match_number), '[]'::jsonb)
    from public.matches m
    where m.tournament_id = 'fifa-world-cup-2026'
  ),
  'groupQualifications', '[]'::jsonb,
  'groupOverrides', (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', s.id || '-' || e.country_id,
      'setId', s.id,
      'tournamentId', e.tournament_id,
      'groupCode', e.group_code,
      'countryId', e.country_id,
      'officialRank', e.official_rank,
      'qualifiedForRoundOf32', e.qualified_for_round_of_32,
      'reason', s.reason,
      'source', s.source
    )) order by s.id, e.country_id), '[]'::jsonb)
    from public.group_override_entries e
    join public.group_override_sets s
      on (s.id, s.tournament_id, s.group_code) =
         (e.override_set_id, e.tournament_id, e.group_code)
    where e.tournament_id = 'fifa-world-cup-2026'
  ),
  'rules', (
    select jsonb_build_object(
      'version', rules_version,
      'updatedAt', rules_updated_at::text,
      'goldenGoalIncludesGroupStage', golden_goal_includes_group_stage,
      'shootoutKicksExcluded', shootout_kicks_excluded,
      'rankingMethod', ranking_method,
      'starRankingTolerance', star_ranking_tolerance
    )
    from public.tournaments
    where id = 'fifa-world-cup-2026'
  ),
  'datasetKind', 'official_reference'
);
`;
