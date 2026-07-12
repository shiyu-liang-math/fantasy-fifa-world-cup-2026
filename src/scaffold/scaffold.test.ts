import { describe, expect, it } from "vitest";

import {
  adminNavigation,
  publicNavigation,
  teamPath,
  tournamentNavigation,
} from "../config/routes";

describe("application scaffold", () => {
  it("defines every required static route without duplicates", () => {
    const configuredPaths = [
      ...publicNavigation,
      ...tournamentNavigation,
      ...adminNavigation,
    ].map(({ href }) => href);

    expect(configuredPaths).toEqual([
      "/",
      "/dashboard",
      "/awards",
      "/tournament",
      "/rules",
      "/tournament/groups",
      "/tournament/bracket",
      "/admin",
      "/admin/login",
    ]);
    expect(new Set(configuredPaths).size).toBe(configuredPaths.length);
  });

  it("builds the required dynamic team route safely", () => {
    expect(teamPath("team name/one")).toBe("/teams/team%20name%2Fone");
  });
});
