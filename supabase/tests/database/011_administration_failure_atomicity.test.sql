begin;

select plan(19);

update public.tournaments set status = 'planned', current_round_id = 'group', reference_data_complete = false, missing_official_data = array['isolated failure test'];
delete from public.match_source_slots;
delete from public.group_override_entries;
delete from public.group_override_sets;
delete from public.matches;
delete from public.group_memberships;

insert into auth.users (id) values ('76666666-6666-4666-8666-666666666666');
insert into private.administrator_allowlist (user_id) values ('76666666-6666-4666-8666-666666666666');
create temporary table failure_before as
select revision, last_updated_at from public.tournaments where id = 'fifa-world-cup-2026';

create function pg_temp.reject_change_set() returns trigger language plpgsql as $$
begin raise exception 'test change-set failure'; end;
$$;
create trigger test_reject_change_set before insert on private.administration_change_sets
for each row execute function pg_temp.reject_change_set();

select set_config('request.jwt.claim.sub', '76666666-6666-4666-8666-666666666666', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_administration_change(
    'fifa-world-cup-2026', 0, '76666666-6666-4666-8666-666666666601',
    '[{"type":"update_tournament_metadata","update":{"status":"active"}}]', repeat('A',43)
  )$$,
  'P0001', 'test change-set failure', 'change-set insertion failure aborts the RPC'
);
reset role;
select is((select status from public.tournaments where id = 'fifa-world-cup-2026'), 'planned', 'change-set failure rolls back canonical data');
select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), (select revision from failure_before), 'change-set failure preserves revision');
select is((select last_updated_at from public.tournaments where id = 'fifa-world-cup-2026'), (select last_updated_at from failure_before), 'change-set failure preserves lastUpdatedAt');
select is((select count(*) from private.administration_change_sets where id = '76666666-6666-4666-8666-666666666601'), 0::bigint, 'change-set failure leaves no change set');
select is((select count(*) from private.audit_log where change_set_id = '76666666-6666-4666-8666-666666666601'), 0::bigint, 'change-set failure leaves no audit rows');
drop trigger test_reject_change_set on private.administration_change_sets;

create function pg_temp.reject_audit() returns trigger language plpgsql as $$
begin raise exception 'test audit failure'; end;
$$;
create trigger test_reject_audit before insert on private.audit_log
for each row execute function pg_temp.reject_audit();

select set_config('request.jwt.claim.sub', '76666666-6666-4666-8666-666666666666', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_administration_change(
    'fifa-world-cup-2026', 0, '76666666-6666-4666-8666-666666666602',
    '[{"type":"update_tournament_metadata","update":{"status":"active"}}]', repeat('B',43)
  )$$,
  'P0001', 'test audit failure', 'audit insertion failure aborts the RPC'
);
reset role;
select is((select status from public.tournaments where id = 'fifa-world-cup-2026'), 'planned', 'audit failure rolls back canonical data');
select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), (select revision from failure_before), 'audit failure preserves revision');
select is((select last_updated_at from public.tournaments where id = 'fifa-world-cup-2026'), (select last_updated_at from failure_before), 'audit failure preserves lastUpdatedAt');
select is((select count(*) from private.administration_change_sets where id = '76666666-6666-4666-8666-666666666602'), 0::bigint, 'audit failure rolls back the change set');
select is((select count(*) from private.audit_log where change_set_id = '76666666-6666-4666-8666-666666666602'), 0::bigint, 'audit failure leaves no audit rows');
drop trigger test_reject_audit on private.audit_log;

insert into public.matches (
  tournament_id, id, round_id, stage, match_number, status,
  home_country_id, away_country_id, data_classification
) values
  ('fifa-world-cup-2026','failure-source','round-of-32','round_of_32',3100,'scheduled','france','spain','official_reference'),
  ('fifa-world-cup-2026','failure-dependent','quarterfinal','quarterfinal',3101,'scheduled',null,'portugal','official_reference');
insert into public.match_source_slots (tournament_id, match_id, slot, source_match_id, outcome)
values ('fifa-world-cup-2026','failure-dependent','home','failure-source','winner');

create function pg_temp.reject_propagation() returns trigger language plpgsql as $$
begin
  if new.id = 'failure-dependent' and old.home_country_id is null and new.home_country_id is not null then
    raise exception 'test propagation failure';
  end if;
  return new;
end;
$$;
create trigger test_reject_propagation before update on public.matches
for each row execute function pg_temp.reject_propagation();

select set_config('request.jwt.claim.sub', '76666666-6666-4666-8666-666666666666', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_administration_change(
    'fifa-world-cup-2026', 0, '76666666-6666-4666-8666-666666666603',
    '[{"type":"record_result","result":{"matchId":"failure-source","homeGoals":1,"awayGoals":0,"advancingCountryId":"france"}}]', repeat('C',43)
  )$$,
  'P7V01', 'Administration change failed validation.', 'propagation failure aborts the originating result'
);
reset role;
select is((select status from public.matches where id = 'failure-source'), 'scheduled', 'propagation failure rolls back the source result');
select is((select home_country_id from public.matches where id = 'failure-dependent'), null, 'propagation failure rolls back the dependent participant');
select is((select revision from public.tournaments where id = 'fifa-world-cup-2026'), (select revision from failure_before), 'propagation failure preserves revision');
select is((select last_updated_at from public.tournaments where id = 'fifa-world-cup-2026'), (select last_updated_at from failure_before), 'propagation failure preserves lastUpdatedAt');
select is((select count(*) from private.administration_change_sets where id = '76666666-6666-4666-8666-666666666603'), 0::bigint, 'propagation failure leaves no change set');
select is((select count(*) from private.audit_log where change_set_id = '76666666-6666-4666-8666-666666666603'), 0::bigint, 'propagation failure leaves no audit rows');

select * from finish();
rollback;
