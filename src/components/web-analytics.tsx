"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

export function filterAdminAnalytics(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  let pathname: string;
  try {
    pathname = new URL(event.url, "https://local.invalid").pathname;
  } catch {
    return null;
  }
  return pathname === "/admin" || pathname.startsWith("/admin/") ? null : event;
}

export function WebAnalytics() {
  return <Analytics beforeSend={filterAdminAnalytics} />;
}
