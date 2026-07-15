begin;

select plan(16);

select throws_ok(
  $$insert into public.draft_picks (id, tournament_id, participant_id, country_id, draft_value)
    values ('bad-value', 'fifa-world-cup-2026', 'lyla', 'france', 4)$$,
  '23514', null, 'draft values outside 1, 2, and 3 are rejected'
);
select throws_ok(
  $$insert into public.draft_picks (id, tournament_id, participant_id, country_id, draft_value)
    values ('second-owner', 'fifa-world-cup-2026', 'shiyu', 'france', 1)$$,
  '23505', null, 'a drafted country cannot have a second owner'
);
select throws_ok(
  $$insert into public.countries (id, name, fifa_code) values ('duplicate-fifa', 'Duplicate', 'FRA')$$,
  '23505', null, 'FIFA codes are unique'
);
select throws_ok(
  $$insert into public.countries (id, name, fifa_code) values ('bad-fifa', 'Bad', 'fr')$$,
  '23514', null, 'FIFA codes use exactly three uppercase letters'
);
select throws_ok(
  $$insert into public.matches (
      tournament_id, id, round_id, stage, match_number, status,
      home_country_id, away_country_id, home_goals, away_goals
    ) values (
      'fifa-world-cup-2026', 'negative-score', 'round-of-32', 'round_of_32', 2001,
      'completed', 'france', 'spain', -1, 0
    )$$,
  '23514', null, 'negative scores are rejected'
);
select throws_ok(
  $$insert into public.matches (
      tournament_id, id, round_id, stage, match_number, status,
      home_country_id, away_country_id, home_goals, away_goals
    ) values (
      'fifa-world-cup-2026', 'same-country', 'round-of-32', 'round_of_32', 2002,
      'completed', 'france', 'france', 1, 0
    )$$,
  '23514', null, 'home and away countries must differ'
);
select throws_ok(
  $$insert into public.matches (
      tournament_id, id, round_id, stage, match_number, status,
      home_country_id, away_country_id, home_goals, away_goals
    ) values (
      'fifa-world-cup-2026', 'incomplete-score', 'round-of-32', 'round_of_32', 2003,
      'completed', 'france', 'spain', 1, null
    )$$,
  '23514', null, 'official scores must be complete pairs'
);
select throws_ok(
  $$insert into public.matches (
      tournament_id, id, round_id, stage, match_number, status,
      home_country_id, away_country_id, home_goals, away_goals
    ) values (
      'fifa-world-cup-2026', 'scheduled-score', 'round-of-32', 'round_of_32', 2004,
      'scheduled', 'france', 'spain', 1, 0
    )$$,
  '23514', null, 'scheduled matches cannot contain result fields'
);
select throws_ok(
  $$insert into public.matches (
      tournament_id, id, round_id, stage, match_number, status,
      home_country_id, away_country_id, home_goals, away_goals,
      went_to_extra_time, home_shootout_goals
    ) values (
      'fifa-world-cup-2026', 'incomplete-shootout', 'round-of-32', 'round_of_32', 2005,
      'completed', 'france', 'spain', 1, 1, true, 5
    )$$,
  '23514', null, 'shootout scores must be complete pairs'
);
select throws_ok(
  $$insert into public.matches (
      tournament_id, id, round_id, stage, match_number, status,
      home_country_id, away_country_id, home_goals, away_goals,
      went_to_extra_time, home_shootout_goals, away_shootout_goals
    ) values (
      'fifa-world-cup-2026', 'tied-shootout', 'round-of-32', 'round_of_32', 2006,
      'completed', 'france', 'spain', 1, 1, true, 4, 4
    )$$,
  '23514', null, 'shootouts cannot finish tied'
);
select throws_ok(
  $$insert into public.matches (
      tournament_id, id, round_id, stage, match_number, status,
      home_country_id, away_country_id, home_goals, away_goals,
      went_to_extra_time, home_shootout_goals, away_shootout_goals
    ) values (
      'fifa-world-cup-2026', 'shootout-no-et', 'round-of-32', 'round_of_32', 2007,
      'completed', 'france', 'spain', 1, 1, false, 5, 4
    )$$,
  '23514', null, 'shootouts require extra time'
);
select throws_ok(
  $$insert into public.matches (
      tournament_id, id, round_id, stage, match_number, status,
      home_country_id, away_country_id, data_classification
    ) values (
      'fifa-world-cup-2026', 'bad-classification', 'round-of-32', 'round_of_32', 2008,
      'scheduled', 'france', 'spain', 'preview'
    )$$,
  '23514', null, 'match data classification matches the TypeScript literal union'
);

insert into public.tournaments (
  id, name, year, status, last_updated_at, reference_data_complete,
  missing_official_data, rules_version, rules_updated_at,
  golden_goal_includes_group_stage, shootout_kicks_excluded,
  ranking_method, star_ranking_tolerance
) values (
  'other-tournament', 'Other Tournament', 2026, 'planned', now(), false,
  array['Test-only incomplete tournament'], 'test', current_date,
  true, true, 'standard_competition', 0.01
);
insert into public.tournament_rounds (
  tournament_id, id, stage, name, phase, display_order
) values ('other-tournament', 'other-group', 'group', 'Other group', 'group', 1);
insert into public.tournament_groups (tournament_id, code, display_order)
  values ('other-tournament', 'A', 1);
insert into public.group_memberships (tournament_id, group_code, country_id, display_order)
  values ('other-tournament', 'A', 'france', 1);

update public.tournaments
set current_round_id = 'other-group'
where id = 'fifa-world-cup-2026';
select throws_ok(
  $$set constraints tournaments_current_round_same_tournament_fk immediate$$,
  '23503', null, 'current round must belong to the same tournament'
);
update public.tournaments
set current_round_id = 'group'
where id = 'fifa-world-cup-2026';
select throws_ok(
  $$insert into public.matches (
      tournament_id, id, round_id, stage, match_number, status,
      home_country_id, away_country_id
    ) values (
      'fifa-world-cup-2026', 'wrong-round-context', 'other-group', 'group', 2010,
      'scheduled', 'france', 'spain'
    )$$,
  '23503', null, 'a match round must belong to the same tournament'
);

insert into public.matches (
  tournament_id, id, round_id, stage, match_number, status,
  home_country_id, away_country_id
) values
  ('fifa-world-cup-2026', 'source-target', 'quarterfinal', 'quarterfinal', 2011, 'scheduled', null, null),
  ('other-tournament', 'other-source', 'other-group', 'group', 2012, 'scheduled', 'france', 'spain');

select throws_ok(
  $$insert into public.match_source_slots (
      tournament_id, match_id, slot, source_match_id, outcome
    ) values ('fifa-world-cup-2026', 'source-target', 'home', 'other-source', 'winner')$$,
  '23503', null, 'source and target matches must share a tournament'
);

insert into public.group_memberships (tournament_id, group_code, country_id, display_order)
  values ('fifa-world-cup-2026', 'A', 'spain', 1);
insert into public.group_override_sets (id, tournament_id, group_code, reason, source)
  values ('official-a', 'fifa-world-cup-2026', 'A', 'Official test order', 'FIFA');
insert into public.group_override_entries (
  override_set_id, tournament_id, group_code, country_id, qualified_for_round_of_32
) values ('official-a', 'fifa-world-cup-2026', 'A', 'spain', true);

select throws_ok(
  $$insert into public.group_override_entries (
      override_set_id, tournament_id, group_code, country_id, qualified_for_round_of_32
    ) values ('official-a', 'other-tournament', 'A', 'france', true)$$,
  '23503', null, 'override entries must match their exact set, tournament, and group'
);

select * from finish();
rollback;
