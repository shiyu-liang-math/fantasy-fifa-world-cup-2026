export class TournamentRepositoryUnavailableError extends Error {
  constructor() {
    super("The canonical tournament repository is temporarily unavailable.");
    this.name = "TournamentRepositoryUnavailableError";
  }
}

export class InvalidTournamentSnapshotError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("The canonical tournament snapshot is invalid.");
    this.name = "InvalidTournamentSnapshotError";
    this.issues = [...issues];
  }
}
