create table public.tournaments (
  id text primary key,
  name text not null check (btrim(name) <> ''),
  year smallint not null check (year between 1900 and 2200),
  status text not null check (status in ('planned', 'active', 'completed')),
  current_round_id text,
  last_updated_at timestamptz not null,
  reference_data_complete boolean not null default false,
  missing_official_data text[] not null default '{}',
  rules_version text not null check (btrim(rules_version) <> ''),
  rules_updated_at date not null,
  golden_goal_includes_group_stage boolean not null
    check (golden_goal_includes_group_stage),
  shootout_kicks_excluded boolean not null check (shootout_kicks_excluded),
  ranking_method text not null check (ranking_method = 'standard_competition'),
  star_ranking_tolerance double precision not null
    check (
      star_ranking_tolerance > 0
      and star_ranking_tolerance < 'Infinity'::double precision
    ),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_incompleteness_explained check (
    reference_data_complete or cardinality(missing_official_data) > 0
  )
);

create table public.participants (
  id text primary key,
  slug text not null unique check (btrim(slug) <> ''),
  name text not null check (btrim(name) <> ''),
  abbreviation text not null unique check (btrim(abbreviation) <> ''),
  display_order smallint not null unique check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.countries (
  id text primary key,
  name text not null check (btrim(name) <> ''),
  fifa_code text not null unique check (fifa_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_rounds (
  tournament_id text not null references public.tournaments(id) on delete restrict,
  id text not null,
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
  name text not null check (btrim(name) <> ''),
  phase text not null check (phase in ('group', 'knockout', 'placement')),
  display_order smallint not null check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, id),
  unique (tournament_id, stage),
  unique (tournament_id, display_order),
  constraint tournament_rounds_stage_phase_check check (
    (stage = 'group' and phase = 'group')
    or (stage in ('round_of_32', 'round_of_16', 'quarterfinal', 'semifinal') and phase = 'knockout')
    or (stage in ('third_place', 'final') and phase = 'placement')
  )
);

alter table public.tournaments
  add constraint tournaments_current_round_same_tournament_fk
  foreign key (id, current_round_id)
  references public.tournament_rounds(tournament_id, id)
  on delete restrict
  deferrable initially deferred;

create table public.tournament_groups (
  tournament_id text not null references public.tournaments(id) on delete restrict,
  code text not null check (code ~ '^[A-L]$'),
  display_order smallint not null check (display_order between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, code),
  unique (tournament_id, display_order)
);

create table public.group_memberships (
  tournament_id text not null,
  group_code text not null,
  country_id text not null references public.countries(id) on delete restrict,
  display_order smallint not null check (display_order between 1 and 4),
  primary key (tournament_id, group_code, country_id),
  unique (tournament_id, country_id),
  unique (tournament_id, group_code, display_order),
  foreign key (tournament_id, group_code)
    references public.tournament_groups(tournament_id, code)
    on delete restrict
);

create index group_memberships_country_idx
  on public.group_memberships(country_id);

create table public.draft_picks (
  id text primary key,
  tournament_id text not null references public.tournaments(id) on delete restrict,
  participant_id text not null references public.participants(id) on delete restrict,
  country_id text not null references public.countries(id) on delete restrict,
  draft_value smallint not null check (draft_value in (1, 2, 3)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, country_id),
  unique (tournament_id, participant_id, country_id)
);

create index draft_picks_participant_idx
  on public.draft_picks(tournament_id, participant_id);

create index draft_picks_country_idx on public.draft_picks(country_id);

comment on column public.tournaments.revision is
  'Persistence concurrency token. It is incremented only by the future reviewed mutation function.';

comment on table public.group_memberships is
  'Canonical group assignment. Country.groupCode and TournamentGroup.countryIds are hydrated from this table.';
