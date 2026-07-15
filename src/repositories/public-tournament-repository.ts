import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import { readSupabaseServerEnvironment } from "../config/server-environment";
import { CANONICAL_TOURNAMENT_ID } from "../config/tournament";
import { createServerSupabaseClient } from "../lib/supabase/server";
import type { TournamentDataSnapshot } from "../data/types";
import type { TournamentRepository } from "./tournament-repository";
import {
  loadSupabaseTournamentSnapshot,
  SupabaseTournamentRepository,
} from "./supabase-tournament-repository";

export const TOURNAMENT_CACHE_TAG = `tournament:${CANONICAL_TOURNAMENT_ID}`;

async function loadDirect(
  tournamentId: string,
): Promise<TournamentDataSnapshot> {
  const environment = readSupabaseServerEnvironment();
  const client = createServerSupabaseClient(environment);
  return loadSupabaseTournamentSnapshot(client, tournamentId);
}

const loadProductionSnapshot = unstable_cache(
  loadDirect,
  ["canonical-tournament-snapshot-v1"],
  { revalidate: 60, tags: [TOURNAMENT_CACHE_TAG] },
);

const loadForRequest = cache(async (tournamentId: string) => {
  await connection();
  return process.env.NODE_ENV === "production"
    ? loadProductionSnapshot(tournamentId)
    : loadDirect(tournamentId);
});

export function createPublicTournamentRepository(): TournamentRepository {
  return new SupabaseTournamentRepository(() =>
    loadForRequest(CANONICAL_TOURNAMENT_ID),
  );
}
