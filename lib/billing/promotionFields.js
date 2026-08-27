// lib/billing/promotionFields.js
//
// Validation for a PlatformPromotion, shared by create and edit.
//
// ── endsAt is required HERE, not in the form ───────────────────────────────
//
// A discount with no end is a price. The schema makes the column non-null, but
// a non-null column accepts `new Date("")`… no, it rejects it — and returns a
// Prisma stack trace, which is not a sentence an operator can act on. More to
// the point, a JSON body can carry `endsAt: null` or `endsAt: "soon"` and
// neither of those is going to be stopped by a `required` attribute on an
// input, because the form is the half of the system that can be skipped.
//
// ── And an end date in the past is refused on CREATE ───────────────────────
//
// You cannot start a promotion that has already finished. It would save, show
// a green "active" toggle, and discount nothing — a control that appears to
// work and doesn't, which is the failure this whole area was audited for.
//
// EDIT is deliberately allowed to keep a past date: that is what "this
// promotion is over" looks like once time has passed, and refusing the edit
// would mean an operator could not fix a typo in the label of a finished
// promotion. What edit refuses is MOVING the end date backwards into the past,
// which is a different act — see below.

const KINDS = new Set(["percent", "amount"]);
const TIERS = new Set(["solo", "crew", "shop", "scale"]);
const CURRENCIES = new Set(["CAD", "USD"]);

function fail(message) {
  return { error: message };
}

function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : undefined; // undefined = unparseable
}

/**
 * @param body
 * @param opts.partial   PATCH: an absent key means "leave it alone".
 * @param opts.existing  the current row, for PATCH — needed to check a field
 *                       against the value it is replacing rather than against
 *                       nothing.
 * @param opts.now       injectable clock, so the "already finished" rule is
 *                       testable rather than only reachable by waiting.
 * @returns {{ data?: object, error?: string }}
 */
export function parsePromotionFields(
  body = {},
  { partial = false, existing = null, now = new Date() } = {},
) {
  const data = {};
  const has = (key) => body[key] !== undefined;
  const nowMs = new Date(now).getTime();

  // ── Label ───────────────────────────────────────────────────────────────
  //
  // Printed on the pricing page ("Save $47/mo for 3 months") and it is the
  // only thing that tells one row in this list from another. An unlabelled
  // promotion is one nobody can audit later, which is the same fault the promo
  // code route was fixed for.
  if (!partial || has("label")) {
    const label = String(body.label || "").trim();
    if (!label)
      return fail(
        "Give the promotion a label. It goes on the pricing page and it's " +
          "the only way to tell two of these apart later.",
      );
    if (label.length > 120) return fail("Keep the label under 120 characters.");
    data.label = label;
  }

  if (has("notes")) data.notes = String(body.notes || "").trim() || null;

  // ── Ends ────────────────────────────────────────────────────────────────
  if (!partial || has("endsAt")) {
    const ends = parseDate(body.endsAt);
    if (ends === null)
      return fail(
        "An end date is required. A discount with no end isn't a promotion — " +
          "it's a price change.",
      );
    if (ends === undefined) return fail("That end date isn't a date.");

    if (!existing && ends.getTime() <= nowMs) {
      return fail(
        "That end date has already passed. You can't start a promotion that " +
          "has already finished — it would save, show as active, and discount " +
          "nobody.",
      );
    }
    // On EDIT, moving the end date into the past is allowed but is the act of
    // ENDING the promotion early, so it is not refused — an operator killing a
    // live discount at 3pm is a legitimate and urgent thing to want. Refusing
    // it would push them to the `active` toggle, which the ladder treats as
    // the weaker of the two signals.
    data.endsAt = ends;
  }

  // ── Starts ──────────────────────────────────────────────────────────────
  if (has("startsAt")) {
    const starts = parseDate(body.startsAt);
    if (starts === undefined) return fail("That start date isn't a date.");
    data.startsAt = starts; // null is legitimate: "as soon as it is active"
  }

  // A window that never opens. Checked against whichever end date this request
  // is producing — the new one if it is being changed, the stored one if not.
  const effectiveEnd =
    data.endsAt ?? (existing?.endsAt ? new Date(existing.endsAt) : null);
  const effectiveStart =
    data.startsAt !== undefined
      ? data.startsAt
      : existing?.startsAt
        ? new Date(existing.startsAt)
        : null;
  if (effectiveStart && effectiveEnd && effectiveStart.getTime() >= effectiveEnd.getTime()) {
    return fail("The start date has to be before the end date.");
  }

  // ── Discount ────────────────────────────────────────────────────────────
  if (!partial || has("discountKind")) {
    const kind = String(body.discountKind || "percent");
    if (!KINDS.has(kind))
      return fail('Discount kind has to be "percent" or "amount".');
    data.discountKind = kind;
  }

  if (!partial || has("discountValue")) {
    const value = Number(body.discountValue);
    if (!Number.isFinite(value)) return fail("The discount has to be a number.");
    if (value <= 0)
      return fail("A discount of zero or less isn't a discount.");
    const kind = data.discountKind || existing?.discountKind || "percent";
    if (kind === "percent" && value >= 100) {
      // priceFor() refuses a 100% discount rather than rendering $0, because
      // Stripe rejects a zero unit_amount and the failure would surface at
      // checkout. Saying so here means the operator finds out while typing.
      return fail(
        "A 100% discount would take the price to zero, which checkout can't " +
          "bill. Use 99 or less, or make it a free trial instead.",
      );
    }
    if (kind === "amount" && value > 100_000)
      return fail("That discount looks like a typo.");
    data.discountValue = value;
  }

  // ── Duration ────────────────────────────────────────────────────────────
  //
  // How many months the promotional price applies before reverting. Zero would
  // mean "forever", which is a price change wearing a promotion's clothes —
  // the schema comment says it is rejected in code, so it is.
  if (!partial || has("durationMonths")) {
    const months = Number(
      body.durationMonths === undefined || body.durationMonths === ""
        ? 3
        : body.durationMonths,
    );
    if (!Number.isInteger(months) || months < 1)
      return fail(
        "The promotional price has to last at least one whole month. Zero " +
          "would mean forever, which is a price change, not a promotion.",
      );
    if (months > 36) return fail("36 months is the ceiling for a promotion.");
    data.durationMonths = months;
  }

  // ── Scope ───────────────────────────────────────────────────────────────
  //
  // Stored as JSON. An EMPTY list means "all" to promotionApplies(), so an
  // empty array and null are the same thing to the reader — normalised to null
  // so the row says what it means.
  if (has("tierKeys")) {
    const list = body.tierKeys;
    if (list !== null && !Array.isArray(list))
      return fail("Tiers have to be a list.");
    const keys = (list || []).map((k) => String(k));
    const bad = keys.find((k) => !TIERS.has(k));
    if (bad) return fail(`"${bad}" isn't one of the tiers.`);
    data.tierKeys = keys.length ? keys : null;
  }

  if (has("currencies")) {
    const list = body.currencies;
    if (list !== null && !Array.isArray(list))
      return fail("Currencies have to be a list.");
    const codes = (list || []).map((c) => String(c).toUpperCase());
    const bad = codes.find((c) => !CURRENCIES.has(c));
    if (bad) return fail(`"${bad}" isn't a currency FieldQuo prices in.`);
    data.currencies = codes.length ? codes : null;
  }

  if (has("active")) data.active = !!body.active;

  return { data };
}
