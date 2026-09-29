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

import {
  SEAT_LADDER,
  SUPPORTED_CURRENCIES,
  CUSTOM_TIER_KEY,
  PROMOTION_APPLIES_TO,
  promotionIntervals,
} from "@/lib/pricing/ladder";

const KINDS = new Set(["percent", "amount"]);
// "custom" is the "Need more people?" plan — every custom size (custom-11 …
// custom-47) is one choice here, matched by promotionApplies in
// lib/pricing/ladder.js. The four rungs come from the ladder itself.
const TIERS = new Set([...SEAT_LADDER.map((t) => t.tierKey), CUSTOM_TIER_KEY]);
// Read from the ladder, not typed: the form offered an A$ AUD checkbox from
// SUPPORTED_CURRENCIES while this list still said CAD and USD, so ticking it
// was refused with "isn't a currency FieldQuo prices in" — about a currency
// FieldQuo has priced in since 2026-09-24.
const CURRENCIES = new Set(SUPPORTED_CURRENCIES);
const APPLIES_TO = new Set(PROMOTION_APPLIES_TO);

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
    // ── Exactly one standing offer has no end, and it is not this row ─────
    //
    // The owner (2026-09-28): the 1-year commitment's "pay 10 months, get
    // 12" is a STANDING promotion with no end date. It lives on the plan
    // rows (Plan.priceAnnual) and is edited in its own panel at the top of
    // /platform/billing/promotions — one per plan, by construction, never a
    // second row here. Every PlatformPromotion is a SALE, and a sale with no
    // end is still a price change.
    if (ends === null)
      return fail(
        "An end date is required. A discount with no end isn't a promotion — " +
          "it's a price change. The one standing offer, the 1-year commitment " +
          "offer, is set in its own panel at the top of this page.",
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

  // ── Which commitment ──────────────────────────────────────────────────
  //
  // "year" discounts the 1-year commitment against twelve months of the
  // monthly price and replaces the standing 1-year offer for the first year
  // (lib/pricing/planOffer.js); "month" is the monthly price for
  // durationMonths, which is what every promotion meant before this field
  // existed — so a create without it is "month", not a guess at "both".
  if (!partial || has("appliesTo")) {
    const appliesTo = String(body.appliesTo || "month");
    if (!APPLIES_TO.has(appliesTo))
      return fail('Applies to has to be "year" (1-year commitment), "month" (monthly) or "both".');
    data.appliesTo = appliesTo;
  }

  if (has("active")) data.active = !!body.active;

  return { data };
}

// ══ One sale at a time ═════════════════════════════════════════════════════
//
// The owner, 2026-09-29: one sale runs at a time. Two live sales on the same
// plan do not add up to a bigger discount — planOffer picks ONE, so the
// second is a row that says "active" and discounts nobody (the console's own
// dead-control failure), or silently displaces the one marketing is
// advertising. So a create, or an edit that switches a sale on or makes it
// cover more, is refused when its window overlaps another switched-on,
// not-yet-ended sale covering any of the same tier × commitment × currency
// cells.
//
// What is never refused: editing a sale in ways that cannot make it cover
// more — its label, notes, discount, ending it early, switching it off,
// narrowing it. Two sales that overlapped before this rule existed stay
// editable; only widening either of them is stopped.
//
// Pure, with an injectable clock, so check:promotions-live runs it against
// hostile rows rather than trusting a reading of it. The route reads the
// other rows fresh on every write; two admins saving overlapping sales in the
// same instant could both pass — acceptable for a console with a handful of
// operators, and the list shows both rows the moment either reloads.

const MINUTE = 60_000;
/** Minute-floored ms, or null. The console's datetime-local round trip drops seconds. */
function minuteOf(value) {
  if (value === null || value === undefined || value === "") return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? Math.floor(t / MINUTE) : null;
}

/** null/empty = every value; otherwise the listed ones. */
function scopeList(v) {
  return Array.isArray(v) && v.length ? v.map(String) : null;
}

/** Do two scope lists share at least one value? "All" shares with anything. */
function scopesMeet(a, b) {
  const x = scopeList(a);
  const y = scopeList(b);
  if (!x || !y) return true;
  return x.some((v) => y.includes(v));
}

/** Is `next` inside `prev`? "All" contains everything; only "all" contains "all". */
function scopeWithin(next, prev) {
  const n = scopeList(next);
  const p = scopeList(prev);
  if (!p) return true;
  if (!n) return false;
  return n.every((v) => p.includes(v));
}

/**
 * The window a sale can discount in, in minutes: [start, end). A null start
 * is "as soon as it is switched on" — open to the past, which is right for
 * overlap because both sides are only compared while not yet ended.
 */
function windowOf(promo) {
  const start = minuteOf(promo?.startsAt);
  return { start: start ?? -Infinity, end: minuteOf(promo?.endsAt) };
}

/** Running or scheduled at `now`? Switched off, ended, or with no end = no. */
function liveOrScheduled(promo, now) {
  if (!promo || promo.active !== true) return false;
  const end = minuteOf(promo.endsAt);
  const at = minuteOf(now);
  if (end === null || at === null) return false; // no end is not a sale — promotionIsLive agrees
  return end > at;
}

/**
 * The other sale `candidate` would collide with, or null.
 *
 * @param candidate the row AS IT WOULD BE after this write (existing + edits).
 * @param others    rows from the database; the candidate's own id is skipped,
 *                  so the whole list can be passed.
 * @returns the colliding row that ends first — the one the operator is
 *          likeliest to wait out.
 */
export function promotionConflict(candidate, others = [], { now = new Date() } = {}) {
  if (!liveOrScheduled(candidate, now)) return null;
  const a = windowOf(candidate);
  const aIntervals = promotionIntervals(candidate);
  const hits = (Array.isArray(others) ? others : []).filter((other) => {
    if (!other || (candidate.id && other.id === candidate.id)) return false;
    if (!liveOrScheduled(other, now)) return false;
    const b = windowOf(other);
    // Half-open: a sale ending at 00:00 Nov 1 and one starting at 00:00 Nov 1
    // touch without overlapping — "pick dates after it" has to be possible.
    if (!(a.start < b.end && b.start < a.end)) return false;
    if (!promotionIntervals(other).some((i) => aIntervals.includes(i))) return false;
    return scopesMeet(candidate.tierKeys, other.tierKeys) && scopesMeet(candidate.currencies, other.currencies);
  });
  hits.sort((x, y) => minuteOf(x.endsAt) - minuteOf(y.endsAt));
  return hits[0] || null;
}

/**
 * Does this edit make the sale cover MORE than it did — switched on, ended
 * later, started earlier, or scoped to more tiers, currencies or commitments?
 * Only such an edit is checked for a collision (see the section header).
 * Compared by value, not by key: the console's edit form sends every field,
 * and an unchanged end date is not an extension.
 */
export function promotionWidens(existing, data = {}) {
  if (!existing) return true; // a create
  const has = (k) => data[k] !== undefined;
  if (has("active") && data.active === true && existing.active !== true) return true;
  if (has("endsAt")) {
    const next = minuteOf(data.endsAt);
    const prev = minuteOf(existing.endsAt);
    if (next !== null && (prev === null || next > prev)) return true;
  }
  if (has("startsAt")) {
    const next = minuteOf(data.startsAt);
    const prev = minuteOf(existing.startsAt);
    if (prev !== null && (next === null || next < prev)) return true;
  }
  if (has("tierKeys") && !scopeWithin(data.tierKeys, existing.tierKeys)) return true;
  if (has("currencies") && !scopeWithin(data.currencies, existing.currencies)) return true;
  if (has("appliesTo")) {
    const before = promotionIntervals(existing);
    if (!promotionIntervals({ appliesTo: data.appliesTo }).every((i) => before.includes(i))) return true;
  }
  return false;
}

/** The zone the operator's browser named, if Intl knows it; else Toronto, where FieldQuo is run. */
export function promotionTimeZone(value) {
  const tz = typeof value === "string" ? value.trim() : "";
  if (tz) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    } catch {
      /* an unknown zone falls through to the default */
    }
  }
  return "America/Toronto";
}

/**
 * 'The "Fall Sale 40%" runs until Oct 31 on 1-year plans — end it or pick
 * dates after it.' Names the other sale, its dates and the commitments the
 * two share. The last day shown is the day of the final instant (end − 1ms),
 * the rule the pricing card's "Offer ends" uses, so a sale ending at
 * midnight reads as running until the day before.
 */
export function promotionConflictMessage(other, candidate = null, { now = new Date(), timeZone } = {}) {
  const tz = promotionTimeZone(timeZone);
  const yearOf = (d) => d.toLocaleDateString("en-US", { year: "numeric", timeZone: tz });
  const nowYear = yearOf(new Date(now));
  const day = (ms) => {
    const d = new Date(ms);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(yearOf(d) !== nowYear ? { year: "numeric" } : {}),
      timeZone: tz,
    });
  };
  const endMs = new Date(other.endsAt).getTime() - 1;
  const startMs = other.startsAt ? new Date(other.startsAt).getTime() : NaN;
  const when =
    Number.isFinite(startMs) && startMs > new Date(now).getTime()
      ? `runs from ${day(startMs)} until ${day(endMs)}`
      : `runs until ${day(endMs)}`;
  const shared = promotionIntervals(other).filter((i) => !candidate || promotionIntervals(candidate).includes(i));
  const plans =
    shared.length === 2 ? "monthly and 1-year plans" : shared[0] === "year" ? "1-year plans" : "monthly plans";
  const label = String(other.label || "other sale").trim();
  return `The "${label}" ${when} on ${plans} — end it or pick dates after it.`;
}
