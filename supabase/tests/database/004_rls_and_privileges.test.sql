begin;

select plan(28);

set local role anon;
select lives_ok(
  $$select count(*) from public.tournaments$$,
  'anonymous users can read public canonical data'
);
select throws_ok(
  $$insert into public.countries (id, name, fifa_code) values ('anon-write', 'Anon', 'ANN')$$,
  '42501', 'permission denied for table countries',
  'anonymous users cannot insert canonical data'
);
select throws_ok(
  $$update public.tournaments set status = 'active' where id = 'fifa-world-cup-2026'$$,
  '42501', 'permission denied for table tournaments',
  'anonymous users cannot update canonical data'
);
select throws_ok(
  $$delete from public.draft_picks where id = 'lyla-france'$$,
  '42501', 'permission denied for table draft_picks',
  'anonymous users cannot delete canonical data'
);
select throws_ok(
  $$truncate public.matches$$,
  '42501', 'permission denied for table matches',
  'anonymous users cannot truncate canonical data'
);
select throws_ok(
  $$select count(*) from private.administrator_allowlist$$,
  '42501', 'permission denied for schema private',
  'anonymous users cannot inspect the administrator allowlist'
);
reset role;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
insert into private.administrator_allowlist (user_id)
  values ('22222222-2222-2222-2222-222222222222');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select lives_ok(
  $$select count(*) from public.countries$$,
  'authenticated users can read public canonical data'
);
select is(
  private.is_tournament_administrator(),
  false,
  'ordinary authenticated users are not administrators'
);
select throws_ok(
  $$insert into public.countries (id, name, fifa_code) values ('user-write', 'User', 'USR')$$,
  '42501', 'permission denied for table countries',
  'ordinary authenticated users cannot insert canonical data'
);
select throws_ok(
  $$update public.tournaments set status = 'active' where id = 'fifa-world-cup-2026'$$,
  '42501', 'permission denied for table tournaments',
  'ordinary authenticated users cannot update canonical data'
);
select throws_ok(
  $$delete from public.draft_picks where id = 'lyla-france'$$,
  '42501', 'permission denied for table draft_picks',
  'ordinary authenticated users cannot delete canonical data'
);
select throws_ok(
  $$truncate public.matches$$,
  '42501', 'permission denied for table matches',
  'ordinary authenticated users cannot truncate canonical data'
);
reset role;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select is(
  private.is_tournament_administrator(),
  true,
  'the immutable-UUID helper recognizes an allowlisted administrator'
);
select throws_ok(
  $$insert into public.countries (id, name, fifa_code) values ('admin-write', 'Admin', 'ADM')$$,
  '42501', 'permission denied for table countries',
  'allowlisted administrators still cannot insert canonical data directly'
);
select throws_ok(
  $$update public.tournaments set status = 'active' where id = 'fifa-world-cup-2026'$$,
  '42501', 'permission denied for table tournaments',
  'allowlisted administrators still cannot update canonical data directly'
);
select throws_ok(
  $$delete from public.draft_picks where id = 'lyla-france'$$,
  '42501', 'permission denied for table draft_picks',
  'allowlisted administrators still cannot delete canonical data directly'
);
select throws_ok(
  $$truncate public.matches$$,
  '42501', 'permission denied for table matches',
  'allowlisted administrators still cannot truncate canonical data directly'
);
select throws_ok(
  $$select count(*) from private.administrator_allowlist$$,
  '42501', 'permission denied for table administrator_allowlist',
  'allowlisted clients cannot enumerate administrator identities'
);
select throws_ok(
  $$select count(*) from private.audit_log$$,
  '42501', 'permission denied for table audit_log',
  'detailed audit records remain private from application clients'
);
reset role;

select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) role_name
    cross join unnest(array[
      'tournaments', 'participants', 'countries', 'tournament_rounds',
      'tournament_groups', 'group_memberships', 'draft_picks', 'matches',
      'match_source_slots', 'group_override_sets', 'group_override_entries'
    ]) table_name
    where not has_table_privilege(role_name, 'public.' || table_name, 'SELECT')
  ),
  'both application roles can select every public canonical table'
);
select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) role_name
    cross join unnest(array[
      'tournaments', 'participants', 'countries', 'tournament_rounds',
      'tournament_groups', 'group_memberships', 'draft_picks', 'matches',
      'match_source_slots', 'group_override_sets', 'group_override_entries'
    ]) table_name
    where has_table_privilege(
      role_name, 'public.' || table_name, 'INSERT,UPDATE,DELETE,TRUNCATE'
    )
  ),
  'application roles have no direct write privilege on any canonical table'
);
select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) role_name
    cross join unnest(array[
      'administrator_allowlist', 'administration_change_sets', 'audit_log'
    ]) table_name
    where has_table_privilege(
      role_name, 'private.' || table_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
    )
  ),
  'application roles have no privileges on private tables'
);
select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['anon', 'authenticated']) role_name
    where c.relkind = 'S'
      and n.nspname in ('public', 'private')
      and has_sequence_privilege(role_name, c.oid, 'USAGE,SELECT,UPDATE')
  ),
  'application roles have no sequence privileges in application schemas'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname in ('public', 'private')
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC retains no function execution privilege in application schemas'
);
select ok(
  has_function_privilege(
    'authenticated', 'private.is_tournament_administrator()', 'EXECUTE'
  )
  and has_function_privilege(
    'anon', 'public.read_tournament_snapshot(text)', 'EXECUTE'
  )
  and has_function_privilege(
    'authenticated', 'public.read_tournament_snapshot(text)', 'EXECUTE'
  )
  and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
      and not (
        (
          not has_function_privilege('anon', p.oid, 'EXECUTE')
          and has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and n.nspname = 'private'
          and p.proname = 'is_tournament_administrator'
          and pg_get_function_identity_arguments(p.oid) = ''
        )
        or (
          has_function_privilege('anon', p.oid, 'EXECUTE')
          and has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and n.nspname = 'public'
          and p.proname = 'read_tournament_snapshot'
          and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text'
        )
        or (
          not has_function_privilege('anon', p.oid, 'EXECUTE')
          and has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and n.nspname = 'public'
          and p.proname = 'read_administration_context'
          and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text'
        )
        or (
          not has_function_privilege('anon', p.oid, 'EXECUTE')
          and has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and n.nspname = 'public'
          and p.proname = 'apply_administration_change'
          and pg_get_function_identity_arguments(p.oid) =
            'p_tournament_id text, p_expected_revision bigint, p_change_set_id uuid, p_commands jsonb, p_review_fingerprint text'
        )
      )
  ),
  'only the reviewed public and administrator functions are executable by application roles'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) setting
        where setting like 'search_path=%'
      )
  ),
  'every application SECURITY DEFINER function fixes its search path'
);

select lives_ok(
  $$insert into public.countries (id, name, fifa_code) values ('owner-write', 'Owner', 'OWN')$$,
  'database-owner migration and seed writes remain possible'
);
select lives_ok(
  $$delete from public.countries where id = 'owner-write'$$,
  'database-owner maintenance deletes remain possible'
);

select * from finish();
rollback;
