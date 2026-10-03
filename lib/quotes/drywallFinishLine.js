// lib/quotes/drywallFinishLine.js
//
// A drywall group's finish level → the one finishing line it bills.
//
// ── The pattern this follows ────────────────────────────────────────────────
//
// lib/quotes/lawnLines.js: the lines a picker writes carry a `meta` marker, the
// picker replaces its own lines when the estimator changes their mind, and a
// line it did not write is never touched. Here the "picker" is the Finish
// Level select in the intake, and the marker is `meta.drywallFinish`.
//
// One addition the lawn picker does not need: a finishing line is a natural
// thing to retype (a contractor who charges $1.60 on this job, not $1.45), and
// a level change must not throw that edit away. So the marker records what was
// WRITTEN — description, quantity, rate, amount — and a line whose fields no
// longer match it is the contractor's, not ours. It stays, and no second
// finishing line is added beside it: two finishing lines bill the same walls
// twice. The builder says so under the select (`held`).
//
// ── Where the rate comes from ───────────────────────────────────────────────
//
// The trade's price book, through getPriceBook(categoryKey, the company's
// rateOverrides) — the same merged book every takeoff line is priced from, so
// a company's own Level 5 rate is the rate. Row `finish_l1` … `finish_l5`,
// priced off the `standard` tier's `finishLevelNPricePerSqft` exactly as
// tradeScope.js prices a book row: `priceType` into the complexity grid.
// Level 0 is hung board — the hang row with no finish row — so it has no line.
//
// On 2026-10-03 NO drywall price book is live: drywall_install's book is staged
// in app/data/priceBooks/interior.js and merging it is the owner's call (that
// file's header). Until it is merged getPriceBook returns null, no line is
// written, and the builder says the level will print but no rate is set
// (`unpriced`) — never a $0 line wearing the look of a price. The moment a book
// with these rows exists, the select prices with no further change here.
//
// The drywall trades have no tier control on the builder, so the tier is
// `standard`; a caller that grows one passes it.
//
// ── Money and the browser ───────────────────────────────────────────────────
//
// This runs in the STAFF builder. The public self-quote form sends a level
// string and nothing else, produces a lead rather than a quote, and no route
// prices from it (AGENTS.md non-negotiables 4 and 5).
//
// Pure — scripts/check-drywall-finish-levels.mjs executes it.

import { normaliseFinishLevel, FINISH_LEVEL_TRADES } from "@/app/data/drywallFinishLevels";
import { drywallFinishText } from "@/lib/documents/serviceContent";

/** The price-book row each level bills. Level 0 has none. */
export const FINISH_LINE_IDS = Object.freeze({
  level_1: "finish_l1",
  level_2: "finish_l2",
  level_3: "finish_l3",
  level_4: "finish_l4",
  level_5: "finish_l5",
});

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;

/**
 * The company's rate for a level, from a merged price book — or null when the
 * book is absent, has no row for the level, or prices it at nothing.
 */
export function finishLevelRate(book, level, tier = "standard") {
  const id = Object.prototype.hasOwnProperty.call(FINISH_LINE_IDS, level) ? FINISH_LINE_IDS[level] : null;
  if (!id || !book || typeof book !== "object") return null;
  const item = (Array.isArray(book.items) ? book.items : []).find((i) => i && i.id === id);
  if (!item) return null;
  const grid = book.complexity?.[tier] || book.complexity?.standard || {};
  const rate = item.priceType === "flat" ? num(item.flatPrice) : num(grid[item.priceType]);
  return rate > 0 ? round2(rate) : null;
}

/**
 * The line a level bills, or null (Level 0, no level, or no rate).
 *
 * @param opts.quantity  square feet of board; a blank or junk figure is 0 —
 *                       the line then shows its rate at quantity 0 and $0,
 *                       and fills when the square footage is typed.
 * @param opts.language  the DOCUMENT's language (Quote.language): the words
 *                       are copied onto the line once, never re-translated.
 */
export function finishLevelLine({ level, book, quantity = 0, language = "en", tier = "standard" } = {}) {
  const lvl = normaliseFinishLevel(level);
  if (!lvl) return null;
  const rate = finishLevelRate(book, lvl, tier);
  if (rate === null) return null;
  const words = drywallFinishText(lvl, language);
  if (!words) return null;
  const qty = Math.max(0, round2(quantity));
  const description = `${words.lineTitle} — ${words.name}`;
  const amount = round2(qty * rate);
  return {
    description,
    quantity: qty,
    unit: "sqft",
    rate,
    amount,
    detail: words.description,
    // Staff-side. `meta` reaches no client-facing renderer (the PDF, the page
    // and the email read description, detail, quantity and amount).
    meta: {
      drywallFinish: {
        level: lvl,
        itemId: FINISH_LINE_IDS[lvl],
        written: { description, quantity: qty, rate, amount },
      },
    },
  };
}

/** A line this module wrote, whether or not it has been edited since. */
export function isFinishLine(line) {
  return Boolean(line && typeof line === "object" && line.meta && line.meta.drywallFinish);
}

/**
 * A line this module wrote and nobody has changed: every field it wrote still
 * reads what it wrote. Anything else — a retyped rate, a reworded description,
 * a marker with no record — is the contractor's line.
 */
export function isUntouchedFinishLine(line) {
  if (!isFinishLine(line)) return false;
  const w = line.meta.drywallFinish.written;
  if (!w || typeof w !== "object") return false;
  return (
    line.description === w.description &&
    num(line.quantity) === num(w.quantity) &&
    num(line.rate) === num(w.rate) &&
    num(line.amount) === num(w.amount)
  );
}

/**
 * A group's lines after its finish level (or square footage) changed.
 *
 * Replaces this module's own untouched line in place — same position, so the
 * line the estimator was looking at does not jump — or appends the first one.
 * A line the contractor edited is never removed or rewritten, and while one
 * exists no new line is added (`held`).
 *
 * @returns { lineItems, line, held, unpriced }
 *   line      the finishing line now on the group, or null
 *   held      true when an edited finishing line was kept and no new one added
 *   unpriced  true when a level that bills a line (1–5) has no rate in `book`
 */
export function syncFinishLine(group, { book = null, language = "en", tier = "standard" } = {}) {
  const lines = Array.isArray(group?.lineItems) ? group.lineItems : [];
  const same = { lineItems: lines, line: null, held: false, unpriced: false };
  if (!group || group.persisted || !FINISH_LEVEL_TRADES.includes(group.categoryKey)) return same;

  const level = normaliseFinishLevel(group.intakeValues?.finishLevel);
  const edited = lines.filter((l) => isFinishLine(l) && !isUntouchedFinishLine(l));
  const unpriced = Boolean(level && level !== "level_0" && finishLevelRate(book, level, tier) === null);

  if (edited.length) {
    // The contractor's line stands. Drop only an untouched twin of ours, if
    // one is somehow beside it, so the walls are billed once.
    return {
      lineItems: lines.filter((l) => !isUntouchedFinishLine(l)),
      line: null,
      held: true,
      unpriced,
    };
  }

  const next = finishLevelLine({
    level,
    book,
    quantity: group.intakeValues?.squareFootage,
    language,
    tier,
  });
  const at = lines.findIndex((l) => isUntouchedFinishLine(l));
  const kept = lines.filter((l) => !isUntouchedFinishLine(l));
  if (!next) return { lineItems: kept, line: null, held: false, unpriced };
  if (at < 0) return { lineItems: [...kept, next], line: next, held: false, unpriced };
  const out = kept.slice();
  out.splice(at, 0, next);
  return { lineItems: out, line: next, held: false, unpriced };
}
