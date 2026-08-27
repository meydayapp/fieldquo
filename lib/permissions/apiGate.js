// lib/permissions/apiGate.js
//
// The grid check a route makes BEFORE it answers, in the shape memberOrRefusal
// already taught every handler to read.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// Until the `none` rung landed, the bottom of the quotes/jobs/invoices/requests
// ladders was view_only, so the READ half of those categories never needed a
// gate: everybody who could reach the route was allowed the document. The write
// halves were enforced (requireLevel at view_create_edit) and the read half was
// enforced by there being nothing below it.
//
// `none` removes that floor, and roughly thirty GET handlers would otherwise
// each need the same six lines:
//
//   const full = await loadEnforceableMember(db, member.id);
//   try { requireLevel(full, "quotes", "view_only", "see quotes"); }
//   catch (err) { const { body, status } = permissionErrorResponse(err); … }
//
// Six lines copied thirty times is the duplication AGENTS.md names, and the
// copy that rots is the one guarding the endpoint nobody looks at. One helper,
// one shape, one place to change.
//
// ══ Why it returns the member ══════════════════════════════════════════════
//
// Most of these routes already load the enforceable member a few lines later,
// to redact what they return. Handing it back means the gate costs no extra
// query — and, more usefully, means a route cannot end up gated by one member
// object and redacted by another.
//
// Separate module from enforce.js on purpose: enforce.js is imported by
// app/providers/PermissionProvider.js and therefore ships to the browser, and
// `next/server` plus the Prisma client have no business in that bundle.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "./enforce";

/**
 * Load this member's grid and refuse if it is below `level` in `category`.
 *
 * Mirrors memberOrRefusal deliberately, so a handler reads the same way twice:
 *
 *   const { member, response } = await memberOrRefusal(request);
 *   if (response) return response;
 *   const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see quotes");
 *   if (denied) return denied;
 *
 * @param member   the session member from memberOrRefusal (needs `id`)
 * @param category key of PERMISSION_CATEGORIES
 * @param level    the minimum level value required
 * @param action   the verb phrase the refusal sentence ends with
 * @returns {{ full }} on success, or {{ response }} to return as-is
 */
export async function levelOrRefusal(member, category, level, action) {
  // No member id means loadEnforceableMember returns null, and hasLevel denies
  // a null member — the safe direction, and the one enforce.js documents.
  const full = await loadEnforceableMember(db, member?.id);
  try {
    requireLevel(full, category, level, action);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return { full, response: NextResponse.json(body, { status }) };
  }
  return { full };
}
