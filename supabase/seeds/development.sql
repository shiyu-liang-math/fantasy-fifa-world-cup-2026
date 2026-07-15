-- FICTIONAL DEVELOPMENT DATA ONLY.
-- Apply manually after the stable seed. This file is intentionally excluded
-- from supabase/config.toml and must never be used as a production seed.

begin;

insert into public.group_memberships (
  tournament_id, group_code, country_id, display_order
) values
  ('fifa-world-cup-2026', 'A', 'france', 1),
  ('fifa-world-cup-2026', 'A', 'spain', 2),
  ('fifa-world-cup-2026', 'A', 'portugal', 3),
  ('fifa-world-cup-2026', 'A', 'argentina', 4),
  ('fifa-world-cup-2026', 'B', 'brazil', 1),
  ('fifa-world-cup-2026', 'B', 'germany', 2),
  ('fifa-world-cup-2026', 'B', 'england', 3),
  ('fifa-world-cup-2026', 'B', 'mexico', 4),
  ('fifa-world-cup-2026', 'C', 'japan', 1);

insert into public.matches (
  tournament_id, id, round_id, stage, match_number, status, scheduled_at,
  home_country_id, away_country_id, home_goals, away_goals,
  went_to_extra_time, home_shootout_goals, away_shootout_goals,
  advancing_country_id, data_classification
) values
  ('fifa-world-cup-2026', 'dev-group-win', 'group', 'group', 1001, 'completed', null,
    'france', 'spain', 2, 1, false, null, null, null, 'fictional_development'),
  ('fifa-world-cup-2026', 'dev-group-draw', 'group', 'group', 1002, 'completed', null,
    'portugal', 'argentina', 1, 1, false, null, null, null, 'fictional_development'),
  ('fifa-world-cup-2026', 'dev-r32-shootout', 'round-of-32', 'round_of_32', 1033, 'completed', null,
    'brazil', 'germany', 1, 1, true, 5, 4, 'brazil', 'fictional_development'),
  ('fifa-world-cup-2026', 'dev-r32-scheduled', 'round-of-32', 'round_of_32', 1034, 'scheduled', '2026-07-01T18:00:00.000Z',
    'mexico', 'japan', null, null, false, null, null, null, 'fictional_development'),
  ('fifa-world-cup-2026', 'dev-qf-unresolved', 'quarterfinal', 'quarterfinal', 1060, 'scheduled', '2026-07-05T18:00:00.000Z',
    null, null, null, null, false, null, null, null, 'fictional_development'),
  ('fifa-world-cup-2026', 'dev-semifinal-one', 'semifinal', 'semifinal', 1069, 'completed', null,
    'france', 'argentina', 2, 0, false, null, null, 'france', 'fictional_development'),
  ('fifa-world-cup-2026', 'dev-semifinal-two', 'semifinal', 'semifinal', 1070, 'completed', null,
    'spain', 'portugal', 1, 0, false, null, null, 'spain', 'fictional_development'),
  ('fifa-world-cup-2026', 'dev-third-place', 'third-place', 'third_place', 1071, 'completed', null,
    'argentina', 'portugal', 1, 2, false, null, null, 'portugal', 'fictional_development'),
  ('fifa-world-cup-2026', 'dev-final', 'final', 'final', 1072, 'completed', null,
    'france', 'spain', 3, 2, false, null, null, 'france', 'fictional_development');

insert into public.match_source_slots (
  tournament_id, match_id, slot, source_match_id, outcome
) values
  ('fifa-world-cup-2026', 'dev-qf-unresolved', 'home', 'dev-r32-shootout', 'winner'),
  ('fifa-world-cup-2026', 'dev-qf-unresolved', 'away', 'dev-r32-scheduled', 'winner');

update public.tournaments
set
  status = 'completed',
  current_round_id = 'final',
  last_updated_at = '2026-07-19T22:00:00.000Z',
  missing_official_data = missing_official_data
    || array['This entire match scenario is fictional development data']
where id = 'fifa-world-cup-2026';

commit;
