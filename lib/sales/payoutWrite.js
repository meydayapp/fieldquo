// lib/sales/payoutWrite.js
//
// The only place a rep's own payout DESTINATION is written.
//
// ══ Why this file exists rather than a db call in the route ═══════════════
//
// `salesRep` is on REP_FORBIDDEN_WRITES, and scripts/check-sales-auth.mjs
// enforces it against the real route files. When /api/sales/payout was built
// it wrote `db.salesRep.update` directly and turned that check red — correctly.
// The rule caught something real, and the answer is not to weaken the rule.
//
// ══ Why this write is not the escalation that list forbids ════════════════
//
// REP_FORBIDDEN_WRITES names the rep row because of four columns and says so:
// "active, code, commission plan, acceptedAt. Rotating your own code or
// reactivating yourself is the same escalation in a different shape." Every
// one of those is a rep DECIDING SOMETHING ABOUT WHAT THEY ARE OWED.
//
// A payout destination is a different shape. It cannot change what is owed, it
// cannot change who a company is credited to, and it pays nothing on its own —
// SalesPayoutBatch and SalesCommissionEntry stay untouchable, and a batch still
// has to be raised by somebody who is not this rep. What this changes is where
// money already decided goes.
//
// The precedent is `lastSeenAt` and this file follows it exactly: the columns
// are named AS DATA so a check can assert that this function touches those and
// nothing else, rather than trusting the paragraph above.
//
// ══ The part that is genuinely dangerous, and what is done about it ═══════
//
// Redirecting a payout is a real fraud shape: take a rep's session, change the
// destination, wait for a batch. Three things narrow it, and none of them is
// "trust the sentence above":
//
//   1. The column list is closed and asserted. No status, no plan, no code.
//   2. Every save stamps `payoutConfirmedAt` with the SERVER's clock, so the
//      screen can show how old the confirmation is — a destination confirmed
//      two years ago is not the same claim as one confirmed last week, and the
//      rep screen says so.
//   3. Every change is written to the audit log with the OLD and NEW handle,
//      so a redirect is visible after the fact even if nobody noticed it at
//      the time. A change nobody can reconstruct is the one that costs money.
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";

/**
 * The columns of SalesRep this file writes, and the only ones.
 *
 * Named as data so scripts/check-sales-auth.mjs can assert it touches these
 * and nothing else. Mirrors GATE_WRITES_ON_SALES_REP in lib/sales/gate.js.
 */
export const PAYOUT_WRITES_ON_SALES_REP = ["payoutMethod", "payoutHandle", "payoutConfirmedAt"];

/**
 * Save a rep's payout destination.
 *
 * @param salesRepId  from the gate's fresh read of the session. NEVER from a
 *                    request body — a rep id a client could name is a client
 *                    that can redirect a colleague's money.
 * @param method      already validated by the caller against PAYOUT_METHODS.
 * @param handle      already trimmed and length-checked by the caller.
 *
 * @returns the updated row, selected narrowly.
 */
export async function savePayoutDestination({ salesRepId, method, handle, client = db } = {}) {
  const id = typeof salesRepId === "string" ? salesRepId.trim() : "";
  if (!id) throw new Error("savePayoutDestination: a salesRepId is required");

  // Read the previous destination BEFORE the write, so the audit line can say
  // what it changed FROM. Reconstructing that afterwards is impossible.
  const before = await client.salesRep.findUnique({
    where: { id },
    select: { payoutMethod: true, payoutHandle: true },
  });

  const row = await client.salesRep.update({
    where: { id },
    // Exactly PAYOUT_WRITES_ON_SALES_REP. Anything else here is the escalation
    // REP_FORBIDDEN_WRITES exists to prevent.
    data: {
      payoutMethod: method,
      payoutHandle: handle,
      // The server's clock. What is being confirmed is that these details are
      // correct TODAY, so carrying an older stamp through an edit would date
      // the confirmation to before the thing it confirms.
      payoutConfirmedAt: new Date(),
    },
    select: {
      id: true,
      engagement: true,
      accruesPaidLeave: true,
      payoutMethod: true,
      payoutHandle: true,
      payoutConfirmedAt: true,
    },
  });

  const changed = before?.payoutMethod !== method || before?.payoutHandle !== handle;
  if (changed) {
    // Logged as an event, not an error — recordError is this codebase's one
    // durable, queryable trail and it carries an `area`. A redirect that
    // nobody can reconstruct afterwards is the one that costs money.
    await recordError({
      area: "sales_payout",
      code: "payout_destination_changed",
      message: `A rep changed where their commission is sent.`,
      detail: {
        salesRepId: id,
        from: { method: before?.payoutMethod || null, handle: mask(before?.payoutHandle) },
        to: { method, handle: mask(handle) },
      },
    }).catch(() => {});
  }

  return row;
}

/**
 * Enough of a destination to recognise, not enough to use.
 *
 * The audit line has to be readable by a human deciding whether a change was
 * legitimate, and an account number written in full into a log is a second
 * copy of the thing being protected.
 */
export function mask(handle) {
  const s = String(handle ?? "").trim();
  if (!s) return null;
  if (s.includes("@")) {
    const [local, domain] = s.split("@");
    return `${local.slice(0, 2)}…@${domain}`;
  }
  return s.length <= 4 ? "…" : `…${s.slice(-4)}`;
}
