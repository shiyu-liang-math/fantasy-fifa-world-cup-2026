begin;

select plan(31);

select has_table('public', 'tournaments', 'tournaments table exists');
select has_table('public', 'participants', 'participants table exists');
select has_table('public', 'countries', 'countries table exists');
select has_table('public', 'tournament_rounds', 'tournament rounds table exists');
select has_table('public', 'tournament_groups', 'tournament groups table exists');
select has_table('public', 'group_memberships', 'group memberships table exists');
select has_table('public', 'draft_picks', 'draft picks table exists');
select has_table('public', 'matches', 'matches table exists');
select has_table('public', 'match_source_slots', 'match source slots table exists');
select has_table('public', 'group_override_sets', 'group override sets table exists');
select has_table('public', 'group_override_entries', 'group override entries table exists');
select has_table('private', 'administrator_allowlist', 'administrator allowlist exists privately');
select has_table('private', 'administration_change_sets', 'change-set table exists privately');
select has_table('private', 'audit_log', 'audit log exists privately');

select is((select count(*) from public.tournaments), 1::bigint, 'one tournament is seeded');
select is((select count(*) from public.participants), 5::bigint, 'five participants are seeded');
select is((select count(*) from public.countries), 25::bigint, 'only 25 authoritative countries are seeded');
select is((select count(*) from public.draft_picks), 25::bigint, '25 draft picks are seeded');
select is((select count(*) from public.tournament_rounds), 7::bigint, 'seven tournament rounds are seeded');
select is((select count(*) from public.tournament_groups), 12::bigint, 'Groups A through L are seeded');
select is((select count(*) from public.group_memberships), 0::bigint, 'official group assignments are not invented');
select is((select count(*) from public.matches), 0::bigint, 'fictional matches are excluded from stable seed');
select is((select count(*) from public.match_source_slots), 0::bigint, 'source slots are absent without official fixtures');
select is((select count(*) from public.group_override_sets), 0::bigint, 'group override sets are not invented');
select is((select count(*) from public.group_override_entries), 0::bigint, 'group override entries are not invented');
select is((select count(*) from private.administrator_allowlist), 0::bigint, 'administrator identities are not seeded');
select is((select count(*) from private.administration_change_sets), 0::bigint, 'change sets are not seeded');
select is((select count(*) from private.audit_log), 0::bigint, 'audit events are not seeded');
select is(
  (select current_round_id from public.tournaments where id = 'fifa-world-cup-2026'),
  'group'::text,
  'current round matches the TypeScript reference snapshot'
);
select is(
  (select cardinality(missing_official_data) from public.tournaments where id = 'fifa-world-cup-2026'),
  4,
  'all missing-official-data explanations are retained'
);
select is(
  (select count(*) from supabase_migrations.schema_migrations where version like '20260713%'),
  5::bigint,
  'all five Milestone 5 migrations applied'
);

select * from finish();
rollback;
