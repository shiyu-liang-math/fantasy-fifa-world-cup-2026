#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const container = "supabase_db_Fantasy-FIFA-World-Cup-2026";
const bootstrap = readFileSync(
  "supabase/bootstrap/fifa-world-cup-2026-structure.sql",
  "utf8",
);

function psql(sql, expectSuccess = true) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qAt",
    ],
    { input: sql, encoding: "utf8" },
  );
  if (expectSuccess && result.status !== 0) {
    throw new Error(`psql failed:\n${result.stderr}`);
  }
  if (!expectSuccess && result.status === 0) {
    throw new Error(
      "Expected the guarded bootstrap to reject conflicting data.",
    );
  }
  return result;
}

// Exact-state execution and a second execution prove repeat safety.
psql(bootstrap);
psql(bootstrap);

// A late conflict occurs after missing earlier rows would have been inserted.
// ON_ERROR_STOP closes the connection with the transaction aborted, proving
// both mismatch rejection and rollback of those earlier inserts.
const rejected = psql(
  `begin;
update public.draft_picks set draft_value = 2 where id = 'lyla-france';
delete from public.group_memberships where tournament_id = 'fifa-world-cup-2026' and country_id = 'algeria';
${bootstrap}`,
  false,
);
if (!rejected.stderr.includes("Conflicting existing draft_picks row")) {
  throw new Error(
    `Bootstrap failed for an unexpected reason:\n${rejected.stderr}`,
  );
}

const verification = psql(`
select jsonb_build_object(
  'algeriaCountries', (select count(*) from public.countries where id = 'algeria'),
  'algeriaMemberships', (select count(*) from public.group_memberships where tournament_id = 'fifa-world-cup-2026' and country_id = 'algeria'),
  'lylaFranceValue', (select draft_value from public.draft_picks where id = 'lyla-france')
);
`).stdout.trim();
const state = JSON.parse(verification);
if (
  state.algeriaCountries !== 1 ||
  state.algeriaMemberships !== 1 ||
  state.lylaFranceValue !== 3
) {
  throw new Error(`Bootstrap rollback verification failed: ${verification}`);
}

console.log(
  "Guarded bootstrap is repeatable, rejects mismatches, and rolls back transactionally.",
);
