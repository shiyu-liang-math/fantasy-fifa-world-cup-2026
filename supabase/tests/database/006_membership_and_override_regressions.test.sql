begin;

select plan(7);

update public.tournaments set reference_data_complete = false, missing_official_data = array['isolated membership test'];
delete from public.match_source_slots;
delete from public.group_override_entries;
delete from public.group_override_sets;
delete from public.matches;
delete from public.group_memberships;

insert into public.group_memberships (
  tournament_id, group_code, country_id, display_order
) values
  ('fifa-world-cup-2026', 'A', 'france', 1),
  ('fifa-world-cup-2026', 'A', 'spain', 2);

insert into public.matches (
  tournament_id, id, round_id, stage, match_number, status,
  home_country_id, away_country_id
) values (
  'fifa-world-cup-2026', 'membership-match', 'group', 'group', 6001,
  'scheduled', 'france', 'spain'
);

select lives_ok(
  $$select private.validate_match('fifa-world-cup-2026', 'membership-match')$$,
  'the initial same-group fixture is valid'
);
select throws_ok(
  $sql$do $block$
    begin
      update public.group_memberships
      set group_code = 'C'
      where tournament_id = 'fifa-world-cup-2026' and country_id = 'france';
      set constraints group_memberships_validate_deferred immediate;
    end
  $block$$sql$,
  'P0001',
  'Group match membership-match countries must belong to the same tournament group.',
  'moving a membership revalidates matches in its old group context'
);
select is(
  (
    select group_code from public.group_memberships
    where tournament_id = 'fifa-world-cup-2026' and country_id = 'france'
  ),
  'A'::text,
  'a failed membership move rolls back to the original group'
);

select throws_ok(
  $sql$do $block$
    begin
      insert into public.group_override_sets (
        id, tournament_id, group_code, reason, source
      ) values (
        'empty-group-override', 'fifa-world-cup-2026', 'D',
        'Test-only empty override', 'Test'
      );
      set constraints group_override_sets_validate_deferred immediate;
    end
  $block$$sql$,
  'P0001',
  'Override set empty-group-override requires at least one entry.',
  'empty groups cannot receive an empty override set'
);

insert into public.group_override_sets (
  id, tournament_id, group_code, reason, source
) values (
  'complete-a', 'fifa-world-cup-2026', 'A', 'Test-only complete order', 'Test'
);
insert into public.group_override_entries (
  override_set_id, tournament_id, group_code, country_id, official_rank
) values
  ('complete-a', 'fifa-world-cup-2026', 'A', 'france', 1),
  ('complete-a', 'fifa-world-cup-2026', 'A', 'spain', 2);

select lives_ok(
  $$select private.validate_override_set('complete-a', 'fifa-world-cup-2026', 'A')$$,
  'a ranked override covering every current group member is valid'
);
select throws_ok(
  $sql$do $block$
    begin
      insert into public.group_memberships (
        tournament_id, group_code, country_id, display_order
      ) values ('fifa-world-cup-2026', 'A', 'portugal', 3);
      set constraints group_memberships_validate_deferred immediate;
    end
  $block$$sql$,
  'P0001',
  'Ranked override set complete-a must rank every group country exactly once.',
  'future group population must update a ranked override atomically'
);
select is(
  (
    select count(*) from public.group_memberships
    where tournament_id = 'fifa-world-cup-2026' and country_id = 'portugal'
  ),
  0::bigint,
  'an override-completeness failure rolls back the new membership'
);

select * from finish();
rollback;
