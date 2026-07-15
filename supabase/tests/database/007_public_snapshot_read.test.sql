begin;

select plan(18);

insert into public.participants (id, slug, name, abbreviation, display_order)
values ('unrelated', 'unrelated', 'Unrelated participant', 'ZZZ', 99);
insert into public.countries (id, name, fifa_code)
values ('unrelated', 'Unrelated country', 'ZZZ');

select has_function(
  'public',
  'read_tournament_snapshot',
  array['text'],
  'the canonical snapshot read function exists'
);
select function_returns(
  'public',
  'read_tournament_snapshot',
  array['text'],
  'jsonb',
  'the snapshot function returns JSON'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.read_tournament_snapshot(text)'::regprocedure),
  false,
  'the snapshot function uses SECURITY INVOKER'
);
select is(
  (select provolatile from pg_proc where oid = 'public.read_tournament_snapshot(text)'::regprocedure),
  's'::"char",
  'the snapshot function is stable'
);
select ok(
  not has_function_privilege('public', 'public.read_tournament_snapshot(text)', 'EXECUTE'),
  'PUBLIC cannot execute the snapshot function'
);
select ok(
  has_function_privilege('anon', 'public.read_tournament_snapshot(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.read_tournament_snapshot(text)', 'EXECUTE'),
  'both public application roles can execute the snapshot function'
);

set local role anon;
select lives_ok(
  $$select public.read_tournament_snapshot('fifa-world-cup-2026')$$,
  'anonymous reads obey the existing public RLS policy'
);
select is(
  public.read_tournament_snapshot('fifa-world-cup-2026') #>> '{tournament,id}',
  'fifa-world-cup-2026',
  'the requested tournament is returned'
);
select is(
  jsonb_array_length(public.read_tournament_snapshot('fifa-world-cup-2026')->'participants'),
  5,
  'the complete participant collection is returned'
);
select is(
  public.read_tournament_snapshot('fifa-world-cup-2026') #>> '{participants,0,id}',
  'lyla',
  'participant ordering is deterministic'
);
select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.read_tournament_snapshot('fifa-world-cup-2026')->'participants'
    ) row
    where row->>'id' = 'unrelated'
  ),
  0,
  'unrelated global participants do not enter the tournament graph'
);
select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.read_tournament_snapshot('fifa-world-cup-2026')->'countries'
    ) row
    where row->>'id' = 'unrelated'
  ),
  0,
  'unrelated global countries do not enter the tournament graph'
);
select is(
  public.read_tournament_snapshot('fifa-world-cup-2026') #>> '{rounds,0,id}',
  'group',
  'round ordering is deterministic'
);
select is(
  public.read_tournament_snapshot('fifa-world-cup-2026') #>> '{groups,11,code}',
  'L',
  'group ordering is deterministic'
);
select is(
  public.read_tournament_snapshot('missing') -> 'tournament',
  'null'::jsonb,
  'a missing tournament has an explicit null tournament record'
);
select is(
  jsonb_array_length(public.read_tournament_snapshot('missing')->'participants'),
  0,
  'a missing tournament cannot leak unrelated canonical rows'
);
select throws_ok(
  $$select count(*) from private.audit_log$$,
  '42501', 'permission denied for schema private',
  'the read function grants no private-data access'
);
select throws_ok(
  $$update public.tournaments set status = 'active' where id = 'fifa-world-cup-2026'$$,
  '42501', 'permission denied for table tournaments',
  'the read interface grants no canonical write access'
);
reset role;

select * from finish();
rollback;
