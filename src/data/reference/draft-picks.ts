import type { DraftPickRecord } from "../types";

const tournamentId = "fifa-world-cup-2026";

export const REFERENCE_DRAFT_PICKS: readonly DraftPickRecord[] = [
  pick("lyla", "france", 3),
  pick("lyla", "colombia", 2),
  pick("lyla", "brazil", 1),
  pick("lyla", "norway", 1),
  pick("lyla", "south-korea", 1),
  pick("shiyu", "spain", 3),
  pick("shiyu", "england", 2),
  pick("shiyu", "united-states", 1),
  pick("shiyu", "canada", 1),
  pick("shiyu", "belgium", 1),
  pick("ivy", "portugal", 3),
  pick("ivy", "germany", 2),
  pick("ivy", "uruguay", 1),
  pick("ivy", "netherlands", 1),
  pick("ivy", "senegal", 1),
  pick("xun", "argentina", 3),
  pick("xun", "croatia", 2),
  pick("xun", "mexico", 1),
  pick("xun", "japan", 1),
  pick("xun", "morocco", 1),
  pick("houji-yujin", "switzerland", 3),
  pick("houji-yujin", "sweden", 2),
  pick("houji-yujin", "scotland", 1),
  pick("houji-yujin", "iran", 1),
  pick("houji-yujin", "ivory-coast", 1),
];

function pick(
  participantId: string,
  countryId: string,
  draftValue: 1 | 2 | 3,
): DraftPickRecord {
  return {
    id: `${participantId}-${countryId}`,
    tournamentId,
    participantId,
    countryId,
    draftValue,
  };
}
