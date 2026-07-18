import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

import {
  nextMobileMenuState,
  ResponsiveNavigation,
} from "./responsive-navigation";

const participants = [
  {
    participantId: "lyla",
    slug: "lyla",
    name: "Lyla",
    abbreviation: "L",
  },
];

describe("ResponsiveNavigation", () => {
  it("exposes a closed mobile disclosure without rendering its panel", () => {
    const html = renderToStaticMarkup(
      <ResponsiveNavigation participants={participants} />,
    );
    expect(html).toContain('aria-controls="mobile-primary-navigation"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Open primary navigation"');
    expect(html).not.toContain('id="mobile-primary-navigation"');
    expect(html).toContain('aria-label="Primary navigation"');
  });

  it("keeps every primary and nested team destination in the open menu", () => {
    const html = renderToStaticMarkup(
      <ResponsiveNavigation
        defaultOpen
        defaultTeamsOpen
        participants={participants}
      />,
    );
    expect(html).toContain('id="mobile-primary-navigation"');
    expect(html).toContain('aria-label="Close primary navigation"');
    expect(html.match(/href="\/dashboard"/g)).toHaveLength(2);
    expect(html).toContain('href="/teams/lyla"');
    expect(html).toContain('aria-current="page"');
  });

  it("toggles and dismisses deterministically", () => {
    expect(nextMobileMenuState(false, "toggle")).toBe(true);
    expect(nextMobileMenuState(true, "toggle")).toBe(false);
    expect(nextMobileMenuState(true, "dismiss")).toBe(false);
    expect(nextMobileMenuState(true, "select")).toBe(false);
  });
});
