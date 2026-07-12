import type { TournamentGroup, TournamentRound } from "../types";

const tournamentId = "fifa-world-cup-2026";

export const REFERENCE_ROUNDS: readonly TournamentRound[] = [
  round("group", "group", "Group stage", "group", 1),
  round("round-of-32", "round_of_32", "Round of 32", "knockout", 2),
  round("round-of-16", "round_of_16", "Round of 16", "knockout", 3),
  round("quarterfinal", "quarterfinal", "Quarterfinals", "knockout", 4),
  round("semifinal", "semifinal", "Semifinals", "knockout", 5),
  round("third-place", "third_place", "Third-place match", "placement", 6),
  round("final", "final", "Final", "placement", 7),
];

export const REFERENCE_GROUPS: readonly TournamentGroup[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
].map((code, index) => ({
  code: code as TournamentGroup["code"],
  tournamentId,
  displayOrder: index + 1,
  countryIds: [],
}));

function round(
  id: string,
  stage: TournamentRound["stage"],
  name: string,
  phase: TournamentRound["phase"],
  displayOrder: number,
): TournamentRound {
  return { id, tournamentId, stage, name, phase, displayOrder };
}
