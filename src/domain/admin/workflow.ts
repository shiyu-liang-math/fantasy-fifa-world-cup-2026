import { calculateGroupStandings } from "../group-standings";
import { deriveGroupQualifications } from "../group-qualification";
import { deriveProgression } from "../progression";
import { validateCanonicalData } from "../../data/validation";
import type {
  GroupCode,
  GroupQualificationOverrideRecord,
  MatchRecord,
  TournamentDataSnapshot,
  TournamentGroup,
} from "../../data/types";
import type { CountryId, MatchId } from "../types";
import { deriveCompetition } from "../../services/page-models/shared";
import {
  compareGroupOverrideEntries,
  groupOverrideEntryId,
} from "../group-override-entry";
import type {
  AdministrationAffectedData,
  AdministrationCommand,
  AdministrationIssue,
  AdministrationProposal,
  ApplyProposalResult,
  CompletedResult,
  GroupOverrideInput,
  OfficialFixture,
  TournamentMetadataUpdate,
} from "./types";

type MutableSnapshot = {
  -readonly [K in keyof TournamentDataSnapshot]: TournamentDataSnapshot[K];
};

type Work = {
  original: TournamentDataSnapshot;
  snapshot: MutableSnapshot;
  errors: AdministrationIssue[];
  warnings: AdministrationIssue[];
  changedGroups: Set<GroupCode>;
  replacementResultIds: Set<MatchId>;
};

const reviewedProposals = new WeakMap<AdministrationProposal, string>();

/**
 * Deterministic optimistic-concurrency label. The canonical content comparison
 * in applyAdministrationProposal provides proposal integrity; this compact
 * 32-bit label is not an authentication or cryptographic authorization boundary.
 */
function tournamentRevision(snapshot: TournamentDataSnapshot): string {
  return revisionOf(normalizePersistenceManagedSnapshot(snapshot));
}

/**
 * Creates a deeply frozen review artifact registered to this JavaScript
 * process. Proposal objects cannot be cloned, serialized, or reconstructed for
 * later application; prepare and apply must use the exact returned object in
 * the same process.
 */
export function prepareAdministrationUpdate(
  snapshot: TournamentDataSnapshot,
  commandOrCommands: AdministrationCommand | readonly AdministrationCommand[],
): AdministrationProposal {
  const commands = structuredClone(
    Array.isArray(commandOrCommands) ? commandOrCommands : [commandOrCommands],
  );
  const work: Work = {
    original: snapshot,
    snapshot: structuredClone(snapshot),
    errors: [],
    warnings: [],
    changedGroups: new Set(),
    replacementResultIds: new Set(
      commands.flatMap((command) =>
        isCommandRecord(command) && command.type === "replace_result"
          ? [command.result.matchId]
          : [],
      ),
    ),
  };

  const unsupportedCommands = findUnsupportedValue(commands, "commands");
  const unsupportedSnapshot = findUnsupportedValue(snapshot, "snapshot");
  if (unsupportedCommands !== null)
    issue(
      work,
      0,
      "unsupported_runtime_value",
      `${unsupportedCommands} is not a supported JSON-like command value.`,
    );
  if (unsupportedSnapshot !== null)
    issue(
      work,
      0,
      "unsupported_runtime_value",
      `${unsupportedSnapshot} is not a supported JSON-like snapshot value.`,
    );

  if (commands.length === 0) {
    issue(work, 0, "empty_batch", "At least one command is required.");
  }
  preflightConflicts(work, commands);
  commands.forEach((command, index) => applyCommand(work, command, index));

  if (work.errors.length === 0) {
    propagateKnockoutParticipants(work);
    recomputeGroupQualifications(work);
    validateResultingSnapshot(work, Math.max(0, commands.length - 1));
  }

  const safeToApply = work.errors.length === 0;
  const proposedSnapshot = safeToApply ? structuredClone(work.snapshot) : null;
  const affected = deriveAffectedData(snapshot, proposedSnapshot);
  const summary = summarizeDifferences(affected);
  const baseRevision = tournamentRevision(snapshot);
  const commandsRevision = revisionOf(commands);
  const resultRevision =
    proposedSnapshot === null
      ? "invalid"
      : tournamentRevision(proposedSnapshot);
  const proposalCore = {
    commands,
    baseRevision,
    commandsRevision,
    resultRevision,
    validation: safeToApply ? ("valid" as const) : ("invalid" as const),
    errors: work.errors,
    warnings: work.warnings,
    summary,
    affected,
    safeToApply,
    proposedSnapshot,
  };
  const proposal: AdministrationProposal = {
    ...proposalCore,
    proposalRevision: revisionOf({
      ...proposalCore,
      proposedSnapshot:
        proposalCore.proposedSnapshot === null
          ? null
          : normalizePersistenceManagedSnapshot(proposalCore.proposedSnapshot),
    }),
  };
  reviewedProposals.set(proposal, stableStringify(proposal));
  return deepFreeze(proposal);
}

/**
 * Recomputes and applies the reviewed commands without trusting proposal data.
 * The exact process-local object returned by prepareAdministrationUpdate is
 * required. Rejections never consume the proposal or mutate current state.
 */
export function applyAdministrationProposal(
  current: TournamentDataSnapshot,
  proposal: AdministrationProposal,
): ApplyProposalResult {
  if (tournamentRevision(current) !== proposal.baseRevision) {
    return rejected("stale_proposal", [
      applicationIssue(
        "stale_proposal",
        "Tournament state changed after this proposal was reviewed.",
      ),
    ]);
  }

  const registered = reviewedProposals.get(proposal);
  if (registered === undefined || registered !== stableStringify(proposal)) {
    return rejected("proposal_tampered", [
      applicationIssue(
        "proposal_tampered",
        "The proposal was not produced by this review workflow or changed after review.",
      ),
    ]);
  }

  const recomputed = prepareAdministrationUpdate(current, proposal.commands);
  if (!recomputed.safeToApply || recomputed.proposedSnapshot === null) {
    return rejected("invalid_proposal", recomputed.errors);
  }
  if (
    proposal.commandsRevision !== recomputed.commandsRevision ||
    proposal.resultRevision !== recomputed.resultRevision ||
    proposal.proposalRevision !== recomputed.proposalRevision ||
    stableStringify(normalizeProposalForBusinessIdentity(proposal)) !==
      stableStringify(normalizeProposalForBusinessIdentity(recomputed))
  ) {
    return rejected("proposal_tampered", [
      applicationIssue(
        "review_identity_mismatch",
        "Recomputed commands, result, or review metadata do not match the reviewed proposal.",
      ),
    ]);
  }

  const snapshot = structuredClone(recomputed.proposedSnapshot);
  const errors = canonicalErrors(snapshot);
  if (errors.length > 0) return rejected("invariant_violation", errors);
  return {
    status: "applied",
    snapshot,
    revision: tournamentRevision(snapshot),
  };
}

function preflightConflicts(
  work: Work,
  commands: readonly AdministrationCommand[],
): void {
  const fixtures = new Map<string, number>();
  const results = new Map<string, number>();
  const participants = new Map<string, number>();
  const overrideGroups = new Map<string, number>();
  let metadataIndex: number | undefined;

  commands.forEach((command, index) => {
    if (!isCommandRecord(command)) {
      issue(
        work,
        index,
        "unknown_command",
        "Administration commands must be objects with a known type.",
      );
      return;
    }
    let collection: Map<string, number> | undefined;
    let target: string | undefined;
    switch (command.type) {
      case "upsert_fixture":
        collection = fixtures;
        target = command.fixture.id;
        break;
      case "record_result":
      case "replace_result":
        collection = results;
        target = command.result.matchId;
        break;
      case "set_knockout_participants":
        collection = participants;
        target = command.matchId;
        break;
      case "set_group_override":
        collection = overrideGroups;
        target = command.override.groupCode;
        break;
      case "replace_group_override":
        collection = overrideGroups;
        target = command.override.groupCode;
        registerConflictTarget(
          work,
          overrideGroups,
          overrideRecords(work.snapshot, command.replacedOverrideId)[0]
            ?.groupCode ?? `unknown:${command.replacedOverrideId}`,
          index,
        );
        break;
      case "remove_group_override": {
        collection = overrideGroups;
        const records = overrideRecords(work.snapshot, command.overrideId);
        target = records[0]?.groupCode ?? `unknown:${command.overrideId}`;
        break;
      }
      case "update_tournament_metadata":
        if (metadataIndex !== undefined)
          issue(
            work,
            index,
            "conflicting_commands",
            `Commands ${metadataIndex} and ${index} both update tournament metadata.`,
          );
        metadataIndex = index;
        break;
      default:
        assertNeverCommand(work, command, index);
    }
    if (collection !== undefined && target !== undefined) {
      const previous = collection.get(target);
      if (previous !== undefined && previous !== index) {
        issue(
          work,
          index,
          "conflicting_commands",
          `Commands ${previous} and ${index} both write ${target}.`,
        );
      } else {
        collection.set(target, index);
      }
    }
  });

  for (const target of fixtures.keys()) {
    const participantIndex = participants.get(target);
    if (participantIndex !== undefined)
      issue(
        work,
        participantIndex,
        "conflicting_commands",
        `A fixture and participant command both write ${target}.`,
      );
  }
  for (const target of results.keys()) {
    const participantIndex = participants.get(target);
    if (participantIndex !== undefined)
      issue(
        work,
        participantIndex,
        "conflicting_commands",
        `A result and participant command both write ${target}.`,
      );
  }
}

function applyCommand(
  work: Work,
  command: AdministrationCommand,
  index: number,
): void {
  if (!isCommandRecord(command)) {
    issue(
      work,
      index,
      "unknown_command",
      "Administration commands must be objects with a known type.",
    );
    return;
  }
  switch (command.type) {
    case "upsert_fixture":
      upsertFixture(work, command.fixture, index);
      return;
    case "record_result":
      recordResult(work, command.result, index, false);
      return;
    case "replace_result":
      if (command.reason.trim() === "")
        issue(
          work,
          index,
          "missing_correction_reason",
          "A result correction requires a reason.",
        );
      recordResult(work, command.result, index, true);
      return;
    case "set_group_override":
      setOverride(work, command.override, index);
      return;
    case "replace_group_override":
      removeOverride(work, command.replacedOverrideId, index);
      if (!hasCommandError(work, index))
        setOverride(work, command.override, index);
      return;
    case "remove_group_override":
      removeOverride(work, command.overrideId, index);
      return;
    case "set_knockout_participants":
      setKnockoutParticipants(work, command, index);
      return;
    case "update_tournament_metadata":
      updateTournamentMetadata(work, command.update, index);
      return;
    default:
      assertNeverCommand(work, command, index);
  }
}

function upsertFixture(
  work: Work,
  fixture: OfficialFixture,
  index: number,
): void {
  const round = work.snapshot.rounds.find(({ id }) => id === fixture.roundId);
  if (round === undefined) {
    issue(work, index, "unknown_round", `Unknown round ${fixture.roundId}.`);
    return;
  }
  if (!Number.isInteger(fixture.matchNumber) || fixture.matchNumber <= 0)
    issue(
      work,
      index,
      "invalid_match_number",
      "Match number must be a positive integer.",
    );
  validateCountries(
    work,
    [fixture.homeCountryId, fixture.awayCountryId],
    index,
  );
  if (
    fixture.homeCountryId !== null &&
    fixture.homeCountryId === fixture.awayCountryId
  )
    issue(
      work,
      index,
      "duplicate_fixture_team",
      "A fixture must contain two different teams.",
    );
  if (round.stage === "group") validateGroupFixture(work, fixture, index);
  const position = work.snapshot.matches.findIndex(
    ({ id }) => id === fixture.id,
  );
  const existing = work.snapshot.matches[position];
  if (existing?.status === "completed")
    issue(
      work,
      index,
      "fixture_conflicts_with_result",
      "Use replace_result to correct a completed match.",
    );
  if (
    work.snapshot.matches.some(
      (match) =>
        match.id !== fixture.id && match.matchNumber === fixture.matchNumber,
    )
  )
    issue(
      work,
      index,
      "duplicate_match_number",
      `Match number ${fixture.matchNumber} already exists.`,
    );
  if (
    round.stage === "group" &&
    fixture.homeCountryId !== null &&
    fixture.awayCountryId !== null &&
    work.snapshot.matches.some(
      (match) =>
        match.id !== fixture.id &&
        match.stage === "group" &&
        samePair(
          match.homeCountryId,
          match.awayCountryId,
          fixture.homeCountryId!,
          fixture.awayCountryId!,
        ),
    )
  )
    issue(
      work,
      index,
      "duplicate_group_fixture",
      "This group-stage pairing already has an official fixture.",
    );
  if (hasCommandError(work, index)) return;

  const match: MatchRecord = {
    id: fixture.id,
    tournamentId: work.snapshot.tournament?.id ?? "",
    roundId: round.id,
    stage: round.stage,
    status: fixture.status ?? "scheduled",
    matchNumber: fixture.matchNumber,
    scheduledAt: fixture.scheduledAt,
    homeCountryId: fixture.homeCountryId,
    awayCountryId: fixture.awayCountryId,
    homeGoals: null,
    awayGoals: null,
    wentToExtraTime: false,
    homeShootoutGoals: null,
    awayShootoutGoals: null,
    advancingCountryId: null,
    homeSourceSlot: fixture.homeSourceSlot ?? null,
    awaySourceSlot: fixture.awaySourceSlot ?? null,
    dataClassification: work.snapshot.datasetKind,
  };
  work.snapshot.matches =
    position < 0
      ? [...work.snapshot.matches, match]
      : work.snapshot.matches.map((candidate, candidateIndex) =>
          candidateIndex === position ? match : candidate,
        );
  if (
    existing === undefined ||
    existing.roundId !== match.roundId ||
    existing.homeCountryId !== match.homeCountryId ||
    existing.awayCountryId !== match.awayCountryId ||
    existing.status === "completed"
  )
    markMatchGroup(work, match);
}

function recordResult(
  work: Work,
  result: CompletedResult,
  index: number,
  replacement: boolean,
): void {
  const position = work.snapshot.matches.findIndex(
    ({ id }) => id === result.matchId,
  );
  const existing = work.snapshot.matches[position];
  if (existing === undefined) {
    issue(work, index, "unknown_match", `Unknown match ${result.matchId}.`);
    return;
  }
  if (existing.status === "completed" && !replacement) {
    issue(
      work,
      index,
      "result_requires_replacement",
      "A completed result can only be changed with replace_result.",
    );
    return;
  }
  if (existing.status !== "completed" && replacement) {
    issue(
      work,
      index,
      "nothing_to_replace",
      "The match does not have a completed result to replace.",
    );
    return;
  }
  if (replacement)
    warning(
      work,
      index,
      "replacing_completed_result",
      `Completed result ${result.matchId} will be replaced.`,
    );
  const updated: MatchRecord = {
    ...existing,
    status: "completed",
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    wentToExtraTime: result.wentToExtraTime ?? false,
    homeShootoutGoals: result.homeShootoutGoals ?? null,
    awayShootoutGoals: result.awayShootoutGoals ?? null,
    advancingCountryId:
      existing.stage === "group" ? null : (result.advancingCountryId ?? null),
  };
  work.snapshot.matches = work.snapshot.matches.map((match, matchIndex) =>
    matchIndex === position ? updated : match,
  );
  markMatchGroup(work, updated);
}

function validateGroupFixture(
  work: Work,
  fixture: OfficialFixture,
  index: number,
): void {
  if (
    (fixture.homeSourceSlot ?? null) !== null ||
    (fixture.awaySourceSlot ?? null) !== null
  )
    issue(
      work,
      index,
      "group_source_slot",
      "Group-stage fixtures cannot use knockout source slots.",
    );
  if (fixture.homeCountryId === null || fixture.awayCountryId === null) {
    issue(
      work,
      index,
      "unassigned_group_fixture",
      "A group fixture requires two assigned group teams.",
    );
    return;
  }
  const homeCountryId = fixture.homeCountryId;
  const awayCountryId = fixture.awayCountryId;
  const homeGroups = work.snapshot.groups.filter(({ countryIds }) =>
    countryIds.includes(homeCountryId),
  );
  const awayGroups = work.snapshot.groups.filter(({ countryIds }) =>
    countryIds.includes(awayCountryId),
  );
  if (
    homeGroups.length !== 1 ||
    awayGroups.length !== 1 ||
    homeGroups[0]?.code !== awayGroups[0]?.code
  )
    issue(
      work,
      index,
      "cross_group_fixture",
      "Group-stage participants must belong to the same assigned group.",
    );
}

function setOverride(
  work: Work,
  input: GroupOverrideInput,
  index: number,
): void {
  const group = work.snapshot.groups.find(
    ({ code }) => code === input.groupCode,
  );
  if (group === undefined) {
    issue(work, index, "unknown_group", `Unknown group ${input.groupCode}.`);
    return;
  }
  validateCompleteOrder(work, group, input, index);
  if (overrideRecords(work.snapshot, input.id).length > 0)
    issue(
      work,
      index,
      "duplicate_override_id",
      `Override ${input.id} already exists.`,
    );
  if (
    work.snapshot.groupOverrides.some(
      (record) => record.groupCode === input.groupCode,
    )
  )
    issue(
      work,
      index,
      "duplicate_group_override",
      `Group ${input.groupCode} already has an override.`,
    );
  if (hasCommandError(work, index)) return;
  const records: GroupQualificationOverrideRecord[] =
    input.orderedCountryIds.map((countryId, rank) => ({
      id: groupOverrideEntryId(
        input.id,
        work.snapshot.tournament?.id ?? "",
        input.groupCode,
        countryId,
      ),
      setId: input.id,
      tournamentId: work.snapshot.tournament?.id ?? "",
      groupCode: input.groupCode,
      countryId,
      officialRank: rank + 1,
      reason: input.reason,
      source: input.source,
    }));
  work.snapshot.groupOverrides = [
    ...work.snapshot.groupOverrides,
    ...records,
  ].sort(compareGroupOverrideEntries);
  work.changedGroups.add(input.groupCode);
}

function validateCompleteOrder(
  work: Work,
  group: TournamentGroup,
  input: GroupOverrideInput,
  index: number,
): void {
  if (input.reason.trim() === "" || input.source.trim() === "")
    issue(
      work,
      index,
      "invalid_group_override",
      "A group override requires a reason and source.",
    );
  if (input.orderedCountryIds.length !== group.countryIds.length)
    issue(
      work,
      index,
      "incomplete_group_override",
      `A group override must order all ${group.countryIds.length} countries.`,
    );
  if (new Set(input.orderedCountryIds).size !== input.orderedCountryIds.length)
    issue(
      work,
      index,
      "duplicate_override_country",
      "A group override cannot contain duplicate countries.",
    );
  const expected = new Set(group.countryIds);
  for (const countryId of input.orderedCountryIds)
    if (!expected.has(countryId))
      issue(
        work,
        index,
        "override_team_not_in_group",
        `${countryId} does not belong to group ${group.code}.`,
      );
  for (const countryId of group.countryIds)
    if (!input.orderedCountryIds.includes(countryId))
      issue(
        work,
        index,
        "missing_override_country",
        `${countryId} is missing from the group override.`,
      );
}

function removeOverride(work: Work, id: string, index: number): void {
  const records = overrideRecords(work.snapshot, id);
  if (records.length === 0) {
    issue(
      work,
      index,
      "unknown_group_override",
      `Unknown group override ${id}.`,
    );
    return;
  }
  const ids = new Set(records.map(({ id: recordId }) => recordId));
  work.snapshot.groupOverrides = work.snapshot.groupOverrides.filter(
    (record) => !ids.has(record.id),
  );
  for (const record of records) work.changedGroups.add(record.groupCode);
}

function setKnockoutParticipants(
  work: Work,
  command: Extract<
    AdministrationCommand,
    { type: "set_knockout_participants" }
  >,
  index: number,
): void {
  const position = work.snapshot.matches.findIndex(
    ({ id }) => id === command.matchId,
  );
  const existing = work.snapshot.matches[position];
  if (existing === undefined) {
    issue(work, index, "unknown_match", `Unknown match ${command.matchId}.`);
    return;
  }
  if (existing.stage === "group") {
    issue(
      work,
      index,
      "not_knockout_match",
      `${command.matchId} is a group match.`,
    );
    return;
  }
  if (existing.status === "completed") {
    issue(
      work,
      index,
      "completed_participant_change",
      "Replace the completed result instead of changing its participants.",
    );
    return;
  }
  if (existing.homeSourceSlot !== null || existing.awaySourceSlot !== null) {
    issue(
      work,
      index,
      "source_managed_participants",
      "Source-slot participants are derived from upstream results.",
    );
    return;
  }
  validateCountries(
    work,
    [command.homeCountryId, command.awayCountryId],
    index,
  );
  if (
    command.homeCountryId !== null &&
    command.homeCountryId === command.awayCountryId
  )
    issue(
      work,
      index,
      "duplicate_fixture_team",
      "A match must contain two different teams.",
    );
  if (hasCommandError(work, index)) return;
  work.snapshot.matches = work.snapshot.matches.map((match, matchIndex) =>
    matchIndex === position
      ? {
          ...existing,
          homeCountryId: command.homeCountryId,
          awayCountryId: command.awayCountryId,
        }
      : match,
  );
}

function updateTournamentMetadata(
  work: Work,
  update: TournamentMetadataUpdate,
  index: number,
): void {
  const tournament = work.snapshot.tournament;
  if (tournament === null) {
    issue(
      work,
      index,
      "missing_tournament",
      "The tournament record is missing.",
    );
    return;
  }
  if (
    update.status !== undefined &&
    update.status !== "planned" &&
    update.status !== "active" &&
    update.status !== "completed"
  )
    issue(
      work,
      index,
      "invalid_tournament_status",
      `Invalid tournament status ${String(update.status)}.`,
    );
  if (
    update.currentRoundId !== undefined &&
    update.currentRoundId !== null &&
    !work.snapshot.rounds.some(({ id }) => id === update.currentRoundId)
  )
    issue(
      work,
      index,
      "unknown_current_round",
      `Unknown current round ${update.currentRoundId}.`,
    );
  if (Object.keys(update).length === 0)
    issue(work, index, "empty_metadata_update", "Metadata update is empty.");
  const changesBusinessState =
    (update.status !== undefined && update.status !== tournament.status) ||
    (update.currentRoundId !== undefined &&
      update.currentRoundId !== tournament.currentRoundId) ||
    (update.referenceDataComplete !== undefined &&
      update.referenceDataComplete !== tournament.referenceDataComplete) ||
    (update.missingOfficialData !== undefined &&
      stableStringify(update.missingOfficialData) !==
        stableStringify(tournament.missingOfficialData));
  if (Object.keys(update).length > 0 && !changesBusinessState)
    issue(
      work,
      index,
      "no_op_metadata_update",
      "Metadata update does not change canonical business state.",
    );
  if (hasCommandError(work, index)) return;
  work.snapshot.tournament = {
    ...tournament,
    ...update,
    missingOfficialData:
      update.missingOfficialData === undefined
        ? tournament.missingOfficialData
        : [...update.missingOfficialData],
  };
}

/**
 * Persistence revision and lastUpdatedAt are database-managed operational
 * fields. Administration proposal identities deliberately cover every other
 * canonical field while excluding those two values.
 */
function normalizePersistenceManagedSnapshot(
  snapshot: TournamentDataSnapshot,
): unknown {
  return snapshot.tournament === null
    ? snapshot
    : {
        ...snapshot,
        tournament: {
          ...snapshot.tournament,
          lastUpdatedAt: "database-managed",
        },
      };
}

function normalizeProposalForBusinessIdentity(
  proposal: AdministrationProposal,
): unknown {
  return {
    ...proposal,
    proposedSnapshot:
      proposal.proposedSnapshot === null
        ? null
        : normalizePersistenceManagedSnapshot(proposal.proposedSnapshot),
  };
}

function propagateKnockoutParticipants(work: Work): void {
  const roundOrder = new Map(
    work.snapshot.rounds.map(({ id, displayOrder }) => [id, displayOrder]),
  );
  const ordered = work.snapshot.matches
    .map((match, index) => ({ match, index }))
    .sort(
      (left, right) =>
        (roundOrder.get(left.match.roundId) ?? 0) -
          (roundOrder.get(right.match.roundId) ?? 0) ||
        left.index - right.index,
    );
  const byId = new Map(work.snapshot.matches.map((match) => [match.id, match]));

  for (const { match } of ordered) {
    if (match.stage === "group") continue;
    const home = resolveSource(byId, match.homeSourceSlot);
    const away = resolveSource(byId, match.awaySourceSlot);
    const expectedHome =
      match.homeSourceSlot === null ? match.homeCountryId : home;
    const expectedAway =
      match.awaySourceSlot === null ? match.awayCountryId : away;
    const changed =
      expectedHome !== match.homeCountryId ||
      expectedAway !== match.awayCountryId;
    if (!changed) continue;
    if (
      match.status === "completed" &&
      !work.replacementResultIds.has(match.id)
    ) {
      issue(
        work,
        0,
        "completed_downstream_conflict",
        `Completed match ${match.id} has participants inconsistent with its source slots and must be replaced in the same batch.`,
      );
      continue;
    }
    const updated = {
      ...match,
      homeCountryId: expectedHome,
      awayCountryId: expectedAway,
    };
    byId.set(match.id, updated);
    const position = work.snapshot.matches.findIndex(
      ({ id }) => id === match.id,
    );
    work.snapshot.matches = work.snapshot.matches.map((candidate, index) =>
      index === position ? updated : candidate,
    );
  }
}

function resolveSource(
  matches: ReadonlyMap<MatchId, MatchRecord>,
  slot: MatchRecord["homeSourceSlot"],
): CountryId | null {
  if (slot === null) return null;
  const source = matches.get(slot.sourceMatchId);
  if (
    source?.status !== "completed" ||
    source.homeCountryId === null ||
    source.awayCountryId === null ||
    source.advancingCountryId === null
  )
    return null;
  return slot.outcome === "winner"
    ? source.advancingCountryId
    : source.advancingCountryId === source.homeCountryId
      ? source.awayCountryId
      : source.homeCountryId;
}

function recomputeGroupQualifications(work: Work): void {
  if (work.changedGroups.size === 0) return;
  work.snapshot.groupQualifications = deriveGroupQualifications(work.snapshot, {
    previousQualifications: work.original.groupQualifications,
    changedGroupCodes: work.changedGroups,
    useOverrideBoundaryResolutions: false,
  });
}

function isCompleteOverride(
  records: readonly GroupQualificationOverrideRecord[],
  group: TournamentGroup,
): boolean {
  return (
    records.length === group.countryIds.length &&
    new Set(records.map(({ countryId }) => countryId)).size ===
      group.countryIds.length &&
    new Set(records.map(({ officialRank }) => officialRank)).size ===
      group.countryIds.length &&
    records.every(
      ({ countryId, officialRank }) =>
        group.countryIds.includes(countryId) &&
        officialRank !== undefined &&
        officialRank >= 1 &&
        officialRank <= group.countryIds.length,
    )
  );
}

function validateResultingSnapshot(work: Work, commandIndex: number): void {
  for (const error of canonicalErrors(work.snapshot))
    issue(work, commandIndex, error.code, error.message);
  for (const match of work.snapshot.matches) {
    if (match.stage === "group") {
      const fixture: OfficialFixture = {
        id: match.id,
        roundId: match.roundId,
        matchNumber: match.matchNumber,
        scheduledAt: match.scheduledAt,
        homeCountryId: match.homeCountryId,
        awayCountryId: match.awayCountryId,
        homeSourceSlot: match.homeSourceSlot,
        awaySourceSlot: match.awaySourceSlot,
      };
      validateGroupFixture(work, fixture, commandIndex);
    }
    const targetRound = work.snapshot.rounds.find(
      ({ id }) => id === match.roundId,
    );
    for (const slot of [match.homeSourceSlot, match.awaySourceSlot]) {
      if (slot === null) continue;
      const source = work.snapshot.matches.find(
        ({ id }) => id === slot.sourceMatchId,
      );
      const sourceRound = work.snapshot.rounds.find(
        ({ id }) => id === source?.roundId,
      );
      if (
        targetRound !== undefined &&
        sourceRound !== undefined &&
        sourceRound.displayOrder >= targetRound.displayOrder
      )
        issue(
          work,
          commandIndex,
          "invalid_source_progression",
          `${match.id} must source participants from an earlier round.`,
        );
    }
  }
  for (const group of work.snapshot.groups) {
    const pairToMatch = new Map<string, MatchId>();
    for (const match of work.snapshot.matches) {
      if (
        match.stage !== "group" ||
        match.homeCountryId === null ||
        match.awayCountryId === null ||
        !group.countryIds.includes(match.homeCountryId) ||
        !group.countryIds.includes(match.awayCountryId)
      )
        continue;
      const pair = [match.homeCountryId, match.awayCountryId].sort().join("|");
      const existingMatchId = pairToMatch.get(pair);
      if (existingMatchId !== undefined)
        issue(
          work,
          commandIndex,
          "duplicate_group_fixture",
          `${existingMatchId} and ${match.id} duplicate a group ${group.code} pairing.`,
        );
      else pairToMatch.set(pair, match.id);
    }
    const records = work.snapshot.groupOverrides.filter(
      ({ groupCode }) => groupCode === group.code,
    );
    if (records.length > 0 && !isCompleteOverride(records, group))
      issue(
        work,
        commandIndex,
        "incomplete_persisted_override",
        `Group ${group.code} must have one complete official-order override.`,
      );
  }
}

function deriveAffectedData(
  before: TournamentDataSnapshot,
  after: TournamentDataSnapshot | null,
): AdministrationAffectedData {
  const empty = {
    matchIds: [],
    groupCodes: [],
    countryIds: [],
    fixturesChanged: false,
    resultsChanged: false,
    standingsChanged: false,
    qualificationsChanged: false,
    knockoutParticipantsChanged: false,
    advancementChanged: false,
    leaderboardChanged: false,
    goldenStarChanged: false,
    goldenGoalChanged: false,
    goldenCupChanged: false,
    awardsChanged: false,
    tournamentMetadataChanged: false,
    publicPageModelsChanged: false,
  } satisfies AdministrationAffectedData;
  if (after === null) return empty;
  const beforeMatches = new Map(
    before.matches.map((match) => [match.id, match]),
  );
  const afterMatches = new Map(after.matches.map((match) => [match.id, match]));
  const matchIds = [
    ...new Set([...beforeMatches.keys(), ...afterMatches.keys()]),
  ]
    .filter(
      (id) =>
        stableStringify(beforeMatches.get(id)) !==
        stableStringify(afterMatches.get(id)),
    )
    .sort();
  const changedMatches = matchIds.flatMap((id) => {
    const match = afterMatches.get(id) ?? beforeMatches.get(id);
    return match === undefined ? [] : [match];
  });
  const changedOverrideRecords = changedRecords(
    before.groupOverrides,
    after.groupOverrides,
    (record) => record.id,
  );
  const countryIds = [
    ...new Set([
      ...changedMatches.flatMap((match) =>
        [
          match.homeCountryId,
          match.awayCountryId,
          match.advancingCountryId,
        ].filter((id): id is string => id !== null),
      ),
      ...changedOverrideRecords.map(({ countryId }) => countryId),
    ]),
  ].sort();
  const groupCodes = [
    ...new Set([
      ...changedMatches.flatMap((match) =>
        before.groups
          .filter(
            ({ countryIds: ids }) =>
              match.homeCountryId !== null && ids.includes(match.homeCountryId),
          )
          .map(({ code }) => code),
      ),
      ...changedOverrideRecords.map(({ groupCode }) => groupCode),
    ]),
  ].sort();
  const fixturesChanged = matchIds.some((id) =>
    fixturePartChanged(beforeMatches.get(id), afterMatches.get(id)),
  );
  const resultsChanged = matchIds.some((id) =>
    resultPartChanged(beforeMatches.get(id), afterMatches.get(id)),
  );
  const standingsChanged =
    groupStandingsRevision(before) !== groupStandingsRevision(after);
  const qualificationsChanged =
    stableStringify(before.groupQualifications) !==
    stableStringify(after.groupQualifications);
  const knockoutParticipantsChanged = matchIds.some((id) =>
    knockoutParticipantsDiffer(beforeMatches.get(id), afterMatches.get(id)),
  );
  const beforeProjection = deriveCompetition(before);
  const afterProjection = deriveCompetition(after);
  const goldenStarChanged = projectionFieldChanged(
    beforeProjection.participants,
    afterProjection.participants,
    "stars",
  );
  const goldenGoalChanged = projectionFieldChanged(
    beforeProjection.participants,
    afterProjection.participants,
    "goals",
  );
  const goldenCupChanged = projectionFieldChanged(
    beforeProjection.participants,
    afterProjection.participants,
    "goldenCupStatus",
  );
  const advancementChanged =
    progressionRevision(before) !== progressionRevision(after);
  const leaderboardChanged = goldenStarChanged || goldenGoalChanged;
  const awardsChanged = leaderboardChanged || goldenCupChanged;
  const tournamentMetadataChanged =
    stableStringify(before.tournament) !== stableStringify(after.tournament);
  return {
    matchIds,
    groupCodes,
    countryIds,
    fixturesChanged,
    resultsChanged,
    standingsChanged,
    qualificationsChanged,
    knockoutParticipantsChanged,
    advancementChanged,
    leaderboardChanged,
    goldenStarChanged,
    goldenGoalChanged,
    goldenCupChanged,
    awardsChanged,
    tournamentMetadataChanged,
    publicPageModelsChanged: stableStringify(before) !== stableStringify(after),
  };
}

function summarizeDifferences(affected: AdministrationAffectedData): string[] {
  const summary: string[] = [];
  if (affected.fixturesChanged)
    summary.push(`Fixtures changed: ${affected.matchIds.join(", ")}.`);
  if (affected.resultsChanged)
    summary.push(`Results changed: ${affected.matchIds.join(", ")}.`);
  if (affected.standingsChanged)
    summary.push(`Group standings changed: ${affected.groupCodes.join(", ")}.`);
  if (affected.qualificationsChanged)
    summary.push("Group qualification changed.");
  if (affected.knockoutParticipantsChanged)
    summary.push("Knockout participants changed.");
  if (affected.advancementChanged)
    summary.push("Tournament advancement changed.");
  if (affected.leaderboardChanged) summary.push("Public leaderboard changed.");
  if (affected.awardsChanged) summary.push("Award projections changed.");
  if (affected.tournamentMetadataChanged)
    summary.push("Tournament metadata changed.");
  if (summary.length === 0) summary.push("No tournament data changes.");
  return summary;
}

function fixturePartChanged(
  before: MatchRecord | undefined,
  after: MatchRecord | undefined,
): boolean {
  const select = (match: MatchRecord | undefined) =>
    match === undefined
      ? undefined
      : {
          id: match.id,
          roundId: match.roundId,
          matchNumber: match.matchNumber,
          scheduledAt: match.scheduledAt,
          homeCountryId: match.homeCountryId,
          awayCountryId: match.awayCountryId,
          homeSourceSlot: match.homeSourceSlot,
          awaySourceSlot: match.awaySourceSlot,
        };
  return stableStringify(select(before)) !== stableStringify(select(after));
}

function resultPartChanged(
  before: MatchRecord | undefined,
  after: MatchRecord | undefined,
): boolean {
  const select = (match: MatchRecord | undefined) =>
    match === undefined
      ? undefined
      : {
          status: match.status,
          homeGoals: match.homeGoals,
          awayGoals: match.awayGoals,
          wentToExtraTime: match.wentToExtraTime,
          homeShootoutGoals: match.homeShootoutGoals,
          awayShootoutGoals: match.awayShootoutGoals,
          advancingCountryId: match.advancingCountryId,
        };
  return stableStringify(select(before)) !== stableStringify(select(after));
}

function groupStandingsRevision(snapshot: TournamentDataSnapshot): string {
  return revisionOf(
    snapshot.groups.map((group) => ({
      code: group.code,
      standings: calculateGroupStandings(group.countryIds, snapshot.matches),
      overrides: snapshot.groupOverrides.filter(
        ({ groupCode }) => groupCode === group.code,
      ),
    })),
  );
}

function knockoutParticipantsDiffer(
  before: MatchRecord | undefined,
  after: MatchRecord | undefined,
): boolean {
  if ((before?.stage ?? after?.stage) === "group") return false;
  return (
    before?.homeCountryId !== after?.homeCountryId ||
    before?.awayCountryId !== after?.awayCountryId
  );
}

function changedRecords<T>(
  before: readonly T[],
  after: readonly T[],
  key: (record: T) => string,
): T[] {
  const left = new Map(before.map((record) => [key(record), record]));
  const right = new Map(after.map((record) => [key(record), record]));
  return [...new Set([...left.keys(), ...right.keys()])].flatMap((id) => {
    const beforeRecord = left.get(id);
    const afterRecord = right.get(id);
    return stableStringify(beforeRecord) === stableStringify(afterRecord)
      ? []
      : afterRecord === undefined
        ? beforeRecord === undefined
          ? []
          : [beforeRecord]
        : [afterRecord];
  });
}

function samePair(
  leftHome: CountryId | null,
  leftAway: CountryId | null,
  rightHome: CountryId,
  rightAway: CountryId,
): boolean {
  return (
    (leftHome === rightHome && leftAway === rightAway) ||
    (leftHome === rightAway && leftAway === rightHome)
  );
}

function progressionRevision(snapshot: TournamentDataSnapshot): string {
  return revisionOf(
    deriveProgression({
      countryIds: snapshot.countries.map(({ id }) => id),
      matches: snapshot.matches,
      groupQualifications: snapshot.groupQualifications,
    }),
  );
}

function projectionFieldChanged(
  before: ReturnType<typeof deriveCompetition>["participants"],
  after: ReturnType<typeof deriveCompetition>["participants"],
  field: "stars" | "goals" | "goldenCupStatus",
): boolean {
  const select = (participants: typeof before) =>
    participants.map((participant) => ({
      participantId: participant.participantId,
      value: participant[field],
    }));
  return stableStringify(select(before)) !== stableStringify(select(after));
}

function overrideRecords(
  snapshot: TournamentDataSnapshot,
  id: string,
): GroupQualificationOverrideRecord[] {
  return snapshot.groupOverrides.filter(
    (record) => record.setId === id || record.id === id,
  );
}

function markMatchGroup(work: Work, match: MatchRecord): void {
  if (match.stage !== "group") return;
  const group = work.snapshot.groups.find(
    ({ countryIds }) =>
      match.homeCountryId !== null && countryIds.includes(match.homeCountryId),
  );
  if (group !== undefined) work.changedGroups.add(group.code);
}

function validateCountries(
  work: Work,
  ids: readonly (CountryId | null)[],
  index: number,
): void {
  const known = new Set(work.snapshot.countries.map(({ id }) => id));
  for (const id of ids)
    if (id !== null && !known.has(id))
      issue(work, index, "unknown_team", `Unknown team ${id}.`);
}

function canonicalErrors(
  snapshot: TournamentDataSnapshot,
): AdministrationIssue[] {
  return validateCanonicalData(snapshot)
    .filter(({ severity }) => severity === "error")
    .map(({ code, message }) => ({ commandIndex: 0, code, message }));
}

function hasCommandError(work: Work, index: number): boolean {
  return work.errors.some(({ commandIndex }) => commandIndex === index);
}

function issue(
  work: Work,
  commandIndex: number,
  code: string,
  message: string,
): void {
  work.errors.push({ commandIndex, code, message });
}

function warning(
  work: Work,
  commandIndex: number,
  code: string,
  message: string,
): void {
  work.warnings.push({ commandIndex, code, message });
}

function applicationIssue(code: string, message: string): AdministrationIssue {
  return { commandIndex: 0, code, message };
}

function rejected(
  code:
    | "invalid_proposal"
    | "stale_proposal"
    | "invariant_violation"
    | "proposal_tampered",
  errors: readonly AdministrationIssue[],
): ApplyProposalResult {
  return { status: "rejected", code, errors };
}

function assertNeverCommand(work: Work, command: never, index: number): void {
  const type =
    command !== null && typeof command === "object"
      ? (command as { type?: unknown }).type
      : undefined;
  issue(
    work,
    index,
    "unknown_command",
    `Unknown administration command ${String(type)}.`,
  );
}

function isCommandRecord(command: unknown): command is AdministrationCommand {
  return command !== null && typeof command === "object" && "type" in command;
}

function registerConflictTarget(
  work: Work,
  targets: Map<string, number>,
  target: string,
  index: number,
): void {
  const previous = targets.get(target);
  if (previous !== undefined && previous !== index)
    issue(
      work,
      index,
      "conflicting_commands",
      `Commands ${previous} and ${index} both write ${target}.`,
    );
  else targets.set(target, index);
}

function revisionOf(value: unknown): string {
  const canonical = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
    .join(",")}}`;
}

function findUnsupportedValue(value: unknown, path: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? null : path;
  if (typeof value === "string" || typeof value === "boolean") return null;
  if (typeof value !== "object") return path;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const unsupported = findUnsupportedValue(
        value[index],
        `${path}[${index}]`,
      );
      if (unsupported !== null) return unsupported;
    }
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return path;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const unsupported = findUnsupportedValue(child, `${path}.${key}`);
    if (unsupported !== null) return unsupported;
  }
  return null;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
  }
  return value;
}
