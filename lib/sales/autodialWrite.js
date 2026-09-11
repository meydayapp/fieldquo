// lib/sales/autodialWrite.js
//
// The only place a rep's own AUTODIAL SWITCH is written.
//
// ══ Why a file, rather than db.salesRep.update in the route ═══════════════
//
// `salesRep` is on REP_FORBIDDEN_WRITES (lib/sales/gate.js) and
// scripts/check-sales-auth.mjs enforces that against the real route files AND
// against the modules those routes import — one hop, so moving a forbidden
// write into lib/ to quiet the grep is caught rather than rewarded. The shape
// that rule accepts is the one lib/sales/preferenceWrite.js established: one
// function, its column named AS DATA, the key set asserted by the check.
//
// This is the third instance of that shape and a SEPARATE file from
// preferenceWrite.js, for the reason that file gives about payoutWrite.js: the
// check locates each writer's update by `indexOf("salesRep.update(")` — the
// first in the file — and asserts its data block. A second update in the same
// file would sit past that index and be scanned by nothing.
//
// ══ Why this write is not the escalation that list forbids ════════════════
//
// REP_FORBIDDEN_WRITES exists because a rep who can write their own row can
// reactivate themselves, rotate their code, or move onto a richer plan — a rep
// deciding something about what they are owed or whether they are employed.
//
// `autodial` decides whether, after the rep logs an outcome, their own screen
// counts down five seconds and presses the Call button for them. It cannot
// change what is owed, who a company is credited to, whether a batch pays, or
// whether the rep can sign in tomorrow. It authorises no call: every
// autodialled call still arrives at the dial branch of /api/sales/calls and
// is gated there — window, suppression list, do-not-contact, the 24-hour cap,
// our own numbers — exactly as a pressed one. A boolean, validated by the
// caller, so the worst a compromised session achieves is a countdown on a
// screen nobody is looking at, which dials nothing because CallPanel refuses
// a press while the browser has no microphone.
//
// No audit row, for the reason preferenceWrite.js gives: a recordError row per
// switch flip would bury the payout redirects that log exists to make findable.
import { db } from "@/lib/db";

/**
 * The columns of SalesRep this file writes, and the only ones. Named as data
 * so scripts/check-sales-auth.mjs can assert the writer touches these and
 * nothing else — the same shape as PREFERENCE_WRITES_ON_SALES_REP.
 */
export const AUTODIAL_WRITES_ON_SALES_REP = ["autodial"];

/**
 * Save the rep's autodial switch.
 *
 * @param salesRepId  from the gate's fresh read of the session. NEVER from a
 *                    request body.
 * @param on          a boolean. Anything else is refused here rather than
 *                    coerced — `"false"` is truthy, and a switch that turned
 *                    on because a client sent a string is a control that did
 *                    the opposite of what was pressed.
 *
 * @returns the updated row, selected narrowly.
 */
export async function saveRepAutodial({ salesRepId, on, client = db } = {}) {
  const id = typeof salesRepId === "string" ? salesRepId.trim() : "";
  if (!id) throw new Error("saveRepAutodial: a salesRepId is required");
  if (typeof on !== "boolean") throw new Error("saveRepAutodial: `on` must be a boolean");

  return client.salesRep.update({
    where: { id },
    // Exactly AUTODIAL_WRITES_ON_SALES_REP. Anything else here is the
    // escalation REP_FORBIDDEN_WRITES exists to prevent.
    data: { autodial: on },
    select: { id: true, autodial: true },
  });
}
