"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { publicNavigation, teamPath } from "@/config/routes";
import { isActiveRoute, NavLink } from "./nav-link";
import type { TeamsMenuParticipant } from "./teams-menu";
import { TeamsMenu } from "./teams-menu";

const mobileLinkClassName =
  "flex min-h-11 items-center rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-800";

export function nextMobileMenuState(
  open: boolean,
  action: "toggle" | "dismiss" | "select",
) {
  return action === "toggle" ? !open : false;
}

export function ResponsiveNavigation({
  participants,
  defaultOpen = false,
  defaultTeamsOpen = false,
}: {
  participants: readonly TeamsMenuParticipant[];
  defaultOpen?: boolean;
  defaultTeamsOpen?: boolean;
}) {
  const pathname = usePathname();
  const [openForPathname, setOpenForPathname] = useState<string | null>(() =>
    defaultOpen ? pathname : null,
  );
  const [teamsOpenForPathname, setTeamsOpenForPathname] = useState<
    string | null
  >(() => (defaultTeamsOpen ? pathname : null));
  const open = openForPathname === pathname;
  const teamsOpen = teamsOpenForPathname === pathname;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const teamsTriggerRef = useRef<HTMLButtonElement>(null);

  function dismiss() {
    setOpenForPathname(null);
    setTeamsOpenForPathname(null);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOpenForPathname(null);
      setTeamsOpenForPathname(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (teamsOpen) {
        setTeamsOpenForPathname(null);
        teamsTriggerRef.current?.focus();
        return;
      }
      dismiss();
      triggerRef.current?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) dismiss();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, teamsOpen]);

  return (
    <>
      <nav aria-label="Primary navigation" className="hidden lg:block">
        <ul className="flex items-center justify-end gap-1 text-sm">
          {publicNavigation.map((route) => (
            <li key={route.href}>
              <NavLink href={route.href}>{route.label}</NavLink>
            </li>
          ))}
          <li>
            <TeamsMenu participants={participants} />
          </li>
        </ul>
      </nav>

      <div className="lg:hidden" ref={containerRef}>
        <button
          aria-controls="mobile-primary-navigation"
          aria-expanded={open}
          aria-label={
            open ? "Close primary navigation" : "Open primary navigation"
          }
          className="grid min-h-11 min-w-11 place-items-center rounded-md border border-slate-300 bg-white text-xl font-semibold leading-none text-slate-800 hover:bg-slate-100"
          onClick={() => {
            setOpenForPathname(
              nextMobileMenuState(open, "toggle") ? pathname : null,
            );
            if (open) setTeamsOpenForPathname(null);
          }}
          ref={triggerRef}
          type="button"
        >
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>

        {open && (
          <nav
            aria-label="Mobile primary navigation"
            className="fixed inset-x-4 top-[4.5rem] z-50 max-h-[calc(100dvh-5.5rem)] overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
            id="mobile-primary-navigation"
          >
            <ul className="space-y-1 text-base">
              {publicNavigation.map((route) => (
                <li key={route.href}>
                  <Link
                    aria-current={
                      isActiveRoute(pathname, route.href) ? "page" : undefined
                    }
                    className={mobileLinkClassName}
                    href={route.href}
                    onClick={dismiss}
                  >
                    {route.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  aria-controls="mobile-teams-navigation"
                  aria-expanded={teamsOpen}
                  className={`${mobileLinkClassName} w-full justify-between text-left`}
                  onClick={() =>
                    setTeamsOpenForPathname(teamsOpen ? null : pathname)
                  }
                  ref={teamsTriggerRef}
                  type="button"
                >
                  Teams
                  <span aria-hidden="true">{teamsOpen ? "▴" : "▾"}</span>
                </button>
                {teamsOpen && (
                  <ul
                    aria-label="Fantasy teams"
                    className="mt-1 space-y-1 border-l-2 border-brand-100 pl-3"
                    id="mobile-teams-navigation"
                  >
                    {participants.map((participant) => (
                      <li key={participant.participantId}>
                        <Link
                          aria-current={
                            pathname === teamPath(participant.slug)
                              ? "page"
                              : undefined
                          }
                          className={mobileLinkClassName}
                          href={teamPath(participant.slug)}
                          onClick={dismiss}
                        >
                          {participant.name}{" "}
                          <span className="ml-1 text-slate-500">
                            ({participant.abbreviation})
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          </nav>
        )}
      </div>
    </>
  );
}
