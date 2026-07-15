begin;

select plan(12);

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
  ('fifa-world-cup-2026', 'B', 'mexico', 4);

insert into public.matches (
  tournament_id, id, round_id, stage, match_number, status,
  home_country_id, away_country_id, home_goals, away_goals,
  went_to_extra_time, home_shootout_goals, away_shootout_goals,
  advancing_country_id
) values
  ('fifa-world-cup-2026', 'valid-group', 'group', 'group', 3001, 'completed',
    'france', 'spain', 2, 1, false, null, null, null),
  ('fifa-world-cup-2026', 'cross-group', 'group', 'group', 3002, 'completed',
    'france', 'brazil', 1, 0, false, null, null, null),
  ('fifa-world-cup-2026', 'group-shootout', 'group', 'group', 3003, 'completed',
    'portugal', 'argentina', 1, 1, true, 5, 4, null),
  ('fifa-world-cup-2026', 'group-advancing', 'group', 'group', 3004, 'completed',
    'brazil', 'germany', 2, 1, false, null, null, 'brazil'),
  ('fifa-world-cup-2026', 'valid-knockout', 'round-of-32', 'round_of_32', 3005, 'completed',
    'france', 'spain', 2, 1, false, null, null, 'france'),
  ('fifa-world-cup-2026', 'missing-advancing', 'round-of-32', 'round_of_32', 3006, 'completed',
    'portugal', 'argentina', 2, 1, false, null, null, null),
  ('fifa-world-cup-2026', 'wrong-winner', 'round-of-32', 'round_of_32', 3007, 'completed',
    'brazil', 'germany', 2, 0, false, null, null, 'germany'),
  ('fifa-world-cup-2026', 'tied-no-shootout', 'round-of-32', 'round_of_32', 3008, 'completed',
    'england', 'mexico', 1, 1, true, null, null, 'england'),
  ('fifa-world-cup-2026', 'source-result', 'round-of-32', 'round_of_32', 3009, 'completed',
    'brazil', 'germany', 1, 1, true, 5, 4, 'brazil'),
  ('fifa-world-cup-2026', 'source-unresolved', 'quarterfinal', 'quarterfinal', 3010, 'scheduled',
    null, null, null, null, false, null, null, null),
  ('fifa-world-cup-2026', 'source-resolved', 'quarterfinal', 'quarterfinal', 3011, 'scheduled',
    'brazil', null, null, null, false, null, null, null),
  ('fifa-world-cup-2026', 'cycle-a', 'round-of-16', 'round_of_16', 3012, 'scheduled',
    null, null, null, null, false, null, null, null),
  ('fifa-world-cup-2026', 'cycle-b', 'quarterfinal', 'quarterfinal', 3013, 'scheduled',
    null, null, null, null, false, null, null, null);

insert into public.match_source_slots (
  tournament_id, match_id, slot, source_match_id, outcome
) values
  ('fifa-world-cup-2026', 'source-unresolved', 'home', 'source-result', 'winner'),
  ('fifa-world-cup-2026', 'source-resolved', 'home', 'source-result', 'winner'),
  ('fifa-world-cup-2026', 'cycle-a', 'home', 'cycle-b', 'winner'),
  ('fifa-world-cup-2026', 'cycle-b', 'home', 'cycle-a', 'winner');

select lives_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'valid-group')$$,
  'a completed group match with same-group countries is valid'
);
select throws_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'cross-group')$$,
  'P0001', 'Group match cross-group countries must belong to the same tournament group.',
  'cross-group fixtures are rejected'
);
select throws_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'group-shootout')$$,
  'P0001', 'Group match group-shootout cannot contain a shootout.',
  'group matches cannot use shootouts'
);
select throws_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'group-advancing')$$,
  'P0001', 'Group match group-advancing cannot identify an advancing country.',
  'group matches cannot identify an advancing country'
);
select lives_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'valid-knockout')$$,
  'a valid completed knockout result passes'
);
select throws_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'missing-advancing')$$,
  'P0001', 'Completed knockout match missing-advancing requires an advancing country.',
  'completed knockout matches require an advancing country'
);
select throws_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'wrong-winner')$$,
  'P0001', 'Advancing country for match wrong-winner did not win the match.',
  'advancing country must match the score winner'
);
select throws_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'tied-no-shootout')$$,
  'P0001', 'Tied knockout match tied-no-shootout requires a shootout winner.',
  'tied knockout matches require a shootout winner'
);
select lives_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'source-unresolved')$$,
  'an unresolved source slot hydrates with a null country'
);
select lives_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'source-resolved')$$,
  'a retained source slot may coexist with its resolved country'
);

update public.matches
set home_country_id = 'germany'
where tournament_id = 'fifa-world-cup-2026' and id = 'source-resolved';
select throws_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'source-resolved')$$,
  'P0001',
  'Resolved home slot for match source-resolved disagrees with source match source-result winner.',
  'resolved source slots must agree with their source outcome'
);
select throws_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'cycle-b')$$,
  'P0001', 'Match-source cycle detected for match cycle-b.',
  'source-slot cycles are rejected'
);

select * from finish();
rollback;
