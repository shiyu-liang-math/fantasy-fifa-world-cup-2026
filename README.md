# Fantasy FIFA World Cup 2026

Mobile-first tournament tracker for a private fantasy game. The repository contains tested tournament domain logic, typed local canonical data, read-only public pages, reviewed administration workflows, and a local PostgreSQL/Supabase persistence foundation. Public pages intentionally continue to use the local repository in Milestone 5.

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

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No environment values are required by the scaffold. `.env.example` contains placeholders only.

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

## Current scope

Milestone 5 adds local Supabase configuration, versioned migrations, deterministic seeds, PostgreSQL constraints, deferred cross-row validation, private administrator/audit infrastructure, RLS, and executable database tests. It does not add Supabase application clients, authentication pages, database-backed repositories, server actions, persistent mutations, or hosted deployment.
