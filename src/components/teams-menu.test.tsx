import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { isActiveRoute } from "./nav-link";
import {
  TeamsMenu,
  nextTeamsMenuState,
  teamsMenuPanelClassName,
} from "./teams-menu";

const participants = [
  {
    participantId: "lyla",
    slug: "lyla",
    name: "Lyla",
    abbreviation: "L",
  },
  {
    participantId: "shiyu",
    slug: "shiyu",
    name: "Shiyu",
    abbreviation: "S",
  },
];

describe("TeamsMenu", () => {
  it("exposes its closed accessibility state from the trigger", () => {
    const html = renderToStaticMarkup(
      <TeamsMenu participants={participants} />,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="teams-navigation-menu"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it("exposes participant menu links when opened", () => {
    const html = renderToStaticMarkup(
      <TeamsMenu defaultOpen participants={participants} />,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('role="menu"');
    expect(html).toContain('href="/teams/lyla"');
    expect(html).toContain('href="/teams/shiyu"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(2);
  });

  it("uses an overlay panel with desktop right alignment and bounded scrolling", () => {
    expect(teamsMenuPanelClassName).toContain("fixed");
    expect(teamsMenuPanelClassName).toContain("z-50");
    expect(teamsMenuPanelClassName).toContain("max-h-80");
    expect(teamsMenuPanelClassName).toContain("overflow-y-auto");
    expect(teamsMenuPanelClassName).toContain("lg:absolute");
    expect(teamsMenuPanelClassName).toContain("lg:right-0");
    expect(teamsMenuPanelClassName).toContain("lg:top-full");
  });

  it("closes after selection or dismissal and toggles from its trigger", () => {
    expect(nextTeamsMenuState(false, "toggle")).toBe(true);
    expect(nextTeamsMenuState(true, "toggle")).toBe(false);
    expect(nextTeamsMenuState(true, "select")).toBe(false);
    expect(nextTeamsMenuState(true, "dismiss")).toBe(false);
  });
});

describe("active route matching", () => {
  it("keeps exact home matching and nested section matching", () => {
    expect(isActiveRoute("/", "/")).toBe(true);
    expect(isActiveRoute("/dashboard", "/")).toBe(false);
    expect(isActiveRoute("/tournament/groups", "/tournament")).toBe(true);
    expect(isActiveRoute("/awards", "/dashboard")).toBe(false);
  });
});
