begin;

select plan(17);

update public.tournaments set reference_data_complete = false, missing_official_data = array['isolated audit test'];
delete from public.match_source_slots;
delete from public.group_override_entries;
delete from public.group_override_sets;
delete from public.matches;
delete from public.group_memberships;

select has_trigger(
  'private', 'administration_change_sets', 'administration_change_sets_append_only',
  'change sets have append-only protection'
);
select has_trigger(
  'private', 'audit_log', 'audit_log_append_only',
  'audit entries have append-only protection'
);
select has_trigger(
  'private', 'administration_change_sets', 'administration_change_sets_no_truncate',
  'change sets reject truncation'
);
select has_trigger(
  'private', 'audit_log', 'audit_log_no_truncate',
  'audit entries reject truncation'
);

select lives_ok(
  $$insert into private.administration_change_sets (
      id, tournament_id, actor_user_id, reason, commands,
      base_revision, result_revision
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'fifa-world-cup-2026',
      '33333333-3333-3333-3333-333333333333',
      'Reviewed test change', '[]', 0, 1
    )$$,
  'database transaction infrastructure can create a change set'
);
select lives_ok(
  $$insert into private.audit_log (
      change_set_id, entity_type, entity_id, action,
      before_data, after_data, actor_user_id
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'matches', 'test-match', 'insert', null, '{"id":"test-match"}',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  'database transaction infrastructure can append an audit entry'
);
select throws_ok(
  $$update private.administration_change_sets
    set reason = 'Changed' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'P0001', 'Administration history is append-only.',
  'change sets cannot be updated'
);
select throws_ok(
  $$delete from private.audit_log
    where change_set_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'P0001', 'Administration history is append-only.',
  'audit entries cannot be deleted'
);
select throws_ok(
  $$truncate private.audit_log$$,
  'P0001', 'Administration history is append-only.',
  'audit entries cannot be truncated'
);
select throws_ok(
  $$truncate private.administration_change_sets, private.audit_log$$,
  'P0001', 'Administration history is append-only.',
  'change sets cannot be truncated'
);

insert into auth.users (id) values ('33333333-3333-3333-3333-333333333333');
select lives_ok(
  $$delete from auth.users where id = '33333333-3333-3333-3333-333333333333'$$,
  'historical actor UUIDs do not prevent Auth-account removal'
);
select ok(
  exists (
    select 1 from private.administration_change_sets
    where actor_user_id = '33333333-3333-3333-3333-333333333333'
  ),
  'historical actor identity survives Auth-account deletion'
);

insert into auth.users (id) values ('44444444-4444-4444-4444-444444444444');
insert into private.administrator_allowlist (user_id)
  values ('44444444-4444-4444-4444-444444444444');
select throws_ok(
  $$delete from auth.users where id = '44444444-4444-4444-4444-444444444444'$$,
  '23503', null,
  'active allowlist membership restricts Auth-account deletion'
);

select throws_ok(
  $sql$do $block$
    begin
      insert into public.countries (id, name, fifa_code)
        values ('rollback-country', 'Rollback', 'RBK');
      raise exception 'force rollback';
    end
  $block$$sql$,
  'P0001', 'force rollback',
  'an exception rolls back a partial canonical write'
);
select is(
  (select count(*) from public.countries where id = 'rollback-country'),
  0::bigint,
  'the failed canonical write leaves no partial row'
);

insert into public.group_memberships (
  tournament_id, group_code, country_id, display_order
) values
  ('fifa-world-cup-2026', 'A', 'france', 1),
  ('fifa-world-cup-2026', 'B', 'spain', 1);

select throws_ok(
  $sql$do $block$
    begin
      insert into public.matches (
        tournament_id, id, round_id, stage, match_number, status,
        home_country_id, away_country_id
      ) values (
        'fifa-world-cup-2026', 'deferred-rollback', 'group', 'group', 5001,
        'scheduled', 'france', 'spain'
      );
      set constraints matches_validate_deferred immediate;
    end
  $block$$sql$,
  'P0001',
  'Group match deferred-rollback countries must belong to the same tournament group.',
  'deferred validation rejects an invalid canonical batch'
);
select is(
  (select count(*) from public.matches where id = 'deferred-rollback'),
  0::bigint,
  'a deferred validation failure rolls back the entire statement batch'
);

select * from finish();
rollback;
