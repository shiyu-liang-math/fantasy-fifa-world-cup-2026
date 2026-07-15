create or replace function private.is_tournament_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.administrator_allowlist a
    where a.user_id = auth.uid()
  );
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_tournament_administrator() to authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

alter table public.tournaments enable row level security;
alter table public.participants enable row level security;
alter table public.countries enable row level security;
alter table public.tournament_rounds enable row level security;
alter table public.tournament_groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.draft_picks enable row level security;
alter table public.matches enable row level security;
alter table public.match_source_slots enable row level security;
alter table public.group_override_sets enable row level security;
alter table public.group_override_entries enable row level security;

alter table private.administrator_allowlist enable row level security;
alter table private.administration_change_sets enable row level security;
alter table private.audit_log enable row level security;

revoke all on table
  public.tournaments,
  public.participants,
  public.countries,
  public.tournament_rounds,
  public.tournament_groups,
  public.group_memberships,
  public.draft_picks,
  public.matches,
  public.match_source_slots,
  public.group_override_sets,
  public.group_override_entries
from anon, authenticated;

grant select on table
  public.tournaments,
  public.participants,
  public.countries,
  public.tournament_rounds,
  public.tournament_groups,
  public.group_memberships,
  public.draft_picks,
  public.matches,
  public.match_source_slots,
  public.group_override_sets,
  public.group_override_entries
to anon, authenticated;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

create policy tournaments_public_read on public.tournaments
  for select to anon, authenticated using (true);
create policy participants_public_read on public.participants
  for select to anon, authenticated using (true);
create policy countries_public_read on public.countries
  for select to anon, authenticated using (true);
create policy tournament_rounds_public_read on public.tournament_rounds
  for select to anon, authenticated using (true);
create policy tournament_groups_public_read on public.tournament_groups
  for select to anon, authenticated using (true);
create policy group_memberships_public_read on public.group_memberships
  for select to anon, authenticated using (true);
create policy draft_picks_public_read on public.draft_picks
  for select to anon, authenticated using (true);
create policy matches_public_read on public.matches
  for select to anon, authenticated using (true);
create policy match_source_slots_public_read on public.match_source_slots
  for select to anon, authenticated using (true);
create policy group_override_sets_public_read on public.group_override_sets
  for select to anon, authenticated using (true);
create policy group_override_entries_public_read on public.group_override_entries
  for select to anon, authenticated using (true);

comment on function private.is_tournament_administrator() is
  'Checks auth.uid() against the private immutable-UUID allowlist. It grants no table mutation privilege.';

comment on schema private is
  'Private authorization and historical administration data. Browser roles receive no table access.';
