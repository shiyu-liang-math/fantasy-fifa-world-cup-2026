# Local database foundation

The local PostgreSQL/Supabase foundation stores canonical tournament data and
provides the read interface used by the Next.js public application. Persistent
administrator mutations remain deferred.

## Prerequisites

- Node.js 24
- npm 11
- Docker Desktop or a compatible Docker Engine with Compose v2

The repository pins Supabase CLI 2.109.1 as a development dependency. No Supabase login, hosted project, project link, hosted credentials, or service-role key is needed for local work.

## Local commands

```bash
npm install
npx supabase start
npx supabase status
npm run db:reset
npm run test:db
npm run test:db-equivalence
```

`npm run db:verify` performs a reset, the pgTAP suite, and the live seed-to-TypeScript comparison.

The local configuration enables the database, API gateway, PostgREST, and Auth services needed for realistic local security behavior. Unrelated Studio, Storage, Realtime, Edge Runtime, Analytics, Mailpit, and Vector services are disabled. The generated local keys shown by `supabase status` are disposable development defaults and must never be used in production.

Stop only this repository's stack with:

```bash
npx supabase stop
```

## Migration order

1. `20260713000100_extensions_and_schemas.sql` enables pgTAP and creates the non-exposed `private` schema.
2. `20260713000200_core_tables.sql` creates tournament metadata/rules, participants, countries, rounds, groups, memberships, and draft picks.
3. `20260713000300_matches_overrides_and_constraints.sql` creates matches, retained source slots, group overrides, indexes, and deferred validators.
4. `20260713000400_private_administration.sql` creates private change-set and audit storage with append-only protection.
5. `20260713000500_rls_and_privileges.sql` creates immutable-UUID administrator recognition, explicit read grants, RLS, and browser-role write denial.
6. `20260714000100_public_snapshot_read.sql` adds the narrowly granted,
   statement-consistent public snapshot function.

## Application read configuration

The server requires these runtime values:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local anonymous key>
```

Obtain disposable local values with `npx supabase status`. Do not copy local
defaults into source control. Both variables deliberately lack a `NEXT_PUBLIC_`
prefix, and browser components never import the Supabase client.

The application neither recognizes nor requires a service-role credential.
Missing or malformed configuration produces a safe setup state rather than a
canonical-data fallback.

## Consistent public snapshot RPC

`public.read_tournament_snapshot(text)` returns the raw canonical graph needed
to hydrate `TournamentDataSnapshot`: tournament/rules metadata, participants,
countries, rounds, groups, memberships, draft picks, matches, source slots, and
group overrides. It performs no award, scoring, standings, qualification, or
progression calculation.

The function is one stable SQL statement, so all returned collections share one
PostgreSQL statement-level MVCC snapshot. Every array has an explicit stable
order. Participants and countries are included only when a canonical row links
them to the requested tournament. An unknown tournament returns a null
tournament and empty collections, so unrelated global rows cannot enter either
kind of response.

The function is `SECURITY INVOKER`, fixes an empty `search_path`, fully qualifies
all objects, and is executable only by `anon` and `authenticated`. Reads remain
subject to the existing grants and RLS policies. `PUBLIC` has no execution
privilege. The function contains no writes, dynamic SQL, security definer
bypass, or private-schema access.

Server-side mapping validates the complete payload before publishing it to page
models. Group qualification and progression remain deterministic TypeScript
derivations instead of mutable database counters.

## Canonical schema

Public canonical tables are:

- `tournaments`
- `participants`
- `countries`
- `tournament_rounds`
- `tournament_groups`
- `group_memberships`
- `draft_picks`
- `matches`
- `match_source_slots`
- `group_override_sets`
- `group_override_entries`

Country/participant goal totals, Stars, standings totals, group qualifications, progression, elimination, ranks, and award leaders remain derived in TypeScript and are not stored as mutable counters.

`matches.stage` and `matches.data_classification` are retained to match the existing `MatchRecord` contract exactly. Their SQL literal constraints use the same values as the TypeScript unions, and deferred validation requires the stored stage to equal the referenced round stage.

Group assignment is stored once in `group_memberships`. The server row mapper
hydrates both `Country.groupCode` and `TournamentGroup.countryIds` without
changing their existing contracts.

## Same-context relationships

Composite keys and foreign keys enforce that:

- `current_round_id` belongs to its tournament.
- A match's round belongs to its tournament.
- Both sides of a source-slot relationship belong to the same tournament.
- An override entry belongs to the exact set, tournament, and group named by the row.
- An override country belongs to that tournament group.

Referenced canonical records use restrictive deletion behavior.

## Deferred validation

Deferred constraint triggers validate cross-row or stage-aware rules that cannot be expressed safely with a row-local `CHECK`:

- Match stage agrees with round stage.
- Group fixtures use two countries from the same group and cannot use source slots, shootouts, or advancing countries.
- Completed knockout matches identify the score or shootout winner.
- Source matches come from earlier rounds and source graphs are acyclic.
- Retained resolved source slots agree with the source winner or loser.
- Ranked group overrides include every group country exactly once.
- A tournament marked reference-complete has 12 groups and 48 memberships, four per group.

Source slots are retained after resolution. A null home/away country with a source slot hydrates an unresolved slot. Once the source resolves, the country may be populated while the source slot remains; validation requires the two facts to agree.

## Read-only application security

`anon` and `authenticated` receive `SELECT` only on public canonical tables. Neither role receives `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE`, including authenticated users recognized as administrators. RLS contains public read policies and no canonical write policies. Application roles have no application-schema sequence privileges, no private-table privileges, and no function execution privilege except the authenticated administrator boolean helper. Default privileges keep future application-schema objects closed until explicitly reviewed and granted.

`private.is_tournament_administrator()` is a narrowly scoped `SECURITY DEFINER` helper that checks `auth.uid()` against `private.administrator_allowlist`. It grants no mutation capability. A later milestone will introduce one reviewed transactional mutation function that authorizes, checks revision, validates, applies the complete batch, records audit history, increments revision, and rolls back atomically.

Do not authorize using browser-side email checks and do not expose a service-role key to the application.

## Administrator bootstrap

After creating the administrator through Supabase Auth, obtain the immutable Auth user UUID using trusted administration tooling. As database owner, insert that UUID into the private allowlist:

```sql
insert into private.administrator_allowlist (user_id)
values ('00000000-0000-0000-0000-000000000000');
```

Replace the placeholder with the actual Auth UUID. Never seed a production administrator email or UUID in public canonical data.

The active allowlist has a restrictive `auth.users` foreign key. Historical `actor_user_id` fields intentionally have no `auth.users` foreign key, so removing an Auth account cannot delete or invalidate change-set and audit history.

## Audit boundary

`private.administration_change_sets` and `private.audit_log` are private, indexed, and append-only: updates, deletes, and truncation are rejected. They support future reviewed transactions but are not automatically populated in Milestone 5. Because application roles cannot mutate canonical tables directly and no mutation function exists yet, this milestone does not claim automatic canonical auditing.

## Seeds

`supabase/seed.sql` is the only reset seed configured in `config.toml`. It contains:

- The incomplete but truthful tournament/rules metadata
- Five participants
- The 25 currently authoritative drafted countries
- 25 draft picks
- Seven rounds
- Empty Groups A through L
- No matches, results, group assignments, administrator IDs, or invented official data

`supabase/seeds/development.sql` is fictional and excluded from automatic reset. To apply it manually after a clean reset:

```bash
docker exec -i supabase_db_Fantasy-FIFA-World-Cup-2026 \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < supabase/seeds/development.sql
```

Run `npm run db:reset` afterward to return to the stable reference dataset.

## Tests

`npx supabase test db` runs pgTAP coverage for:

- Schema and deterministic stable-seed contents
- Foreign keys, uniqueness, checks, and same-context relationships
- Match state, winner, source-slot, cycle, and override invariants
- Public reads and direct canonical DML denial for every browser role
- Immutable-UUID administrator recognition
- Sensitive-table privacy
- Append-only audit history and durable actor UUIDs
- Transaction rollback

`npm run test:db-equivalence` reads the live local database and compares its complete stable canonical projection—including any matches, source slots, or group overrides—to `REFERENCE_SNAPSHOT`. The normal `npm test` run skips this Docker-dependent test; the dedicated npm lifecycle command enables it explicitly without relying on platform-specific shell environment-assignment syntax.

That command retains two separate proofs: the original independent stable-seed
projection and a second check that the production RPC plus runtime mapper hydrate
the same approved snapshot.

## Read caching

One server render deduplicates snapshot loads across the header and page-model
services. Local development does not persist snapshots, so resets and manual
database work appear on the next request. Production persistently caches only a
successfully mapped and semantically valid snapshot for approximately 60
seconds. Configuration, network, malformed-payload, and invalid-canonical-data
failures are not cached. The cache identity and future invalidation tag include
`fifa-world-cup-2026`; Milestone 7 can invalidate that tag after reviewed writes.

## Troubleshooting public reads

- **Configuration message:** confirm `.env.local` contains `SUPABASE_URL` and
  `SUPABASE_ANON_KEY`, then restart `npm run dev`.
- **Temporarily unavailable:** run `npx supabase status`; if necessary run
  `npx supabase start` followed by `npm run db:reset`.
- **Invalid canonical data:** run `npm run db:verify` and inspect server logs or
  database test output. Public UI intentionally withholds standings.
- **Unexpected fictional results:** run `npm run db:reset`. The fictional
  development seed is manual-only and is never an application fallback.
- **Stale production read:** successful snapshots may remain visible for up to
  approximately 60 seconds. Development reads are not persistently cached.

Run the complete verification boundary with:

```bash
npm test
npm run db:verify
npm run lint
npm run typecheck
npm run format:check
npm run build
git diff --check
```
