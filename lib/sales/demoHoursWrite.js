// lib/sales/demoHoursWrite.js
//
// The only place a rep's demo-page hours and zone are written.
//
// Same shape as lib/sales/sellsInWrite.js, its own file for the reason
// lib/sales/preferenceWrite.js gives: `salesRep` is on REP_FORBIDDEN_WRITES
// (lib/sales/gate.js), scripts/check-sales-auth.mjs locates each fenced
// writer's update by `indexOf("salesRep.update(")`, and a second update in
// one file sits past that index where nothing scans it. The columns are
// named as data so the check can assert the data block sets these and
// nothing else.
//
// Why this is not the escalation the list forbids: `demoHours` and
// `timeZone` decide when a prospect may book fifteen minutes of the rep's
// day on app/demo/[repCode]. They cannot change what is owed, who a company
// is credited to, whether a batch pays, or whether the rep can sign in
// tomorrow. The values are validated by lib/sales/demoBooking/slots.js's
// parseDemoHours() and usableTimeZone() before this is called; the worst a
// compromised session achieves is a calendar nobody can book.
import { db } from "@/lib/db";

/** The columns of SalesRep this file writes, and the only ones. */
export const DEMO_HOURS_WRITES_ON_SALES_REP = ["timeZone", "demoHours"];

/**
 * Save a rep's demo hours and zone.
 *
 * @param salesRepId  from the gate's fresh read of the session, never a body.
 * @param timeZone    an IANA zone the caller validated, or null to clear.
 * @param demoHours   the list parseDemoHours() returned, or null to return to
 *                    the stated default.
 */
export async function saveRepDemoHours({ salesRepId, timeZone, demoHours, client = db } = {}) {
  const id = typeof salesRepId === "string" ? salesRepId.trim() : "";
  if (!id) throw new Error("saveRepDemoHours: a salesRepId is required");
  if (timeZone !== null && typeof timeZone !== "string") throw new Error("saveRepDemoHours: timeZone must be a string or null");
  if (demoHours !== null && !Array.isArray(demoHours)) throw new Error("saveRepDemoHours: demoHours must be a list or null");
  return client.salesRep.update({
    where: { id },
    // Exactly DEMO_HOURS_WRITES_ON_SALES_REP.
    data: { timeZone, demoHours },
    select: { id: true, timeZone: true, demoHours: true },
  });
}
