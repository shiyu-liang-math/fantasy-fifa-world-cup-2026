"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { teamPath } from "../config/routes";

export type TeamsMenuParticipant = Readonly<{
  participantId: string;
  slug: string;
  name: string;
  abbreviation: string;
}>;

export const teamsMenuPanelClassName =
  "fixed inset-x-4 top-28 z-50 max-h-80 overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-64";

export function nextTeamsMenuState(
  open: boolean,
  action: "toggle" | "dismiss" | "select",
) {
  return action === "toggle" ? !open : false;
}

export function TeamsMenu({
  participants,
  defaultOpen = false,
}: {
  participants: readonly TeamsMenuParticipant[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen((current) => nextTeamsMenuState(current, "dismiss"));
        triggerRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node))
        setOpen((current) => nextTeamsMenuState(current, "dismiss"));
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls="teams-navigation-menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
        onClick={() =>
          setOpen((current) => nextTeamsMenuState(current, "toggle"))
        }
        ref={triggerRef}
        type="button"
      >
        Teams <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul
          aria-label="Fantasy teams"
          className={teamsMenuPanelClassName}
          id="teams-navigation-menu"
          role="menu"
        >
          {participants.map((participant) => (
            <li key={participant.participantId} role="none">
              <Link
                className="block rounded-md px-3 py-2 text-slate-800 hover:bg-brand-50 hover:text-brand-800"
                href={teamPath(participant.slug)}
                onClick={() =>
                  setOpen((current) => nextTeamsMenuState(current, "select"))
                }
                role="menuitem"
              >
                {participant.name}{" "}
                <span className="text-slate-500">
                  ({participant.abbreviation})
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
