// lib/purchasing/receiving.js
//
// Taking delivery of a purchase order, in the shape deliveries actually arrive.
//
// ══ Partial is the normal case ═════════════════════════════════════════════
//
// The schema comment on PurchaseOrderLine.quantityReceived says it: received
// is a QUANTITY, not a boolean, because "half the order turned up and the rest
// is Thursday" is the ordinary Tuesday for a trade counter. A boolean forces
// whoever is holding the delivery note to choose between two lies — mark it
// received and lose the outstanding half, or leave it unreceived and lose the
// half that is on the van.
//
// So a receipt is a set of quantities, the PO status is DERIVED from what has
// arrived, and both halves of "12 of 40" survive.
//
// ══ Over-delivery is reported, not clamped ═════════════════════════════════
//
// A supplier sending 42 of 40 happens (a full box instead of a part box), and
// silently clamping it to 40 would make the stock movement disagree with the
// physical shelf — the exact drift StockMovement exists to prevent. So the
// extra is accepted into stock AND flagged, because somebody has to decide
// whether it gets paid for.
//
// Pure. The caller writes the rows; this decides what the rows should say.
import { toMilli, fromMilli, formatMilli } from "./quantity";

/** Statuses a PurchaseOrder may hold. Mirrors the schema comment. */
export const PO_STATUSES = ["draft", "sent", "partial", "received", "cancelled"];

/** What is still owed on one line, in thousandths. Never negative. */
export function outstandingMilli(line) {
  const ordered = toMilli(line?.quantity);
  const received = toMilli(line?.quantityReceived) ?? 0;
  if (ordered === null) return null;
  return Math.max(0, ordered - received);
}

/**
 * The status the order's lines add up to.
 *
 * DERIVED, never stored independently of the lines — the same reasoning as the
 * stock level. `current` is passed in because two statuses are decisions
 * rather than sums: a cancelled order stays cancelled however much of it
 * turned up, and an order nobody has sent yet stays a draft.
 */
export function derivedStatus(lines, current = "draft") {
  if (current === "cancelled") return "cancelled";

  const rows = Array.isArray(lines) ? lines : [];
  if (!rows.length) return current === "sent" ? "sent" : current;

  let anyReceived = false;
  let allReceived = true;
  for (const line of rows) {
    const ordered = toMilli(line?.quantity);
    const received = toMilli(line?.quantityReceived) ?? 0;
    if (received > 0) anyReceived = true;
    // An unreadable ordered quantity cannot be called complete. Treating it as
    // done would close an order on a line nobody can total.
    if (ordered === null || received < ordered) allReceived = false;
  }

  if (allReceived) return "received";
  if (anyReceived) return "partial";
  // Nothing has arrived: it is still whatever it was — a draft, or sent.
  return current === "draft" ? "draft" : "sent";
}

/**
 * Apply a delivery to a set of lines.
 *
 * @param lines     the PO's current lines: { id, description, quantity, quantityReceived }
 * @param received  { [lineId]: quantity } — what arrived THIS time, not the
 *                  running total. A delivery note lists what is in the van.
 * @param current   the order's stored status.
 *
 * @returns {{
 *   ok: boolean, error?: string,
 *   lines: Array<{ id, quantityReceived, appliedMilli, outstandingMilli, over: boolean }>,
 *   status: string,
 *   overDelivered: Array<{ id, description, byText }>,
 *   applied: number
 * }}
 */
export function applyDelivery({ lines, received, current = "sent" } = {}) {
  const rows = Array.isArray(lines) ? lines : [];
  const note = received && typeof received === "object" ? received : {};

  const out = [];
  const overDelivered = [];
  let applied = 0;

  for (const line of rows) {
    const already = toMilli(line?.quantityReceived) ?? 0;
    const ordered = toMilli(line?.quantity);

    // A line the delivery note does not mention is untouched. Absence on a
    // note means "not in this van", never "zero of these will ever arrive".
    if (!Object.hasOwn(note, line.id)) {
      out.push({
        id: line.id,
        quantityReceived: fromMilli(already),
        appliedMilli: 0,
        outstandingMilli: outstandingMilli(line),
        over: false,
      });
      continue;
    }

    const delta = toMilli(note[line.id]);
    if (delta === null) {
      return { ok: false, error: `Couldn't read the quantity received for "${line.description}".`, lines: [], status: current, overDelivered: [], applied: 0 };
    }
    if (delta < 0) {
      // A negative on a delivery note is a return, and a return is its own
      // movement against stock — not a quiet subtraction from what a supplier
      // is recorded as having delivered.
      return { ok: false, error: `A delivery can't be negative. Record a return against stock instead.`, lines: [], status: current, overDelivered: [], applied: 0 };
    }

    const total = already + delta;
    if (delta > 0) applied += 1;

    const over = ordered !== null && total > ordered;
    if (over) {
      overDelivered.push({
        id: line.id,
        description: line.description,
        byText: formatMilli(total - ordered),
      });
    }

    out.push({
      id: line.id,
      quantityReceived: fromMilli(total),
      appliedMilli: delta,
      outstandingMilli: ordered === null ? null : Math.max(0, ordered - total),
      over,
    });
  }

  return {
    ok: true,
    lines: out,
    status: derivedStatus(
      out.map((l, i) => ({ quantity: rows[i]?.quantity, quantityReceived: l.quantityReceived })),
      current,
    ),
    overDelivered,
    applied,
  };
}

/** A one-line human summary of where an order stands. */
export function progressSummary(lines) {
  const rows = Array.isArray(lines) ? lines : [];
  const done = rows.filter((l) => {
    const o = outstandingMilli(l);
    return o !== null && o === 0;
  }).length;
  return { lines: rows.length, complete: done, outstanding: rows.length - done };
}
