create extension if not exists pgtap with schema extensions;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

comment on schema private is
  'Non-public authorization and audit infrastructure. This schema is not exposed by the Data API.';
