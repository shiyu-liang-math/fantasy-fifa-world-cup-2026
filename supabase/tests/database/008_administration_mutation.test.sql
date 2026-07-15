begin;

select plan(61);

update public.tournaments set status = 'planned', current_round_id = 'group', reference_data_complete = false, missing_official_data = array['isolated administration test'];
delete from public.match_source_slots;
delete from public.group_override_entries;
delete from public.group_override_sets;
delete from public.matches;
delete from public.group_memberships;

select has_function('public', 'read_administration_context', array['text'], 'administration context function exists');
select has_function(
  'public', 'apply_administration_change',
  array['text', 'bigint', 'uuid', 'jsonb', 'text'],
  'atomic administration apply function exists'
);
select function_returns('public', 'read_administration_context', array['text'], 'jsonb', 'context returns JSON');
select function_returns(
  'public', 'apply_administration_change',
  array['text', 'bigint', 'uuid', 'jsonb', 'text'],
  'jsonb', 'apply returns JSON'
);
select is((select prosecdef from pg_proc where oid = 'public.read_administration_context(text)'::regprocedure), true, 'context is SECURITY DEFINER');
select is((select prosecdef from pg_proc where oid = 'public.apply_administration_change(text,bigint,uuid,jsonb,text)'::regprocedure), true, 'apply is SECURITY DEFINER');
select is((select provolatile from pg_proc where oid = 'public.read_administration_context(text)'::regprocedure), 's'::"char", 'context is stable');
select is((select provolatile from pg_proc where oid = 'public.apply_administration_change(text,bigint,uuid,jsonb,text)'::regprocedure), 'v'::"char", 'apply is volatile');
select ok((select exists (select 1 from unnest(proconfig) setting where setting like 'search_path=%') from pg_proc where oid = 'public.read_administration_context(text)'::regprocedure), 'context fixes an empty search path');
select ok((select exists (select 1 from unnest(proconfig) setting where setting like 'search_path=%') from pg_proc where oid = 'public.apply_administration_change(text,bigint,uuid,jsonb,text)'::regprocedure), 'apply fixes an empty search path');
select ok(not has_function_privilege('public', 'public.read_administration_context(text)', 'EXECUTE'), 'PUBLIC cannot execute context');
select ok(not has_function_privilege('anon', 'public.read_administration_context(text)', 'EXECUTE'), 'anon cannot execute context');
select ok(has_function_privilege('authenticated', 'public.read_administration_context(text)', 'EXECUTE'), 'authenticated can execute context');
select ok(not has_function_privilege('public', 'public.apply_administration_change(text,bigint,uuid,jsonb,text)', 'EXECUTE'), 'PUBLIC cannot execute apply');
select ok(not has_function_privilege('anon', 'public.apply_administration_change(text,bigint,uuid,jsonb,text)', 'EXECUTE'), 'anon cannot execute apply');
select ok(has_function_privilege('authenticated', 'public.apply_administration_change(text,bigint,uuid,jsonb,text)', 'EXECUTE'), 'authenticated can execute apply');

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok(
  $$select public.read_administration_context('fifa-world-cup-2026')$$,
  'P7401', 'Authentication required.',
  'authenticated role without a user identity cannot read context'
);
select throws_ok(
  $$select public.apply_administration_change('fifa-world-cup-2026', 0, '70000000-0000-4000-8000-000000000000', '[{"type":"remove_group_override","overrideId":"missing"}]', repeat('Z', 43))$$,
  'P7401', 'Authentication required.',
  'authenticated role without a user identity cannot apply changes'
);
reset role;

insert into auth.users (id) values
  ('71111111-1111-4111-8111-111111111111'),
  ('72222222-2222-4222-8222-222222222222');
insert into private.administrator_allowlist (user_id)
values ('72222222-2222-4222-8222-222222222222');

set local role anon;
select throws_ok(
  $$select public.read_administration_context('fifa-world-cup-2026')$$,
  '42501', 'permission denied for function read_administration_context',
  'anonymous context reads are denied'
);
select throws_ok(
  $$select public.apply_administration_change('fifa-world-cup-2026', 0, '70000000-0000-4000-8000-000000000001', '[]', repeat('A', 43))$$,
  '42501', 'permission denied for function apply_administration_change',
  'anonymous apply is denied'
);
reset role;

select set_config('request.jwt.claim.sub', '71111111-1111-4111-8111-111111111111', true);
set local role authenticated;
select throws_ok(
  $$select public.read_administration_context('fifa-world-cup-2026')$$,
  'P7403', 'Administrator access required.',
  'non-allowlisted users cannot read administration context'
);
select throws_ok(
  $$select public.apply_administration_change('fifa-world-cup-2026', 0, '70000000-0000-4000-8000-000000000002', '[{"type":"remove_group_override","overrideId":"missing"}]', repeat('A', 43))$$,
  'P7403', 'Administrator access required.',
  'non-allowlisted users cannot apply changes'
);
reset role;

insert into public.group_memberships (tournament_id, group_code, country_id, display_order) values
  ('fifa-world-cup-2026', 'A', 'france', 1),
  ('fifa-world-cup-2026', 'A', 'spain', 2),
  ('fifa-world-cup-2026', 'A', 'portugal', 3),
  ('fifa-world-cup-2026', 'A', 'argentina', 4);

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select lives_ok(
  $$select public.read_administration_context('fifa-world-cup-2026')$$,
  'allowlisted administrator can read context'
);
select is(
  public.read_administration_context('fifa-world-cup-2026') #>> '{revision}',
  '0', 'context returns the database revision'
);
select is(
  public.read_administration_context('fifa-world-cup-2026') #>> '{snapshot,tournament,id}',
  'fifa-world-cup-2026', 'context returns the canonical snapshot without private data'
);

select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 0, '70000000-0000-4000-8000-000000000010',
    '[{"type":"upsert_fixture","fixture":{"id":"admin-group","roundId":"group","matchNumber":2001,"scheduledAt":"2026-07-20T18:00:00.000Z","homeCountryId":"france","awayCountryId":"spain"}}]',
    repeat('A', 43)
  ) #>> '{status}',
  'applied', 'allowlisted administrator can create a scheduled match'
);
reset role;

select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), 1::bigint, 'successful apply increments revision once');
select is((select status from public.matches where tournament_id = 'fifa-world-cup-2026' and id = 'admin-group'), 'scheduled', 'match creation persists canonical fixture state');
select is((select actor_user_id from private.administration_change_sets where id = '70000000-0000-4000-8000-000000000010'), '72222222-2222-4222-8222-222222222222'::uuid, 'change set captures authenticated actor');
select is((select count(*) from private.audit_log where change_set_id = '70000000-0000-4000-8000-000000000010' and entity_type = 'tournaments' and action = 'update'), 1::bigint, 'tournament revision and timestamp are audited');
select is((select count(*) from private.audit_log where change_set_id = '70000000-0000-4000-8000-000000000010' and entity_type = 'matches' and entity_id = '["fifa-world-cup-2026", "admin-group"]' and action = 'insert' and before_data is null and after_data is not null), 1::bigint, 'match insertion has complete before/after audit shape');

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 0, '70000000-0000-4000-8000-000000000010',
    '[{"type":"upsert_fixture","fixture":{"id":"admin-group","roundId":"group","matchNumber":2001,"scheduledAt":"2026-07-20T18:00:00.000Z","homeCountryId":"france","awayCountryId":"spain"}}]',
    repeat('A', 43)
  ) #>> '{status}',
  'already_applied', 'identical idempotent replay returns original success'
);
reset role;
select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), 1::bigint, 'idempotent replay does not increment revision');

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_administration_change(
    'fifa-world-cup-2026', 0, '70000000-0000-4000-8000-000000000010',
    '[{"type":"remove_group_override","overrideId":"different"}]', repeat('A', 43)
  )$$,
  'P7I01', 'Change-set identifier conflict.',
  'conflicting idempotency-key reuse is rejected'
);
select throws_ok(
  $$select public.apply_administration_change(
    'fifa-world-cup-2026', 0, '70000000-0000-4000-8000-000000000011',
    '[{"type":"remove_group_override","overrideId":"missing"}]', repeat('B', 43)
  )$$,
  'P7S01', 'Tournament revision is stale.',
  'stale expected revision is rejected'
);

select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 1, '70000000-0000-4000-8000-000000000012',
    '[{"type":"record_result","result":{"matchId":"admin-group","homeGoals":2,"awayGoals":1}}]',
    repeat('C', 43)
  ) #>> '{status}',
  'applied', 'completed result entry succeeds'
);
reset role;
select is((select home_goals::text || ':' || away_goals::text from public.matches where id = 'admin-group'), '2:1', 'official result goals persist exactly once');
select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), 2::bigint, 'result entry increments revision once');

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 2, '70000000-0000-4000-8000-000000000013',
    '[{"type":"replace_result","reason":"Official correction","result":{"matchId":"admin-group","homeGoals":0,"awayGoals":1}}]',
    repeat('D', 43)
  ) #>> '{status}',
  'applied', 'completed result correction succeeds'
);
reset role;
select is((select home_goals::text || ':' || away_goals::text from public.matches where id = 'admin-group'), '0:1', 'correction replaces rather than accumulates canonical score');
select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), 3::bigint, 'correction increments revision once');

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 3, '70000000-0000-4000-8000-000000000014',
    '[{"type":"upsert_fixture","fixture":{"id":"admin-shootout","roundId":"round-of-32","matchNumber":2033,"scheduledAt":null,"homeCountryId":"france","awayCountryId":"spain"}},{"type":"record_result","result":{"matchId":"admin-shootout","homeGoals":2,"awayGoals":2,"wentToExtraTime":true,"homeShootoutGoals":5,"awayShootoutGoals":4,"advancingCountryId":"france"}}]',
    repeat('E', 43)
  ) #>> '{status}',
  'applied', 'extra-time shootout result applies atomically'
);
reset role;
select is((select home_goals::text || ':' || away_goals::text from public.matches where id = 'admin-shootout'), '2:2', 'stored official goals exclude shootout kicks');
select is((select home_shootout_goals::text || ':' || away_shootout_goals::text from public.matches where id = 'admin-shootout'), '5:4', 'shootout score remains separate');
select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), 4::bigint, 'shootout batch increments revision once');

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 4, '70000000-0000-4000-8000-000000000015',
    '[{"type":"upsert_fixture","fixture":{"id":"admin-source","roundId":"round-of-32","matchNumber":2034,"scheduledAt":null,"homeCountryId":"portugal","awayCountryId":"argentina"}},{"type":"upsert_fixture","fixture":{"id":"admin-dependent","roundId":"quarterfinal","matchNumber":2060,"scheduledAt":null,"homeCountryId":null,"awayCountryId":"france","homeSourceSlot":{"sourceMatchId":"admin-source","outcome":"winner"}}},{"type":"record_result","result":{"matchId":"admin-source","homeGoals":1,"awayGoals":0,"advancingCountryId":"portugal"}}]',
    repeat('F', 43)
  ) #>> '{status}',
  'applied', 'source result and downstream propagation commit together'
);
reset role;
select is((select home_country_id from public.matches where id = 'admin-dependent'), 'portugal', 'downstream winner source slot is propagated');
select is((select count(*) from private.audit_log where change_set_id = '70000000-0000-4000-8000-000000000015' and entity_type = 'match_source_slots' and action = 'insert'), 1::bigint, 'source-slot insertion is audited');
select is(
  (select count(*) from private.audit_log where change_set_id = '70000000-0000-4000-8000-000000000015'
    and entity_type = 'matches' and entity_id = '["fifa-world-cup-2026", "admin-dependent"]'
    and action = 'insert' and after_data->>'home_country_id' = 'portugal'),
  1::bigint, 'propagated downstream participant is present in the match audit row'
);

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select is(
  public.apply_administration_change(
    'fifa-world-cup-2026', 5, '70000000-0000-4000-8000-000000000016',
    '[{"type":"upsert_fixture","fixture":{"id":"admin-semifinal","roundId":"semifinal","matchNumber":2069,"scheduledAt":null,"homeCountryId":"france","awayCountryId":"spain"}},{"type":"upsert_fixture","fixture":{"id":"admin-third","roundId":"third-place","matchNumber":2071,"scheduledAt":null,"homeCountryId":null,"awayCountryId":"argentina","homeSourceSlot":{"sourceMatchId":"admin-semifinal","outcome":"loser"}}},{"type":"record_result","result":{"matchId":"admin-semifinal","homeGoals":2,"awayGoals":0,"advancingCountryId":"france"}}]',
    repeat('G', 43)
  ) #>> '{status}',
  'applied', 'third-place loser source behavior applies atomically'
);
reset role;
select is((select home_country_id from public.matches where id = 'admin-third'), 'spain', 'third-place slot receives semifinal loser');

insert into public.countries (id, name, fifa_code) values ('not-in-tournament', 'Not in tournament', 'NIT');
select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_administration_change(
    'fifa-world-cup-2026', 6, '70000000-0000-4000-8000-000000000017',
    '[{"type":"upsert_fixture","fixture":{"id":"bad-country","roundId":"round-of-16","matchNumber":2050,"scheduledAt":null,"homeCountryId":"france","awayCountryId":"not-in-tournament"}}]', repeat('H', 43)
  )$$,
  'P7V01', 'Match country does not belong to tournament.',
  'match countries must belong to the tournament'
);
reset role;

select throws_ok(
  $$insert into public.matches (tournament_id, id, round_id, stage, match_number, status, home_country_id, away_country_id, home_goals, away_goals)
    values ('fifa-world-cup-2026', 'bad-live', 'round-of-16', 'round_of_16', 2090, 'live', 'france', 'spain', 1, 0)$$,
  '23514', null, 'live matches cannot store official result fields'
);
select throws_ok(
  $$insert into public.matches (tournament_id, id, round_id, stage, match_number, status, home_country_id, away_country_id, home_goals, away_goals, went_to_extra_time)
    values ('fifa-world-cup-2026', 'bad-group-et', 'group', 'group', 2091, 'completed', 'france', 'spain', 1, 1, true)$$,
  '23514', null, 'group matches cannot use extra time'
);

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_administration_change(
    'fifa-world-cup-2026', 6, '70000000-0000-4000-8000-000000000018',
    '[{"type":"upsert_fixture","fixture":{"id":"rolled-back","roundId":"round-of-16","matchNumber":2051,"scheduledAt":null,"homeCountryId":"france","awayCountryId":"portugal"}},{"type":"record_result","result":{"matchId":"rolled-back","homeGoals":1,"awayGoals":1,"advancingCountryId":"france"}}]', repeat('I', 43)
  )$$,
  'P7V01', 'Invalid knockout shootout.',
  'deferred validation failure rejects the full batch'
);
reset role;
select is((select count(*) from public.matches where id = 'rolled-back'), 0::bigint, 'failed batch leaves no canonical match');
select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), 6::bigint, 'failed batch does not increment revision');
select is((select count(*) from private.administration_change_sets where id = '70000000-0000-4000-8000-000000000018'), 0::bigint, 'failed batch leaves no change set');
select is((select count(*) from private.audit_log where change_set_id = '70000000-0000-4000-8000-000000000018'), 0::bigint, 'failed batch leaves no partial audit rows');

select set_config('request.jwt.claim.sub', '72222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select throws_ok(
  $$insert into public.matches (tournament_id, id, round_id, stage, match_number, status)
    values ('fifa-world-cup-2026', 'direct-admin-write', 'round-of-16', 'round_of_16', 2099, 'scheduled')$$,
  '42501', 'permission denied for table matches',
  'allowlisted administrators still cannot write canonical tables directly'
);
reset role;

select ok(
  not has_table_privilege('authenticated', 'public.matches', 'INSERT,UPDATE,DELETE,TRUNCATE')
  and not has_table_privilege('anon', 'public.matches', 'INSERT,UPDATE,DELETE,TRUNCATE'),
  'default and explicit canonical write privileges remain closed'
);

select * from finish();
rollback;
