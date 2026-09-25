// lib/sales/workNameWrite.js
//
// The only place a rep writes their own work name — the name prospects,
// signups and customer companies see (lib/sales/repIdentity.js).
//
// ══ Why its own file ══════════════════════════════════════════════════════
//
// The shape of lib/sales/sellsInWrite.js and preferenceWrite.js, and a
// SEPARATE file for their reason: scripts/check-sales-auth.mjs fences each
// writer by locating the first `salesRep.update(` in the file and asserting
// the keys of its data block. One writer per file keeps that fence honest.
//
// ══ Why this write is not the escalation REP_FORBIDDEN_WRITES exists for ══
//
// That list guards what a rep is OWED and whether they still work here. A
// work name changes what a prospect reads in a signature. It cannot move an
// attribution (links carry the opaque referralToken, which this never
// touches), cannot change a commission, and cannot hide the rep from the
// owner: /platform and every money record keep showing the REAL name beside
// it (repStaffLabel). The owner asked for reps to be able to set it
// themselves, 2026-09-22.
//
// The value is validated by validateWorkName() before it reaches this file,
// and again on every read by repPublicName().
import { db } from "@/lib/db";

/** The columns of SalesRep this file writes, and the only ones. */
export const WORK_NAME_WRITES_ON_SALES_REP = ["workName"];

/**
 * Save (or clear, with null) a rep's work name.
 *
 * @param salesRepId  from the gate's fresh read of the session. NEVER from a
 *                    request body.
 * @param workName    the cleaned value from validateWorkName(), or null to
 *                    fall back to the first name. Null is written through —
 *                    "clear it" is a real answer, not "no change".
 */
export async function saveRepWorkName({ salesRepId, workName, client = db } = {}) {
  const id = typeof salesRepId === "string" ? salesRepId.trim() : "";
  if (!id) throw new Error("saveRepWorkName: a salesRepId is required");
  if (workName !== null && typeof workName !== "string") throw new Error("saveRepWorkName: workName must be a string or null");

  return client.salesRep.update({
    where: { id },
    // Exactly WORK_NAME_WRITES_ON_SALES_REP.
    data: { workName },
    select: { id: true, name: true, workName: true },
  });
}
