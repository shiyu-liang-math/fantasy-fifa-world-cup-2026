create table public.matches (
  tournament_id text not null,
  id text not null,
  round_id text not null,
  stage text not null check (
    stage in (
      'group',
      'round_of_32',
      'round_of_16',
      'quarterfinal',
      'semifinal',
      'third_place',
      'final'
    )
  ),
  match_number integer not null check (match_number > 0),
  status text not null check (
    status in ('scheduled', 'live', 'completed', 'postponed', 'cancelled')
  ),
  scheduled_at timestamptz,
  home_country_id text references public.countries(id) on delete restrict,
  away_country_id text references public.countries(id) on delete restrict,
  home_goals integer check (home_goals >= 0),
  away_goals integer check (away_goals >= 0),
  went_to_extra_time boolean not null default false,
  home_shootout_goals integer check (home_shootout_goals >= 0),
  away_shootout_goals integer check (away_shootout_goals >= 0),
  advancing_country_id text references public.countries(id) on delete restrict,
  data_classification text not null default 'official_reference' check (
    data_classification in ('official_reference', 'fictional_development')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, id),
  unique (tournament_id, match_number),
  foreign key (tournament_id, round_id)
    references public.tournament_rounds(tournament_id, id)
    on delete restrict,
  constraint matches_distinct_countries check (
    home_country_id is null or away_country_id is null or home_country_id <> away_country_id
  ),
  constraint matches_score_pair_complete check (
    (home_goals is null) = (away_goals is null)
  ),
  constraint matches_shootout_pair_complete check (
    (home_shootout_goals is null) = (away_shootout_goals is null)
  ),
  constraint matches_shootout_valid check (
    home_shootout_goals is null
    or (
      home_shootout_goals <> away_shootout_goals
      and went_to_extra_time
      and home_goals is not null
      and home_goals = away_goals
    )
  ),
  constraint matches_completed_fields check (
    status <> 'completed'
    or (
      home_country_id is not null
      and away_country_id is not null
      and home_goals is not null
      and away_goals is not null
    )
  ),
  constraint matches_unplayed_fields check (
    status not in ('scheduled', 'postponed', 'cancelled')
    or (
      home_goals is null
      and away_goals is null
      and not went_to_extra_time
      and home_shootout_goals is null
      and away_shootout_goals is null
      and advancing_country_id is null
    )
  ),
  constraint matches_advancement_after_completion check (
    status = 'completed' or advancing_country_id is null
  ),
  constraint matches_advancing_country_participates check (
    advancing_country_id is null
    or advancing_country_id = home_country_id
    or advancing_country_id = away_country_id
  )
);

create index matches_round_number_idx
  on public.matches(tournament_id, round_id, match_number);

create index matches_status_schedule_idx
  on public.matches(tournament_id, status, scheduled_at);

create index matches_home_country_idx on public.matches(home_country_id);
create index matches_away_country_idx on public.matches(away_country_id);
create index matches_advancing_country_idx on public.matches(advancing_country_id);
create index matches_completed_idx
  on public.matches(tournament_id, match_number)
  where status = 'completed';

create unique index matches_unique_group_pair_idx
  on public.matches(
    tournament_id,
    least(home_country_id, away_country_id),
    greatest(home_country_id, away_country_id)
  )
  where stage = 'group' and home_country_id is not null and away_country_id is not null;

create table public.match_source_slots (
  tournament_id text not null,
  match_id text not null,
  slot text not null check (slot in ('home', 'away')),
  source_match_id text not null,
  outcome text not null check (outcome in ('winner', 'loser')),
  primary key (tournament_id, match_id, slot),
  foreign key (tournament_id, match_id)
    references public.matches(tournament_id, id)
    on delete restrict,
  foreign key (tournament_id, source_match_id)
    references public.matches(tournament_id, id)
    on delete restrict,
  check (match_id <> source_match_id)
);

create index match_source_slots_source_idx
  on public.match_source_slots(tournament_id, source_match_id);

create table public.group_override_sets (
  id text not null,
  tournament_id text not null,
  group_code text not null,
  reason text not null check (btrim(reason) <> ''),
  source text not null check (btrim(source) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, tournament_id, group_code),
  unique (tournament_id, group_code),
  foreign key (tournament_id, group_code)
    references public.tournament_groups(tournament_id, code)
    on delete restrict
);

create table public.group_override_entries (
  override_set_id text not null,
  tournament_id text not null,
  group_code text not null,
  country_id text not null,
  official_rank smallint check (official_rank between 1 and 4),
  qualified_for_round_of_32 boolean,
  primary key (override_set_id, tournament_id, group_code, country_id),
  foreign key (override_set_id, tournament_id, group_code)
    references public.group_override_sets(id, tournament_id, group_code)
    on delete restrict,
  foreign key (tournament_id, group_code, country_id)
    references public.group_memberships(tournament_id, group_code, country_id)
    on delete restrict,
  check (official_rank is not null or qualified_for_round_of_32 is not null)
);

create unique index group_override_entries_rank_idx
  on public.group_override_entries(override_set_id, tournament_id, group_code, official_rank)
  where official_rank is not null;

create or replace function private.validate_match(p_tournament_id text, p_match_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.matches%rowtype;
  target_round_order smallint;
  source_slot record;
  source_match public.matches%rowtype;
  source_round_order smallint;
  expected_country_id text;
  target_country_id text;
  home_group text;
  away_group text;
begin
  select m.* into target
  from public.matches m
  where m.tournament_id = p_tournament_id and m.id = p_match_id;

  if not found then
    return;
  end if;

  select r.display_order into target_round_order
  from public.tournament_rounds r
  where r.tournament_id = target.tournament_id and r.id = target.round_id;

  if target.stage <> (
    select r.stage
    from public.tournament_rounds r
    where r.tournament_id = target.tournament_id and r.id = target.round_id
  ) then
    raise exception 'Match % stage must match its round stage.', target.id;
  end if;

  if target.stage = 'group' then
    if target.advancing_country_id is not null then
      raise exception 'Group match % cannot identify an advancing country.', target.id;
    end if;
    if target.home_shootout_goals is not null or target.away_shootout_goals is not null then
      raise exception 'Group match % cannot contain a shootout.', target.id;
    end if;
    if exists (
      select 1 from public.match_source_slots s
      where s.tournament_id = target.tournament_id and s.match_id = target.id
    ) then
      raise exception 'Group match % cannot use source slots.', target.id;
    end if;
    if target.home_country_id is null or target.away_country_id is null then
      raise exception 'Group match % requires two assigned countries.', target.id;
    end if;

    select group_code into home_group
    from public.group_memberships
    where tournament_id = target.tournament_id and country_id = target.home_country_id;
    select group_code into away_group
    from public.group_memberships
    where tournament_id = target.tournament_id and country_id = target.away_country_id;
    if home_group is null or away_group is null or home_group <> away_group then
      raise exception 'Group match % countries must belong to the same tournament group.', target.id;
    end if;
  elsif target.status = 'completed' then
    if target.advancing_country_id is null then
      raise exception 'Completed knockout match % requires an advancing country.', target.id;
    end if;
    if target.home_goals > target.away_goals then
      if target.advancing_country_id <> target.home_country_id then
        raise exception 'Advancing country for match % did not win the match.', target.id;
      end if;
    elsif target.away_goals > target.home_goals then
      if target.advancing_country_id <> target.away_country_id then
        raise exception 'Advancing country for match % did not win the match.', target.id;
      end if;
    elsif target.home_shootout_goals is null then
      raise exception 'Tied knockout match % requires a shootout winner.', target.id;
    elsif target.home_shootout_goals > target.away_shootout_goals then
      if target.advancing_country_id <> target.home_country_id then
        raise exception 'Advancing country for match % lost the shootout.', target.id;
      end if;
    elsif target.advancing_country_id <> target.away_country_id then
      raise exception 'Advancing country for match % lost the shootout.', target.id;
    end if;
  end if;

  if exists (
    with recursive sources(match_id) as (
      select s.source_match_id
      from public.match_source_slots s
      where s.tournament_id = target.tournament_id and s.match_id = target.id
      union
      select s.source_match_id
      from public.match_source_slots s
      join sources on sources.match_id = s.match_id
      where s.tournament_id = target.tournament_id
    )
    select 1 from sources where match_id = target.id
  ) then
    raise exception 'Match-source cycle detected for match %.', target.id;
  end if;

  for source_slot in
    select *
    from public.match_source_slots s
    where s.tournament_id = target.tournament_id and s.match_id = target.id
  loop
    select m.* into source_match
    from public.matches m
    where m.tournament_id = source_slot.tournament_id
      and m.id = source_slot.source_match_id;

    select r.display_order into source_round_order
    from public.tournament_rounds r
    where r.tournament_id = source_match.tournament_id
      and r.id = source_match.round_id;

    if source_round_order >= target_round_order then
      raise exception 'Match % must source countries from an earlier round.', target.id;
    end if;

    target_country_id := case source_slot.slot
      when 'home' then target.home_country_id
      else target.away_country_id
    end;

    if source_match.status = 'completed' then
      expected_country_id := case source_slot.outcome
        when 'winner' then source_match.advancing_country_id
        when 'loser' then case
          when source_match.advancing_country_id = source_match.home_country_id
            then source_match.away_country_id
          else source_match.home_country_id
        end
      end;
      if target_country_id is not null and target_country_id is distinct from expected_country_id then
        raise exception 'Resolved % slot for match % disagrees with source match % %.',
          source_slot.slot, target.id, source_match.id, source_slot.outcome;
      end if;
    elsif target_country_id is not null then
      raise exception 'Unresolved source slot % for match % cannot yet name a country.',
        source_slot.slot, target.id;
    end if;
  end loop;
end;
$$;

create or replace function private.validate_match_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  dependent record;
begin
  if tg_op <> 'DELETE' then
    perform private.validate_match(new.tournament_id, new.id);
  end if;
  if tg_op <> 'INSERT' then
    for dependent in
      select tournament_id, match_id
      from public.match_source_slots
      where tournament_id = old.tournament_id and source_match_id = old.id
    loop
      perform private.validate_match(dependent.tournament_id, dependent.match_id);
    end loop;
  end if;
  return null;
end;
$$;

create constraint trigger matches_validate_deferred
after insert or update or delete on public.matches
deferrable initially deferred
for each row execute function private.validate_match_trigger();

create or replace function private.validate_source_slot_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op <> 'DELETE' then
    perform private.validate_match(new.tournament_id, new.match_id);
  end if;
  if tg_op <> 'INSERT' then
    perform private.validate_match(old.tournament_id, old.match_id);
  end if;
  return null;
end;
$$;

create constraint trigger match_source_slots_validate_deferred
after insert or update or delete on public.match_source_slots
deferrable initially deferred
for each row execute function private.validate_source_slot_trigger();

create or replace function private.validate_override_set(
  p_override_set_id text,
  p_tournament_id text,
  p_group_code text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  member_count integer;
  entry_count integer;
  ranked_count integer;
begin
  if not exists (
    select 1 from public.group_override_sets s
    where s.id = p_override_set_id
      and s.tournament_id = p_tournament_id
      and s.group_code = p_group_code
  ) then
    return;
  end if;

  select count(*) into member_count
  from public.group_memberships
  where tournament_id = p_tournament_id and group_code = p_group_code;

  select count(*), count(official_rank)
    into entry_count, ranked_count
  from public.group_override_entries
  where override_set_id = p_override_set_id
    and tournament_id = p_tournament_id
    and group_code = p_group_code;

  if entry_count = 0 then
    raise exception 'Override set % requires at least one entry.', p_override_set_id;
  end if;
  if ranked_count > 0 and (ranked_count <> entry_count or ranked_count <> member_count) then
    raise exception 'Ranked override set % must rank every group country exactly once.', p_override_set_id;
  end if;
end;
$$;

create or replace function private.validate_override_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op <> 'DELETE' then
    perform private.validate_override_set(new.id, new.tournament_id, new.group_code);
  end if;
  if tg_op <> 'INSERT' then
    perform private.validate_override_set(old.id, old.tournament_id, old.group_code);
  end if;
  return null;
end;
$$;

create constraint trigger group_override_sets_validate_deferred
after insert or update or delete on public.group_override_sets
deferrable initially deferred
for each row execute function private.validate_override_trigger();

create or replace function private.validate_override_entry_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op <> 'DELETE' then
    perform private.validate_override_set(
      new.override_set_id, new.tournament_id, new.group_code
    );
  end if;
  if tg_op <> 'INSERT' then
    perform private.validate_override_set(
      old.override_set_id, old.tournament_id, old.group_code
    );
  end if;
  return null;
end;
$$;

create constraint trigger group_override_entries_validate_deferred
after insert or update or delete on public.group_override_entries
deferrable initially deferred
for each row execute function private.validate_override_entry_trigger();

create or replace function private.validate_tournament_completeness(p_tournament_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not coalesce((
    select reference_data_complete
    from public.tournaments
    where id = p_tournament_id
  ), false) then
    return;
  end if;

  if (select count(*) from public.tournament_groups where tournament_id = p_tournament_id) <> 12 then
    raise exception 'Complete tournament % requires 12 groups.', p_tournament_id;
  end if;
  if (select count(*) from public.group_memberships where tournament_id = p_tournament_id) <> 48 then
    raise exception 'Complete tournament % requires 48 group memberships.', p_tournament_id;
  end if;
  if exists (
    select 1
    from public.tournament_groups g
    left join public.group_memberships m
      on m.tournament_id = g.tournament_id and m.group_code = g.code
    where g.tournament_id = p_tournament_id
    group by g.tournament_id, g.code
    having count(m.country_id) <> 4
  ) then
    raise exception 'Complete tournament % requires four countries in every group.', p_tournament_id;
  end if;
end;
$$;

create or replace function private.validate_tournament_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.validate_tournament_completeness(new.id);
  return null;
end;
$$;

create constraint trigger tournaments_validate_completeness_deferred
after insert or update on public.tournaments
deferrable initially deferred
for each row execute function private.validate_tournament_trigger();

create or replace function private.validate_round_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected record;
begin
  for affected in
    select distinct m.tournament_id, m.id
    from public.matches m
    left join public.match_source_slots s
      on s.tournament_id = m.tournament_id and s.match_id = m.id
    left join public.matches source_match
      on source_match.tournament_id = s.tournament_id
      and source_match.id = s.source_match_id
    where (m.tournament_id, m.round_id) = (new.tournament_id, new.id)
       or (source_match.tournament_id, source_match.round_id) = (new.tournament_id, new.id)
  loop
    perform private.validate_match(affected.tournament_id, affected.id);
  end loop;
  return null;
end;
$$;

create constraint trigger tournament_rounds_validate_deferred
after update on public.tournament_rounds
deferrable initially deferred
for each row execute function private.validate_round_trigger();

create or replace function private.validate_membership_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected_match record;
  affected_override record;
  old_tournament_id text := case when tg_op <> 'INSERT' then old.tournament_id end;
  old_group_code text := case when tg_op <> 'INSERT' then old.group_code end;
  old_country_id text := case when tg_op <> 'INSERT' then old.country_id end;
  new_tournament_id text := case when tg_op <> 'DELETE' then new.tournament_id end;
  new_group_code text := case when tg_op <> 'DELETE' then new.group_code end;
  new_country_id text := case when tg_op <> 'DELETE' then new.country_id end;
begin
  for affected_match in
    select distinct tournament_id, id
    from public.matches
    where stage = 'group'
      and (
        (
          tournament_id = old_tournament_id
          and (home_country_id = old_country_id or away_country_id = old_country_id)
        )
        or (
          tournament_id = new_tournament_id
          and (home_country_id = new_country_id or away_country_id = new_country_id)
        )
      )
  loop
    perform private.validate_match(affected_match.tournament_id, affected_match.id);
  end loop;

  for affected_override in
    select distinct id, tournament_id, group_code
    from public.group_override_sets
    where (tournament_id, group_code) in (
      (old_tournament_id, old_group_code),
      (new_tournament_id, new_group_code)
      )
  loop
    perform private.validate_override_set(
      affected_override.id,
      affected_override.tournament_id,
      affected_override.group_code
    );
  end loop;

  if old_tournament_id is not null then
    perform private.validate_tournament_completeness(old_tournament_id);
  end if;
  if new_tournament_id is not null and new_tournament_id is distinct from old_tournament_id then
    perform private.validate_tournament_completeness(new_tournament_id);
  end if;
  return null;
end;
$$;

create constraint trigger group_memberships_validate_deferred
after insert or update or delete on public.group_memberships
deferrable initially deferred
for each row execute function private.validate_membership_trigger();

comment on table public.match_source_slots is
  'A slot remains present after resolution. A nullable match country represents unresolved state; when both exist deferred validation requires agreement.';

comment on column public.matches.stage is
  'Stored to preserve MatchRecord exactly; deferred validation requires equality with tournament_rounds.stage.';
