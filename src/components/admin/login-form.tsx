"use client";

import { useActionState, useEffect, useRef } from "react";

import { INITIAL_LOGIN_STATE } from "@/app/admin/action-state";
import { loginAction } from "@/app/admin/login/actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(
    loginAction,
    INITIAL_LOGIN_STATE,
  );
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") statusRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="max-w-md space-y-5">
      {state.status === "error" && (
        <div
          aria-live="polite"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-950"
          ref={statusRef}
          role="alert"
          tabIndex={-1}
        >
          {state.message}
        </div>
      )}
      <div className="space-y-2">
        <label className="block font-semibold text-slate-900" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="username"
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div className="space-y-2">
        <label
          className="block font-semibold text-slate-900"
          htmlFor="password"
        >
          Password
        </label>
        <input
          autoComplete="current-password"
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      <button
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 py-2 font-bold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
