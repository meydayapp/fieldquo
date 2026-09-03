// lib/sales/notes/platformGate.js
//
// The door for the two platform routes that read reps' notes.
//
// ══ Why superadmin and not canPlatform() ═══════════════════════════════════
//
// PLATFORM_PERMISSIONS has no sales permission, and
// app/api/platform/sales/reps/route.js's header explains why adding one was
// refused: it would imply the permission map has a scoping concept it does not
// have. So this follows that route's own bar — `admin.role !== "superadmin"`,
// asked through noteReaderWhere so there is exactly one definition of it —
// rather than inventing "notes:read" and granting it to a row that would then
// also grant it to "admin".
//
// The stronger reason is in lib/sales/notes/visibility.js: reading a rep's
// account of a phone call is a management act, and a support session looking
// at a ticket is not one.
//
// ══ Why the gate lives here and not in the route file ══════════════════════
//
// Two routes need it, and a second copy is the one that rots (AGENTS.md
// failure class #4). It also keeps route.js exporting nothing but HTTP
// methods, which is what Next expects of a route handler.
//
// ══ Why the check is "does noteReaderWhere refuse me", not a role compare ══
//
// A role compare here and a where-fragment there is two rules that can
// disagree, and the shape of the disagreement is a 200 with somebody's notes
// in it. So the gate asks the SAME function the query will run under: if it
// hands back anything other than an empty object — the fragment that means
// "all reps" — this viewer is not a note reader and the request is refused
// before a query happens.
//
// The consequence worth naming: a non-superadmin gets a 403, not an empty
// list. An empty list would be a screen saying "no reps have written any
// notes", which is a false statement about the world rather than a refusal.

import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { VIEWER_PLATFORM, noteReaderWhere } from "./visibility";

/**
 * The signed-in superadmin as a VIEWER, or a refusal to return verbatim.
 *
 *   const { viewer, refusal } = await requireNoteReader(request);
 *   if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
 *
 * A plain `{ body, status }` rather than a NextResponse, matching
 * lib/sales/gate.js and lib/permissions/enforce.js — so this module stays
 * importable by a check script that cannot resolve "next/server", and so the
 * route builds its own response, which check:refusal-shape requires.
 */
export async function requireNoteReader(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { viewer: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }

  // A viewer, not a role string, so every decision downstream goes through
  // canReadNote/noteReaderWhere and none of them re-derives what the role
  // means.
  const viewer = { kind: VIEWER_PLATFORM, role: admin.role };

  if (Object.keys(noteReaderWhere(viewer)).length !== 0) {
    return {
      viewer: null,
      refusal: {
        status: 403,
        body: { error: "Only superadmins can read the sales team's notes." },
      },
    };
  }

  return { viewer, refusal: null };
}
