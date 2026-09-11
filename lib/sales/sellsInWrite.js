// lib/sales/sellsInWrite.js
//
// The only place a rep writes their own "languages I can sell in".
//
// ══ Why its own file ══════════════════════════════════════════════════════
//
// The same shape as lib/sales/preferenceWrite.js and lib/sales/autodialWrite.js,
// and a SEPARATE file for the reason both give: scripts/check-sales-auth.mjs
// fences each writer by locating the first `salesRep.update(` in the file and
// asserting the keys of its data block. A second update in one of those files
// would sit past that index and be scanned by nothing. One writer per file is
// what keeps the fence honest.
//
// ══ Why this write is not the escalation REP_FORBIDDEN_WRITES exists for ══
//
// That list names the rep row for active, code, commission plan, acceptedAt —
// each a rep deciding something about what they are OWED or whether they are
// still employed. `sellsIn` decides which PROSPECTS the queue may hand them:
// a rep who adds French to their list starts receiving Quebec rows. That is
// a claim about themselves the owner wants them to make — "unless they have a
// French profile in their settings" — and the worst a false claim achieves is
// a francophone contractor answered in English, which the owner can see on
// the console and correct. Nothing about money, attribution or sign-in moves.
//
// The value is validated by lib/sales/leadLanguage.js's parseSellsIn() against
// the closed set in app/i18n/languages.js before it reaches this file.
//
// No audit row, for preferenceWrite.js's reason: a recordError per settings
// save would bury the payout redirects that log exists to make findable.
import { db } from "@/lib/db";

/**
 * The columns of SalesRep this file writes, and the only ones. Named as data
 * so scripts/check-sales-auth.mjs can assert the writer touches these and
 * nothing else.
 */
export const SELLS_IN_WRITES_ON_SALES_REP = ["sellsIn"];

/**
 * Save the languages a rep can sell in.
 *
 * @param salesRepId  from the gate's fresh read of the session. NEVER from a
 *                    request body.
 * @param sellsIn     a clean list of supported codes, possibly empty, already
 *                    validated by parseSellsIn(). An empty list is written
 *                    through: it is the rep un-ticking everything, and a writer
 *                    that treated [] as "no change" would ship a control that
 *                    appears to work and doesn't.
 */
export async function saveRepSellsIn({ salesRepId, sellsIn, client = db } = {}) {
  const id = typeof salesRepId === "string" ? salesRepId.trim() : "";
  if (!id) throw new Error("saveRepSellsIn: a salesRepId is required");
  if (!Array.isArray(sellsIn)) throw new Error("saveRepSellsIn: sellsIn must be a list");

  return client.salesRep.update({
    where: { id },
    // Exactly SELLS_IN_WRITES_ON_SALES_REP.
    data: { sellsIn },
    select: { id: true, sellsIn: true },
  });
}
