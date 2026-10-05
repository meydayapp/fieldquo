// scripts/truefinish/source.mjs
//
// What both TrueFinish imports share: reading the old system's database
// read-only, and turning its documents into FieldQuo's shape.
//
//   scripts/import-truefinish-history.mjs  the accepted quotes → past jobs
//                                          (2026-10-03/04)
//   scripts/import-truefinish-quotes.mjs   the sent and declined quotes
//                                          (2026-10-05)
//
// Moved here verbatim from the first script when the second arrived, rather
// than copied: two copies of mapLine would be two answers to "what did this
// line cost the homeowner", and the copy is the one nobody re-reads.
//
// No Prisma, no product module that connects to anything: the only "@/"
// import is the pure round2. Both scripts still load it AFTER removing
// DATABASE_URL on a dry run (see their headers), so the order the dry run's
// guarantee depends on does not rest on what this file happens to import.

import fs from "node:fs";
import pg from "pg";
import { round2 } from "@/lib/quotes/totals";

// ── Connection strings — read, never printed ──────────────────────────────
/**
 * The DATABASE_URL line of an env file. `onError(message)` decides what a
 * missing file or line does (the scripts print and exit); it must not return.
 */
export function urlFromEnvFile(path, onError) {
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch {
    onError(`Cannot read ${path}.`);
  }
  const m = text.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?\s*$/m);
  if (!m) onError(`${path} has no DATABASE_URL line.`);
  return m[1].trim();
}

// ── Read-only access ───────────────────────────────────────────────────────
//
// Neon scales to zero (AGENTS.md): the first connection after idle can fail
// with a connect error. One retry, then believe it.
//
// Both schemas store DateTime as Postgres `timestamp` WITHOUT time zone,
// written in UTC by Prisma. node-pg's default parser reads such a value as
// the HOST's local time, so the same row gave a different Date on a Toronto
// Mac and on a UTC server. This client reads it as the UTC it is — per
// client, not pg.types globally, so the Prisma adapter used by --apply is
// untouched.
const TIMESTAMP_WITHOUT_TZ = 1114;
function utcTimestampParser(oid, format) {
  if (oid === TIMESTAMP_WITHOUT_TZ) return (s) => (s === null ? null : new Date(`${s.replace(" ", "T")}Z`));
  return pg.types.getTypeParser(oid, format);
}
export async function readOnly(url, fn) {
  let client;
  for (let attempt = 0; attempt < 2; attempt++) {
    client = new pg.Client({ connectionString: url, types: { getTypeParser: utcTimestampParser } });
    try {
      await client.connect();
      break;
    } catch (err) {
      await client.end().catch(() => {});
      if (attempt === 1) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    return await fn((sql, params = []) => client.query(sql, params).then((r) => r.rows));
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

// ── Mapping ────────────────────────────────────────────────────────────────

// TrueFinish's date-only fields (job start/end, due date, payment date) are
// stored as UTC midnights of the day picked, so their UTC calendar day IS the
// day TrueFinish showed. Its moments (paidDate = when "mark paid" was
// pressed, createdAt, sentAt) are read the same way — the UTC day — which on
// every paid invoice on file is the same day as its last payment's date
// field. FieldQuo's past jobs speak UTC calendar days too
// (lib/jobs/pastJobImport.js isoDay). An earlier version of this comment said
// Toronto midnights: that was node-pg reading UTC values as local time on a
// Toronto machine; utcTimestampParser above removes the host from the sum,
// and the days it yields are the days the earlier runs printed.
export const tfDay = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
export const dayDate = (s) => (s ? new Date(`${s}T00:00:00.000Z`) : null);

// TrueFinish quoteType → FieldQuo ServiceCategory key. "hybrid" is a refacing
// + refinishing kitchen; FieldQuo's past-job write takes ONE category, and the
// refinishing share is the larger on the one hybrid on file — flagged in the
// plan as an owner's call. A null quoteType predates the field; every one on
// file is the "Essential Cabinet Refinishing" package (serviceId "essential").
export const CATEGORY_BY_TYPE = {
  refinishing: "cabinet_refinishing",
  refacing: "cabinet_refacing",
  hybrid: "cabinet_refinishing",
  countertop: "countertop",
  stairs: "stairs",
  flooring: "flooring",
  kitchen: "kitchen_design",
};
export function categoryKeyFor(quote) {
  if (quote.quoteType) return { key: CATEGORY_BY_TYPE[quote.quoteType] || null, inferred: quote.quoteType === "hybrid" };
  const lines = Array.isArray(quote.lineItems) ? quote.lineItems : [];
  if (lines.some((l) => l?.serviceId === "essential" || /cabinet refinishing/i.test(l?.name || l?.title || ""))) {
    return { key: "cabinet_refinishing", inferred: true };
  }
  return { key: null, inferred: false };
}

export const clean = (v) => (typeof v === "string" ? v.trim() : "") || null;

// TrueFinish's own line rule, used ONLY for a line with no stored total —
// app/admin/lib/lineItemTotal.js: an included item (or a legacy material with
// no flag, which meant included) is $0; otherwise quantity × unit price.
function tfComputedLineTotal(l) {
  if (l?.included === true || (l?.category === "material" && l?.included === undefined)) return 0;
  const t = (Number(l?.quantity) || 0) * (Number(l?.unitPrice) || 0);
  return Number.isFinite(t) ? t : 0;
}

const LINE_TITLE_BY_CATEGORY = { "scope-group": "Cabinet work", "measured-extra": "Extra", "stair-section": "Stairs", "floor-section": "Flooring" };

/**
 * One TrueFinish line → one FieldQuo line: { description, detail, quantity,
 * rate, amount, unit }. `amount` is TrueFinish's stored `total` — the price
 * the client saw. `rate` is amount ÷ quantity, so quantity × rate = amount
 * holds on the FieldQuo side even for TrueFinish's "included" materials,
 * which carry a unit price of $150 and a total of $0.
 */
export function mapLine(l, computedFlags) {
  const stored = l?.total !== undefined && l?.total !== null && Number.isFinite(Number(l.total));
  const amount = round2(stored ? Number(l.total) : tfComputedLineTotal(l));
  if (!stored) computedFlags.push(clean(l?.name) || clean(l?.title) || "line");
  const quantity = Number(l?.quantity) > 0 ? Number(l.quantity) : 1;
  const parts = [];
  if (l?.category === "scope-group") {
    // What TrueFinish's PDF printed under a scope card (generateQuotePDF.js
    // renderScopeGroupCard): doors, drawers, colour, sheen.
    const meta = [
      Number.isFinite(Number(l.doorsCount)) && l.doorsCount !== undefined ? `Doors: ${l.doorsCount}` : null,
      Number.isFinite(Number(l.drawerCount)) && l.drawerCount !== undefined ? `Drawers: ${l.drawerCount}` : null,
      clean(l.style) ? `Style: ${clean(l.style)}` : null,
      clean(l.color) ? `Color: ${clean(l.color)}` : null,
      clean(l.sheen) ? `Sheen: ${clean(l.sheen)}` : null,
    ].filter(Boolean);
    if (meta.length) parts.push(meta.join(" · "));
  }
  if (clean(l?.description)) parts.push(clean(l.description));
  if (clean(l?.notes)) parts.push(clean(l.notes));
  return {
    description: clean(l?.name) || clean(l?.title) || LINE_TITLE_BY_CATEGORY[l?.category] || "Item",
    ...(parts.length ? { detail: parts.join("\n\n") } : {}),
    quantity,
    rate: round2(amount / quantity),
    amount,
    ...(clean(l?.unit) ? { unit: clean(l.unit) } : {}),
  };
}

export function docFigures(doc, computedFlags) {
  return {
    lineItems: (Array.isArray(doc.lineItems) ? doc.lineItems : []).map((l) => mapLine(l, computedFlags)),
    subtotal: round2(Number(doc.subtotal)),
    discount: round2(Number(doc.discount)),
    tax: round2(Number(doc.tax)),
    total: round2(Number(doc.total)),
    taxEnabled: Boolean(doc.taxEnabled),
    notes: clean(doc.notes),
  };
}

export const money = (n) => `$${Number(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
