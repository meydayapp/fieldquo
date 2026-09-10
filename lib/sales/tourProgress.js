// lib/sales/tourProgress.js
//
// Where a rep got to in the portal tour. The read, and the only write.
//
// ══ Why this is NOT a column on SalesRep ══════════════════════════════════
//
// `salesRep` is on REP_FORBIDDEN_WRITES (lib/sales/gate.js), and there is a
// well-worn path for writing one anyway: name the columns as data, declare the
// file in scripts/check-sales-auth.mjs's LIB_FORBIDDEN_WRITE_BY_DESIGN, and
// add a fence asserting the update's key set. lib/sales/payoutWrite.js and
// lib/sales/preferenceWrite.js both do exactly that, and both are right to.
//
// This one deliberately does not. Each exemption on that list is a hole in the
// commission-and-attribution boundary that the next reader has to evaluate and
// the next check has to fence — preferenceWrite.js's own header records that
// it had to become a SEPARATE FILE because a second update in payoutWrite.js
// would have sat past the `indexOf("salesRep.update(")` the fence uses and been
// scanned by nothing. That is what a third exemption costs. A tour position is
// the least consequential fact in this product, and buying it with a fourth
// hole in the boundary that decides who gets paid is the wrong trade.
//
// So: its own table, `SalesRepTourProgress`, which is on no forbidden list.
// The check's lib scan walks past this file because there is nothing here to
// exempt — which is the point.
//
// ══ The rep id comes from the session, never from a body ══════════════════
//
// Same rule preferenceWrite.js states: a rep id a client could name is a
// client that can reach into a colleague's row. Nothing in this file accepts
// an id from anywhere but its caller, and the one caller reads it off the
// gate's fresh look at the session.
//
// ══ Nothing here deletes ══════════════════════════════════════════════════
//
// Dismissing sets `dismissedAt`; asking to see the tour again clears it back
// to null on the SAME row. There is no delete function and there must not be
// one — a row that vanishes takes `completedAt` with it, and "this rep read
// the whole thing in March" is a fact about a new hire worth keeping.
import { db } from "@/lib/db";
import { SALES_TOUR_LENGTH, clampTourStep } from "@/app/sales/tourSteps";

/**
 * The shape both verbs answer with, so the screen never has two readings.
 *
 * Modelled on app/api/sales/language/route.js's view(): the vocabulary the
 * client needs travels WITH the answer, so a panel cannot drift from the
 * validator that will judge what it sends back.
 *
 * `step` is run back through clampTourStep on the way out as well as in. A row
 * written when the tour was longer must not hand a browser an index the step
 * array cannot answer — see that function's own note.
 */
export function tourView(row) {
  return {
    step: clampTourStep(row?.step),
    dismissed: Boolean(row?.dismissedAt),
    completed: Boolean(row?.completedAt),
    total: SALES_TOUR_LENGTH,
  };
}

/**
 * What the tour looks like for this rep right now.
 *
 * A rep who has never opened it has no row, and that is not an error: the
 * absence IS the answer, and it means "step 0, not dismissed". Creating a row
 * on a READ would write to the database on every page load in the portal for
 * a rep who never touches the tour.
 */
export async function readTourProgress({ salesRepId, client = db } = {}) {
  const id = typeof salesRepId === "string" ? salesRepId.trim() : "";
  if (!id) throw new Error("readTourProgress: a salesRepId is required");

  const row = await client.salesRepTourProgress.findUnique({
    where: { salesRepId: id },
    select: { step: true, dismissedAt: true, completedAt: true },
  });
  return tourView(row);
}

/**
 * Move, dismiss, or un-dismiss.
 *
 * @param step        where the rep is now. Clamped, never trusted.
 * @param dismissed   true  → they asked it to stop
 *                    false → they asked to see it again
 *                    undefined → they are just moving; leave it alone.
 *
 * The three-way `dismissed` is the reason this takes an object rather than two
 * booleans. `false` and "not mentioned" are different requests — one is "show
 * it to me again", the other is "I pressed Next" — and collapsing them would
 * make every Next press silently un-dismiss a tour the rep had told to go
 * away, which is the same shape of bug as a save button that quietly discards
 * a field it was not given.
 *
 * `completedAt` is stamped the first time the last step is reached and never
 * cleared after that, including by a rep who replays the tour: they did read
 * it, and re-reading it does not make that less true.
 *
 * @param now injectable so the check can assert the stamps without a clock.
 */
export async function saveTourProgress({
  salesRepId,
  step,
  dismissed,
  client = db,
  now = new Date(),
} = {}) {
  const id = typeof salesRepId === "string" ? salesRepId.trim() : "";
  if (!id) throw new Error("saveTourProgress: a salesRepId is required");

  const at = clampTourStep(step);
  const reachedEnd = at === SALES_TOUR_LENGTH - 1;

  // Written out rather than built with spreads so the three cases are readable
  // side by side: undefined leaves the column alone, true stamps it, false
  // clears it.
  const dismissedAt =
    dismissed === undefined ? undefined : dismissed ? now : null;

  // ── The completion stamp, made first-time-only ─────────────────────────
  //
  // A conditional updateMany BEFORE the upsert, rather than a field inside
  // it. `completedAt: now` in the upsert's update block would move the stamp
  // every time a rep re-read the last step, so the column would answer "the
  // last time they replayed it" while its name and its schema comment both
  // say "the first time they finished". Two answers to one question.
  //
  // updateMany rather than update because the row may not exist yet — the
  // create branch below stamps that case — and updateMany on nothing is a
  // no-op rather than a throw. The `completedAt: null` in the WHERE is what
  // makes it first-time-only.
  if (reachedEnd) {
    await client.salesRepTourProgress.updateMany({
      where: { salesRepId: id, completedAt: null },
      data: { completedAt: now },
    });
  }

  const row = await client.salesRepTourProgress.upsert({
    where: { salesRepId: id },
    create: {
      salesRepId: id,
      step: at,
      dismissedAt: dismissed ? now : null,
      completedAt: reachedEnd ? now : null,
    },
    update: {
      step: at,
      ...(dismissedAt === undefined ? {} : { dismissedAt }),
    },
    select: { step: true, dismissedAt: true, completedAt: true },
  });
  return tourView(row);
}
