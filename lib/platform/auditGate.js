// lib/platform/auditGate.js
//
// The door for the console's conversation-audit routes: the staff chat
// (app/api/platform/chat/audit/*) and a rep's texts and emails with a
// prospect (app/api/platform/sales/conversations/*).
//
// ══ Why the route names the permission and this file checks it ═══════════
//
// The permission literal ("chat:audit") is passed IN rather than fixed here,
// so every route file carries the string it is gated on. That is what
// scripts/check-platform-truth.mjs's GATED table reads: it proves a screen
// asks `can("chat:audit")` for the same permission its route enforces, and it
// does so by looking for the literal in the route file. A gate that hid the
// literal in a helper would pass the screen and fail the proof.
//
// ══ The row, not the token ════════════════════════════════════════════════
//
// The JWT says who and what role; the PlatformAdmin row says whether they
// are still active and what their email is — the system line the audit
// posts into a room names them by it. An admin switched off keeps a valid
// token until it expires, so the row is re-read on every request, the same
// way lib/staff/viewer.js does for the chat itself.
//
// A plain `{ viewer, refusal }` rather than a NextResponse, matching
// lib/sales/gate.js and lib/sales/notes/platformGate.js — importable by a
// check script that cannot resolve "next/server", and the route builds its
// own response, which check:refusal-shape requires.
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { canPlatform } from "@/lib/platform/permissions";

/**
 * @param request
 * @param permission  the literal the route is gated on, e.g. "chat:audit"
 * @returns {{ viewer: {id,email,role}|null, refusal: {status, body}|null }}
 */
export async function requireAuditor(request, permission) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { viewer: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  if (!permission || !canPlatform(admin.role, permission)) {
    return {
      viewer: null,
      refusal: {
        status: 403,
        body: {
          error: "Only the owner (a superadmin) can read conversations they are not part of.",
          code: "not_auditor",
        },
      },
    };
  }
  const row = await db.platformAdmin.findUnique({
    where: { id: admin.id },
    select: { id: true, email: true, role: true, active: true },
  });
  if (!row?.active) {
    return { viewer: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  // The role from the ROW, not the token: a demotion takes effect on the
  // next request, not at the token's expiry.
  if (!canPlatform(row.role, permission)) {
    return {
      viewer: null,
      refusal: {
        status: 403,
        body: {
          error: "Only the owner (a superadmin) can read conversations they are not part of.",
          code: "not_auditor",
        },
      },
    };
  }
  return { viewer: { id: row.id, email: row.email, role: row.role }, refusal: null };
}
