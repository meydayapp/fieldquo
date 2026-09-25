// app/api/platform/signups/dismiss/route.js
//
// POST — "Remove from list" and "Restore" on /platform/signups.
//
// ══ What it writes, and what it never touches ══════════════════════════════
//
// A SignupDismissal row (lib/signup/dismissal.js) and an audit line — nothing
// else. The SignupLead or Company the row is about is not read for anything
// but its existence and is never written: the owner's standing rule is no
// data deletion, and non-negotiable #3 is that the console edits nothing on
// a company's data. "Remove" hides; "Restore" stamps restoredAt and keeps the
// history. There is no DELETE here and none should be added.
//
// The hide is real, not cosmetic: every reader of these rows — the two
// follow-up letters, the hot-lead promotion, the welcome-row backfill, the
// review folder and "Assign for callback" — refuses an active dismissal.
//
// ══ Superadmin only, checked here ══════════════════════════════════════════
//
// The same gate as ./assign: what reaches the sales floor is the owner's
// call. The page hides the button from anyone else, and hiding a button is
// not access control — the role is read fresh on every request.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { dismissSignupRow, readDismissTarget, restoreSignupRow } from "@/lib/signup/dismissal";

const MAX_TARGETS = 200;

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json({ error: "Only superadmins can remove signups from the list" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "dismiss" && action !== "restore") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  const targets = (Array.isArray(body?.targets) ? body.targets.slice(0, MAX_TARGETS) : [])
    .map(readDismissTarget)
    .filter(Boolean);
  if (!targets.length) return NextResponse.json({ error: "Pick at least one signup." }, { status: 400 });

  const now = new Date();
  const write = action === "dismiss" ? dismissSignupRow : restoreSignupRow;
  const results = [];
  for (const target of targets) {
    const r = await write({ client: db, admin, target, now }).catch((err) => ({
      error: err?.message || (action === "dismiss" ? "Could not remove." : "Could not restore."),
    }));
    results.push({ ...target, ...r });
  }
  const done = results.filter((r) => r.ok && !r.already).length;
  return NextResponse.json({ ok: true, action, done, results });
}
