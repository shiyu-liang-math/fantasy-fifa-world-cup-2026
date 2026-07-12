export type AppRoute = {
  href: string;
  label: string;
};

export const publicNavigation: readonly AppRoute[] = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/awards", label: "Awards" },
  { href: "/tournament", label: "Tournament" },
  { href: "/rules", label: "Rules" },
];

export const tournamentNavigation: readonly AppRoute[] = [
  { href: "/tournament/groups", label: "Groups" },
  { href: "/tournament/bracket", label: "Bracket" },
];

export const adminNavigation: readonly AppRoute[] = [
  { href: "/admin", label: "Administration" },
  { href: "/admin/login", label: "Administrator login" },
];

export function teamPath(participantSlug: string) {
  return `/teams/${encodeURIComponent(participantSlug)}`;
}
