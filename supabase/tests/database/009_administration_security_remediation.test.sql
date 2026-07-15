begin;

select plan(61);

select is(
  pg_get_userbyid((select proowner from pg_proc where oid = 'public.read_administration_context(text)'::regprocedure)),
  'postgres', 'context function is owned by postgres'
);
select is(
  pg_get_userbyid((select proowner from pg_proc where oid = 'public.apply_administration_change(text,bigint,uuid,jsonb,text)'::regprocedure)),
  'postgres', 'apply function is owned by postgres'
);
select ok(
  not has_function_privilege('public', 'private.validate_administration_commands(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.validate_administration_commands(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.validate_administration_commands(text,jsonb)', 'EXECUTE'),
  'command validator is private to trusted database code'
);
select is(
  pg_get_userbyid((select proowner from pg_proc where oid = 'private.validate_administration_semantics(text,jsonb)'::regprocedure)),
  'postgres', 'semantic validator is owned by postgres'
);
select is(
  (select prosecdef from pg_proc where oid = 'private.validate_administration_semantics(text,jsonb)'::regprocedure),
  false, 'semantic validator is SECURITY INVOKER'
);
select ok(
  (select exists (select 1 from unnest(proconfig) setting where setting = 'search_path=""') from pg_proc where oid = 'private.validate_administration_semantics(text,jsonb)'::regprocedure),
  'semantic validator fixes an empty search path'
);
select ok(
  not has_function_privilege('public', 'private.validate_administration_semantics(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.validate_administration_semantics(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.validate_administration_semantics(text,jsonb)', 'EXECUTE'),
  'semantic validator has no application-role grants'
);
select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'country_belongs_to_tournament', 'jsonb_has_exact_keys',
        'jsonb_nonempty_string', 'jsonb_nullable_string',
        'jsonb_nonnegative_integer', 'jsonb_iso_timestamp_or_null',
        'validate_administration_commands', 'validate_administration_semantics'
      ) and (
        pg_get_userbyid(p.proowner) <> 'postgres' or p.prosecdef
        or not exists (select 1 from unnest(p.proconfig) setting where setting = 'search_path=""')
        or has_function_privilege('public', p.oid, 'EXECUTE')
        or has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ), 'every private command helper has the exact hardened owner, mode, path, and grants'
);

select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"x","roundId":"group","matchNumber":1,"scheduledAt":null,"homeCountryId":null,"awayCountryId":null},"summary":[]}]')$$,
  'P7V01', 'Malformed fixture command.', 'fixture command rejects extra top-level keys'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"record_result","result":{"matchId":"x","homeGoals":1}}]')$$,
  'P7V01', 'Malformed result command.', 'result command rejects missing required fields'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"record_result","result":{"matchId":"x","homeGoals":1,"awayGoals":0},"after":{}}]')$$,
  'P7V01', 'Malformed result command.', 'result command rejects extra fields'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"set_knockout_participants","matchId":"x","homeCountryId":null}]')$$,
  'P7V01', 'Malformed participant command.', 'participant command rejects missing fields'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"set_group_override","override":{"id":"x","groupCode":"A","orderedCountryIds":["a"],"reason":"r","source":"s","summary":[]}}]')$$,
  'P7V01', 'Malformed group override.', 'override rejects extra nested fields'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"remove_group_override","overrideId":1}]')$$,
  'P7V01', 'Malformed group override command.', 'remove override rejects wrong scalar types'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"record_result","result":{"matchId":"x","homeGoals":1.5,"awayGoals":0}}]')$$,
  'P7V01', 'Malformed result command.', 'result rejects floating-point scores'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"record_result","result":{"matchId":"x","homeGoals":2147483648,"awayGoals":0}}]')$$,
  'P7V01', 'Malformed result command.', 'result rejects PostgreSQL integer overflow'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"x","roundId":"group","matchNumber":1,"scheduledAt":null,"homeCountryId":null}}]')$$,
  'P7V01', 'Malformed fixture command.', 'fixture command rejects missing required keys'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"x","roundId":"group","matchNumber":"1","scheduledAt":null,"homeCountryId":null,"awayCountryId":null}}]')$$,
  'P7V01', 'Malformed fixture command.', 'fixture command rejects string numbers'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"x","roundId":"group","matchNumber":1,"scheduledAt":"not-a-time","homeCountryId":null,"awayCountryId":null}}]')$$,
  'P7V01', 'Malformed fixture command.', 'fixture command rejects malformed timestamps'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"x","roundId":"round-of-32","matchNumber":1,"scheduledAt":null,"homeCountryId":null,"awayCountryId":null,"homeSourceSlot":{"sourceMatchId":"source","outcome":"winner","derivedCountryId":"fake"}}}]')$$,
  'P7V01', 'Malformed source slot.', 'source slot rejects fabricated derived fields'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"record_result","result":{"matchId":"x","homeGoals":"1","awayGoals":0}}]')$$,
  'P7V01', 'Malformed result command.', 'result rejects string scores'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"record_result","result":{"matchId":"x","homeGoals":-1,"awayGoals":0}}]')$$,
  'P7V01', 'Malformed result command.', 'result rejects negative scores'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"record_result","result":{"matchId":"x","homeGoals":1,"awayGoals":0,"wentToExtraTime":"false"}}]')$$,
  'P7V01', 'Malformed result command.', 'result rejects string booleans'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"set_knockout_participants","matchId":"x","homeCountryId":1,"awayCountryId":null}]')$$,
  'P7V01', 'Malformed participant command.', 'participant command rejects wrong scalar types'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"set_group_override","override":{"id":"x","groupCode":"A","orderedCountryIds":["a",2,"c","d"],"reason":"r","source":"s"}}]')$$,
  'P7V01', 'Malformed group override.', 'override rejects malformed nested arrays'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"update_tournament_metadata","update":{}}]')$$,
  'P7V01', 'Malformed metadata update.', 'metadata rejects no-op updates'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"update_tournament_metadata","update":{"lastUpdatedAt":"2026-07-14T00:00:00.000Z"}}]')$$,
  'P7V01', 'Malformed metadata update.', 'metadata rejects administrator-supplied lastUpdatedAt'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"upsert_fixture","fixture":{"id":"x","roundId":"group","matchNumber":1,"scheduledAt":null,"homeCountryId":null,"awayCountryId":null}},{"type":"upsert_fixture","fixture":{"id":"x","roundId":"group","matchNumber":2,"scheduledAt":null,"homeCountryId":null,"awayCountryId":null}}]')$$,
  'P7V01', 'Conflicting administration commands.', 'duplicate fixture targets are rejected'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"record_result","result":{"matchId":"x","homeGoals":1,"awayGoals":0}},{"type":"replace_result","reason":"r","result":{"matchId":"x","homeGoals":0,"awayGoals":1}}]')$$,
  'P7V01', 'Conflicting administration commands.', 'record and replacement result conflict is rejected'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"set_knockout_participants","matchId":"x","homeCountryId":null,"awayCountryId":null},{"type":"set_knockout_participants","matchId":"x","homeCountryId":null,"awayCountryId":null}]')$$,
  'P7V01', 'Conflicting administration commands.', 'duplicate participant targets are rejected'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"update_tournament_metadata","update":{"status":"active"}},{"type":"update_tournament_metadata","update":{"currentRoundId":null}}]')$$,
  'P7V01', 'Conflicting administration commands.', 'multiple metadata commands are rejected'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"set_group_override","override":{"id":"a","groupCode":"A","orderedCountryIds":["a","b","c","d"],"reason":"r","source":"s"}},{"type":"set_group_override","override":{"id":"b","groupCode":"A","orderedCountryIds":["a","b","c","d"],"reason":"r","source":"s"}}]')$$,
  'P7V01', 'Conflicting administration commands.', 'multiple override operations for one group are rejected'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"unsupported","before":{}}]')$$,
  'P7V01', 'Unsupported administration command.', 'unknown command and fabricated before-state are rejected'
);

insert into auth.users (id) values
  ('73333333-3333-4333-8333-333333333333'),
  ('74444444-4444-4444-8444-444444444444');
insert into private.administrator_allowlist (user_id) values
  ('73333333-3333-4333-8333-333333333333'),
  ('74444444-4444-4444-8444-444444444444');

create temporary table mutation_clock(before_value timestamptz, applied_value timestamptz);
insert into mutation_clock(before_value)
select last_updated_at from public.tournaments where id = 'fifa-world-cup-2026';

select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 0, '79999999-9999-4999-8999-999999999901',
    '[{"type":"update_tournament_metadata","update":{"status":"active"}}]', repeat('A', 43)
  ) #>> '{status}',
  'applied', 'new change set applies'
);

reset role;
update mutation_clock set applied_value = (select last_updated_at from public.tournaments where id = 'fifa-world-cup-2026');
select ok((select applied_value > before_value from mutation_clock), 'successful mutation advances database-managed lastUpdatedAt');
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"update_tournament_metadata","update":{"status":"active"}}]')$$,
  'P7V01', 'No-op administration command.', 'metadata rejects a semantically unchanged value'
);

select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 0, '79999999-9999-4999-8999-999999999901',
    '[{"type":"update_tournament_metadata","update":{"status":"active"}}]', repeat('A', 43)
  ) #>> '{status}',
  'already_applied', 'identical replay is deterministic'
);
reset role;
select is(
  (select last_updated_at from public.tournaments where id = 'fifa-world-cup-2026'),
  (select applied_value from mutation_clock), 'replay preserves database-managed lastUpdatedAt'
);
select is((select count(*) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999901'), 1::bigint, 'replay adds no second audit history');

select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_administration_change('other-tournament', 0, '79999999-9999-4999-8999-999999999901', '[{"type":"update_tournament_metadata","update":{"status":"active"}}]', repeat('A',43))$$,
  'P7I01', 'Change-set identifier conflict.', 'same UUID against another tournament is deterministic conflict'
);
select throws_ok(
  $$select public.apply_administration_change('fifa-world-cup-2026', 1, '79999999-9999-4999-8999-999999999901', '[{"type":"update_tournament_metadata","update":{"status":"active"}}]', repeat('A',43))$$,
  'P7I01', 'Change-set identifier conflict.', 'same UUID with another expected revision conflicts'
);
select throws_ok(
  $$select public.apply_administration_change('fifa-world-cup-2026', 0, '79999999-9999-4999-8999-999999999901', '[{"type":"update_tournament_metadata","update":{"status":"planned"}}]', repeat('A',43))$$,
  'P7I01', 'Change-set identifier conflict.', 'same UUID with another command conflicts'
);
select throws_ok(
  $$select public.apply_administration_change('fifa-world-cup-2026', 0, '79999999-9999-4999-8999-999999999901', '[{"type":"update_tournament_metadata","update":{"status":"active"}}]', repeat('B',43))$$,
  'P7I01', 'Change-set identifier conflict.', 'same UUID with another review fingerprint conflicts'
);
reset role;

select set_config('request.jwt.claim.sub', '74444444-4444-4444-8444-444444444444', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_administration_change('fifa-world-cup-2026', 0, '79999999-9999-4999-8999-999999999901', '[{"type":"update_tournament_metadata","update":{"status":"active"}}]', repeat('A',43))$$,
  'P7I01', 'Change-set identifier conflict.', 'same UUID from another authorized actor conflicts'
);
reset role;

select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_administration_change('fifa-world-cup-2026', 1, '79999999-9999-4999-8999-999999999902', '[{"type":"update_tournament_metadata","update":{"lastUpdatedAt":"2026-07-14T00:00:00.000Z"}}]', repeat('C',43))$$,
  'P7V01', 'Malformed metadata update.', 'RPC rejects supplied lastUpdatedAt'
);
reset role;
select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), 1::bigint, 'parser failure preserves revision');
select is(
  (select last_updated_at from public.tournaments where id = 'fifa-world-cup-2026'),
  (select applied_value from mutation_clock), 'parser failure preserves lastUpdatedAt'
);

insert into public.countries (id, name, fifa_code) values
  ('y:B:z', 'Delimiter A1', 'DAA'), ('a-two', 'A Two', 'DAB'),
  ('a-three', 'A Three', 'DAC'), ('a-four', 'A Four', 'DAD'),
  ('z', 'Delimiter B1', 'DBA'), ('b-two', 'B Two', 'DBB'),
  ('b-three', 'B Three', 'DBC'), ('b-four', 'B Four', 'DBD');
insert into public.group_memberships (tournament_id, group_code, country_id, display_order) values
  ('fifa-world-cup-2026','A','y:B:z',1), ('fifa-world-cup-2026','A','a-two',2),
  ('fifa-world-cup-2026','A','a-three',3), ('fifa-world-cup-2026','A','a-four',4),
  ('fifa-world-cup-2026','B','z',1), ('fifa-world-cup-2026','B','b-two',2),
  ('fifa-world-cup-2026','B','b-three',3), ('fifa-world-cup-2026','B','b-four',4);
insert into public.matches (
  tournament_id, id, round_id, stage, match_number, status,
  home_country_id, away_country_id, data_classification
) values (
  'fifa-world-cup-2026', 'manual-knockout', 'round-of-32', 'round_of_32', 3000,
  'scheduled', null, null, 'official_reference'
);

select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 1, '79999999-9999-4999-8999-999999999903',
    '[{"type":"set_group_override","override":{"id":"x","groupCode":"A","orderedCountryIds":["y:B:z","a-two","a-three","a-four"],"reason":"Official","source":"FIFA"}},{"type":"set_group_override","override":{"id":"x:A:y","groupCode":"B","orderedCountryIds":["z","b-two","b-three","b-four"],"reason":"Official","source":"FIFA"}}]',
    repeat('D',43)
  ) #>> '{status}', 'applied', 'delimiter-like identifiers apply without collision'
);
reset role;
select is(
  (select count(distinct entity_id) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999903' and entity_type = 'group_override_entries'),
  8::bigint, 'structured JSON-array audit identities are injective for delimiter-like identifiers'
);
select is(
  (select count(*) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999903' and entity_type = 'group_override_sets' and action = 'insert'),
  2::bigint, 'override-set inserts are audited'
);
select throws_ok(
  $$select private.validate_administration_commands('fifa-world-cup-2026', '[{"type":"set_group_override","override":{"id":"new-b","groupCode":"B","orderedCountryIds":["z","b-two","b-three","b-four"],"reason":"r","source":"s"}},{"type":"remove_group_override","overrideId":"x:A:y"}]')$$,
  'P7V01', 'Conflicting administration commands.', 'set-then-remove override conflict is rejected'
);

select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 2, '79999999-9999-4999-8999-999999999904',
    '[{"type":"remove_group_override","overrideId":"x"}]', repeat('E',43)
  ) #>> '{status}', 'applied', 'override removal applies'
);
reset role;
select is(
  (select count(*) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999904' and entity_type = 'group_override_entries' and action = 'delete'),
  4::bigint, 'override-entry deletes are audited'
);
select is(
  (select count(*) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999904' and entity_type = 'group_override_sets' and action = 'delete'),
  1::bigint, 'override-set delete is audited'
);

select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 3, '79999999-9999-4999-8999-999999999905',
    '[{"type":"set_knockout_participants","matchId":"manual-knockout","homeCountryId":"y:B:z","awayCountryId":"z"}]', repeat('F',43)
  ) #>> '{status}', 'applied', 'knockout participant command applies'
);
reset role;
select is(
  (select count(*) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999905' and entity_type = 'matches' and action = 'update'),
  1::bigint, 'knockout participant update is audited'
);

select set_config('request.jwt.claim.sub', '73333333-3333-4333-8333-333333333333', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 4, '79999999-9999-4999-8999-999999999906',
    '[{"type":"replace_group_override","replacedOverrideId":"x:A:y","override":{"id":"replacement:B","groupCode":"B","orderedCountryIds":["z","b-two","b-three","b-four"],"reason":"Corrected","source":"FIFA"}}]', repeat('G',43)
  ) #>> '{status}', 'applied', 'group override replacement applies'
);
reset role;
select is(
  (select count(*) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999906' and entity_type = 'group_override_sets' and action = 'delete'),
  1::bigint, 'replaced override set deletion is audited'
);
select is(
  (select count(*) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999906' and entity_type = 'group_override_sets' and action = 'insert'),
  1::bigint, 'replacement override set insertion is audited'
);
select is(
  (select count(*) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999906' and entity_type = 'group_override_entries' and action = 'delete'),
  4::bigint, 'replacement override entry deletions are audited'
);
select is(
  (select count(*) from private.audit_log where change_set_id = '79999999-9999-4999-8999-999999999906' and entity_type = 'group_override_entries' and action = 'insert'),
  4::bigint, 'replacement override entry insertions are audited'
);

select * from finish();
rollback;
