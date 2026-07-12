# Fantasy FIFA World Cup 2026

Mobile-first tournament tracker for a private fantasy game. This repository currently contains only the application scaffold; tournament data, scoring logic, database access, and administrator authentication are intentionally not implemented yet.

`PRODUCT_SPEC.md` is the authoritative product and game-rules specification.

## Prerequisites

- Node.js 24 LTS
- npm 11

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

## Checks

```bash
npm test
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

The scaffold includes the Next.js App Router, strict TypeScript, Tailwind CSS, shared navigation, placeholder routes, Vitest, ESLint, and Prettier. It does not include Supabase, a database schema, authentication, tournament data, or game calculations.
