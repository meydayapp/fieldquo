// lib/staff/viewer.js
//
// Who is asking, when either kind of FieldQuo staff may be.
//
// ══ Why one resolver and not two routes ═══════════════════════════════════
//
// The staff chat is ONE set of conversations. A rep in /sales and a platform
// admin in /platform are in the same rooms saying things to each other, so a
// pair of parallel APIs — one per portal — would be two implementations of one
// feature, and the copy nobody looks at is the one that rots. There is one API
// and this decides which of the two credentials presented it.
//
// ══ The order matters, and it is platform first ═══════════════════════════
//
// Both tokens are signed with the same secret (see currentPlatformAdmin's
// header for why one secret beats a second env var that can be unset), and the
// two are separated by a scope claim that each side refuses in its own
// direction. getCurrentPlatformAdmin already refuses anything carrying a
// scope, so it cannot mistake a rep for an admin — asking it first is safe and
// means an admin never pays for a rep lookup.
//
// Neither credential is trusted for anything but identity here: what a viewer
// can SEE is decided by their membership rows, not by their role.
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { getCurrentSalesRep } from "@/lib/sales/auth";

/**
 * @returns {{ viewer: {kind,id,name,email}|null, refusal: {status,body}|null }}
 */
export async function resolveStaffViewer(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (admin?.id) {
    const row = await db.platformAdmin.findUnique({
      where: { id: admin.id },
      select: { id: true, email: true, active: true },
    });
    // An admin whose account was switched off keeps a valid token until it
    // expires. The row is the authority, not the token.
    if (row?.active) {
      return {
        viewer: { kind: "user", id: row.id, name: row.email, email: row.email },
        refusal: null,
      };
    }
  }

  const claims = await getCurrentSalesRep(request);
  if (claims?.salesRepId) {
    const rep = await db.salesRep.findUnique({
      where: { id: claims.salesRepId },
      select: { id: true, name: true, email: true, active: true, endedAt: true },
    });
    if (rep?.active && !rep.endedAt) {
      return {
        viewer: { kind: "rep", id: rep.id, name: rep.name || rep.email, email: rep.email },
        refusal: null,
      };
    }
  }

  return {
    viewer: null,
    refusal: { status: 401, body: { error: "Sign in to FieldQuo to use the team chat." } },
  };
}

/** The membership `where` fragment for one viewer. One place, so no route spells it. */
export function memberWhere(viewer) {
  return viewer?.kind === "user"
    ? { platformAdminId: viewer.id }
    : { salesRepId: viewer.id };
}

/** The author columns for one viewer, for a write. */
export function authorData(viewer) {
  return viewer?.kind === "user"
    ? { authorPlatformAdminId: viewer.id }
    : { authorSalesRepId: viewer.id };
}
