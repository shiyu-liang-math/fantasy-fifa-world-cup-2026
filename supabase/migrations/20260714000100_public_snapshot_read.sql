create or replace function public.read_tournament_snapshot(p_tournament_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from public.tournaments t where t.id = p_tournament_id
    ) then jsonb_build_object(
      'tournament', null,
      'participants', '[]'::jsonb,
      'countries', '[]'::jsonb,
      'rounds', '[]'::jsonb,
      'groups', '[]'::jsonb,
      'group_memberships', '[]'::jsonb,
      'draft_picks', '[]'::jsonb,
      'matches', '[]'::jsonb,
      'match_source_slots', '[]'::jsonb,
      'group_override_sets', '[]'::jsonb,
      'group_override_entries', '[]'::jsonb,
      'dataset_kind', 'official_reference'
    )
    else jsonb_build_object(
      'tournament', (
        select to_jsonb(t) - 'revision' - 'created_at' - 'updated_at'
        from public.tournaments t
        where t.id = p_tournament_id
      ),
      'participants', (
        select coalesce(
          jsonb_agg(to_jsonb(p) - 'created_at' - 'updated_at' order by p.display_order),
          '[]'::jsonb
        )
        from public.participants p
        where exists (
          select 1
          from public.draft_picks d
          where d.tournament_id = p_tournament_id and d.participant_id = p.id
        )
      ),
      'countries', (
        select coalesce(
          jsonb_agg(to_jsonb(c) - 'created_at' - 'updated_at' order by c.id),
          '[]'::jsonb
        )
        from public.countries c
        where exists (
          select 1
          from public.group_memberships gm
          where gm.tournament_id = p_tournament_id and gm.country_id = c.id
        ) or exists (
          select 1
          from public.draft_picks d
          where d.tournament_id = p_tournament_id and d.country_id = c.id
        ) or exists (
          select 1
          from public.matches m
          where m.tournament_id = p_tournament_id
            and c.id in (m.home_country_id, m.away_country_id, m.advancing_country_id)
        ) or exists (
          select 1
          from public.group_override_entries e
          where e.tournament_id = p_tournament_id and e.country_id = c.id
        )
      ),
      'rounds', (
        select coalesce(
          jsonb_agg(to_jsonb(r) - 'created_at' - 'updated_at' order by r.display_order),
          '[]'::jsonb
        )
        from public.tournament_rounds r
        where r.tournament_id = p_tournament_id
      ),
      'groups', (
        select coalesce(
          jsonb_agg(to_jsonb(g) - 'created_at' - 'updated_at' order by g.display_order),
          '[]'::jsonb
        )
        from public.tournament_groups g
        where g.tournament_id = p_tournament_id
      ),
      'group_memberships', (
        select coalesce(
          jsonb_agg(to_jsonb(m) order by g.display_order, m.display_order, m.country_id),
          '[]'::jsonb
        )
        from public.group_memberships m
        join public.tournament_groups g
          on g.tournament_id = m.tournament_id and g.code = m.group_code
        where m.tournament_id = p_tournament_id
      ),
      'draft_picks', (
        select coalesce(
          jsonb_agg(to_jsonb(d) - 'created_at' - 'updated_at' order by d.id),
          '[]'::jsonb
        )
        from public.draft_picks d
        where d.tournament_id = p_tournament_id
      ),
      'matches', (
        select coalesce(
          jsonb_agg(to_jsonb(m) - 'created_at' - 'updated_at' order by m.match_number),
          '[]'::jsonb
        )
        from public.matches m
        where m.tournament_id = p_tournament_id
      ),
      'match_source_slots', (
        select coalesce(
          jsonb_agg(to_jsonb(s) order by target.match_number, s.slot),
          '[]'::jsonb
        )
        from public.match_source_slots s
        join public.matches target
          on target.tournament_id = s.tournament_id and target.id = s.match_id
        where s.tournament_id = p_tournament_id
      ),
      'group_override_sets', (
        select coalesce(
          jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at' order by g.display_order, s.id),
          '[]'::jsonb
        )
        from public.group_override_sets s
        join public.tournament_groups g
          on g.tournament_id = s.tournament_id and g.code = s.group_code
        where s.tournament_id = p_tournament_id
      ),
      'group_override_entries', (
        select coalesce(
          jsonb_agg(to_jsonb(e) order by g.display_order, e.override_set_id, e.country_id),
          '[]'::jsonb
        )
        from public.group_override_entries e
        join public.tournament_groups g
          on g.tournament_id = e.tournament_id and g.code = e.group_code
        where e.tournament_id = p_tournament_id
      ),
      'dataset_kind', 'official_reference'
    )
  end;
$$;

revoke all on function public.read_tournament_snapshot(text) from public;
grant execute on function public.read_tournament_snapshot(text) to anon, authenticated;

comment on function public.read_tournament_snapshot(text) is
  'Returns one RLS-governed, statement-consistent canonical tournament graph for server-side public reads.';
