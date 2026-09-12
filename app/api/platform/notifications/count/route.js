// app/api/platform/notifications/count/route.js
//
// Two small numbers for the console's chrome: open support tickets, and
// Jennifer conversations waiting for a human. PlatformSidebar reads them
// once a minute while the tab is visible and announces a RISE — the in-tab
// half of browser notifications for the console (the push half is sent by
// app/api/sales/support/route.js and lib/ai/jennifer/conversations.js at
// the moment each event happens).
//
// Counts only, never rows: the sidebar draws digits and the notification
// says "a new ticket", and the screens behind /platform/support and
// /platform/jennifer stay the place the content is read.
//
// null, not 0, for a number this admin may not see (support:manage is
// superadmin-only) — the same rule /api/platform/sales/review/count applies:
// no badge is the honest answer, and a 403 on every poll is noise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { canPlatform } from "@/lib/platform/permissions";
import { UNRESOLVED_STATUSES } from "@/lib/support/escalation";

async function counted(fn) {
  try {
    const n = await fn();
    return Number.isFinite(n) ? n : null;
  } catch (err) {
    console.error("[platform notifications count]", err?.message || err);
    return null;
  }
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tickets, escalations] = await Promise.all([
    canPlatform(admin.role, "support:manage")
      ? counted(() => db.supportTicket.count({ where: { status: { in: UNRESOLVED_STATUSES } } }))
      : null,
    admin.role === "superadmin" || admin.role === "admin"
      ? counted(() => db.jenniferConversation.count({ where: { status: "escalated" } }))
      : null,
  ]);

  return NextResponse.json({ tickets, escalations });
}
