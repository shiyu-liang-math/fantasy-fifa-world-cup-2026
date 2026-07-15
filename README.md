# Fantasy FIFA World Cup 2026

Mobile-first tournament tracker for a private fantasy game. The repository contains tested tournament domain logic, read-only Supabase-backed public pages, reviewed administration workflows, and a local PostgreSQL/Supabase persistence foundation.

`PRODUCT_SPEC.md` is the authoritative product and game-rules specification.

## Prerequisites

- Node.js 24 LTS
- npm 11
- Docker Desktop or a compatible Docker Engine with Compose v2

The scaffold was verified with Node.js 24.18.0 and npm 11.16.0.

## Local setup

```bash
git clone <repository-url>
cd Fantasy-FIFA-World-Cup-2026
nvm use
npm install
cp .env.example .env.local
```

Configure `.env.local` with the local public values printed by
`npx supabase status`:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local anonymous key>
```

These variables are server-only. The application does not use a service-role
key and does not expose a Supabase client to browser components.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If either public read value is absent or malformed, public pages render a safe
configuration message. They never substitute the local reference snapshot or
fictional development data.

## Local database

The Supabase CLI is pinned as a development dependency. Start the local stack and rebuild the database from all migrations and the stable seed:

```bash
npx supabase start
npm run db:reset
```

Run database, RLS, and seed-equivalence checks:

```bash
npm run test:db
npm run test:db-equivalence
```

See [docs/database.md](docs/database.md) for the schema, security boundary, seed separation, administrator bootstrap, and troubleshooting details.

## Checks

```bash
npm test
npm run db:verify
npm run lint
npm run typecheck
npm run format:check
npm run build
```

To apply formatting:

```bash
npm run format
```

To run the production build locally after `npm run build`:

```bash
npm run start
```

## Public data flow

Public Server Components load one statement-consistent canonical graph through
the read-only `read_tournament_snapshot` RPC. Runtime mapping validates database
literals, references, dates, ordering, and canonical semantics before page-model
calculations run. Development reads are request-deduplicated without persistent
caching. Production caches only successful validated snapshots for about 60
seconds under a tournament-specific tag.

Authentication, administrator forms, persistent mutations, automated provider
ingestion, hosted Supabase deployment, and live feeds remain out of scope.
