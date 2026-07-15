alter table public.matches
  add constraint matches_results_only_when_completed check (
    status = 'completed'
    or (
      home_goals is null
      and away_goals is null
      and not went_to_extra_time
      and home_shootout_goals is null
      and away_shootout_goals is null
      and advancing_country_id is null
    )
  ),
  add constraint matches_group_no_extra_time check (
    stage <> 'group' or not went_to_extra_time
  );

alter table private.administration_change_sets
  add column review_fingerprint text not null default 'legacy-unavailable'
    check (btrim(review_fingerprint) <> '');

comment on column private.administration_change_sets.review_fingerprint is
  'Signed application review fingerprint retained for idempotent replay comparison. The HMAC secret is never stored in PostgreSQL.';

create or replace function private.country_belongs_to_tournament(
  p_tournament_id text,
  p_country_id text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_country_id is null or exists (
    select 1
    from public.group_memberships gm
    where gm.tournament_id = p_tournament_id
      and gm.country_id = p_country_id
  ) or exists (
    select 1
    from public.draft_picks dp
    where dp.tournament_id = p_tournament_id
      and dp.country_id = p_country_id
  );
$$;

create or replace function private.jsonb_has_exact_keys(
  p_value pg_catalog.jsonb,
  p_required pg_catalog.text[],
  p_optional pg_catalog.text[] default '{}'::pg_catalog.text[]
)
returns pg_catalog.bool
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_key pg_catalog.text;
begin
  if pg_catalog.jsonb_typeof(p_value) <> 'object' then return false; end if;
  for v_key in select pg_catalog.jsonb_object_keys(p_value)
  loop
    if not (v_key = any(p_required) or v_key = any(p_optional)) then return false; end if;
  end loop;
  foreach v_key in array p_required
  loop
    if not (p_value ? v_key) then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.jsonb_nonempty_string(
  p_value pg_catalog.jsonb,
  p_key pg_catalog.text
)
returns pg_catalog.bool
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_value ? p_key
    and pg_catalog.jsonb_typeof(p_value->p_key) = 'string'
    and pg_catalog.btrim(p_value->>p_key) <> '';
$$;

create or replace function private.jsonb_nullable_string(
  p_value pg_catalog.jsonb,
  p_key pg_catalog.text
)
returns pg_catalog.bool
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_value ? p_key and (
    pg_catalog.jsonb_typeof(p_value->p_key) = 'null'
    or (
      pg_catalog.jsonb_typeof(p_value->p_key) = 'string'
      and pg_catalog.btrim(p_value->>p_key) <> ''
    )
  );
$$;

create or replace function private.jsonb_nonnegative_integer(
  p_value pg_catalog.jsonb,
  p_key pg_catalog.text,
  p_positive pg_catalog.bool default false
)
returns pg_catalog.bool
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_value ? p_key
    and pg_catalog.jsonb_typeof(p_value->p_key) = 'number'
    and (p_value->>p_key) ~ '^-?[0-9]+$'
    and (p_value->>p_key)::pg_catalog.numeric between
      case when p_positive then 1 else 0 end and 2147483647;
$$;

create or replace function private.jsonb_iso_timestamp_or_null(
  p_value pg_catalog.jsonb,
  p_key pg_catalog.text
)
returns pg_catalog.bool
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if not private.jsonb_nullable_string(p_value, p_key) then return false; end if;
  if p_value->p_key = 'null'::pg_catalog.jsonb then return true; end if;
  if not ((p_value->>p_key) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$') then
    return false;
  end if;
  perform (p_value->>p_key)::pg_catalog.timestamptz;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function private.validate_administration_commands(
  p_tournament_id pg_catalog.text,
  p_commands pg_catalog.jsonb
)
returns pg_catalog.void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_command pg_catalog.jsonb;
  v_type pg_catalog.text;
  v_fixture pg_catalog.jsonb;
  v_result pg_catalog.jsonb;
  v_override pg_catalog.jsonb;
  v_update pg_catalog.jsonb;
  v_slot pg_catalog.jsonb;
  v_value pg_catalog.jsonb;
  v_target pg_catalog.text;
  v_other_group pg_catalog.text;
  v_fixture_targets pg_catalog.text[] := '{}'::pg_catalog.text[];
  v_result_targets pg_catalog.text[] := '{}'::pg_catalog.text[];
  v_participant_targets pg_catalog.text[] := '{}'::pg_catalog.text[];
  v_override_groups pg_catalog.text[] := '{}'::pg_catalog.text[];
  v_metadata_seen pg_catalog.bool := false;
  v_metadata_changes pg_catalog.bool;
begin
  if p_commands is null
    or pg_catalog.jsonb_typeof(p_commands) <> 'array'
    or pg_catalog.jsonb_array_length(p_commands) = 0
  then
    raise exception using errcode = 'P7V01', message = 'Malformed administration request.';
  end if;

  for v_command in select value from pg_catalog.jsonb_array_elements(p_commands)
  loop
    v_other_group := null;
    if pg_catalog.jsonb_typeof(v_command) <> 'object'
      or not private.jsonb_nonempty_string(v_command, 'type')
    then
      raise exception using errcode = 'P7V01', message = 'Malformed administration command.';
    end if;
    v_type := v_command->>'type';

    if v_type = 'upsert_fixture' then
      if not private.jsonb_has_exact_keys(v_command, array['type','fixture']::pg_catalog.text[]) then
        raise exception using errcode = 'P7V01', message = 'Malformed fixture command.';
      end if;
      v_fixture := v_command->'fixture';
      if not private.jsonb_has_exact_keys(
          v_fixture,
          array['id','roundId','matchNumber','scheduledAt','homeCountryId','awayCountryId']::pg_catalog.text[],
          array['status','homeSourceSlot','awaySourceSlot']::pg_catalog.text[]
        )
        or not private.jsonb_nonempty_string(v_fixture, 'id')
        or not private.jsonb_nonempty_string(v_fixture, 'roundId')
        or not private.jsonb_nonnegative_integer(v_fixture, 'matchNumber', true)
        or not private.jsonb_iso_timestamp_or_null(v_fixture, 'scheduledAt')
        or not private.jsonb_nullable_string(v_fixture, 'homeCountryId')
        or not private.jsonb_nullable_string(v_fixture, 'awayCountryId')
        or (v_fixture ? 'status' and (
          pg_catalog.jsonb_typeof(v_fixture->'status') <> 'string'
          or not (v_fixture->>'status' = any(array['scheduled','live','postponed','cancelled']::pg_catalog.text[]))
        ))
      then
        raise exception using errcode = 'P7V01', message = 'Malformed fixture command.';
      end if;
      foreach v_target in array array['homeSourceSlot','awaySourceSlot']::pg_catalog.text[]
      loop
        if v_fixture ? v_target and v_fixture->v_target <> 'null'::pg_catalog.jsonb then
          v_slot := v_fixture->v_target;
          if not private.jsonb_has_exact_keys(v_slot, array['sourceMatchId','outcome']::pg_catalog.text[])
            or not private.jsonb_nonempty_string(v_slot, 'sourceMatchId')
            or pg_catalog.jsonb_typeof(v_slot->'outcome') <> 'string'
            or not (v_slot->>'outcome' = any(array['winner','loser']::pg_catalog.text[]))
          then
            raise exception using errcode = 'P7V01', message = 'Malformed source slot.';
          end if;
        end if;
      end loop;
      v_target := v_fixture->>'id';
      if v_target = any(v_fixture_targets) or v_target = any(v_participant_targets) then
        raise exception using errcode = 'P7V01', message = 'Conflicting administration commands.';
      end if;
      v_fixture_targets := pg_catalog.array_append(v_fixture_targets, v_target);

    elsif v_type in ('record_result', 'replace_result') then
      if not private.jsonb_has_exact_keys(
          v_command,
          case when v_type = 'replace_result' then array['type','result','reason']::pg_catalog.text[] else array['type','result']::pg_catalog.text[] end
        )
      then raise exception using errcode = 'P7V01', message = 'Malformed result command.'; end if;
      v_result := v_command->'result';
      if not private.jsonb_has_exact_keys(
          v_result,
          array['matchId','homeGoals','awayGoals']::pg_catalog.text[],
          array['wentToExtraTime','homeShootoutGoals','awayShootoutGoals','advancingCountryId']::pg_catalog.text[]
        )
        or not private.jsonb_nonempty_string(v_result, 'matchId')
        or not private.jsonb_nonnegative_integer(v_result, 'homeGoals')
        or not private.jsonb_nonnegative_integer(v_result, 'awayGoals')
        or (v_type = 'replace_result' and not private.jsonb_nonempty_string(v_command, 'reason'))
        or (v_result ? 'wentToExtraTime' and pg_catalog.jsonb_typeof(v_result->'wentToExtraTime') <> 'boolean')
        or (v_result ? 'homeShootoutGoals' and v_result->'homeShootoutGoals' <> 'null'::pg_catalog.jsonb and not private.jsonb_nonnegative_integer(v_result, 'homeShootoutGoals'))
        or (v_result ? 'awayShootoutGoals' and v_result->'awayShootoutGoals' <> 'null'::pg_catalog.jsonb and not private.jsonb_nonnegative_integer(v_result, 'awayShootoutGoals'))
        or (v_result ? 'advancingCountryId' and not private.jsonb_nullable_string(v_result, 'advancingCountryId'))
      then raise exception using errcode = 'P7V01', message = 'Malformed result command.'; end if;
      v_target := v_result->>'matchId';
      if v_target = any(v_result_targets) or v_target = any(v_participant_targets) then
        raise exception using errcode = 'P7V01', message = 'Conflicting administration commands.';
      end if;
      v_result_targets := pg_catalog.array_append(v_result_targets, v_target);

    elsif v_type = 'set_knockout_participants' then
      if not private.jsonb_has_exact_keys(v_command, array['type','matchId','homeCountryId','awayCountryId']::pg_catalog.text[])
        or not private.jsonb_nonempty_string(v_command, 'matchId')
        or not private.jsonb_nullable_string(v_command, 'homeCountryId')
        or not private.jsonb_nullable_string(v_command, 'awayCountryId')
      then raise exception using errcode = 'P7V01', message = 'Malformed participant command.'; end if;
      v_target := v_command->>'matchId';
      if v_target = any(v_participant_targets)
        or v_target = any(v_fixture_targets)
        or v_target = any(v_result_targets)
      then
        raise exception using errcode = 'P7V01', message = 'Conflicting administration commands.';
      end if;
      v_participant_targets := pg_catalog.array_append(v_participant_targets, v_target);

    elsif v_type in ('set_group_override', 'replace_group_override') then
      if not private.jsonb_has_exact_keys(
          v_command,
          case when v_type = 'replace_group_override' then array['type','replacedOverrideId','override']::pg_catalog.text[] else array['type','override']::pg_catalog.text[] end
        )
        or (v_type = 'replace_group_override' and not private.jsonb_nonempty_string(v_command, 'replacedOverrideId'))
      then raise exception using errcode = 'P7V01', message = 'Malformed group override command.'; end if;
      v_override := v_command->'override';
      if not private.jsonb_has_exact_keys(v_override, array['id','groupCode','orderedCountryIds','reason','source']::pg_catalog.text[])
        or not private.jsonb_nonempty_string(v_override, 'id')
        or pg_catalog.jsonb_typeof(v_override->'groupCode') <> 'string'
        or not ((v_override->>'groupCode') ~ '^[A-L]$')
        or pg_catalog.jsonb_typeof(v_override->'orderedCountryIds') <> 'array'
        or pg_catalog.jsonb_array_length(v_override->'orderedCountryIds') = 0
        or not private.jsonb_nonempty_string(v_override, 'reason')
        or not private.jsonb_nonempty_string(v_override, 'source')
      then raise exception using errcode = 'P7V01', message = 'Malformed group override.'; end if;
      for v_value in select value from pg_catalog.jsonb_array_elements(v_override->'orderedCountryIds')
      loop
        if pg_catalog.jsonb_typeof(v_value) <> 'string' or pg_catalog.btrim(v_value #>> '{}') = '' then
          raise exception using errcode = 'P7V01', message = 'Malformed group override.';
        end if;
      end loop;
      if v_type = 'replace_group_override' then
        select s.group_code into v_other_group from public.group_override_sets s
        where s.tournament_id = p_tournament_id and s.id = v_command->>'replacedOverrideId';
        if not found then raise exception using errcode = 'P7V01', message = 'Unknown group override.'; end if;
        if v_other_group = any(v_override_groups) then
          raise exception using errcode = 'P7V01', message = 'Conflicting administration commands.';
        end if;
        v_override_groups := pg_catalog.array_append(v_override_groups, v_other_group);
      end if;
      v_target := v_override->>'groupCode';
      if v_target = any(v_override_groups) and v_target is distinct from v_other_group then
        raise exception using errcode = 'P7V01', message = 'Conflicting administration commands.';
      end if;
      if not (v_target = any(v_override_groups)) then
        v_override_groups := pg_catalog.array_append(v_override_groups, v_target);
      end if;

    elsif v_type = 'remove_group_override' then
      if not private.jsonb_has_exact_keys(v_command, array['type','overrideId']::pg_catalog.text[])
        or not private.jsonb_nonempty_string(v_command, 'overrideId')
      then raise exception using errcode = 'P7V01', message = 'Malformed group override command.'; end if;
      select s.group_code into v_target from public.group_override_sets s
      where s.tournament_id = p_tournament_id and s.id = v_command->>'overrideId';
      if not found then raise exception using errcode = 'P7V01', message = 'Unknown group override.'; end if;
      if v_target = any(v_override_groups) then
        raise exception using errcode = 'P7V01', message = 'Conflicting administration commands.';
      end if;
      v_override_groups := pg_catalog.array_append(v_override_groups, v_target);

    elsif v_type = 'update_tournament_metadata' then
      if not private.jsonb_has_exact_keys(v_command, array['type','update']::pg_catalog.text[]) then
        raise exception using errcode = 'P7V01', message = 'Malformed metadata command.';
      end if;
      v_update := v_command->'update';
      if not private.jsonb_has_exact_keys(
          v_update,
          '{}'::pg_catalog.text[],
          array['status','currentRoundId','referenceDataComplete','missingOfficialData']::pg_catalog.text[]
        )
        or v_update = '{}'::pg_catalog.jsonb
        or (v_update ? 'status' and (pg_catalog.jsonb_typeof(v_update->'status') <> 'string' or not (v_update->>'status' = any(array['planned','active','completed']::pg_catalog.text[]))))
        or (v_update ? 'currentRoundId' and not private.jsonb_nullable_string(v_update, 'currentRoundId'))
        or (v_update ? 'referenceDataComplete' and pg_catalog.jsonb_typeof(v_update->'referenceDataComplete') <> 'boolean')
        or (v_update ? 'missingOfficialData' and pg_catalog.jsonb_typeof(v_update->'missingOfficialData') <> 'array')
      then raise exception using errcode = 'P7V01', message = 'Malformed metadata update.'; end if;
      if v_update ? 'missingOfficialData' then
        for v_value in select value from pg_catalog.jsonb_array_elements(v_update->'missingOfficialData')
        loop
          if pg_catalog.jsonb_typeof(v_value) <> 'string' or pg_catalog.btrim(v_value #>> '{}') = '' then
            raise exception using errcode = 'P7V01', message = 'Malformed metadata update.';
          end if;
        end loop;
      end if;
      if v_metadata_seen then
        raise exception using errcode = 'P7V01', message = 'Conflicting administration commands.';
      end if;
      select
        (v_update ? 'status' and t.status is distinct from v_update->>'status')
        or (v_update ? 'currentRoundId' and t.current_round_id is distinct from nullif(v_update->>'currentRoundId', ''))
        or (v_update ? 'referenceDataComplete' and t.reference_data_complete is distinct from (v_update->>'referenceDataComplete')::pg_catalog.bool)
        or (v_update ? 'missingOfficialData' and t.missing_official_data is distinct from array(
          select value #>> '{}' from pg_catalog.jsonb_array_elements(v_update->'missingOfficialData')
        ))
      into v_metadata_changes
      from public.tournaments t where t.id = p_tournament_id;
      if not coalesce(v_metadata_changes, false) then
        raise exception using errcode = 'P7V01', message = 'No-op administration command.';
      end if;
      v_metadata_seen := true;
    else
      raise exception using errcode = 'P7V01', message = 'Unsupported administration command.';
    end if;
  end loop;
end;
$$;

create or replace function private.validate_administration_semantics(
  p_tournament_id pg_catalog.text,
  p_commands pg_catalog.jsonb
)
returns pg_catalog.void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_matches pg_catalog.jsonb;
  v_command pg_catalog.jsonb;
  v_type pg_catalog.text;
  v_fixture pg_catalog.jsonb;
  v_result pg_catalog.jsonb;
  v_override pg_catalog.jsonb;
  v_match pg_catalog.jsonb;
  v_source pg_catalog.jsonb;
  v_target pg_catalog.jsonb;
  v_id pg_catalog.text;
  v_stage pg_catalog.text;
  v_round_order pg_catalog.int4;
  v_home_group pg_catalog.text;
  v_away_group pg_catalog.text;
  v_country_ids pg_catalog.text[];
  v_member_ids pg_catalog.text[];
  v_existing_order pg_catalog.text[];
  v_existing_set_id pg_catalog.text;
  v_existing_reason pg_catalog.text;
  v_existing_source pg_catalog.text;
  v_replaced_ids pg_catalog.text[] := '{}'::pg_catalog.text[];
  v_expected_country pg_catalog.text;
  v_advancing pg_catalog.text;
  v_home pg_catalog.int4;
  v_away pg_catalog.int4;
  v_home_shootout pg_catalog.int4;
  v_away_shootout pg_catalog.int4;
  v_went_extra pg_catalog.bool;
  v_slot_name pg_catalog.text;
  v_slot pg_catalog.jsonb;
begin
  select coalesce(pg_catalog.jsonb_object_agg(m.id, pg_catalog.jsonb_build_object(
    'id', m.id,
    'roundId', m.round_id,
    'stage', m.stage,
    'matchNumber', m.match_number,
    'status', m.status,
    'homeCountryId', m.home_country_id,
    'awayCountryId', m.away_country_id,
    'homeGoals', m.home_goals,
    'awayGoals', m.away_goals,
    'wentToExtraTime', m.went_to_extra_time,
    'homeShootoutGoals', m.home_shootout_goals,
    'awayShootoutGoals', m.away_shootout_goals,
    'advancingCountryId', m.advancing_country_id,
    'homeCountryExplicit', false,
    'awayCountryExplicit', false,
    'homeSourceSlot', (select pg_catalog.jsonb_build_object('sourceMatchId', s.source_match_id, 'outcome', s.outcome) from public.match_source_slots s where s.tournament_id = m.tournament_id and s.match_id = m.id and s.slot = 'home'),
    'awaySourceSlot', (select pg_catalog.jsonb_build_object('sourceMatchId', s.source_match_id, 'outcome', s.outcome) from public.match_source_slots s where s.tournament_id = m.tournament_id and s.match_id = m.id and s.slot = 'away')
  )), '{}'::pg_catalog.jsonb)
  into v_matches
  from public.matches m
  where m.tournament_id = p_tournament_id;

  for v_command in select value from pg_catalog.jsonb_array_elements(p_commands)
  loop
    v_type := v_command->>'type';
    if v_type = 'upsert_fixture' then
      v_fixture := v_command->'fixture';
      v_id := v_fixture->>'id';
      if exists (select 1 from public.matches m where m.id = v_id and m.tournament_id <> p_tournament_id) then
        raise exception using errcode = 'P7V01', message = 'Command targets another tournament.';
      end if;
      select r.stage, r.display_order into v_stage, v_round_order
      from public.tournament_rounds r
      where r.tournament_id = p_tournament_id and r.id = v_fixture->>'roundId';
      if not found then
        raise exception using errcode = 'P7V01', message = 'Unknown tournament round.';
      end if;
      if exists (select 1 from public.tournament_rounds r where r.id = v_fixture->>'roundId' and r.tournament_id <> p_tournament_id)
        and not exists (select 1 from public.tournament_rounds r where r.id = v_fixture->>'roundId' and r.tournament_id = p_tournament_id)
      then raise exception using errcode = 'P7V01', message = 'Round belongs to another tournament.'; end if;
      if not private.country_belongs_to_tournament(p_tournament_id, v_fixture->>'homeCountryId')
        or not private.country_belongs_to_tournament(p_tournament_id, v_fixture->>'awayCountryId')
      then raise exception using errcode = 'P7V01', message = 'Match country does not belong to tournament.'; end if;
      if v_fixture->>'homeCountryId' is not null and v_fixture->>'homeCountryId' = v_fixture->>'awayCountryId' then
        raise exception using errcode = 'P7V01', message = 'A match requires distinct countries.';
      end if;
      if v_stage = 'group' then
        if v_fixture->>'homeCountryId' is null or v_fixture->>'awayCountryId' is null
          or coalesce(v_fixture->'homeSourceSlot', 'null'::pg_catalog.jsonb) <> 'null'::pg_catalog.jsonb
          or coalesce(v_fixture->'awaySourceSlot', 'null'::pg_catalog.jsonb) <> 'null'::pg_catalog.jsonb
        then raise exception using errcode = 'P7V01', message = 'Invalid group fixture.'; end if;
        select gm.group_code into v_home_group from public.group_memberships gm
        where gm.tournament_id = p_tournament_id and gm.country_id = v_fixture->>'homeCountryId';
        select gm.group_code into v_away_group from public.group_memberships gm
        where gm.tournament_id = p_tournament_id and gm.country_id = v_fixture->>'awayCountryId';
        if v_home_group is null or v_home_group is distinct from v_away_group then
          raise exception using errcode = 'P7V01', message = 'Group fixture countries must share a group.';
        end if;
      end if;
      if exists (
        select 1 from pg_catalog.jsonb_each(v_matches) e
        where e.key <> v_id and (e.value->>'matchNumber')::pg_catalog.int4 = (v_fixture->>'matchNumber')::pg_catalog.int4
      ) then raise exception using errcode = 'P7V01', message = 'Duplicate match number.'; end if;
      if v_stage = 'group' and exists (
        select 1 from pg_catalog.jsonb_each(v_matches) e
        where e.key <> v_id and e.value->>'stage' = 'group'
          and ((e.value->>'homeCountryId' = v_fixture->>'homeCountryId' and e.value->>'awayCountryId' = v_fixture->>'awayCountryId')
            or (e.value->>'homeCountryId' = v_fixture->>'awayCountryId' and e.value->>'awayCountryId' = v_fixture->>'homeCountryId'))
      ) then raise exception using errcode = 'P7V01', message = 'Duplicate group fixture.'; end if;
      if v_matches ? v_id and v_matches->v_id->>'status' = 'completed' then
        raise exception using errcode = 'P7V01', message = 'Completed fixtures require result replacement.';
      end if;
      v_match := pg_catalog.jsonb_build_object(
        'id', v_id, 'roundId', v_fixture->>'roundId', 'stage', v_stage,
        'matchNumber', (v_fixture->>'matchNumber')::pg_catalog.int4,
        'status', coalesce(v_fixture->>'status', 'scheduled'),
        'homeCountryId', v_fixture->'homeCountryId', 'awayCountryId', v_fixture->'awayCountryId',
        'homeGoals', null, 'awayGoals', null, 'wentToExtraTime', false,
        'homeShootoutGoals', null, 'awayShootoutGoals', null, 'advancingCountryId', null,
        'homeCountryExplicit', v_fixture->'homeSourceSlot' is not null and v_fixture->'homeSourceSlot' <> 'null'::pg_catalog.jsonb and v_fixture->'homeCountryId' <> 'null'::pg_catalog.jsonb,
        'awayCountryExplicit', v_fixture->'awaySourceSlot' is not null and v_fixture->'awaySourceSlot' <> 'null'::pg_catalog.jsonb and v_fixture->'awayCountryId' <> 'null'::pg_catalog.jsonb,
        'homeSourceSlot', coalesce(v_fixture->'homeSourceSlot', 'null'::pg_catalog.jsonb),
        'awaySourceSlot', coalesce(v_fixture->'awaySourceSlot', 'null'::pg_catalog.jsonb)
      );
      v_matches := pg_catalog.jsonb_set(v_matches, array[v_id]::pg_catalog.text[], v_match, true);

    elsif v_type in ('record_result', 'replace_result') then
      v_result := v_command->'result';
      v_id := v_result->>'matchId';
      v_match := v_matches->v_id;
      if v_match is null then raise exception using errcode = 'P7V01', message = 'Unknown match.'; end if;
      if v_type = 'record_result' and v_match->>'status' = 'completed' then
        raise exception using errcode = 'P7V01', message = 'Completed result requires replacement.';
      end if;
      if v_type = 'replace_result' and v_match->>'status' <> 'completed' then
        raise exception using errcode = 'P7V01', message = 'No completed result to replace.';
      end if;
      if v_match->'homeCountryId' = 'null'::pg_catalog.jsonb or v_match->'awayCountryId' = 'null'::pg_catalog.jsonb then
        raise exception using errcode = 'P7V01', message = 'A result requires resolved countries.';
      end if;
      v_home := (v_result->>'homeGoals')::pg_catalog.int4;
      v_away := (v_result->>'awayGoals')::pg_catalog.int4;
      v_went_extra := coalesce((v_result->>'wentToExtraTime')::pg_catalog.bool, false);
      v_home_shootout := nullif(v_result->>'homeShootoutGoals', '')::pg_catalog.int4;
      v_away_shootout := nullif(v_result->>'awayShootoutGoals', '')::pg_catalog.int4;
      v_advancing := nullif(v_result->>'advancingCountryId', '');
      if v_match->>'stage' = 'group' then
        if v_went_extra or v_home_shootout is not null or v_away_shootout is not null or v_advancing is not null then
          raise exception using errcode = 'P7V01', message = 'Invalid group result.';
        end if;
      else
        if v_advancing is null or not (v_advancing = any(array[v_match->>'homeCountryId', v_match->>'awayCountryId']::pg_catalog.text[])) then
          raise exception using errcode = 'P7V01', message = 'Invalid advancing country.';
        end if;
        if v_home = v_away then
          if not v_went_extra or v_home_shootout is null or v_away_shootout is null or v_home_shootout = v_away_shootout
            or v_advancing <> (case when v_home_shootout > v_away_shootout then v_match->>'homeCountryId' else v_match->>'awayCountryId' end)
          then raise exception using errcode = 'P7V01', message = 'Invalid knockout shootout.'; end if;
        elsif v_home_shootout is not null or v_away_shootout is not null
          or v_advancing <> (case when v_home > v_away then v_match->>'homeCountryId' else v_match->>'awayCountryId' end)
        then raise exception using errcode = 'P7V01', message = 'Invalid knockout result.'; end if;
      end if;
      v_match := v_match || pg_catalog.jsonb_build_object(
        'status', 'completed', 'homeGoals', v_home, 'awayGoals', v_away,
        'wentToExtraTime', v_went_extra, 'homeShootoutGoals', v_home_shootout,
        'awayShootoutGoals', v_away_shootout,
        'advancingCountryId', case when v_match->>'stage' = 'group' then null else v_advancing end
      );
      v_matches := pg_catalog.jsonb_set(v_matches, array[v_id]::pg_catalog.text[], v_match, false);
      if v_type = 'replace_result' then v_replaced_ids := pg_catalog.array_append(v_replaced_ids, v_id); end if;

    elsif v_type = 'set_knockout_participants' then
      v_id := v_command->>'matchId';
      v_match := v_matches->v_id;
      if v_match is null or v_match->>'stage' = 'group' or v_match->>'status' = 'completed'
        or v_match->'homeSourceSlot' <> 'null'::pg_catalog.jsonb or v_match->'awaySourceSlot' <> 'null'::pg_catalog.jsonb
      then raise exception using errcode = 'P7V01', message = 'Invalid knockout participant command.'; end if;
      if not private.country_belongs_to_tournament(p_tournament_id, v_command->>'homeCountryId')
        or not private.country_belongs_to_tournament(p_tournament_id, v_command->>'awayCountryId')
        or (v_command->>'homeCountryId' is not null and v_command->>'homeCountryId' = v_command->>'awayCountryId')
      then raise exception using errcode = 'P7V01', message = 'Invalid knockout participants.'; end if;
      v_match := v_match || pg_catalog.jsonb_build_object('homeCountryId', v_command->'homeCountryId', 'awayCountryId', v_command->'awayCountryId');
      v_matches := pg_catalog.jsonb_set(v_matches, array[v_id]::pg_catalog.text[], v_match, false);

    elsif v_type in ('set_group_override', 'replace_group_override') then
      v_override := v_command->'override';
      select pg_catalog.array_agg(value #>> '{}' order by ordinality)
      into v_country_ids
      from pg_catalog.jsonb_array_elements(v_override->'orderedCountryIds') with ordinality;
      select pg_catalog.array_agg(gm.country_id order by gm.country_id)
      into v_member_ids
      from public.group_memberships gm
      where gm.tournament_id = p_tournament_id and gm.group_code = v_override->>'groupCode';
      if v_member_ids is null
        or pg_catalog.array_length(v_country_ids, 1) is distinct from pg_catalog.array_length(v_member_ids, 1)
        or (select count(distinct value) from pg_catalog.unnest(v_country_ids) value) <> pg_catalog.array_length(v_country_ids, 1)
        or exists (select 1 from pg_catalog.unnest(v_country_ids) value where not (value = any(v_member_ids)))
      then raise exception using errcode = 'P7V01', message = 'Incomplete group override.'; end if;
      if v_type = 'replace_group_override' then
        select s.group_code into v_home_group from public.group_override_sets s
        where s.tournament_id = p_tournament_id and s.id = v_command->>'replacedOverrideId';
        if not found then raise exception using errcode = 'P7V01', message = 'Unknown group override.'; end if;
      end if;
      select s.id, s.reason, s.source, array(
        select e.country_id from public.group_override_entries e
        where (e.override_set_id, e.tournament_id, e.group_code) = (s.id, s.tournament_id, s.group_code)
        order by e.official_rank
      ) into v_existing_set_id, v_existing_reason, v_existing_source, v_existing_order
      from public.group_override_sets s
      where s.tournament_id = p_tournament_id and s.group_code = v_override->>'groupCode';
      if found and (v_type = 'set_group_override' or v_existing_set_id <> v_command->>'replacedOverrideId') then
        raise exception using errcode = 'P7V01', message = 'Group already has an override.';
      end if;
      if found and v_existing_reason = v_override->>'reason' and v_existing_source = v_override->>'source' and v_existing_order = v_country_ids then
        raise exception using errcode = 'P7V01', message = 'No-op administration command.';
      end if;
    end if;
  end loop;

  if exists (
    with recursive edges(target_id, source_id) as (
      select m.key, slot.value->>'sourceMatchId'
      from pg_catalog.jsonb_each(v_matches) m
      cross join lateral pg_catalog.jsonb_array_elements(pg_catalog.jsonb_build_array(m.value->'homeSourceSlot', m.value->'awaySourceSlot')) slot
      where slot.value <> 'null'::pg_catalog.jsonb
    ), reach(target_id, source_id) as (
      select target_id, source_id from edges
      union
      select r.target_id, e.source_id from reach r join edges e on e.target_id = r.source_id
    ) select 1 from reach where target_id = source_id
  ) then raise exception using errcode = 'P7V01', message = 'Match-source cycle detected.'; end if;

  for v_target in
    select m.value from pg_catalog.jsonb_each(v_matches) m
    join public.tournament_rounds r on r.tournament_id = p_tournament_id and r.id = m.value->>'roundId'
    order by r.display_order, (m.value->>'matchNumber')::pg_catalog.int4
  loop
    if v_target->'homeSourceSlot' <> 'null'::pg_catalog.jsonb
      and v_target->'awaySourceSlot' <> 'null'::pg_catalog.jsonb
      and v_target->'homeSourceSlot'->>'sourceMatchId' = v_target->'awaySourceSlot'->>'sourceMatchId'
    then raise exception using errcode = 'P7V01', message = 'Duplicate source configuration.'; end if;
    foreach v_slot_name in array array['homeSourceSlot','awaySourceSlot']::pg_catalog.text[]
    loop
      v_slot := v_target->v_slot_name;
      if v_slot = 'null'::pg_catalog.jsonb then continue; end if;
      v_source := v_matches->(v_slot->>'sourceMatchId');
      if v_source is null then raise exception using errcode = 'P7V01', message = 'Unknown source match.'; end if;
      if v_source->>'id' = v_target->>'id' then raise exception using errcode = 'P7V01', message = 'A match cannot source itself.'; end if;
      if (select r.display_order from public.tournament_rounds r where r.tournament_id = p_tournament_id and r.id = v_source->>'roundId') >=
         (select r.display_order from public.tournament_rounds r where r.tournament_id = p_tournament_id and r.id = v_target->>'roundId')
      then raise exception using errcode = 'P7V01', message = 'Source match must be from an earlier round.'; end if;
      v_expected_country := case when v_source->>'status' <> 'completed' then null
        when v_slot->>'outcome' = 'winner' then v_source->>'advancingCountryId'
        when v_source->>'advancingCountryId' = v_source->>'homeCountryId' then v_source->>'awayCountryId'
        else v_source->>'homeCountryId' end;
      v_id := v_target->>'id';
      v_country_ids := case when v_slot_name = 'homeSourceSlot' then array[v_target->>'homeCountryId'] else array[v_target->>'awayCountryId'] end;
      if v_target->>'status' = 'completed' and v_country_ids[1] is distinct from v_expected_country and not (v_id = any(v_replaced_ids)) then
        raise exception using errcode = 'P7V01', message = 'Completed downstream result requires atomic replacement.';
      end if;
      if coalesce((v_target->>(case when v_slot_name = 'homeSourceSlot' then 'homeCountryExplicit' else 'awayCountryExplicit' end))::pg_catalog.bool, false)
        and v_country_ids[1] is distinct from v_expected_country
      then raise exception using errcode = 'P7V01', message = 'Resolved source country disagrees with fixture.'; end if;
      v_target := v_target || case when v_slot_name = 'homeSourceSlot'
        then pg_catalog.jsonb_build_object('homeCountryId', v_expected_country)
        else pg_catalog.jsonb_build_object('awayCountryId', v_expected_country) end;
      v_matches := pg_catalog.jsonb_set(v_matches, array[v_id]::pg_catalog.text[], v_target, false);
    end loop;
  end loop;
end;
$$;

create or replace function public.read_administration_context(p_tournament_id pg_catalog.text)
returns pg_catalog.jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_revision pg_catalog.int8;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P7401', message = 'Authentication required.';
  end if;
  if not private.is_tournament_administrator() then
    raise exception using errcode = 'P7403', message = 'Administrator access required.';
  end if;
  select t.revision into v_revision
  from public.tournaments t
  where t.id = p_tournament_id;
  if not found then
    raise exception using errcode = 'P7V01', message = 'Tournament not found.';
  end if;

  return pg_catalog.jsonb_build_object(
    'tournament_id', p_tournament_id,
    'revision', v_revision::text,
    'snapshot', public.read_tournament_snapshot(p_tournament_id)
  );
end;
$$;

create or replace function public.apply_administration_change(
  p_tournament_id pg_catalog.text,
  p_expected_revision pg_catalog.int8,
  p_change_set_id pg_catalog.uuid,
  p_commands pg_catalog.jsonb,
  p_review_fingerprint pg_catalog.text
)
returns pg_catalog.jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor pg_catalog.uuid;
  v_current_revision pg_catalog.int8;
  v_applied_revision pg_catalog.int8;
  v_existing private.administration_change_sets%rowtype;
  v_command pg_catalog.jsonb;
  v_type pg_catalog.text;
  v_fixture pg_catalog.jsonb;
  v_result pg_catalog.jsonb;
  v_override pg_catalog.jsonb;
  v_update pg_catalog.jsonb;
  v_match public.matches%rowtype;
  v_round public.tournament_rounds%rowtype;
  v_replaced_result_ids pg_catalog.text[] := '{}'::pg_catalog.text[];
  v_country_id pg_catalog.text;
  v_rank pg_catalog.int4;
  v_before_tournament pg_catalog.jsonb;
  v_before_matches pg_catalog.jsonb;
  v_before_slots pg_catalog.jsonb;
  v_before_override_sets pg_catalog.jsonb;
  v_before_override_entries pg_catalog.jsonb;
  v_after_matches pg_catalog.jsonb;
  v_after_slots pg_catalog.jsonb;
  v_after_override_sets pg_catalog.jsonb;
  v_after_override_entries pg_catalog.jsonb;
  v_changed_count pg_catalog.int4;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception using errcode = 'P7401', message = 'Authentication required.';
  end if;
  if not private.is_tournament_administrator() then
    raise exception using errcode = 'P7403', message = 'Administrator access required.';
  end if;
  if p_change_set_id is null then
    raise exception using errcode = 'P7V01', message = 'Malformed administration request.';
  end if;

  -- Global idempotency lock order is authorization, UUID advisory lock,
  -- existing change-set lookup, then the tournament row lock for new work.
  -- hashtextextended consumes the complete canonical UUID text; a theoretical
  -- hash collision only adds serialization and cannot weaken correctness.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_change_set_id::pg_catalog.text, 0)
  );

  select cs.* into v_existing
  from private.administration_change_sets cs
  where cs.id = p_change_set_id;
  if found then
    if v_existing.actor_user_id = v_actor
      and v_existing.tournament_id = p_tournament_id
      and v_existing.base_revision = p_expected_revision
      and v_existing.commands = p_commands
      and v_existing.review_fingerprint = p_review_fingerprint
    then
      return pg_catalog.jsonb_build_object(
        'status', 'already_applied',
        'tournament_id', v_existing.tournament_id,
        'revision', v_existing.result_revision::text,
        'change_set_id', v_existing.id::text
      );
    end if;
    raise exception using errcode = 'P7I01', message = 'Change-set identifier conflict.';
  end if;

  if p_expected_revision is null
    or p_expected_revision < 0
    or p_commands is null
    or p_review_fingerprint is null
    or p_review_fingerprint !~ '^[A-Za-z0-9_-]{43}$'
  then
    raise exception using errcode = 'P7V01', message = 'Malformed administration request.';
  end if;
  select t.revision into v_current_revision
  from public.tournaments t
  where t.id = p_tournament_id
  for update;
  if not found then
    raise exception using errcode = 'P7V01', message = 'Tournament not found.';
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception using errcode = 'P7S01', message = 'Tournament revision is stale.';
  end if;
  perform private.validate_administration_commands(p_tournament_id, p_commands);
  perform private.validate_administration_semantics(p_tournament_id, p_commands);

  select pg_catalog.to_jsonb(t) into v_before_tournament
  from public.tournaments t where t.id = p_tournament_id;
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.jsonb_build_array(m.tournament_id, m.id)::pg_catalog.text, pg_catalog.to_jsonb(m)), '{}'::pg_catalog.jsonb)
    into v_before_matches
  from public.matches m where m.tournament_id = p_tournament_id;
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.jsonb_build_array(s.tournament_id, s.match_id, s.slot)::pg_catalog.text, pg_catalog.to_jsonb(s)), '{}'::pg_catalog.jsonb)
    into v_before_slots
  from public.match_source_slots s where s.tournament_id = p_tournament_id;
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.jsonb_build_array(s.tournament_id, s.id, s.group_code)::pg_catalog.text, pg_catalog.to_jsonb(s)), '{}'::pg_catalog.jsonb)
    into v_before_override_sets
  from public.group_override_sets s where s.tournament_id = p_tournament_id;
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.jsonb_build_array(e.tournament_id, e.override_set_id, e.group_code, e.country_id)::pg_catalog.text, pg_catalog.to_jsonb(e)), '{}'::pg_catalog.jsonb)
    into v_before_override_entries
  from public.group_override_entries e where e.tournament_id = p_tournament_id;

  begin
    for v_command in select value from pg_catalog.jsonb_array_elements(p_commands)
    loop
      if pg_catalog.jsonb_typeof(v_command) <> 'object' then
        raise exception 'Administration commands must be objects.';
      end if;
      v_type := v_command->>'type';

      if v_type = 'upsert_fixture' then
        v_fixture := v_command->'fixture';
        if pg_catalog.jsonb_typeof(v_fixture) <> 'object'
          or nullif(pg_catalog.btrim(v_fixture->>'id'), '') is null
          or nullif(pg_catalog.btrim(v_fixture->>'roundId'), '') is null
          or (v_fixture->>'matchNumber') is null
        then raise exception 'Malformed fixture command.'; end if;

        select r.* into v_round
        from public.tournament_rounds r
        where r.tournament_id = p_tournament_id and r.id = v_fixture->>'roundId';
        if not found then raise exception 'Unknown tournament round.'; end if;
        if not private.country_belongs_to_tournament(p_tournament_id, nullif(v_fixture->>'homeCountryId', ''))
          or not private.country_belongs_to_tournament(p_tournament_id, nullif(v_fixture->>'awayCountryId', ''))
        then raise exception 'Match country does not belong to tournament.'; end if;

        select m.* into v_match from public.matches m
        where m.tournament_id = p_tournament_id and m.id = v_fixture->>'id';
        if found and v_match.status = 'completed' then
          raise exception 'Completed fixtures require result replacement.';
        end if;

        insert into public.matches (
          tournament_id, id, round_id, stage, match_number, status, scheduled_at,
          home_country_id, away_country_id, home_goals, away_goals,
          went_to_extra_time, home_shootout_goals, away_shootout_goals,
          advancing_country_id, data_classification
        ) values (
          p_tournament_id,
          v_fixture->>'id',
          v_round.id,
          v_round.stage,
          (v_fixture->>'matchNumber')::integer,
          coalesce(v_fixture->>'status', 'scheduled'),
          nullif(v_fixture->>'scheduledAt', '')::timestamptz,
          nullif(v_fixture->>'homeCountryId', ''),
          nullif(v_fixture->>'awayCountryId', ''),
          null, null, false, null, null, null,
          'official_reference'
        )
        on conflict (tournament_id, id) do update set
          round_id = excluded.round_id,
          stage = excluded.stage,
          match_number = excluded.match_number,
          status = excluded.status,
          scheduled_at = excluded.scheduled_at,
          home_country_id = excluded.home_country_id,
          away_country_id = excluded.away_country_id,
          home_goals = null,
          away_goals = null,
          went_to_extra_time = false,
          home_shootout_goals = null,
          away_shootout_goals = null,
          advancing_country_id = null,
          data_classification = excluded.data_classification,
          updated_at = pg_catalog.clock_timestamp();

        delete from public.match_source_slots s
        where s.tournament_id = p_tournament_id and s.match_id = v_fixture->>'id';
        if v_fixture ? 'homeSourceSlot' and v_fixture->'homeSourceSlot' <> 'null'::jsonb then
          insert into public.match_source_slots (tournament_id, match_id, slot, source_match_id, outcome)
          values (p_tournament_id, v_fixture->>'id', 'home', v_fixture->'homeSourceSlot'->>'sourceMatchId', v_fixture->'homeSourceSlot'->>'outcome');
        end if;
        if v_fixture ? 'awaySourceSlot' and v_fixture->'awaySourceSlot' <> 'null'::jsonb then
          insert into public.match_source_slots (tournament_id, match_id, slot, source_match_id, outcome)
          values (p_tournament_id, v_fixture->>'id', 'away', v_fixture->'awaySourceSlot'->>'sourceMatchId', v_fixture->'awaySourceSlot'->>'outcome');
        end if;

      elsif v_type in ('record_result', 'replace_result') then
        v_result := v_command->'result';
        if pg_catalog.jsonb_typeof(v_result) <> 'object'
          or nullif(pg_catalog.btrim(v_result->>'matchId'), '') is null
          or (v_result->>'homeGoals') is null
          or (v_result->>'awayGoals') is null
        then raise exception 'Malformed result command.'; end if;
        select m.* into v_match from public.matches m
        where m.tournament_id = p_tournament_id and m.id = v_result->>'matchId';
        if not found then raise exception 'Unknown match.'; end if;
        if v_type = 'record_result' and v_match.status = 'completed' then
          raise exception 'Completed result requires replacement.';
        elsif v_type = 'replace_result' and v_match.status <> 'completed' then
          raise exception 'No completed result to replace.';
        elsif v_type = 'replace_result' and nullif(pg_catalog.btrim(v_command->>'reason'), '') is null then
          raise exception 'Result replacement requires a reason.';
        end if;
        if v_type = 'replace_result' then
          v_replaced_result_ids := pg_catalog.array_append(v_replaced_result_ids, v_result->>'matchId');
        end if;
        update public.matches set
          status = 'completed',
          home_goals = (v_result->>'homeGoals')::integer,
          away_goals = (v_result->>'awayGoals')::integer,
          went_to_extra_time = coalesce((v_result->>'wentToExtraTime')::boolean, false),
          home_shootout_goals = nullif(v_result->>'homeShootoutGoals', '')::integer,
          away_shootout_goals = nullif(v_result->>'awayShootoutGoals', '')::integer,
          advancing_country_id = case when v_match.stage = 'group' then null else nullif(v_result->>'advancingCountryId', '') end,
          updated_at = pg_catalog.clock_timestamp()
        where tournament_id = p_tournament_id and id = v_result->>'matchId';

      elsif v_type = 'set_knockout_participants' then
        select m.* into v_match from public.matches m
        where m.tournament_id = p_tournament_id and m.id = v_command->>'matchId';
        if not found or v_match.stage = 'group' or v_match.status = 'completed' then
          raise exception 'Invalid knockout participant command.';
        end if;
        if exists (select 1 from public.match_source_slots s where s.tournament_id = p_tournament_id and s.match_id = v_match.id) then
          raise exception 'Source-managed match participants are derived.';
        end if;
        if not private.country_belongs_to_tournament(p_tournament_id, nullif(v_command->>'homeCountryId', ''))
          or not private.country_belongs_to_tournament(p_tournament_id, nullif(v_command->>'awayCountryId', ''))
        then raise exception 'Match country does not belong to tournament.'; end if;
        update public.matches set
          home_country_id = nullif(v_command->>'homeCountryId', ''),
          away_country_id = nullif(v_command->>'awayCountryId', ''),
          updated_at = pg_catalog.clock_timestamp()
        where tournament_id = p_tournament_id and id = v_match.id;

      elsif v_type in ('set_group_override', 'replace_group_override') then
        v_override := v_command->'override';
        if pg_catalog.jsonb_typeof(v_override) <> 'object'
          or pg_catalog.jsonb_typeof(v_override->'orderedCountryIds') <> 'array'
          or nullif(pg_catalog.btrim(v_override->>'id'), '') is null
          or nullif(pg_catalog.btrim(v_override->>'groupCode'), '') is null
          or nullif(pg_catalog.btrim(v_override->>'reason'), '') is null
          or nullif(pg_catalog.btrim(v_override->>'source'), '') is null
        then raise exception 'Malformed group override.'; end if;
        if v_type = 'replace_group_override' then
          delete from public.group_override_entries e
          where e.tournament_id = p_tournament_id and e.override_set_id = v_command->>'replacedOverrideId';
          delete from public.group_override_sets s
          where s.tournament_id = p_tournament_id and s.id = v_command->>'replacedOverrideId';
          if not found then raise exception 'Unknown group override.'; end if;
        end if;
        insert into public.group_override_sets (id, tournament_id, group_code, reason, source)
        values (v_override->>'id', p_tournament_id, v_override->>'groupCode', v_override->>'reason', v_override->>'source');
        v_rank := 0;
        for v_country_id in select value #>> '{}' from pg_catalog.jsonb_array_elements(v_override->'orderedCountryIds')
        loop
          v_rank := v_rank + 1;
          insert into public.group_override_entries (
            override_set_id, tournament_id, group_code, country_id, official_rank
          ) values (
            v_override->>'id', p_tournament_id, v_override->>'groupCode', v_country_id, v_rank
          );
        end loop;

      elsif v_type = 'remove_group_override' then
        delete from public.group_override_entries e
        where e.tournament_id = p_tournament_id and e.override_set_id = v_command->>'overrideId';
        delete from public.group_override_sets s
        where s.tournament_id = p_tournament_id and s.id = v_command->>'overrideId';
        if not found then raise exception 'Unknown group override.'; end if;

      elsif v_type = 'update_tournament_metadata' then
        v_update := v_command->'update';
        if pg_catalog.jsonb_typeof(v_update) <> 'object' then raise exception 'Malformed metadata update.'; end if;
        update public.tournaments set
          status = case when v_update ? 'status' then v_update->>'status' else status end,
          current_round_id = case when v_update ? 'currentRoundId' then nullif(v_update->>'currentRoundId', '') else current_round_id end,
          reference_data_complete = case when v_update ? 'referenceDataComplete' then (v_update->>'referenceDataComplete')::boolean else reference_data_complete end,
          missing_official_data = case when v_update ? 'missingOfficialData' then array(select value #>> '{}' from pg_catalog.jsonb_array_elements(v_update->'missingOfficialData')) else missing_official_data end,
          updated_at = pg_catalog.clock_timestamp()
        where id = p_tournament_id;
      else
        raise exception 'Unsupported administration command.';
      end if;
    end loop;

    loop
      with resolved as (
        select target.id,
          case when hs.source_match_id is null then target.home_country_id
            when hm.status = 'completed' and hs.outcome = 'winner' then hm.advancing_country_id
            when hm.status = 'completed' and hs.outcome = 'loser' then case when hm.advancing_country_id = hm.home_country_id then hm.away_country_id else hm.home_country_id end
            else null end as expected_home,
          case when aws.source_match_id is null then target.away_country_id
            when am.status = 'completed' and aws.outcome = 'winner' then am.advancing_country_id
            when am.status = 'completed' and aws.outcome = 'loser' then case when am.advancing_country_id = am.home_country_id then am.away_country_id else am.home_country_id end
            else null end as expected_away
        from public.matches target
        left join public.match_source_slots hs on hs.tournament_id = target.tournament_id and hs.match_id = target.id and hs.slot = 'home'
        left join public.matches hm on hm.tournament_id = hs.tournament_id and hm.id = hs.source_match_id
        left join public.match_source_slots aws on aws.tournament_id = target.tournament_id and aws.match_id = target.id and aws.slot = 'away'
        left join public.matches am on am.tournament_id = aws.tournament_id and am.id = aws.source_match_id
        where target.tournament_id = p_tournament_id and target.stage <> 'group'
      ), conflicts as (
        select m.id from public.matches m join resolved r on r.id = m.id
        where m.tournament_id = p_tournament_id and m.status = 'completed'
          and (m.home_country_id is distinct from r.expected_home or m.away_country_id is distinct from r.expected_away)
          and not (m.id = any(v_replaced_result_ids))
      )
      select count(*) into v_changed_count from conflicts;
      if v_changed_count > 0 then raise exception 'Completed downstream result requires atomic replacement.'; end if;

      with resolved as (
        select target.id,
          case when hs.source_match_id is null then target.home_country_id
            when hm.status = 'completed' and hs.outcome = 'winner' then hm.advancing_country_id
            when hm.status = 'completed' and hs.outcome = 'loser' then case when hm.advancing_country_id = hm.home_country_id then hm.away_country_id else hm.home_country_id end
            else null end as expected_home,
          case when aws.source_match_id is null then target.away_country_id
            when am.status = 'completed' and aws.outcome = 'winner' then am.advancing_country_id
            when am.status = 'completed' and aws.outcome = 'loser' then case when am.advancing_country_id = am.home_country_id then am.away_country_id else am.home_country_id end
            else null end as expected_away
        from public.matches target
        left join public.match_source_slots hs on hs.tournament_id = target.tournament_id and hs.match_id = target.id and hs.slot = 'home'
        left join public.matches hm on hm.tournament_id = hs.tournament_id and hm.id = hs.source_match_id
        left join public.match_source_slots aws on aws.tournament_id = target.tournament_id and aws.match_id = target.id and aws.slot = 'away'
        left join public.matches am on am.tournament_id = aws.tournament_id and am.id = aws.source_match_id
        where target.tournament_id = p_tournament_id and target.stage <> 'group'
      )
      update public.matches m set
        home_country_id = r.expected_home,
        away_country_id = r.expected_away,
        updated_at = pg_catalog.clock_timestamp()
      from resolved r
      where m.tournament_id = p_tournament_id and m.id = r.id
        and (m.home_country_id is distinct from r.expected_home or m.away_country_id is distinct from r.expected_away);
      get diagnostics v_changed_count = row_count;
      exit when v_changed_count = 0;
    end loop;

    v_applied_revision := v_current_revision + 1;
    update public.tournaments set
      revision = v_applied_revision,
      last_updated_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
    where id = p_tournament_id;

    set constraints all immediate;
    set constraints all deferred;
  exception when others then
    if sqlstate in ('P7401', 'P7403', 'P7S01', 'P7I01', 'P7V01') then raise; end if;
    raise exception using errcode = 'P7V01', message = 'Administration change failed validation.';
  end;

  insert into private.administration_change_sets (
    id, tournament_id, actor_user_id, commands, base_revision,
    result_revision, review_fingerprint
  ) values (
    p_change_set_id, p_tournament_id, v_actor, p_commands,
    p_expected_revision, v_applied_revision, p_review_fingerprint
  );

  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.jsonb_build_array(m.tournament_id, m.id)::pg_catalog.text, pg_catalog.to_jsonb(m)), '{}'::pg_catalog.jsonb) into v_after_matches
  from public.matches m where m.tournament_id = p_tournament_id;
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.jsonb_build_array(s.tournament_id, s.match_id, s.slot)::pg_catalog.text, pg_catalog.to_jsonb(s)), '{}'::pg_catalog.jsonb) into v_after_slots
  from public.match_source_slots s where s.tournament_id = p_tournament_id;
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.jsonb_build_array(s.tournament_id, s.id, s.group_code)::pg_catalog.text, pg_catalog.to_jsonb(s)), '{}'::pg_catalog.jsonb) into v_after_override_sets
  from public.group_override_sets s where s.tournament_id = p_tournament_id;
  select coalesce(pg_catalog.jsonb_object_agg(pg_catalog.jsonb_build_array(e.tournament_id, e.override_set_id, e.group_code, e.country_id)::pg_catalog.text, pg_catalog.to_jsonb(e)), '{}'::pg_catalog.jsonb) into v_after_override_entries
  from public.group_override_entries e where e.tournament_id = p_tournament_id;

  insert into private.audit_log (change_set_id, entity_type, entity_id, action, before_data, after_data, actor_user_id)
  select p_change_set_id, 'tournaments', pg_catalog.jsonb_build_array(p_tournament_id)::pg_catalog.text, 'update', v_before_tournament, pg_catalog.to_jsonb(t), v_actor
  from public.tournaments t where t.id = p_tournament_id;

  insert into private.audit_log (change_set_id, entity_type, entity_id, action, before_data, after_data, actor_user_id)
  select p_change_set_id, 'matches', coalesce(b.key, a.key),
    case when b.value is null then 'insert' when a.value is null then 'delete' else 'update' end,
    b.value, a.value, v_actor
  from pg_catalog.jsonb_each(v_before_matches) b
  full join pg_catalog.jsonb_each(v_after_matches) a on a.key = b.key
  where b.value is distinct from a.value;

  insert into private.audit_log (change_set_id, entity_type, entity_id, action, before_data, after_data, actor_user_id)
  select p_change_set_id, 'match_source_slots', coalesce(b.key, a.key),
    case when b.value is null then 'insert' when a.value is null then 'delete' else 'update' end,
    b.value, a.value, v_actor
  from pg_catalog.jsonb_each(v_before_slots) b
  full join pg_catalog.jsonb_each(v_after_slots) a on a.key = b.key
  where b.value is distinct from a.value;

  insert into private.audit_log (change_set_id, entity_type, entity_id, action, before_data, after_data, actor_user_id)
  select p_change_set_id, 'group_override_sets', coalesce(b.key, a.key),
    case when b.value is null then 'insert' when a.value is null then 'delete' else 'update' end,
    b.value, a.value, v_actor
  from pg_catalog.jsonb_each(v_before_override_sets) b
  full join pg_catalog.jsonb_each(v_after_override_sets) a on a.key = b.key
  where b.value is distinct from a.value;

  insert into private.audit_log (change_set_id, entity_type, entity_id, action, before_data, after_data, actor_user_id)
  select p_change_set_id, 'group_override_entries', coalesce(b.key, a.key),
    case when b.value is null then 'insert' when a.value is null then 'delete' else 'update' end,
    b.value, a.value, v_actor
  from pg_catalog.jsonb_each(v_before_override_entries) b
  full join pg_catalog.jsonb_each(v_after_override_entries) a on a.key = b.key
  where b.value is distinct from a.value;

  return pg_catalog.jsonb_build_object(
    'status', 'applied',
    'tournament_id', p_tournament_id,
    'revision', v_applied_revision::text,
    'change_set_id', p_change_set_id::text
  );
end;
$$;

alter function public.read_administration_context(pg_catalog.text) owner to postgres;
alter function public.apply_administration_change(pg_catalog.text, pg_catalog.int8, pg_catalog.uuid, pg_catalog.jsonb, pg_catalog.text) owner to postgres;
alter function private.country_belongs_to_tournament(pg_catalog.text, pg_catalog.text) owner to postgres;
alter function private.jsonb_has_exact_keys(pg_catalog.jsonb, pg_catalog.text[], pg_catalog.text[]) owner to postgres;
alter function private.jsonb_nonempty_string(pg_catalog.jsonb, pg_catalog.text) owner to postgres;
alter function private.jsonb_nullable_string(pg_catalog.jsonb, pg_catalog.text) owner to postgres;
alter function private.jsonb_nonnegative_integer(pg_catalog.jsonb, pg_catalog.text, pg_catalog.bool) owner to postgres;
alter function private.jsonb_iso_timestamp_or_null(pg_catalog.jsonb, pg_catalog.text) owner to postgres;
alter function private.validate_administration_commands(pg_catalog.text, pg_catalog.jsonb) owner to postgres;
alter function private.validate_administration_semantics(pg_catalog.text, pg_catalog.jsonb) owner to postgres;

revoke all on function private.country_belongs_to_tournament(text, text) from public, anon, authenticated;
revoke all on function private.jsonb_has_exact_keys(jsonb, text[], text[]) from public, anon, authenticated;
revoke all on function private.jsonb_nonempty_string(jsonb, text) from public, anon, authenticated;
revoke all on function private.jsonb_nullable_string(jsonb, text) from public, anon, authenticated;
revoke all on function private.jsonb_nonnegative_integer(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function private.jsonb_iso_timestamp_or_null(jsonb, text) from public, anon, authenticated;
revoke all on function private.validate_administration_commands(text, jsonb) from public, anon, authenticated;
revoke all on function private.validate_administration_semantics(text, jsonb) from public, anon, authenticated;
revoke all on function public.read_administration_context(text) from public, anon;
grant execute on function public.read_administration_context(text) to authenticated;
revoke all on function public.apply_administration_change(text, bigint, uuid, jsonb, text) from public, anon;
grant execute on function public.apply_administration_change(text, bigint, uuid, jsonb, text) to authenticated;

comment on function public.read_administration_context(text) is
  'Returns one statement-consistent canonical snapshot and persistence revision only to an allowlisted authenticated administrator.';
comment on function public.apply_administration_change(text, bigint, uuid, jsonb, text) is
  'The sole authenticated application mutation boundary: revision-locked, idempotent, validated, audited, and atomic.';
