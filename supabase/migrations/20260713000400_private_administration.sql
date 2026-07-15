create table private.administrator_allowlist (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table private.administration_change_sets (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete restrict,
  actor_user_id uuid not null,
  reason text,
  commands jsonb not null check (jsonb_typeof(commands) = 'array'),
  base_revision bigint not null check (base_revision >= 0),
  result_revision bigint not null check (result_revision >= 0),
  review_metadata jsonb not null default '{}' check (jsonb_typeof(review_metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (reason is null or btrim(reason) <> '')
);

create table private.audit_log (
  id bigint generated always as identity primary key,
  change_set_id uuid not null
    references private.administration_change_sets(id) on delete restrict,
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id text not null check (btrim(entity_id) <> ''),
  action text not null check (action in ('insert', 'update', 'delete')),
  before_data jsonb,
  after_data jsonb,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint audit_log_before_after_check check (
    (action = 'insert' and before_data is null and after_data is not null)
    or (action = 'update' and before_data is not null and after_data is not null)
    or (action = 'delete' and before_data is not null and after_data is null)
  )
);

create index administration_change_sets_tournament_idx
  on private.administration_change_sets(tournament_id, created_at desc);

create index administration_change_sets_actor_idx
  on private.administration_change_sets(actor_user_id, created_at desc);

create index audit_log_change_set_idx on private.audit_log(change_set_id, id);
create index audit_log_entity_idx
  on private.audit_log(entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on private.audit_log(actor_user_id, created_at desc);

create or replace function private.reject_historical_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Administration history is append-only.';
end;
$$;

create trigger administration_change_sets_append_only
before update or delete on private.administration_change_sets
for each row execute function private.reject_historical_audit_mutation();

create trigger administration_change_sets_no_truncate
before truncate on private.administration_change_sets
for each statement execute function private.reject_historical_audit_mutation();

create trigger audit_log_append_only
before update or delete on private.audit_log
for each row execute function private.reject_historical_audit_mutation();

create trigger audit_log_no_truncate
before truncate on private.audit_log
for each statement execute function private.reject_historical_audit_mutation();

comment on column private.administration_change_sets.actor_user_id is
  'Immutable Supabase Auth UUID captured historically without an auth.users FK, so Auth-account removal cannot invalidate history.';

comment on column private.audit_log.actor_user_id is
  'Durable historical actor UUID with no auth.users FK by design.';

comment on table private.administration_change_sets is
  'Schema support for future reviewed transactions. Milestone 5 does not create the mutation function or automatic canonical auditing.';

comment on table private.audit_log is
  'Append-only audit storage. Milestone 5 does not claim that canonical writes are automatically audited.';
