# Fantasy FIFA World Cup 2026
## Product Brief and Codex Build Guide

**Document status:** Working specification  
**Purpose:** This file is the source of truth for building the website with Codex. Update it whenever the game rules or product requirements change.

---

## 1. Product Overview

Build a free, mobile-friendly website for a private Fantasy FIFA World Cup game among friends.

Each participant has drafted a set of countries. Every drafted country has a draft value of 1, 2, or 3. Participants compete for three awards:

1. **Golden Star** — most accumulated Stars based on how far drafted countries advance.
2. **Golden Goal** — most total goals scored by drafted countries.
3. **Golden Cup** — awarded to the participant who drafted the World Cup champion.

The website should let friends open a shared URL without signing in and quickly see:

- Current fantasy-team standings
- Accumulated Stars
- Accumulated goals
- Countries still alive or eliminated
- Current tournament bracket
- Award leaders
- Match results and upcoming matches

One administrator should be able to enter or correct results.

---

## 2. Participants and Drafted Countries

### Lyla (Team L)

| Draft value | Countries |
|---:|---|
| 3 | France |
| 2 | Colombia |
| 1 | Brazil, Norway, South Korea |

### Shiyu (Team S)

| Draft value | Countries |
|---:|---|
| 3 | Spain |
| 2 | England |
| 1 | United States, Canada, Belgium |

### Ivy (Team Y)

| Draft value | Countries |
|---:|---|
| 3 | Portugal |
| 2 | Germany |
| 1 | Uruguay, Netherlands, Senegal |

### Xun (Team X)

| Draft value | Countries |
|---:|---|
| 3 | Argentina |
| 2 | Croatia |
| 1 | Mexico, Japan, Morocco |

### Houji & Yujin (Team H&J)

| Draft value | Countries |
|---:|---|
| 3 | Switzerland |
| 2 | Sweden |
| 1 | Scotland, Iran, Ivory Coast |

The initial data may be imported manually or seeded into the database.

---

## 3. Golden Star Rules

For a drafted country `t`:

```text
Stars(t) = (6 - log2(R(t))) × V(t)
```

Where:

- `V(t)` is the country's draft value: 1, 2, or 3.
- `R(t)` is the country's best current finishing-position threshold, determined by the furthest stage it has reached.
- Stars shown in the app are the country's **current accumulated Stars**, not a sum of the totals displayed at every previous stage.

### Standard stage values

| Furthest stage/result reached | R | Accumulated Stars |
|---|---:|---:|
| Did not reach Top 32 | — | 0 |
| Top 32 | 32 | `1 × V` |
| Top 16 | 16 | `2 × V` |
| Top 8 | 8 | `3 × V` |
| Top 4 / fourth place | 4 | `4 × V` |
| Third place | 3 | `(6 - log2(3)) × V`, approximately `4.4150375 × V` |
| Runner-up | 2 | `5 × V` |
| Champion | 1 | `6 × V` |

### Advancement behavior

For normal knockout advancement, a country gains an additional number of Stars equal to its draft value.

Example for a Value 3 country:

| Current result | Accumulated Stars | Increase |
|---|---:|---:|
| Top 32 | 3 | +3 |
| Top 16 | 6 | +3 |
| Top 8 | 9 | +3 |
| Top 4 | 12 | +3 |
| Runner-up | 15 | +3 |
| Champion | 18 | +3 |

### Third-place exception

A semifinalist starts with `4 × V` Stars.

- The third-place winner moves to `(6 - log2(3)) × V`.
- The fourth-place country remains at `4 × V`.
- The third-place bonus is therefore `(2 - log2(3)) × V`, approximately `0.4150375 × V`.

### Fantasy-team total

A participant's Golden Star total is the sum of the current accumulated Stars of all countries drafted by that participant.

Calculations should use full numerical precision internally. The interface should normally display two decimal places.

---

## 4. Golden Goal Rules

Golden Goal points equal the total official match goals scored by all countries drafted by a participant.

Count:

- Regulation-time goals
- Stoppage-time goals
- Extra-time goals
- Penalty kicks scored during regulation or extra time

Do not count:

- Penalty-shootout kicks

For a match decided by shootout, store these separately:

- Score after extra time
- Shootout score
- Advancing country

Only the score after extra time contributes to Golden Goal totals.

---

## 5. Golden Cup Rules

The Golden Cup is awarded to the participant who drafted the World Cup champion.

Before the tournament ends, the website should show each participant's countries that remain eligible to win the World Cup.

---

## 6. Ranking and Tie Rules

Use standard competition ranking.

Example:

```text
1. Team L — 20 Stars
1. Team S — 20 Stars
3. Team Y — 18 Stars
```

Participants with equal values share the same rank. The following rank skips the number of tied positions.

Apply this rule to both Golden Star and Golden Goal standings.

Do not resolve ties with an unapproved secondary tiebreaker.

---


## 6.1 Group-Stage Standings Rules

The app should calculate group standings automatically from entered match results.

Use:

- 3 points for a win
- 1 point for a draw
- 0 points for a loss
- Goals for
- Goals against
- Goal difference
- Matches played
- Wins, draws, and losses

For the MVP, the administrator may manually correct final group order or qualification status if official FIFA tiebreaking produces a different order than the simplified calculation.

Show all 48 countries across Groups A through L. Drafted countries should be visually highlighted and labeled with their fantasy owner.


## 7. Website Pages

### 7.1 Front Page

Purpose: introduce the game and provide a simple entrance to the tracker.

Show:

- Game title
- Short explanation
- Current tournament stage
- Current leaders for Golden Star and Golden Goal
- Golden Cup contenders or number of countries still alive
- `View Tournament` button
- Last-updated timestamp

No login is required to view the site.

### 7.2 Main Dashboard

Purpose: show the current status of every fantasy team.

Each participant card should show:

- Participant name and team abbreviation
- Total accumulated Stars
- Total goals
- Number of countries still active
- Every drafted country
- Draft value
- Current tournament status
- Active or eliminated status
- Current Stars contributed by each country
- Current goals contributed by each country
- Next match, when available

Also show:

- Current tournament stage
- Recent results
- Upcoming matches
- Last-updated timestamp

### 7.3 Leaderboards and Awards

Include three sections:

1. Golden Star standings
2. Golden Goal standings
3. Golden Cup race

Use standard competition ranking for ties.

### 7.4 Fantasy-Team Detail Page

For each participant, show:

- All drafted countries
- Draft values
- Current stages
- Active/eliminated status
- Stars by country
- Goals by country
- Match history
- Upcoming match
- Team totals

Allow a country row to expand and show its Stars calculation.

### 7.5 Tournament Page

Include both the group stage and knockout stage.

#### Group stage

Show:

- Groups A through L
- Teams in each group
- Matches, scores, and status
- Played, wins, draws, losses, goals for, goals against, goal difference, and points
- Which fantasy participant owns each drafted country
- Upcoming group matches
- Group-stage goals contributing to Golden Goal totals

#### Knockout bracket

Show:

- Knockout rounds
- Countries
- Match scores
- Advancing countries
- Upcoming matches
- Participant who owns each country

The first version can use a plain, functional bracket. It must work on mobile, even if that requires horizontal scrolling.

### 7.6 Rules Page

Document:

- Drafted countries and values
- Golden Star formula
- Stage values
- Third-place exception
- Golden Goal counting rules
- Shootout exclusion
- Tie-ranking rules
- Golden Cup rule
- Last rules update date

### 7.7 Administrator Page

Protected by administrator authentication.

The administrator can:

- Add or edit matches
- Enter regulation/extra-time score
- Enter shootout score separately
- Select the advancing country
- Assign the tournament stage
- Correct previously entered results
- Set upcoming matches
- Update tournament stage
- Review the effects before saving

Saving a result should automatically:

- Update country goal totals
- Update participant Golden Goal totals
- Advance or eliminate countries when applicable
- Update each country's furthest stage
- Recalculate country Stars
- Recalculate fantasy-team Stars
- Update award standings
- Update the bracket
- Update the last-modified timestamp

Manual corrections must trigger a complete recalculation so totals do not get counted twice.

---

## 8. Access Model

### Public users

- No account required
- Read-only access
- Can see all public pages

### Administrator

- One administrator account for the MVP
- Can enter and correct tournament information
- Authentication credentials must never be stored in client-side code

A second administrator can be added later.

---

## 9. Data Update Strategy

### MVP

Use manual result entry.

### Future enhancement

After Version 1 is working and verified, support automatic live score and result updates using a reliable tournament-data API.

Requirements for future live data:

- Keep manual correction capability
- Store the external match ID
- Record when data was last synchronized
- Prevent duplicate imports
- Keep shootout goals separate
- Do not let an API overwrite a deliberate manual correction without warning

Do not add a paid sports API to the MVP.

---

## 10. Recommended Technical Direction

Codex should first inspect the local environment and propose the smallest maintainable implementation.

Preferred starting stack:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase for database and administrator authentication
- Vercel for deployment
- GitHub for version control

Constraints:

- Stay within free tiers for this small private project
- Mobile-first responsive design
- Accessible semantic HTML
- No API keys or secrets in the browser
- Keep game calculations in tested pure functions
- Avoid unnecessary libraries
- Include clear setup instructions

Codex may recommend a different stack only if it gives a concrete reason and preserves the free, simple, mobile-friendly requirements.

---

## 11. Core Data Model

Codex should refine this schema before implementing it.

### Participant

- `id`
- `name`
- `display_order`

### Country

- `id`
- `name`
- `code`
- `flag_url` or local flag reference, optional
- `participant_id`
- `draft_value`
- `furthest_stage`
- `is_eliminated`

### Match

- `id`
- `stage`
- `home_country_id`
- `away_country_id`
- `home_goals`
- `away_goals`
- `home_shootout_goals`, nullable
- `away_shootout_goals`, nullable
- `advancing_country_id`, nullable
- `scheduled_at`, nullable
- `status`: scheduled, live, completed
- `source`: manual or external
- `external_match_id`, nullable
- `updated_at`

### Tournament Settings

- `current_stage`
- `last_updated_at`
- `rules_version`

Derived values such as total Stars and total goals should preferably be computed from canonical country and match data rather than stored redundantly, unless caching becomes necessary.

---

## 12. Required Calculation Functions and Tests

Implement calculation logic as pure TypeScript functions.

At minimum:

```text
calculateCountryStars(draftValue, furthestStage)
calculateParticipantStars(countries)
calculateCountryGoals(matches, countryId)
calculateParticipantGoals(countries, matches)
rankWithTies(entries)
```

Required tests:

1. Value 3 at Top 32 returns 3 Stars.
2. Value 3 at Top 16 returns 6 Stars.
3. Value 1 at Top 8 returns 3 Stars.
4. Value 2 at Top 4 returns 8 Stars.
5. Value 3 in third place returns approximately 13.2451125 Stars.
6. Value 3 in fourth place returns 12 Stars.
7. Value 2 as runner-up returns 10 Stars.
8. Value 1 as champion returns 6 Stars.
9. Shootout kicks do not increase Golden Goal totals.
10. Regulation and extra-time goals do increase Golden Goal totals.
11. Two tied leaders are ranked 1, 1, and the next participant is ranked 3.
12. Editing a completed match recalculates totals without double-counting.

Use a small tolerance for floating-point assertions.

---

## 13. MVP Acceptance Criteria

The MVP is ready when:

- The site works on phone and desktop.
- Public pages require no login.
- The five fantasy teams and drafted countries are seeded.
- The administrator can enter and edit a match.
- Scores after extra time and shootout scores are stored separately.
- Golden Goal totals update correctly.
- Countries advance or become eliminated correctly.
- Accumulated Stars update correctly.
- Third and fourth place are scored correctly.
- Ties use standard competition ranking.
- The dashboard, awards, team details, group-stage tournament view, knockout bracket, rules, front page, and admin page exist.
- Refreshing the site preserves data.
- Calculation tests pass.
- Linting and type checking pass.
- Setup and deployment steps are documented.
- No secret is committed to Git.

---

# Codex Workflow

Do not ask Codex to build the entire production site in one unreviewed step. Use the prompts below in order.

## Prompt 1 — Plan the Project

```text
Read PRODUCT_SPEC.md completely.

We are starting this project from an empty or nearly empty repository. Do not write application code yet.

Your task:
1. Summarize the product and game rules in your own words.
2. Identify contradictions, missing decisions, or risky assumptions.
3. Propose the smallest maintainable architecture for the MVP.
4. Propose the database schema.
5. Propose the route/page structure.
6. Separate canonical stored data from derived values.
7. Propose an implementation sequence with small reviewable milestones.
8. Explain how the project can remain within free service tiers.
9. List the exact local prerequisites and commands that will be needed.

Prioritize correctness of the scoring rules, mobile usability, security, and simple maintenance.

Do not install packages, initialize services, or modify files other than optionally creating a planning document.
```

Review Codex's answer before proceeding.

## Prompt 2 — Scaffold the Application

```text
Read PRODUCT_SPEC.md and the approved architecture plan.

Implement only the project scaffold.

Requirements:
- Next.js with TypeScript
- Tailwind CSS
- Mobile-first responsive base layout
- Routes/placeholders for front page, dashboard, awards, fantasy-team details, tournament group stage, knockout bracket, rules, and admin
- Shared navigation
- README with local setup commands
- Environment-variable example file with placeholders only
- Formatting, linting, and type checking configured
- No database connection yet
- No real authentication yet
- No secrets
- No elaborate visual design

Run all available checks and report:
1. Files changed
2. Commands run
3. Check results
4. Any assumptions
```

## Prompt 3 — Implement and Test the Game Logic

```text
Read PRODUCT_SPEC.md.

Implement the game calculations as pure TypeScript functions, independent of the UI and database.

Include:
- Country Stars by draft value and furthest stage
- Participant accumulated Stars
- Country and participant goal totals
- Standard competition ranking for ties
- Third-place scoring
- Shootout-goal exclusion

Add comprehensive automated tests, including every required test listed in PRODUCT_SPEC.md.

Do not build database code or admin forms in this task.

Run the tests, type checker, and linter. Explain any floating-point handling and summarize all changed files.
```

Do not continue until these tests pass.

## Prompt 4 — Add Seed Data and Read-Only Pages

```text
Read PRODUCT_SPEC.md and use the existing tested calculation functions.

Add a temporary typed local data layer containing the five participants and their drafted countries.

Build the read-only MVP pages:
- Front page
- Dashboard
- Awards
- Fantasy-team detail pages
- Plain mobile-friendly tournament page with group-stage standings/results and knockout bracket
- Rules page

Requirements:
- Use derived calculations rather than hard-coded totals.
- Clearly show draft value, current stage, Stars, goals, and active/eliminated status.
- Use standard competition ranking.
- Keep the visual design clean and plain.
- Include realistic sample match data clearly marked as development seed data.
- Ensure keyboard accessibility and responsive behavior.

Do not add Supabase or administrator editing yet.

Run tests, linting, and type checking. Summarize the implementation and note any UX decisions.
```

## Prompt 5 — Design the Database Migration

```text
Read PRODUCT_SPEC.md and inspect the current typed local data model.

Design and implement the Supabase database migration and seed data.

Requirements:
- Normalize participants, countries, matches, and tournament settings.
- Keep shootout goals separate from regulation/extra-time goals.
- Preserve enough data for safe match corrections.
- Include constraints that prevent invalid draft values and obviously invalid scores.
- Seed the five participants and drafted countries.
- Add row-level security policies:
  - Public users can read public tournament data.
  - Only authenticated administrators can write.
- Do not place service-role credentials in browser code.
- Add setup documentation and environment-variable placeholders.

Before making changes, state the proposed schema and security model. Then implement it.

Run all local checks available without requiring undisclosed credentials.
```

## Prompt 6 — Connect Read-Only Pages to Supabase

```text
Replace the temporary local data source with the Supabase-backed data layer.

Requirements:
- Preserve the existing UI and calculation behavior.
- Handle loading, empty, and error states.
- Keep calculations deterministic and tested.
- Do not expose administrator credentials.
- Add a documented development fallback or clear setup error when environment variables are absent.
- Avoid unnecessary client-side fetching when server-side rendering is suitable.

Run tests, linting, and type checking. Summarize all data-flow changes.
```

## Prompt 7 — Build Administrator Editing

```text
Build the protected administrator workflow described in PRODUCT_SPEC.md.

The administrator must be able to:
- Sign in
- Create a scheduled match
- Enter or edit a completed match
- Store score after regulation/extra time
- Store shootout score separately
- Select the advancing country
- Select the tournament stage
- Correct an existing result
- Preview the effects before saving

Validation requirements:
- Goals cannot be negative.
- Shootout values are optional and do not count toward Golden Goal.
- A knockout match must have a valid advancing country.
- The advancing country must be one of the two participants in the match.
- Corrections must recalculate from canonical match data and never double-count goals or Stars.

Add tests for validation and correction behavior.

Run all tests, type checking, and linting. Report any security assumptions.
```

## Prompt 8 — Full Review Before Deployment

```text
Perform a release-readiness review of the entire repository against PRODUCT_SPEC.md.

Check:
- Game-rule correctness
- Third-place calculation
- Shootout exclusion
- Tie ranking
- Match-correction behavior
- Authentication and authorization
- Row-level security
- Secret handling
- Mobile responsiveness
- Accessibility
- Error and empty states
- Type safety
- Test coverage
- Deployment documentation

Fix serious issues you find. Do not redesign the site or add new product features.

Run the complete test, lint, type-check, and production-build commands. Provide a concise release report listing:
1. Checks passed
2. Fixes made
3. Remaining limitations
4. Exact deployment steps
```

---

## 14. Decisions Still Open

These do not block the initial scaffold, but should be resolved before final deployment:

- Official app/game title  
  **Decision: Fantasy FIFA World Cup 2026.**
- Tournament year and exact competition  
  **Decision: 2026 FIFA World Cup.**
- Whether group-stage goals count toward Golden Goal  
  **Decision: YES. All tournament match goals count toward Golden Goal (excluding penalty shootout kicks).**
- Whether countries that fail to reach Top 32 receive zero Stars  
  **Decision: YES. Countries eliminated before reaching the Top 32 receive zero Stars.**
- Whether the tournament page includes group-stage tables  
  **Decision: YES. The MVP includes all 12 World Cup groups and all 48 countries, with drafted countries highlighted and labeled by owner. It also includes the knockout bracket because all tournament goals count toward Golden Goal.**
- Whether the front page is public on the open internet or protected by an unlisted URL  
  **Current assumption: public read-only via shared URL.**
- Administrator email/account  
  **Decision: Only Shiyu will have administrator access, using `liangshiyu23@outlook.com` for Supabase authentication.**
- Desired domain name, if any
- Participant display names  
  **Decision:** Lyla (L), Shiyu (S), Xun (X), Ivy (Y), and Houji & Yujin (H&J).

Record approved decisions in this file rather than leaving them only in chat history.
