import type {
  GroupQualificationOverrideRecord,
  MatchRecord,
  TournamentGroup,
} from "../data/types";
import type { GroupQualification } from "./types";
import {
  calculateGroupStandings,
  rankGroupStandings,
  resolveBestThirdPlaceQualifications,
} from "./group-standings";

type QualificationSnapshot = Readonly<{
  countries: readonly Readonly<{ id: string }>[];
  groups: readonly TournamentGroup[];
  matches: readonly MatchRecord[];
  groupOverrides: readonly GroupQualificationOverrideRecord[];
}>;

type DerivationOptions = Readonly<{
  previousQualifications?: readonly GroupQualification[];
  changedGroupCodes?: ReadonlySet<TournamentGroup["code"]>;
  useOverrideBoundaryResolutions?: boolean;
}>;

type FinalOrderRow = Readonly<{
  countryId: string;
  standing: ReturnType<typeof calculateGroupStandings>[number];
  source: "calculated" | "override";
}>;

export function deriveGroupQualifications(
  snapshot: QualificationSnapshot,
  options: DerivationOptions = {},
): GroupQualification[] {
  const changedGroups =
    options.changedGroupCodes ??
    new Set(snapshot.groups.map(({ code }) => code));
  const changedCountries = new Set(
    snapshot.groups
      .filter(({ code }) => changedGroups.has(code))
      .flatMap(({ countryIds }) => countryIds),
  );
  const qualifications = new Map(
    (options.previousQualifications ?? [])
      .filter(({ countryId }) => !changedCountries.has(countryId))
      .map((qualification) => [qualification.countryId, qualification]),
  );
  const thirdPlaces: ReturnType<typeof calculateGroupStandings> = [];
  let everyGroupResolved = true;

  for (const group of snapshot.groups) {
    const order = finalGroupOrder(snapshot, group);
    if (order === null) {
      everyGroupResolved = false;
      if (!changedGroups.has(group.code)) {
        const third = existingThirdPlace(snapshot, group);
        if (third !== undefined) thirdPlaces.push(third);
      }
      continue;
    }
    qualifications.set(
      order[0]!.countryId,
      qualification(order[0]!.countryId, true, order[0]!.source),
    );
    qualifications.set(
      order[1]!.countryId,
      qualification(order[1]!.countryId, true, order[1]!.source),
    );
    qualifications.set(
      order[3]!.countryId,
      qualification(order[3]!.countryId, false, order[3]!.source),
    );
    thirdPlaces.push(order[2]!.standing);
  }

  if (everyGroupResolved && thirdPlaces.length >= 8) {
    const boundaryResolutions =
      options.useOverrideBoundaryResolutions === false
        ? []
        : snapshot.groupOverrides.flatMap((override) =>
            override.qualifiedForRoundOf32 === undefined
              ? []
              : [
                  qualification(
                    override.countryId,
                    override.qualifiedForRoundOf32,
                    "override",
                  ),
                ],
          );
    const result = resolveBestThirdPlaceQualifications(
      thirdPlaces,
      boundaryResolutions,
    );
    if (result.status === "resolved") {
      for (const resolved of result.qualifications) {
        qualifications.set(resolved.countryId, resolved);
      }
    } else {
      for (const resolved of result.guaranteedQualifications) {
        qualifications.set(resolved.countryId, resolved);
      }
    }
  }

  return snapshot.countries.flatMap(({ id }) => {
    const value = qualifications.get(id);
    return value === undefined ? [] : [{ ...value }];
  });
}

function finalGroupOrder(
  snapshot: QualificationSnapshot,
  group: TournamentGroup,
): readonly FinalOrderRow[] | null {
  if (group.countryIds.length !== 4) return null;
  const standings = calculateGroupStandings(group.countryIds, snapshot.matches);
  const records = snapshot.groupOverrides
    .filter(({ groupCode }) => groupCode === group.code)
    .sort(
      (left, right) => (left.officialRank ?? 0) - (right.officialRank ?? 0),
    );

  if (isCompleteOverride(records, group)) {
    const byCountry = new Map(standings.map((row) => [row.countryId, row]));
    return records.map((record) => ({
      countryId: record.countryId,
      standing: byCountry.get(record.countryId)!,
      source: "override",
    }));
  }
  if (!isGroupComplete(snapshot, group)) return null;
  const ranked = rankGroupStandings(standings);
  if (new Set(ranked.map(({ calculatedRank }) => calculatedRank)).size !== 4) {
    return null;
  }
  return ranked.map(({ standing }) => ({
    countryId: standing.countryId,
    standing,
    source: "calculated",
  }));
}

function isGroupComplete(
  snapshot: QualificationSnapshot,
  group: TournamentGroup,
): boolean {
  const completedPairs = new Set(
    snapshot.matches.flatMap((match) => {
      if (
        match.stage !== "group" ||
        match.status !== "completed" ||
        match.homeCountryId === null ||
        match.awayCountryId === null ||
        !group.countryIds.includes(match.homeCountryId) ||
        !group.countryIds.includes(match.awayCountryId)
      ) {
        return [];
      }
      return [[match.homeCountryId, match.awayCountryId].sort().join("|")];
    }),
  );
  const expectedPairs = group.countryIds.flatMap((left, index) =>
    group.countryIds
      .slice(index + 1)
      .map((right) => [left, right].sort().join("|")),
  );
  return (
    expectedPairs.length === 6 &&
    expectedPairs.every((pair) => completedPairs.has(pair))
  );
}

function existingThirdPlace(
  snapshot: QualificationSnapshot,
  group: TournamentGroup,
) {
  return finalGroupOrder(snapshot, group)?.[2]?.standing;
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

function qualification(
  countryId: string,
  qualifiedForRoundOf32: boolean,
  source: GroupQualification["source"],
): GroupQualification {
  return { countryId, qualifiedForRoundOf32, source };
}
