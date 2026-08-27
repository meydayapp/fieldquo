// lib/billing/planFields.js
//
// Validation for the Plan editor, shared by POST (create) and PATCH (edit).
//
// ── Why one module ─────────────────────────────────────────────────────────
//
// POST already refused a negative price, a non-numeric price and a fractional
// seat count, and it does so because QA typed -5 into the field and the plan
// went live on the public pricing page at "$-5 CAD /month" — in the FIRST
// card, because plans sorted by price ascending.
//
// PATCH had none of those checks. So the same -5 was reachable by creating a
// sane plan and then editing it, which is one extra click. Copying the four
// guards across would have produced the fifth copy of a rule that has already
// drifted once in this file's history, so they live here and both routes call
// the same function.
//
// The form's own min="0" is not a check: the pages do not use native
// validation, so the browser never enforces it.

/** Fields the editor may write, in the shape Prisma wants. */
const MONEY_CEILING = 100_000;

function fail(message) {
  return { error: message };
}

/**
 * Reads the editor's body into a Prisma `data` object.
 *
 * @param body   the parsed request body
 * @param opts.partial  true for PATCH — an absent key means "leave it alone",
 *                      rather than "set it to nothing". The distinction is the
 *                      whole difference between editing one field and wiping
 *                      the other eleven.
 * @returns {{ data?: object, error?: string }}
 */
export function parsePlanFields(body = {}, { partial = false } = {}) {
  const data = {};
  const has = (key) => body[key] !== undefined;
  const blank = (v) => v === null || v === "" || v === undefined;

  // ── Name ────────────────────────────────────────────────────────────────
  if (!partial || has("name")) {
    const name = String(body.name || "").trim();
    if (!name) return fail("Give the plan a name.");
    data.name = name;
  }

  // ── Monthly price ───────────────────────────────────────────────────────
  if (!partial || has("priceMonthly")) {
    const price = Number(body.priceMonthly);
    if (!Number.isFinite(price))
      return fail("The monthly price has to be a number.");
    if (price < 0) return fail("A plan can't have a negative price.");
    // Sanity ceiling. Not a business rule — a guard against a misplaced decimal
    // reaching the pricing page before anyone notices.
    if (price > MONEY_CEILING)
      return fail(
        "That price looks like a typo. If it's deliberate, raise it in the " +
          "database rather than here.",
      );
    data.priceMonthly = price;
  }

  // ── Annual price ────────────────────────────────────────────────────────
  //
  // Nullable, and null MEANS something: this tier has no annual option. Blank
  // is therefore stored as null rather than as 0, because a $0/year plan and a
  // plan you cannot buy annually are different products and only one of them
  // is a mistake.
  if (has("priceAnnual")) {
    if (blank(body.priceAnnual)) {
      data.priceAnnual = null;
    } else {
      const annual = Number(body.priceAnnual);
      if (!Number.isFinite(annual))
        return fail("The annual price has to be a number, or blank for none.");
      if (annual < 0) return fail("A plan can't have a negative annual price.");
      if (annual > MONEY_CEILING * 12)
        return fail(
          "That annual price looks like a typo. If it's deliberate, raise it " +
            "in the database rather than here.",
        );
      data.priceAnnual = annual;
    }
  }

  // ── Seats and crew ──────────────────────────────────────────────────────
  //
  // Both required-and-non-null in the schema, so unlike maxUsers there is no
  // "blank = unlimited" here. A seat is somebody who can originate money; crew
  // are free. Zero seats is refused — a plan nobody can write a quote on is a
  // plan that cannot be used, and it would let every member of that company
  // count as free crew.
  if (has("seats")) {
    const seats = Number(body.seats);
    if (!Number.isInteger(seats) || seats < 1)
      return fail("Seats must be a whole number of 1 or more.");
    if (seats > 1000) return fail("That seat count looks like a typo.");
    data.seats = seats;
  }

  if (has("crewSeats")) {
    const crew = Number(body.crewSeats);
    if (!Number.isInteger(crew) || crew < 0)
      return fail("Crew must be a whole number of 0 or more.");
    if (crew > 10_000) return fail("That crew count looks like a typo.");
    data.crewSeats = crew;
  }

  // ── maxUsers ────────────────────────────────────────────────────────────
  //
  // The old PEOPLE count. Still written and still read by the company-facing
  // plan picker, so it stays editable until every reader has moved to
  // seats/crewSeats. Blank genuinely is unlimited here, which is why the
  // message says to mean it.
  if (has("maxUsers")) {
    if (blank(body.maxUsers)) {
      data.maxUsers = null;
    } else {
      const seats = Number(body.maxUsers);
      if (!Number.isInteger(seats) || seats < 1)
        return fail(
          "Seats must be a whole number of 1 or more. Leave it blank for " +
            "unlimited — but do that on purpose.",
        );
      data.maxUsers = seats;
    }
  }

  if (has("maxQuotesPerMonth")) {
    if (blank(body.maxQuotesPerMonth)) {
      data.maxQuotesPerMonth = null;
    } else {
      const quotes = Number(body.maxQuotesPerMonth);
      if (!Number.isInteger(quotes) || quotes < 1)
        return fail(
          "Quotes per month must be a whole number of 1 or more, or blank " +
            "for unlimited.",
        );
      data.maxQuotesPerMonth = quotes;
    }
  }

  if (has("stripePriceId"))
    data.stripePriceId = String(body.stripePriceId || "").trim() || null;
  if (has("stripePriceIdAnnual"))
    data.stripePriceIdAnnual =
      String(body.stripePriceIdAnnual || "").trim() || null;

  if (has("sortOrder")) {
    const order = Number(body.sortOrder);
    if (!Number.isInteger(order)) return fail("Sort order has to be a whole number.");
    data.sortOrder = order;
  }

  if (has("aiCopilotEnabled")) data.aiCopilotEnabled = !!body.aiCopilotEnabled;
  if (has("isPublic")) data.isPublic = !!body.isPublic;
  if (has("features")) data.features = body.features ?? null;

  // tierKey and currency are deliberately NOT editable through this parser.
  // They are the row's identity — (tierKey, currency) is the unique key the
  // seeder and every ladder reader find a row by — and letting an operator
  // retype "solo" as "Solo" in a text box would orphan the row from the code
  // that looks for it, with nothing on screen to say so.

  return { data };
}
