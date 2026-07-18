import { type NextRequest, NextResponse } from "next/server";

import {
  applyAdminNoStoreHeaders,
  refreshAdminSession,
} from "@/lib/supabase/admin-session-proxy";

export async function proxy(request: NextRequest) {
  try {
    return await refreshAdminSession(request);
  } catch {
    // Protected pages render their safe unavailable state when configuration
    // or session refresh is unavailable.
    return applyAdminNoStoreHeaders(NextResponse.next({ request }));
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
