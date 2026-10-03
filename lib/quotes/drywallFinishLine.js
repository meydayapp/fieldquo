// lib/quotes/drywallFinishLine.js
//
// A drywall group's intake → the lines its price book bills: the board HUNG
// (per square foot) and the chosen finish level's FINISHING (per square foot).
//
// ── The pattern this follows ────────────────────────────────────────────────
//
// lib/quotes/lawnLines.js: the lines a picker writes carry a `meta` marker, the
// picker replaces its own lines when the estimator changes their mind, and a
// line it did not write is never touched. Here the "picker" is the intake
// (Square Footage, Finish Level, Complexity), and the marker is
// `meta.drywallFinish` with a `part` — "hang" or "finish".
//
// One addition the lawn picker does not need: these lines are natural to
// retype (a contractor who charges $1.60 on this job, not $1.45), and a level
// change must not throw that edit away. So the marker records what was
// WRITTEN — description, quantity, rate, amount — and a line whose fields no
// longer match it is the contractor's, not ours. It stays, and no second line
// of that part is added beside it: two finishing lines bill the same walls
// twice. The builder says so under the select (`held`).
//
// ── Where the rates come from ───────────────────────────────────────────────
//
// The trade's price book through getPriceBook(categoryKey, the company's
// rateOverrides) — the same merged book every takeoff line is priced from.
// drywall_install's book went live on 2026-10-03 (app/data/tradePriceBooks.js):
// row `hang` and rows `finish_l1` … `finish_l5`, priced off the chosen tier's
// `hangPricePerSqft` / `finishLevelNPricePerSqft` exactly as tradeScope.js
// prices a book row (`priceType` into the complexity grid). Level 0 is hung
// board — the hang row with no finish row. A trade with no book (`drywall`,
// the repair quote type) gets no lines and the builder says why.
//
// ── Square feet ─────────────────────────────────────────────────────────────
//
// The intake's Square Footage when it is typed; otherwise the board area the
// group's own room measure produced (lib/measure/reuseTakeoffs.js, areaSqFt —
// walls net of openings plus ceiling). Typed wins, because a number paced on
// site overrules one drawn on a screen, the same rule the lot tracer follows.
// Neither: the lines open at 0 sq ft and $0, never an invented area.
//
// ── Who adds, who only updates (`mode`) ─────────────────────────────────────
//
//   create  a new group: write both parts
//   level   the finish level changed: write the finishing part if missing;
//           the hang part is only updated (a hang line the estimator deleted
//           is not brought back by picking a level)
//   resize  square feet or tier changed: update what is there, add nothing
//
// A group whose base price is the company's own single service ("Add as one
// line", `ownPricing`) is never added to — only its existing lines of ours,
// which it has none of, would be updated. See QuoteBuilder.
//
// ── Money and the browser ───────────────────────────────────────────────────
//
// This runs in the STAFF builder. The public self-quote form sends a level
// string and nothing else, produces a lead rather than a quote, and no route
// prices from it (AGENTS.md non-negotiables 4 and 5).
//
// Pure — scripts/check-drywall-finish-levels.mjs executes it.

import {
  normaliseFinishLevel,
  normaliseDrywallTier,
  FINISH_LEVEL_TRADES,
} from "@/app/data/drywallFinishLevels";
import { drywallFinishText, drywallHangText } from "@/lib/documents/serviceContent";
import { roomMeasureMeasurements, isRoomMeasureTrade } from "@/lib/measure/reuseTakeoffs";

/** The price-book row each level bills. Level 0 has none. */
export const FINISH_LINE_IDS = Object.freeze({
  level_1: "finish_l1",
  level_2: "finish_l2",
  level_3: "finish_l3",
  level_4: "finish_l4",
  level_5: "finish_l5",
});

export const HANG_LINE_ID = "hang";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;
const list = (v) => (Array.isArray(v) ? v : []);

/** A row's rate in a merged book at a tier, or null when absent or not above 0. */
function rowRate(book, id, tier) {
  if (!id || !book || typeof book !== "object") return null;
  const item = list(book.items).find((i) => i && i.id === id);
  if (!item) return null;
  const grid = book.complexity?.[normaliseDrywallTier(tier)] || book.complexity?.standard || {};
  const rate = item.priceType === "flat" ? num(item.flatPrice) : num(grid[item.priceType]);
  return rate > 0 ? round2(rate) : null;
}

/** The company's rate for a finish level at a tier, or null. */
export function finishLevelRate(book, level, tier = "standard") {
  const id = Object.prototype.hasOwnProperty.call(FINISH_LINE_IDS, level) ? FINISH_LINE_IDS[level] : null;
  return rowRate(book, id, tier);
}

/** The company's hang rate at a tier, or null. */
export function hangRate(book, tier = "standard") {
  return rowRate(book, HANG_LINE_ID, tier);
}

/** The square feet the group's lines bill — see the header. */
export function drywallQuantity(group) {
  const typed = num(group?.intakeValues?.squareFootage);
  if (typed > 0) return round2(typed);
  if (group?.takeoff && isRoomMeasureTrade(group?.categoryKey)) {
    const m = roomMeasureMeasurements(group.takeoff, group.categoryKey);
    const board = num(m?.areaSqFt?.value);
    if (board > 0) return round2(board);
  }
  return 0;
}

function marked(part, extra, { description, quantity, rate, amount }) {
  return { drywallFinish: { part, ...extra, written: { description, quantity, rate, amount } } };
}

/**
 * The finishing line a level bills, or null (Level 0, no level, or no rate).
 * Words in the DOCUMENT's language (Quote.language), copied onto the line once.
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
    meta: marked("finish", { level: lvl, tier: normaliseDrywallTier(tier), itemId: FINISH_LINE_IDS[lvl] }, { description, quantity: qty, rate, amount }),
  };
}

/** The hang line, or null when the book has no hang rate. */
export function hangLine({ book, quantity = 0, language = "en", tier = "standard" } = {}) {
  const rate = hangRate(book, tier);
  if (rate === null) return null;
  const qty = Math.max(0, round2(quantity));
  const description = drywallHangText(language).hangTitle;
  const amount = round2(qty * rate);
  return {
    description,
    quantity: qty,
    unit: "sqft",
    rate,
    amount,
    meta: marked("hang", { tier: normaliseDrywallTier(tier), itemId: HANG_LINE_ID }, { description, quantity: qty, rate, amount }),
  };
}

/** Which part of ours a line is — "hang", "finish" — or null for any other line. */
export function drywallPartOf(line) {
  const m = line && typeof line === "object" && line.meta && line.meta.drywallFinish;
  if (!m || typeof m !== "object") return null;
  return m.part === "hang" ? "hang" : "finish";
}

/** A line this module wrote (either part), whether or not edited since. */
export function isDrywallLine(line) {
  return drywallPartOf(line) !== null;
}

/** A finishing line this module wrote, whether or not edited since. */
export function isFinishLine(line) {
  return drywallPartOf(line) === "finish";
}

/**
 * A line this module wrote and nobody has changed: every field it wrote still
 * reads what it wrote. Anything else — a retyped rate, a reworded description,
 * a marker with no record — is the contractor's line.
 */
export function isUntouchedDrywallLine(line) {
  if (!isDrywallLine(line)) return false;
  const w = line.meta.drywallFinish.written;
  if (!w || typeof w !== "object") return false;
  return (
    line.description === w.description &&
    num(line.quantity) === num(w.quantity) &&
    num(line.rate) === num(w.rate) &&
    num(line.amount) === num(w.amount)
  );
}

/** The finishing part only — kept for readers that ask about that part. */
export function isUntouchedFinishLine(line) {
  return isFinishLine(line) && isUntouchedDrywallLine(line);
}

// One part: replace our untouched line in place, keep an edited one (and add
// nothing beside it), add a missing one only when allowed.
function syncPart(lines, part, desired, mayAdd) {
  const ofPart = (l) => drywallPartOf(l) === part;
  const edited = lines.some((l) => ofPart(l) && !isUntouchedDrywallLine(l));
  const ours = (l) => ofPart(l) && isUntouchedDrywallLine(l);
  const kept = lines.filter((l) => !ours(l));
  if (edited) return { lines: kept, line: null, held: true };
  const at = lines.findIndex(ours);
  if (!desired) return { lines: kept, line: null, held: false };
  if (at >= 0) {
    // Nothing about it changed: the same object stays, so a re-render keys
    // and a later equality check see the line they saw before.
    if (JSON.stringify(lines[at]) === JSON.stringify(desired)) return { lines, line: lines[at], held: false };
    // Position among the kept lines: everything before `at` that survived.
    const pos = lines.slice(0, at).filter((l) => !ours(l)).length;
    const out = kept.slice();
    out.splice(pos, 0, desired);
    return { lines: out, line: desired, held: false };
  }
  if (!mayAdd) return { lines: kept, line: null, held: false };
  // Hang reads first, finishing straight after it; otherwise at the end.
  const out = kept.slice();
  if (part === "finish") {
    const hangAt = out.findIndex((l) => drywallPartOf(l) === "hang");
    out.splice(hangAt >= 0 ? hangAt + 1 : out.length, 0, desired);
  } else {
    const finAt = out.findIndex((l) => drywallPartOf(l) === "finish");
    out.splice(finAt >= 0 ? finAt : out.length, 0, desired);
  }
  return { lines: out, line: desired, held: false };
}

/**
 * A group's lines after its intake changed.
 *
 * @param opts.mode   "create" | "level" | "resize" — see the header
 * @returns { lineItems, line, hang, held, hangHeld, unpriced }
 *   line      the finishing line now on the group, or null
 *   hang      the hang line now on the group, or null
 *   held      an edited finishing line was kept and no new one added
 *   hangHeld  the same, for the hang line
 *   unpriced  a level that bills a line (1–5) has no rate in `book`
 */
export function syncFinishLine(group, { book = null, language = "en", mode = "level" } = {}) {
  const lines = list(group?.lineItems);
  const same = { lineItems: lines, line: null, hang: null, held: false, hangHeld: false, unpriced: false };
  if (!group || group.persisted || !FINISH_LEVEL_TRADES.includes(group.categoryKey)) return same;

  const intake = group.intakeValues || {};
  const level = normaliseFinishLevel(intake.finishLevel);
  const tier = normaliseDrywallTier(intake.complexityLevel);
  const quantity = drywallQuantity(group);
  const unpriced = Boolean(level && level !== "level_0" && finishLevelRate(book, level, tier) === null);
  const ownPricing = group.ownPricing === true;

  const hangDesired = hangLine({ book, quantity, language, tier });
  const hangStep = syncPart(lines, "hang", hangDesired, mode === "create" && !ownPricing);
  const finishDesired = finishLevelLine({ level, book, quantity, language, tier });
  const finishStep = syncPart(hangStep.lines, "finish", finishDesired, (mode === "create" || mode === "level") && !ownPricing);

  return {
    lineItems: finishStep.lines,
    line: finishStep.line,
    hang: hangStep.line,
    held: finishStep.held,
    hangHeld: hangStep.held,
    unpriced,
  };
}
