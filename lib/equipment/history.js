// lib/equipment/history.js
//
// The service history behind a warranty — every visit to one piece of a
// customer's equipment, and what the visits add up to.
//
// ══ Why `underWarranty` is the column that matters ═════════════════════════
//
// A service history is only worth storing if it can answer the question the
// warranty exists to raise: was this visit COVERED, or was it BILLED? That one
// boolean is what makes "we've been out three times, twice on us" a sentence a
// contractor can say on the phone — and it is the evidence a manufacturer asks
// for when a claim is made.
//
// It is a plain `Boolean @default(false)` on `ClientEquipmentService`, so
// false means "billed", not "we don't know". That is a deliberate difference
// from `warrantyEndsAt`, which is nullable precisely because a blank there is
// an absence rather than a statement — and the UI has to match: the form asks
// the question with a checkbox that is off by default and labelled "covered by
// warranty", so leaving it alone is a real answer, not a skipped one.
import { toDate } from "@/lib/expiry/window";

/**
 * What a piece of equipment's visits add up to.
 *
 * Null-safe throughout: a row loaded without its `services` include, an empty
 * array and a list with junk in it all produce a zeroed summary rather than a
 * throw, because this runs inside a list render where one bad row must not
 * take the page down.
 *
 * `lastServicedAt` is null — not "never" and not the epoch — when there is
 * nothing to report. A screen that prints "never serviced" for a row whose
 * history simply wasn't loaded is stating a fact it does not have.
 */
export function summariseServices(services) {
  const rows = (Array.isArray(services) ? services : []).filter(Boolean);

  let underWarranty = 0;
  let billed = 0;
  let last = null;

  for (const row of rows) {
    if (row.underWarranty === true) underWarranty += 1;
    else billed += 1;

    const when = toDate(row.servicedAt);
    // A visit with no usable date still COUNTS — it happened — but it cannot
    // claim to be the most recent one. Dropping the row entirely would make
    // the count disagree with the list rendered beside it.
    if (when && (!last || when > last)) last = when;
  }

  return {
    count: rows.length,
    underWarranty,
    billed,
    lastServicedAt: last,
  };
}

/**
 * Newest visit first.
 *
 * Undated visits sink to the bottom rather than being treated as very old or
 * very new — the same "an absence is not a value" rule the warranty dates take.
 */
export function sortServices(services) {
  return (Array.isArray(services) ? services : [])
    .filter(Boolean)
    .map((row, i) => ({ row, i, when: toDate(row.servicedAt) }))
    .sort((a, b) => {
      if (a.when && b.when && a.when.getTime() !== b.when.getTime()) return b.when - a.when;
      if (a.when && !b.when) return -1;
      if (!a.when && b.when) return 1;
      return a.i - b.i;
    })
    .map(({ row }) => row);
}
