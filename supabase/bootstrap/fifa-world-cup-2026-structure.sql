-- GENERATED guarded structural bootstrap. No match results, credentials, or signatures.
-- Validates every pre-existing structural row before inserting missing rows.
-- Structure SHA-256: 8baa30eb144b90eba1710054ca8a375e3e85ce1a3c81726273f8207779de02b3.

begin;
select pg_advisory_xact_lock(hashtextextended('bootstrap:fifa-world-cup-2026', 0));

do $$ begin
  if exists (select 1 from public.tournaments where id = 'fifa-world-cup-2026' and (name, year, rules_version, golden_goal_includes_group_stage, shootout_kicks_excluded, ranking_method, star_ranking_tolerance) is distinct from ('2026 FIFA World Cup', 2026::smallint, '2026-07-12', true, true, 'standard_competition', 0.01::double precision)) then
    raise exception 'Conflicting existing tournament row';
  end if;
end $$;
insert into public.tournaments (id, name, year, status, current_round_id, last_updated_at, reference_data_complete, missing_official_data, rules_version, rules_updated_at, golden_goal_includes_group_stage, shootout_kicks_excluded, ranking_method, star_ranking_tolerance, revision, created_at, updated_at) values
  ('fifa-world-cup-2026', '2026 FIFA World Cup', 2026, 'planned', null, '2026-07-15T05:56:29Z', false, array['Complete authoritative list of all 48 tournament countries', 'Official group assignments', 'Official fixture schedule and match numbers', 'Official knockout bracket mapping'], '2026-07-12', '2026-07-12', true, true, 'standard_competition', 0.01, 0, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z')
on conflict (id) do nothing;

create temporary table expected_participants (like public.participants including defaults) on commit drop;
insert into expected_participants (id, slug, name, abbreviation, display_order, created_at, updated_at) values
  ('lyla', 'lyla', 'Lyla', 'L', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('shiyu', 'shiyu', 'Shiyu', 'S', 2, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('ivy', 'ivy', 'Ivy', 'Y', 3, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('xun', 'xun', 'Xun', 'X', 4, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('houji-yujin', 'houji-and-yujin', 'Houji & Yujin', 'H&J', 5, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z');
do $$ begin
  if exists (select 1 from public.participants a join expected_participants e on a.id = e.id where a.id is distinct from e.id or a.slug is distinct from e.slug or a.name is distinct from e.name or a.abbreviation is distinct from e.abbreviation or a.display_order is distinct from e.display_order) then
    raise exception 'Conflicting existing participants row';
  end if;
  if exists (select 1 from public.participants a where true and not exists (select 1 from expected_participants e where a.id = e.id)) then
    raise exception 'Unexpected existing participants row';
  end if;
end $$;
insert into public.participants (id, slug, name, abbreviation, display_order, created_at, updated_at) select id, slug, name, abbreviation, display_order, created_at, updated_at from expected_participants on conflict do nothing;

create temporary table expected_countries (like public.countries including defaults) on commit drop;
insert into expected_countries (id, name, fifa_code, created_at, updated_at) values
  ('algeria', 'Algeria', 'ALG', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('argentina', 'Argentina', 'ARG', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('australia', 'Australia', 'AUS', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('austria', 'Austria', 'AUT', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('belgium', 'Belgium', 'BEL', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('bosnia-and-herzegovina', 'Bosnia and Herzegovina', 'BIH', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('brazil', 'Brazil', 'BRA', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('cabo-verde', 'Cabo Verde', 'CPV', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('canada', 'Canada', 'CAN', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('colombia', 'Colombia', 'COL', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('congo-dr', 'Congo DR', 'COD', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('croatia', 'Croatia', 'CRO', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('curacao', 'Curaçao', 'CUW', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('czechia', 'Czechia', 'CZE', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('ecuador', 'Ecuador', 'ECU', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('egypt', 'Egypt', 'EGY', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('england', 'England', 'ENG', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('france', 'France', 'FRA', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('germany', 'Germany', 'GER', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('ghana', 'Ghana', 'GHA', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('haiti', 'Haiti', 'HAI', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('iran', 'Iran', 'IRN', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('iraq', 'Iraq', 'IRQ', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('ivory-coast', 'Ivory Coast', 'CIV', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('japan', 'Japan', 'JPN', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('jordan', 'Jordan', 'JOR', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('mexico', 'Mexico', 'MEX', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('morocco', 'Morocco', 'MAR', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('netherlands', 'Netherlands', 'NED', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('new-zealand', 'New Zealand', 'NZL', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('norway', 'Norway', 'NOR', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('panama', 'Panama', 'PAN', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('paraguay', 'Paraguay', 'PAR', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('portugal', 'Portugal', 'POR', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('qatar', 'Qatar', 'QAT', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('saudi-arabia', 'Saudi Arabia', 'KSA', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('scotland', 'Scotland', 'SCO', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('senegal', 'Senegal', 'SEN', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('south-africa', 'South Africa', 'RSA', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('south-korea', 'South Korea', 'KOR', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('spain', 'Spain', 'ESP', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('sweden', 'Sweden', 'SWE', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('switzerland', 'Switzerland', 'SUI', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('tunisia', 'Tunisia', 'TUN', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('turkiye', 'Türkiye', 'TUR', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('united-states', 'United States', 'USA', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('uruguay', 'Uruguay', 'URU', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('uzbekistan', 'Uzbekistan', 'UZB', '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z');
do $$ begin
  if exists (select 1 from public.countries a join expected_countries e on a.id = e.id where a.id is distinct from e.id or a.name is distinct from e.name or a.fifa_code is distinct from e.fifa_code) then
    raise exception 'Conflicting existing countries row';
  end if;
  if exists (select 1 from public.countries a where true and not exists (select 1 from expected_countries e where a.id = e.id)) then
    raise exception 'Unexpected existing countries row';
  end if;
end $$;
insert into public.countries (id, name, fifa_code, created_at, updated_at) select id, name, fifa_code, created_at, updated_at from expected_countries on conflict do nothing;

create temporary table expected_tournament_rounds (like public.tournament_rounds including defaults) on commit drop;
insert into expected_tournament_rounds (tournament_id, id, stage, name, phase, display_order, created_at, updated_at) values
  ('fifa-world-cup-2026', 'group', 'group', 'Group stage', 'group', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'round-of-32', 'round_of_32', 'Round of 32', 'knockout', 2, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'round-of-16', 'round_of_16', 'Round of 16', 'knockout', 3, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'quarterfinal', 'quarterfinal', 'Quarterfinals', 'knockout', 4, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'semifinal', 'semifinal', 'Semifinals', 'knockout', 5, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'third-place', 'third_place', 'Third-place match', 'placement', 6, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'final', 'final', 'Final', 'placement', 7, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z');
do $$ begin
  if exists (select 1 from public.tournament_rounds a join expected_tournament_rounds e on a.tournament_id = e.tournament_id and a.id = e.id where a.tournament_id is distinct from e.tournament_id or a.id is distinct from e.id or a.stage is distinct from e.stage or a.name is distinct from e.name or a.phase is distinct from e.phase or a.display_order is distinct from e.display_order) then
    raise exception 'Conflicting existing tournament_rounds row';
  end if;
  if exists (select 1 from public.tournament_rounds a where a.tournament_id = 'fifa-world-cup-2026' and not exists (select 1 from expected_tournament_rounds e where a.tournament_id = e.tournament_id and a.id = e.id)) then
    raise exception 'Unexpected existing tournament_rounds row';
  end if;
end $$;
insert into public.tournament_rounds (tournament_id, id, stage, name, phase, display_order, created_at, updated_at) select tournament_id, id, stage, name, phase, display_order, created_at, updated_at from expected_tournament_rounds on conflict do nothing;

create temporary table expected_tournament_groups (like public.tournament_groups including defaults) on commit drop;
insert into expected_tournament_groups (tournament_id, code, display_order, created_at, updated_at) values
  ('fifa-world-cup-2026', 'A', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'B', 2, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'C', 3, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'D', 4, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'E', 5, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'F', 6, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'G', 7, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'H', 8, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'I', 9, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'J', 10, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'K', 11, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('fifa-world-cup-2026', 'L', 12, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z');
do $$ begin
  if exists (select 1 from public.tournament_groups a join expected_tournament_groups e on a.tournament_id = e.tournament_id and a.code = e.code where a.tournament_id is distinct from e.tournament_id or a.code is distinct from e.code or a.display_order is distinct from e.display_order) then
    raise exception 'Conflicting existing tournament_groups row';
  end if;
  if exists (select 1 from public.tournament_groups a where a.tournament_id = 'fifa-world-cup-2026' and not exists (select 1 from expected_tournament_groups e where a.tournament_id = e.tournament_id and a.code = e.code)) then
    raise exception 'Unexpected existing tournament_groups row';
  end if;
end $$;
insert into public.tournament_groups (tournament_id, code, display_order, created_at, updated_at) select tournament_id, code, display_order, created_at, updated_at from expected_tournament_groups on conflict do nothing;

create temporary table expected_group_memberships (like public.group_memberships including defaults) on commit drop;
insert into expected_group_memberships (tournament_id, group_code, country_id, display_order) values
  ('fifa-world-cup-2026', 'A', 'mexico', 1),
  ('fifa-world-cup-2026', 'A', 'south-africa', 2),
  ('fifa-world-cup-2026', 'A', 'south-korea', 3),
  ('fifa-world-cup-2026', 'A', 'czechia', 4),
  ('fifa-world-cup-2026', 'B', 'canada', 1),
  ('fifa-world-cup-2026', 'B', 'bosnia-and-herzegovina', 2),
  ('fifa-world-cup-2026', 'B', 'qatar', 3),
  ('fifa-world-cup-2026', 'B', 'switzerland', 4),
  ('fifa-world-cup-2026', 'C', 'brazil', 1),
  ('fifa-world-cup-2026', 'C', 'morocco', 2),
  ('fifa-world-cup-2026', 'C', 'haiti', 3),
  ('fifa-world-cup-2026', 'C', 'scotland', 4),
  ('fifa-world-cup-2026', 'D', 'united-states', 1),
  ('fifa-world-cup-2026', 'D', 'paraguay', 2),
  ('fifa-world-cup-2026', 'D', 'australia', 3),
  ('fifa-world-cup-2026', 'D', 'turkiye', 4),
  ('fifa-world-cup-2026', 'E', 'germany', 1),
  ('fifa-world-cup-2026', 'E', 'curacao', 2),
  ('fifa-world-cup-2026', 'E', 'ivory-coast', 3),
  ('fifa-world-cup-2026', 'E', 'ecuador', 4),
  ('fifa-world-cup-2026', 'F', 'netherlands', 1),
  ('fifa-world-cup-2026', 'F', 'japan', 2),
  ('fifa-world-cup-2026', 'F', 'sweden', 3),
  ('fifa-world-cup-2026', 'F', 'tunisia', 4),
  ('fifa-world-cup-2026', 'G', 'belgium', 1),
  ('fifa-world-cup-2026', 'G', 'egypt', 2),
  ('fifa-world-cup-2026', 'G', 'iran', 3),
  ('fifa-world-cup-2026', 'G', 'new-zealand', 4),
  ('fifa-world-cup-2026', 'H', 'spain', 1),
  ('fifa-world-cup-2026', 'H', 'cabo-verde', 2),
  ('fifa-world-cup-2026', 'H', 'saudi-arabia', 3),
  ('fifa-world-cup-2026', 'H', 'uruguay', 4),
  ('fifa-world-cup-2026', 'I', 'france', 1),
  ('fifa-world-cup-2026', 'I', 'senegal', 2),
  ('fifa-world-cup-2026', 'I', 'iraq', 3),
  ('fifa-world-cup-2026', 'I', 'norway', 4),
  ('fifa-world-cup-2026', 'J', 'argentina', 1),
  ('fifa-world-cup-2026', 'J', 'algeria', 2),
  ('fifa-world-cup-2026', 'J', 'austria', 3),
  ('fifa-world-cup-2026', 'J', 'jordan', 4),
  ('fifa-world-cup-2026', 'K', 'portugal', 1),
  ('fifa-world-cup-2026', 'K', 'congo-dr', 2),
  ('fifa-world-cup-2026', 'K', 'uzbekistan', 3),
  ('fifa-world-cup-2026', 'K', 'colombia', 4),
  ('fifa-world-cup-2026', 'L', 'england', 1),
  ('fifa-world-cup-2026', 'L', 'croatia', 2),
  ('fifa-world-cup-2026', 'L', 'ghana', 3),
  ('fifa-world-cup-2026', 'L', 'panama', 4);
do $$ begin
  if exists (select 1 from public.group_memberships a join expected_group_memberships e on a.tournament_id = e.tournament_id and a.group_code = e.group_code and a.country_id = e.country_id where a.tournament_id is distinct from e.tournament_id or a.group_code is distinct from e.group_code or a.country_id is distinct from e.country_id or a.display_order is distinct from e.display_order) then
    raise exception 'Conflicting existing group_memberships row';
  end if;
  if exists (select 1 from public.group_memberships a where a.tournament_id = 'fifa-world-cup-2026' and not exists (select 1 from expected_group_memberships e where a.tournament_id = e.tournament_id and a.group_code = e.group_code and a.country_id = e.country_id)) then
    raise exception 'Unexpected existing group_memberships row';
  end if;
end $$;
insert into public.group_memberships (tournament_id, group_code, country_id, display_order) select tournament_id, group_code, country_id, display_order from expected_group_memberships on conflict do nothing;

create temporary table expected_draft_picks (like public.draft_picks including defaults) on commit drop;
insert into expected_draft_picks (id, tournament_id, participant_id, country_id, draft_value, created_at, updated_at) values
  ('lyla-france', 'fifa-world-cup-2026', 'lyla', 'france', 3, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('lyla-colombia', 'fifa-world-cup-2026', 'lyla', 'colombia', 2, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('lyla-brazil', 'fifa-world-cup-2026', 'lyla', 'brazil', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('lyla-norway', 'fifa-world-cup-2026', 'lyla', 'norway', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('lyla-south-korea', 'fifa-world-cup-2026', 'lyla', 'south-korea', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('shiyu-spain', 'fifa-world-cup-2026', 'shiyu', 'spain', 3, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('shiyu-england', 'fifa-world-cup-2026', 'shiyu', 'england', 2, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('shiyu-united-states', 'fifa-world-cup-2026', 'shiyu', 'united-states', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('shiyu-canada', 'fifa-world-cup-2026', 'shiyu', 'canada', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('shiyu-belgium', 'fifa-world-cup-2026', 'shiyu', 'belgium', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('ivy-portugal', 'fifa-world-cup-2026', 'ivy', 'portugal', 3, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('ivy-germany', 'fifa-world-cup-2026', 'ivy', 'germany', 2, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('ivy-uruguay', 'fifa-world-cup-2026', 'ivy', 'uruguay', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('ivy-netherlands', 'fifa-world-cup-2026', 'ivy', 'netherlands', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('ivy-senegal', 'fifa-world-cup-2026', 'ivy', 'senegal', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('xun-argentina', 'fifa-world-cup-2026', 'xun', 'argentina', 3, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('xun-croatia', 'fifa-world-cup-2026', 'xun', 'croatia', 2, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('xun-mexico', 'fifa-world-cup-2026', 'xun', 'mexico', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('xun-japan', 'fifa-world-cup-2026', 'xun', 'japan', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('xun-morocco', 'fifa-world-cup-2026', 'xun', 'morocco', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('houji-yujin-switzerland', 'fifa-world-cup-2026', 'houji-yujin', 'switzerland', 3, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('houji-yujin-sweden', 'fifa-world-cup-2026', 'houji-yujin', 'sweden', 2, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('houji-yujin-scotland', 'fifa-world-cup-2026', 'houji-yujin', 'scotland', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('houji-yujin-iran', 'fifa-world-cup-2026', 'houji-yujin', 'iran', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z'),
  ('houji-yujin-ivory-coast', 'fifa-world-cup-2026', 'houji-yujin', 'ivory-coast', 1, '2026-07-15T05:56:29Z', '2026-07-15T05:56:29Z');
do $$ begin
  if exists (select 1 from public.draft_picks a join expected_draft_picks e on a.id = e.id where a.id is distinct from e.id or a.tournament_id is distinct from e.tournament_id or a.participant_id is distinct from e.participant_id or a.country_id is distinct from e.country_id or a.draft_value is distinct from e.draft_value) then
    raise exception 'Conflicting existing draft_picks row';
  end if;
  if exists (select 1 from public.draft_picks a where a.tournament_id = 'fifa-world-cup-2026' and not exists (select 1 from expected_draft_picks e where a.id = e.id)) then
    raise exception 'Unexpected existing draft_picks row';
  end if;
end $$;
insert into public.draft_picks (id, tournament_id, participant_id, country_id, draft_value, created_at, updated_at) select id, tournament_id, participant_id, country_id, draft_value, created_at, updated_at from expected_draft_picks on conflict do nothing;

update public.tournaments set current_round_id = coalesce(current_round_id, 'group') where id = 'fifa-world-cup-2026';
commit;
