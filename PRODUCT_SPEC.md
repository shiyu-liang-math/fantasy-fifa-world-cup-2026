# Fantasy FIFA World Cup 2026
## Product Brief and Codex Build Guide

**Document status:** Working specification  
**Purpose:** This file is the source of truth for building the website with Codex. Update it whenever the game rules or product requirements change.
**Rules updated:** 2026-07-12

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

Participant display order is:

1. Lyla (L)
2. Shiyu (S)
3. Ivy (Y)
4. Xun (X)
5. Houji & Yujin (H&J)

The initial data may be imported manually or seeded into the database. Country records use FIFA three-letter country codes. All 48 tournament countries must be represented, including countries that were not drafted. Draft ownership and value belong in a separate `draft_picks` entity rather than directly on a country record.

---

## 3. Golden Star Rules

For a drafted country `t`:

```text
Stars(t) = (6 - log2(R(t))) × V(t)
```

Where:

- `V(t)` is the country's draft value: 1, 2, or 3.
- `R(t)` is the country's best current finishing-position threshold, determined by the furthest stage for which it has officially qualified.
- Stars shown in the app are the country's **current accumulated Stars**, not a sum of the totals displayed at every previous stage.

### Standard stage values

| Furthest stage/result reached | R | Accumulated Stars |
|---|---:|---:|
| Did not reach the Round of 32 | — | 0 |
| Round of 32 | 32 | `1 × V` |
| Round of 16 | 16 | `2 × V` |
| Quarterfinal / final 8 | 8 | `3 × V` |
| Semifinal / final 4 / fourth place | 4 | `4 × V` |
| Third place | 3 | `(6 - log2(3)) × V`, approximately `4.4150375 × V` |
| Runner-up | 2 | `5 × V` |
| Champion | 1 | `6 × V` |

### Advancement behavior

A country receives the Stars for a stage as soon as it officially qualifies for that stage. “Round of 32” is the technical identifier for the scoring threshold sometimes described informally as “Top 32.” Officially qualifying from the group stage gives a country Round-of-32 status. Winning a Round-of-32 match immediately gives Round-of-16 status. Winning a quarterfinal immediately gives semifinal/final-4 status.

For normal knockout advancement, a country gains an additional number of Stars equal to its draft value.

Example for a Value 3 country:

| Current result | Accumulated Stars | Increase |
|---|---:|---:|
| Round of 32 | 3 | +3 |
| Round of 16 | 6 | +3 |
| Quarterfinal / final 8 | 9 | +3 |
| Semifinal / final 4 | 12 | +3 |
| Runner-up | 15 | +3 |
| Champion | 18 | +3 |

### Third-place exception

A semifinalist starts with `4 × V` Stars. Both losing semifinalists initially remain at this multiplier.

- After the third-place match is completed, its winner moves to `(6 - log2(3)) × V`.
- The third-place match loser remains at `4 × V`, the Top-4/fourth-place multiplier.
- The third-place bonus is therefore `(2 - log2(3)) × V`, approximately `0.4150375 × V`.

### Fantasy-team total

A participant's Golden Star total is the sum of the current accumulated Stars of all countries drafted by that participant.

Calculations should use full numerical precision internally. The interface should normally display two decimal places.

---

## 4. Golden Goal Rules

Golden Goal points equal the total official match goals scored by all countries drafted by a participant.

Only matches with `status = completed` contribute to Golden Goal totals or official fantasy standings. Scheduled, live, postponed, and cancelled matches may be displayed but do not affect calculated totals.

Count:

- Regulation-time goals
- Stoppage-time goals
- Extra-time goals
- Penalty kicks scored during regulation or extra time

Do not count:

- Penalty-shootout kicks

`home_goals` and `away_goals` mean the official match score after regulation and, when applicable, extra time, excluding penalty-shootout kicks. Store whether the match went to extra time in `went_to_extra_time`.

For a match decided by shootout, store these separately:

- `home_goals` and `away_goals`, representing the official score after regulation and any extra time
- Shootout score
- Advancing country

Only `home_goals` and `away_goals` from completed matches contribute to Golden Goal totals.

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

The app should calculate group standings automatically from completed match results. Scheduled, live, postponed, and cancelled matches do not affect standings, progression, elimination, or official fantasy standings.

Use:

- 3 points for a win
- 1 point for a draw
- 0 points for a loss
- Goals for
- Goals against
- Goal difference
- Matches played
- Wins, draws, and losses

Calculated standings are the default. For the MVP, the administrator may store a manual final group rank or qualification override if official FIFA tiebreaking produces a different order than the simplified calculation. Every override must include a reason. The interface must clearly indicate when an official/manual override is being used.

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

Match statuses are `scheduled`, `live`, `completed`, `postponed`, and `cancelled`. Only completed matches affect official calculations.

Every completed knockout match must identify an advancing country, and that country must be either the home or away country. Group-stage matches may end in a draw and do not use an advancing country.

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

Manual corrections must trigger a complete recalculation from canonical records so totals do not get counted twice. Administrator match changes and corrections must also create an audit-log entry.

---

## 8. Access Model

### Public users

- No account required
- Read-only access
- Can see all public pages
- Public tournament data in Supabase is publicly readable through row-level security policies.

### Administrator

- One administrator account for the MVP
- Can enter and correct tournament information
- Authentication credentials must never be stored in client-side code
- Administrator authorization must use the authenticated Supabase user ID in an administrator allowlist. A browser-side email check is not authorization.

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

Framework-independent game logic should live under `src/domain`, organized at minimum into scoring, goals, ranking, group standings, progression, and match validation modules.

For mobile usability, use cards and expandable sections where appropriate. Tables and the knockout bracket may scroll horizontally. Ownership, qualification, and elimination must never be communicated using color alone.

Codex may recommend a different stack only if it gives a concrete reason and preserves the free, simple, mobile-friendly requirements.

---

## 11. Core Data Model

Codex should refine this schema before implementing it.

### Canonical and derived data

Canonical stored data consists of match records, participants, countries, draft picks, tournament settings, and explicit administrator overrides. Administrator match changes and corrections are also recorded in an audit log.

Country goals, participant goals, Stars, rankings, progression, elimination, and active-country counts are derived. They must be recalculated from canonical data and must not be stored as mutable totals. Only completed matches participate in these calculations.

### Participant

- `id`
- `name`
- `abbreviation`
- `display_order`
- `created_at`
- `updated_at`

### Country

- `id`
- `name`
- `fifa_code`: unique FIFA three-letter code
- `group_code`
- `flag_url` or local flag reference, optional
- `created_at`
- `updated_at`

All 48 tournament countries must have country records, including undrafted countries. Ownership, draft value, progression, and elimination do not belong as mutable fields on the country.

### Draft Pick

- `id`
- `participant_id`
- `country_id`, unique because a country has at most one fantasy owner
- `draft_value`: 1, 2, or 3
- `created_at`
- `updated_at`

### Match

- `id`
- `match_number`, unique
- `stage`
- `home_country_id`, nullable while a future bracket slot is unresolved
- `away_country_id`, nullable while a future bracket slot is unresolved
- `home_source_match_id`, nullable reference to the match that supplies the future home slot
- `away_source_match_id`, nullable reference to the match that supplies the future away slot
- `home_goals`: official score after regulation and, when applicable, extra time; excludes shootout kicks
- `away_goals`: official score after regulation and, when applicable, extra time; excludes shootout kicks
- `went_to_extra_time`
- `home_shootout_goals`, nullable
- `away_shootout_goals`, nullable
- `advancing_country_id`, nullable
- `scheduled_at`, nullable
- `status`: scheduled, live, completed, postponed, or cancelled
- `source`: manual or external
- `external_match_id`, nullable
- `created_at`
- `updated_at`
- `updated_by`, nullable for system-created records

Every completed knockout match must identify an advancing country that is either its home or away country. Completed group matches may end in a draw and do not use `advancing_country_id`. Only completed matches affect calculations.

### Group-Stage Override

- `id`
- `group_code`
- `country_id`
- `final_rank`, nullable
- `qualified`, nullable
- `reason`, required
- `created_at`
- `updated_at`
- `updated_by`

Calculated group standings are the default. Overrides are canonical exceptions used only when the simplified calculation differs from official FIFA ordering, and the UI must label their use.

### Tournament Settings

- `current_stage`
- `last_updated_at`: the most recent successful mutation of tournament data, not a deployment, page view, or login
- `rules_version`
- `rules_updated_at`
- `created_at`
- `updated_at`
- `updated_by`

### Administrator Allowlist

- `user_id`: authenticated Supabase user ID
- `created_at`
- `updated_at`
- `updated_by`, where applicable

Database write policies must authorize against the authenticated Supabase user ID in this allowlist, not against an email check performed in the browser.

### Audit Log

- `id`
- `actor_user_id`
- `entity_type`
- `entity_id`
- `action`
- `before_data`
- `after_data`
- `created_at`

At minimum, every administrator match creation, edit, and correction must create an audit entry containing the before and after state where applicable.

Explicit progression overrides may be added only as canonical, reasoned exceptions if an official tournament decision cannot be represented by the completed match and group-override records. They must not become mutable scoring counters.

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

1. Value 3 at Round of 32 returns 3 Stars.
2. Value 3 at Round of 16 returns 6 Stars.
3. Value 1 at quarterfinal/final-8 status returns 3 Stars.
4. Value 2 at semifinal/final-4 status returns 8 Stars.
5. Value 3 in third place returns approximately 13.2451125 Stars.
6. Value 3 in fourth place returns 12 Stars.
7. Value 2 as runner-up returns 10 Stars.
8. Value 1 as champion returns 6 Stars.
9. Shootout kicks do not increase Golden Goal totals.
10. Regulation and extra-time goals do increase Golden Goal totals.
11. Two tied leaders are ranked 1, 1, and the next participant is ranked 3.
12. Editing a completed match recalculates totals without double-counting.

Expand test coverage beyond these minimum cases to cover:

- Every draft value at every scoring stage
- Multiple tie configurations, including ties below first place
- Repeated match corrections and replacement of prior scores
- Completed, scheduled, live, postponed, and cancelled match behavior
- Shootouts and extra-time matches
- Semifinal advancement and both losing semifinalists before the third-place match
- Third-place winner and fourth-place loser behavior
- Runner-up and champion behavior after the final
- Valid and invalid knockout advancing countries
- Group-stage draws and group-order/qualification overrides
- Floating-point comparisons and ranking equality

Use a small documented tolerance for floating-point assertions.

---

## 13. MVP Acceptance Criteria

The MVP is ready when:

- The site works on phone and desktop.
- Public pages require no login.
- The five fantasy teams and drafted countries are seeded.
- The administrator can enter and edit a match.
- Official match scores and shootout scores are stored separately, with `went_to_extra_time` recorded.
- Only completed matches affect official calculations.
- Golden Goal totals update correctly.
- Countries advance or become eliminated correctly.
- Accumulated Stars update correctly.
- Third and fourth place are scored correctly.
- Ties use standard competition ranking.
- The dashboard, awards, team details, group-stage tournament view, knockout bracket, rules, front page, and admin page exist.
- Refreshing the site preserves data.
- Administrator match changes and corrections are recorded in the audit log.
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

Implement the game calculations as pure TypeScript functions under `src/domain`, independent of the UI and database. Organize the domain logic into scoring, goals, ranking, group standings, progression, and match validation modules.

Include:
- Country Stars by draft value and furthest stage
- Participant accumulated Stars
- Country and participant goal totals
- Standard competition ranking for ties
- Third-place scoring
- Shootout-goal exclusion
- Completed-match-only calculation behavior

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
- Normalize participants, all 48 countries, draft picks, matches, group-stage overrides, tournament settings, the administrator allowlist, and the audit log.
- Keep shootout goals separate from regulation/extra-time goals.
- Include `went_to_extra_time`, `match_number`, and unresolved bracket source-match references.
- Preserve enough data for safe match corrections.
- Include constraints that prevent invalid draft values and obviously invalid scores.
- Seed the five participants and drafted countries.
- Add row-level security policies:
  - Public users can read public tournament data.
  - Only authenticated Supabase user IDs present in the administrator allowlist can write.
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
- Record whether the match went to extra time
- Store shootout score separately
- Select the advancing country
- Select the tournament stage
- Correct an existing result
- Preview the effects before saving

Validation requirements:
- Goals cannot be negative.
- Shootout values are optional and do not count toward Golden Goal.
- A knockout match must have a valid advancing country.
- The advancing-country requirement applies to completed knockout matches, not group-stage matches.
- The advancing country must be one of the two participants in the match.
- Corrections must recalculate from canonical match data and never double-count goals or Stars.
- Scheduled, live, postponed, and cancelled matches must not affect official calculations.
- Match creations, edits, and corrections must create audit-log entries.

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

## 14. Decision Record and Open Items

### Approved decisions

- Official app/game title  
  **Decision: Fantasy FIFA World Cup 2026.**
- Tournament year and exact competition  
  **Decision: 2026 FIFA World Cup.**
- Whether group-stage goals count toward Golden Goal  
  **Decision: YES. All tournament match goals count toward Golden Goal (excluding penalty shootout kicks).**
- Whether countries that fail to reach the Round of 32 receive zero Stars
  **Decision: YES. Countries eliminated before qualifying for the Round of 32 receive zero Stars.**
- Whether the tournament page includes group-stage tables  
  **Decision: YES. The MVP includes all 12 World Cup groups and all 48 countries, with drafted countries highlighted and labeled by owner. It also includes the knockout bracket because all tournament goals count toward Golden Goal.**
- Administrator email/account  
  **Decision: Only Shiyu will have administrator access, using `liangshiyu23@outlook.com` for Supabase authentication.**
- Participant display names  
  **Decision:** Lyla (L), Shiyu (S), Ivy (Y), Xun (X), and Houji & Yujin (H&J), in that display order.

### Remaining open items

These do not block the initial scaffold, but should be resolved before final deployment:

- Whether the publicly readable site should be discoverable on the open internet or shared only through an unlisted URL
- Desired custom domain name, if any
- The authoritative source and import process for the final 48-country, group, match-number, and schedule seed data

Record approved decisions in this file rather than leaving them only in chat history.
