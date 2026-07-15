begin;

select plan(24);

update public.tournaments set status = 'planned', current_round_id = 'group', reference_data_complete = false, missing_official_data = array['isolated semantic test'];
delete from public.match_source_slots;
delete from public.group_override_entries;
delete from public.group_override_sets;
delete from public.matches;
delete from public.group_memberships;

insert into public.countries (id, name, fifa_code) values
  ('semantic-a1', 'Semantic A1', 'SAA'), ('semantic-a2', 'Semantic A2', 'SAB'),
  ('semantic-a3', 'Semantic A3', 'SAC'), ('semantic-a4', 'Semantic A4', 'SAD'),
  ('semantic-b1', 'Semantic B1', 'SBA'), ('semantic-b2', 'Semantic B2', 'SBB'),
  ('semantic-b3', 'Semantic B3', 'SBC'), ('semantic-b4', 'Semantic B4', 'SBD');
insert into public.group_memberships (tournament_id, group_code, country_id, display_order) values
  ('fifa-world-cup-2026','A','semantic-a1',1), ('fifa-world-cup-2026','A','semantic-a2',2),
  ('fifa-world-cup-2026','A','semantic-a3',3), ('fifa-world-cup-2026','A','semantic-a4',4),
  ('fifa-world-cup-2026','B','semantic-b1',1), ('fifa-world-cup-2026','B','semantic-b2',2),
  ('fifa-world-cup-2026','B','semantic-b3',3), ('fifa-world-cup-2026','B','semantic-b4',4);
insert into public.group_override_sets (id, tournament_id, group_code, reason, source)
values ('semantic-existing', 'fifa-world-cup-2026', 'B', 'Official', 'FIFA');
insert into public.group_override_entries (override_set_id, tournament_id, group_code, country_id, official_rank) values
  ('semantic-existing','fifa-world-cup-2026','B','semantic-b1',1),
  ('semantic-existing','fifa-world-cup-2026','B','semantic-b2',2),
  ('semantic-existing','fifa-world-cup-2026','B','semantic-b3',3),
  ('semantic-existing','fifa-world-cup-2026','B','semantic-b4',4);
insert into public.tournaments (
  id, name, year, status, last_updated_at, reference_data_complete,
  missing_official_data, rules_version, rules_updated_at,
  golden_goal_includes_group_stage, shootout_kicks_excluded,
  ranking_method, star_ranking_tolerance
) values (
  'other-semantic', 'Other Semantic', 2026, 'planned', pg_catalog.now(), false,
  array['test'], 'test', '2026-01-01', true, true,
  'standard_competition', 0.1
);
insert into public.tournament_rounds (tournament_id, id, stage, name, phase, display_order)
values ('other-semantic','other-round','round_of_32','Other round','knockout',1);
insert into public.matches (
  tournament_id, id, round_id, stage, match_number, status,
  home_country_id, away_country_id, data_classification
) values (
  'other-semantic','cross-tournament-source','other-round','round_of_32',1,
  'scheduled','semantic-a1','semantic-b1','official_reference'
);

create temporary table semantic_before as
select t.revision, t.last_updated_at,
  (select count(*) from public.matches) as match_count,
  (select count(*) from private.administration_change_sets) as change_set_count,
  (select count(*) from private.audit_log) as audit_count
from public.tournaments t where t.id = 'fifa-world-cup-2026';

select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"set_group_override","override":{"id":"bad-duplicate","groupCode":"A","orderedCountryIds":["semantic-a1","semantic-a1","semantic-a3","semantic-a4"],"reason":"r","source":"s"}}]')$$,
  'P7V01', 'Incomplete group override.', 'semantic preflight rejects duplicate override countries'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"set_group_override","override":{"id":"bad-missing","groupCode":"A","orderedCountryIds":["semantic-a1","semantic-a2","semantic-a3"],"reason":"r","source":"s"}}]')$$,
  'P7V01', 'Incomplete group override.', 'semantic preflight rejects missing group countries'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"set_group_override","override":{"id":"bad-extra","groupCode":"A","orderedCountryIds":["semantic-a1","semantic-a2","semantic-a3","semantic-a4","semantic-b1"],"reason":"r","source":"s"}}]')$$,
  'P7V01', 'Incomplete group override.', 'semantic preflight rejects extra group countries'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"set_group_override","override":{"id":"bad-group","groupCode":"A","orderedCountryIds":["semantic-a1","semantic-a2","semantic-a3","semantic-b1"],"reason":"r","source":"s"}}]')$$,
  'P7V01', 'Incomplete group override.', 'semantic preflight rejects another-group countries'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"set_group_override","override":{"id":"bad-outside","groupCode":"A","orderedCountryIds":["semantic-a1","semantic-a2","semantic-a3","outside"],"reason":"r","source":"s"}}]')$$,
  'P7V01', 'Incomplete group override.', 'semantic preflight rejects countries outside the tournament'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"replace_group_override","replacedOverrideId":"semantic-existing","override":{"id":"new-same","groupCode":"B","orderedCountryIds":["semantic-b1","semantic-b2","semantic-b3","semantic-b4"],"reason":"Official","source":"FIFA"}}]')$$,
  'P7V01', 'No-op administration command.', 'semantic preflight rejects an identical override replacement'
);

insert into public.matches (
  tournament_id, id, round_id, stage, match_number, status,
  home_country_id, away_country_id, home_goals, away_goals,
  advancing_country_id, data_classification
) values (
  'fifa-world-cup-2026', 'semantic-source', 'round-of-32', 'round_of_32', 3010,
  'completed', 'semantic-a1', 'semantic-b1', 1, 0, 'semantic-a1', 'official_reference'
), (
  'fifa-world-cup-2026', 'semantic-later', 'semifinal', 'semifinal', 3011,
  'scheduled', 'semantic-a1', 'semantic-b1', null, null, null, 'official_reference'
), (
  'fifa-world-cup-2026', 'semantic-dependent', 'quarterfinal', 'quarterfinal', 3012,
  'completed', 'semantic-a1', 'semantic-b2', 1, 0, 'semantic-a1', 'official_reference'
);
insert into public.match_source_slots (tournament_id, match_id, slot, source_match_id, outcome)
values ('fifa-world-cup-2026','semantic-dependent','home','semantic-source','winner');

select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"source-target-a","roundId":"quarterfinal","matchNumber":3020,"scheduledAt":null,"homeCountryId":null,"awayCountryId":"semantic-b1","homeSourceSlot":{"sourceMatchId":"missing-source","outcome":"winner"}}}]')$$,
  'P7V01', 'Unknown source match.', 'semantic preflight rejects nonexistent source matches'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"source-cross","roundId":"quarterfinal","matchNumber":3025,"scheduledAt":null,"homeCountryId":null,"awayCountryId":"semantic-b1","homeSourceSlot":{"sourceMatchId":"cross-tournament-source","outcome":"winner"}}}]')$$,
  'P7V01', 'Unknown source match.', 'semantic preflight rejects a source match from another tournament'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"round-cross","roundId":"other-round","matchNumber":3026,"scheduledAt":null,"homeCountryId":"semantic-a1","awayCountryId":"semantic-b1"}}]')$$,
  'P7V01', 'Unknown tournament round.', 'semantic preflight rejects a round from another tournament'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"self-source","roundId":"quarterfinal","matchNumber":3021,"scheduledAt":null,"homeCountryId":null,"awayCountryId":"semantic-b1","homeSourceSlot":{"sourceMatchId":"self-source","outcome":"winner"}}}]')$$,
  'P7V01', 'Match-source cycle detected.', 'semantic preflight rejects self-source cycles'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"source-target-b","roundId":"quarterfinal","matchNumber":3022,"scheduledAt":null,"homeCountryId":null,"awayCountryId":"semantic-b1","homeSourceSlot":{"sourceMatchId":"semantic-later","outcome":"winner"}}}]')$$,
  'P7V01', 'Source match must be from an earlier round.', 'semantic preflight rejects later-round sources'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"group-source","roundId":"group","matchNumber":3023,"scheduledAt":null,"homeCountryId":"semantic-a1","awayCountryId":"semantic-a2","homeSourceSlot":{"sourceMatchId":"semantic-source","outcome":"winner"}}}]')$$,
  'P7V01', 'Invalid group fixture.', 'semantic preflight rejects source slots on group fixtures'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"source-target-c","roundId":"quarterfinal","matchNumber":3024,"scheduledAt":null,"homeCountryId":"semantic-b1","awayCountryId":"semantic-b2","homeSourceSlot":{"sourceMatchId":"semantic-source","outcome":"winner"}}}]')$$,
  'P7V01', 'Resolved source country disagrees with fixture.', 'semantic preflight rejects an incorrect resolved source country'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"replace_result","reason":"Official correction","result":{"matchId":"semantic-source","homeGoals":0,"awayGoals":1,"advancingCountryId":"semantic-b1"}}]')$$,
  'P7V01', 'Completed downstream result requires atomic replacement.', 'completed downstream conflict is detected before mutation'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"matrix","roundId":"round-of-32","matchNumber":3030,"scheduledAt":null,"homeCountryId":"semantic-a1","awayCountryId":"semantic-b1"}},{"type":"set_knockout_participants","matchId":"matrix","homeCountryId":"semantic-b1","awayCountryId":"semantic-a1"}]')$$,
  'P7V01', 'Conflicting administration commands.', 'fixture-plus-participant is rejected before DML'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"set_knockout_participants","matchId":"matrix","homeCountryId":"semantic-b1","awayCountryId":"semantic-a1"},{"type":"record_result","result":{"matchId":"matrix","homeGoals":1,"awayGoals":0,"advancingCountryId":"semantic-b1"}}]')$$,
  'P7V01', 'Conflicting administration commands.', 'participant-plus-result is rejected before DML'
);
select lives_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"matrix","roundId":"round-of-32","matchNumber":3030,"scheduledAt":null,"homeCountryId":"semantic-a1","awayCountryId":"semantic-b1"}},{"type":"record_result","result":{"matchId":"matrix","homeGoals":1,"awayGoals":0,"advancingCountryId":"semantic-a1"}}]')$$,
  'fixture-plus-result remains an allowed reviewed pair'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"number-one","roundId":"round-of-32","matchNumber":3040,"scheduledAt":null,"homeCountryId":"semantic-a1","awayCountryId":"semantic-b1"}},{"type":"upsert_fixture","fixture":{"id":"number-two","roundId":"round-of-32","matchNumber":3040,"scheduledAt":null,"homeCountryId":"semantic-a2","awayCountryId":"semantic-b2"}}]')$$,
  'P7V01', 'Duplicate match number.', 'projected preflight rejects duplicate match numbers within a batch'
);
select throws_ok(
  $$select private.validate_administration_semantics('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"pair-one","roundId":"group","matchNumber":3041,"scheduledAt":null,"homeCountryId":"semantic-a1","awayCountryId":"semantic-a2"}},{"type":"upsert_fixture","fixture":{"id":"pair-two","roundId":"group","matchNumber":3042,"scheduledAt":null,"homeCountryId":"semantic-a2","awayCountryId":"semantic-a1"}}]')$$,
  'P7V01', 'Duplicate group fixture.', 'projected preflight rejects duplicate group pairs within a batch'
);

select is(
  (select revision from public.tournaments where id = 'fifa-world-cup-2026'),
  (select revision from semantic_before), 'preflight rejections preserve revision'
);
select is(
  (select last_updated_at from public.tournaments where id = 'fifa-world-cup-2026'),
  (select last_updated_at from semantic_before), 'preflight rejections preserve lastUpdatedAt'
);
select is(
  (select count(*) from private.administration_change_sets),
  (select change_set_count from semantic_before), 'preflight rejections create no change set'
);
select is(
  (select count(*) from private.audit_log),
  (select audit_count from semantic_before), 'preflight rejections create no audit rows'
);
select is(
  (select count(*) from public.matches where id in ('source-target-a','self-source','source-target-b','group-source','source-target-c','source-cross','round-cross','matrix','number-one','number-two','pair-one','pair-two')),
  0::bigint, 'preflight validation performs no canonical match DML'
);

select * from finish();
rollback;
