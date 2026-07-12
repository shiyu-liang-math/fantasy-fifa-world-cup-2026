import { isCompletedMatch } from "./match-validation";
import type {
  CountryId,
  CountryResult,
  DomainMatch,
  GroupQualification,
  MatchStage,
  ProgressionState,
} from "./types";

export type ProgressionInput = Readonly<{
  countryIds: readonly CountryId[];
  matches: readonly DomainMatch[];
  groupQualifications: readonly GroupQualification[];
}>;

type MutableProgressionState = {
  countryId: CountryId;
  result: CountryResult;
  isEliminated: boolean;
};

const KNOCKOUT_STAGE_ORDER: Readonly<
  Record<Exclude<MatchStage, "group">, number>
> = {
  round_of_32: 1,
  round_of_16: 2,
  quarterfinal: 3,
  semifinal: 4,
  third_place: 5,
  final: 6,
};

export function deriveProgression(input: ProgressionInput): ProgressionState[] {
  const countryIds = [...new Set(input.countryIds)];
  const states = new Map<CountryId, MutableProgressionState>(
    countryIds.map((countryId) => [
      countryId,
      {
        countryId,
        result: "before_round_of_32",
        isEliminated: false,
      },
    ]),
  );

  applyGroupQualifications(states, input.groupQualifications);

  const completedKnockoutMatches = input.matches
    .filter(
      (match): match is DomainMatch & { stage: Exclude<MatchStage, "group"> } =>
        match.stage !== "group" && isCompletedMatch(match),
    )
    .map((match, originalIndex) => ({ match, originalIndex }))
    .sort(
      (left, right) =>
        KNOCKOUT_STAGE_ORDER[left.match.stage] -
          KNOCKOUT_STAGE_ORDER[right.match.stage] ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ match }) => match);

  for (const match of completedKnockoutMatches) {
    const { winner, loser } = participantsForCompletedKnockout(match);
    const winnerState = states.get(winner);
    const loserState = states.get(loser);

    if (winnerState === undefined || loserState === undefined) {
      continue;
    }

    applyKnockoutResult(match.stage, winnerState, loserState);
  }

  return countryIds.map((countryId) => ({ ...states.get(countryId)! }));
}

function applyGroupQualifications(
  states: Map<CountryId, MutableProgressionState>,
  qualifications: readonly GroupQualification[],
): void {
  const seen = new Set<CountryId>();

  for (const qualification of qualifications) {
    if (seen.has(qualification.countryId)) {
      throw new Error(
        `Duplicate group qualification for ${qualification.countryId}.`,
      );
    }
    seen.add(qualification.countryId);

    const state = states.get(qualification.countryId);
    if (state === undefined) {
      continue;
    }

    if (qualification.qualifiedForRoundOf32) {
      state.result = "round_of_32";
      state.isEliminated = false;
    } else {
      state.result = "before_round_of_32";
      state.isEliminated = true;
    }
  }
}

function participantsForCompletedKnockout(match: DomainMatch): {
  winner: CountryId;
  loser: CountryId;
} {
  const { homeCountryId, awayCountryId, advancingCountryId } = match;

  if (
    homeCountryId === null ||
    awayCountryId === null ||
    advancingCountryId === null ||
    (advancingCountryId !== homeCountryId &&
      advancingCountryId !== awayCountryId)
  ) {
    throw new Error(
      `Completed knockout match ${match.id} requires two countries and a valid advancing country.`,
    );
  }

  return {
    winner: advancingCountryId,
    loser: advancingCountryId === homeCountryId ? awayCountryId : homeCountryId,
  };
}

function applyKnockoutResult(
  stage: Exclude<MatchStage, "group">,
  winner: MutableProgressionState,
  loser: MutableProgressionState,
): void {
  switch (stage) {
    case "round_of_32":
      setState(winner, "round_of_16", false);
      setState(loser, "round_of_32", true);
      break;
    case "round_of_16":
      setState(winner, "quarterfinal", false);
      setState(loser, "round_of_16", true);
      break;
    case "quarterfinal":
      setState(winner, "semifinal", false);
      setState(loser, "quarterfinal", true);
      break;
    case "semifinal":
      setState(winner, "runner_up", false);
      setState(loser, "semifinal", true);
      break;
    case "third_place":
      setState(winner, "third_place", true);
      setState(loser, "fourth_place", true);
      break;
    case "final":
      setState(winner, "champion", false);
      setState(loser, "runner_up", true);
      break;
  }
}

function setState(
  state: MutableProgressionState,
  result: CountryResult,
  isEliminated: boolean,
): void {
  state.result = result;
  state.isEliminated = isEliminated;
}
