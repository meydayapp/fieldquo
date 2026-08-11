// lib/pricing/benchmarkGuidance.js
//
// One normalised read over the two trade benchmark tables, so the quote builder
// can show "typical range — set your price" beside a blank rate.
//
// ── Why this exists rather than the UI reading the tables directly ──────────
//
// The two tables were written independently and do not agree on shape.
// Electrical marks "no number" with a null typical plus `noRange`; plumbing has
// four distinct forms (`unpriced`, `noNationalDefault`, `priceIsMultiplier`,
// `singleObservation`). A component branching on eight shapes would quietly
// render nothing for the ones it forgot — and "nothing" is indistinguishable
// from "no benchmark exists", which is the wrong thing to tell someone pricing
// a job. Normalising here means every no-number case has to be *classified*,
// and the two `default:` branches below throw rather than fall through.
//
// ── Nothing here is client-facing ───────────────────────────────────────────
//
// This is the contractor's guidance layer. A benchmark is FieldQuo's research
// aggregate, not the company's rate card, and it must never reach a document a
// homeowner reads — nor a public endpoint, per non-negotiable #4. The builder
// under /app is the only consumer; check:electrical and check:plumbing both
// assert no route under app/quote|book|q|portal|site|embed imports either table.

import { ELECTRICAL_BENCHMARKS } from "@/app/data/electricalBenchmarks";
import { PLUMBING_BENCHMARKS } from "@/app/data/plumbingBenchmarks";

const TABLES = {
  electrical: ELECTRICAL_BENCHMARKS,
  plumbing: PLUMBING_BENCHMARKS,
};

/** Trades that have a benchmark table at all. Everything else returns null —
 *  the absence of a table is not a statement that a trade has no typical price,
 *  so the UI shows nothing rather than an empty range. */
export function hasBenchmarks(categoryKey) {
  return Object.hasOwn(TABLES, categoryKey);
}

/** A multiplier tier is any object carrying at least one numeric bound. Shape
 *  test, not a name test — see the comment in getBenchmark. */
function isTier(v) {
  if (!v || typeof v !== "object") return false;
  return ["low", "typical", "high"].some((k) => Number.isFinite(Number(v[k])));
}

function isTierMap(v) {
  return Boolean(v) && typeof v === "object" && Object.values(v).some(isTier);
}

function formatTier(when, v) {
  const lo = v.low ?? v.typical ?? v.high;
  const hi = v.high ?? v.typical ?? v.low;
  const span = lo === hi ? `${lo}×` : `${lo}–${hi}×`;
  if (!when) return span;
  // Tier keys arrive both snake_cased and camelCased across the two tables.
  const label = when
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return `${label} ${span}`;
}

function money(n, currency) {
  if (n == null) return null;
  const rounded = Math.round(Number(n));
  if (!Number.isFinite(rounded)) return null;
  return `${currency === "CAD" ? "CA$" : "$"}${rounded.toLocaleString("en-CA")}`;
}

/** Normalised guidance for one catalogue line, or null if there is no entry.
 *
 *  Returns `{ kind, label, detail, confidence, currency }` where `kind` is:
 *    range   — a low/typical/high band exists; `label` is the band
 *    ceiling — only an upper bound was published
 *    multiplier — the trade prices this as a factor, not an amount
 *    single  — one observation, deliberately not widened into a fake band
 *    none    — no number, and `detail` says why
 *
 *  The caller renders `label` beside the rate box and `detail` on demand. */
export function getBenchmark(categoryKey, lineKey) {
  // `Object.hasOwn` rather than a plain lookup on both hops: a bare object
  // inherits `constructor`, `toString` and `__proto__`, so `table["constructor"]`
  // is truthy and would resolve a line that doesn't exist into a confident
  // "no benchmark found" — a fabricated statement about a line nobody wrote.
  if (!categoryKey || !lineKey) return null;
  if (!Object.hasOwn(TABLES, categoryKey)) return null;
  const table = TABLES[categoryKey];
  if (!Object.hasOwn(table, lineKey)) return null;
  const b = table[lineKey];
  if (!b || typeof b !== "object") return null;

  const currency = b.currency || "USD";
  const common = {
    confidence: b.confidence || "guess",
    currency,
    basis: b.basis || "",
  };

  // Order matters: a row can carry both a reason and a stray bound, and the
  // most specific claim wins. Multipliers go first because those rows
  // legitimately have no low/typical/high — falling through would classify a
  // real, usable number as "no benchmark".
  //
  // Two shapes, because the tables were written independently: electrical has
  // one unnamed `multiplier: {low, typical, high}`, plumbing has named tiers
  // under `multipliers` (weeknight/weekend/holiday) — and mixes `confidence`
  // and `basis` into the same object, so tiers are recognised by carrying a
  // numeric bound rather than by not being on a blocklist. A blocklist would
  // print "basis undefined×" the next time someone adds a field.
  const tiers = isTierMap(b.multipliers)
    ? Object.entries(b.multipliers).filter(([, v]) => isTier(v))
    : isTier(b.multiplier)
      ? [[null, b.multiplier]]
      : [];
  if (tiers.length) {
    return {
      ...common,
      kind: "multiplier",
      label: tiers.map(([when, v]) => formatTier(when, v)).join(" · "),
      detail:
        b.reason ||
        b.noRange ||
        "This trade prices the work as a factor on the standard rate, not as an amount.",
    };
  }

  if (b.typical != null && b.low != null && b.high != null) {
    return {
      ...common,
      kind: "range",
      label: `${money(b.low, currency)}–${money(b.high, currency)}, typical ${money(b.typical, currency)}`,
      detail: b.basis || "",
    };
  }

  if (b.noNationalDefault) {
    return {
      ...common,
      kind: "ceiling",
      label:
        b.high != null
          ? `no reliable typical — published ceiling ${money(b.high, currency)}`
          : "no reliable typical",
      detail:
        b.reason ||
        "Only part of a band was published. Inventing the rest would be a guess wearing a number's clothes.",
    };
  }

  if (b.singleObservation) {
    const only = b.typical ?? b.low ?? b.high;
    return {
      ...common,
      kind: "single",
      label:
        only != null
          ? `one observation: ${money(only, currency)}`
          : "one observation",
      detail:
        b.reason ||
        "A single real estimate, not a market band. Treat it as an anchor, not a range.",
    };
  }

  // Everything left has no number. Electrical says so with `noRange`, plumbing
  // with `unpriced`; both carry the reason under one of two names.
  return {
    ...common,
    kind: "none",
    label: "no benchmark — set your own price",
    detail: b.noRange || b.reason || b.basis || "Not researched.",
  };
}

/** Whether the guidance should be shown at all for a line. Deliberately not
 *  "is there an entry" — a `none` entry is worth showing, because "we looked
 *  and found nothing" is different information from "we never looked". */
export function shouldShowGuidance(categoryKey, lineKey) {
  return getBenchmark(categoryKey, lineKey) != null;
}
