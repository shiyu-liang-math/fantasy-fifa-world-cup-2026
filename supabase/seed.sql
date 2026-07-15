-- Stable, production-like reference seed only.
-- This deliberately contains no fictional matches, group allocations, results,
-- administrator identities, or invented official tournament data.

begin;

insert into public.tournaments (
  id,
  name,
  year,
  status,
  current_round_id,
  last_updated_at,
  reference_data_complete,
  missing_official_data,
  rules_version,
  rules_updated_at,
  golden_goal_includes_group_stage,
  shootout_kicks_excluded,
  ranking_method,
  star_ranking_tolerance,
  revision,
  created_at,
  updated_at
) values (
  'fifa-world-cup-2026',
  '2026 FIFA World Cup',
  2026,
  'planned',
  null,
  '2026-07-12T00:00:00.000Z',
  false,
  array[
    'Complete authoritative list of all 48 tournament countries',
    'Official group assignments',
    'Official fixture schedule and match numbers',
    'Official knockout bracket mapping'
  ],
  '2026-07-12',
  '2026-07-12',
  true,
  true,
  'standard_competition',
  0.01,
  0,
  '2026-07-12T00:00:00.000Z',
  '2026-07-12T00:00:00.000Z'
);

insert into public.participants (
  id, slug, name, abbreviation, display_order, created_at, updated_at
) values
  ('lyla', 'lyla', 'Lyla', 'L', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('shiyu', 'shiyu', 'Shiyu', 'S', 2, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('ivy', 'ivy', 'Ivy', 'Y', 3, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('xun', 'xun', 'Xun', 'X', 4, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('houji-yujin', 'houji-and-yujin', 'Houji & Yujin', 'H&J', 5, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z');

insert into public.countries (id, name, fifa_code, created_at, updated_at) values
  ('france', 'France', 'FRA', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('colombia', 'Colombia', 'COL', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('brazil', 'Brazil', 'BRA', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('norway', 'Norway', 'NOR', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('south-korea', 'South Korea', 'KOR', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('spain', 'Spain', 'ESP', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('england', 'England', 'ENG', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('united-states', 'United States', 'USA', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('canada', 'Canada', 'CAN', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('belgium', 'Belgium', 'BEL', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('portugal', 'Portugal', 'POR', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('germany', 'Germany', 'GER', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('uruguay', 'Uruguay', 'URU', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('netherlands', 'Netherlands', 'NED', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('senegal', 'Senegal', 'SEN', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('argentina', 'Argentina', 'ARG', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('croatia', 'Croatia', 'CRO', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('mexico', 'Mexico', 'MEX', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('japan', 'Japan', 'JPN', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('morocco', 'Morocco', 'MAR', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('switzerland', 'Switzerland', 'SUI', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('sweden', 'Sweden', 'SWE', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('scotland', 'Scotland', 'SCO', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('iran', 'Iran', 'IRN', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('ivory-coast', 'Ivory Coast', 'CIV', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z');

insert into public.tournament_rounds (
  tournament_id, id, stage, name, phase, display_order, created_at, updated_at
) values
  ('fifa-world-cup-2026', 'group', 'group', 'Group stage', 'group', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('fifa-world-cup-2026', 'round-of-32', 'round_of_32', 'Round of 32', 'knockout', 2, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('fifa-world-cup-2026', 'round-of-16', 'round_of_16', 'Round of 16', 'knockout', 3, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('fifa-world-cup-2026', 'quarterfinal', 'quarterfinal', 'Quarterfinals', 'knockout', 4, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('fifa-world-cup-2026', 'semifinal', 'semifinal', 'Semifinals', 'knockout', 5, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('fifa-world-cup-2026', 'third-place', 'third_place', 'Third-place match', 'placement', 6, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('fifa-world-cup-2026', 'final', 'final', 'Final', 'placement', 7, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z');

update public.tournaments
set current_round_id = 'group'
where id = 'fifa-world-cup-2026';

insert into public.tournament_groups (
  tournament_id, code, display_order, created_at, updated_at
)
select
  'fifa-world-cup-2026',
  chr(64 + display_order),
  display_order,
  '2026-07-12T00:00:00.000Z'::timestamptz,
  '2026-07-12T00:00:00.000Z'::timestamptz
from generate_series(1, 12) as display_order;

insert into public.draft_picks (
  id, tournament_id, participant_id, country_id, draft_value, created_at, updated_at
) values
  ('lyla-france', 'fifa-world-cup-2026', 'lyla', 'france', 3, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('lyla-colombia', 'fifa-world-cup-2026', 'lyla', 'colombia', 2, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('lyla-brazil', 'fifa-world-cup-2026', 'lyla', 'brazil', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('lyla-norway', 'fifa-world-cup-2026', 'lyla', 'norway', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('lyla-south-korea', 'fifa-world-cup-2026', 'lyla', 'south-korea', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('shiyu-spain', 'fifa-world-cup-2026', 'shiyu', 'spain', 3, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('shiyu-england', 'fifa-world-cup-2026', 'shiyu', 'england', 2, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('shiyu-united-states', 'fifa-world-cup-2026', 'shiyu', 'united-states', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('shiyu-canada', 'fifa-world-cup-2026', 'shiyu', 'canada', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('shiyu-belgium', 'fifa-world-cup-2026', 'shiyu', 'belgium', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('ivy-portugal', 'fifa-world-cup-2026', 'ivy', 'portugal', 3, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('ivy-germany', 'fifa-world-cup-2026', 'ivy', 'germany', 2, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('ivy-uruguay', 'fifa-world-cup-2026', 'ivy', 'uruguay', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('ivy-netherlands', 'fifa-world-cup-2026', 'ivy', 'netherlands', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('ivy-senegal', 'fifa-world-cup-2026', 'ivy', 'senegal', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('xun-argentina', 'fifa-world-cup-2026', 'xun', 'argentina', 3, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('xun-croatia', 'fifa-world-cup-2026', 'xun', 'croatia', 2, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('xun-mexico', 'fifa-world-cup-2026', 'xun', 'mexico', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('xun-japan', 'fifa-world-cup-2026', 'xun', 'japan', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('xun-morocco', 'fifa-world-cup-2026', 'xun', 'morocco', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('houji-yujin-switzerland', 'fifa-world-cup-2026', 'houji-yujin', 'switzerland', 3, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('houji-yujin-sweden', 'fifa-world-cup-2026', 'houji-yujin', 'sweden', 2, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('houji-yujin-scotland', 'fifa-world-cup-2026', 'houji-yujin', 'scotland', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('houji-yujin-iran', 'fifa-world-cup-2026', 'houji-yujin', 'iran', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z'),
  ('houji-yujin-ivory-coast', 'fifa-world-cup-2026', 'houji-yujin', 'ivory-coast', 1, '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z');

commit;
