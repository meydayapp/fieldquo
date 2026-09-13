// lib/sales/discovery/suggestTradesBatch.js
//
// Run the pure trade suggester over the Review folder and STORE what it says,
// so 299,000 rows become forty groups a person can confirm in pages of fifty.
//
// ══ What this writes, and what it must never write ════════════════════════
//
// Prospect.suggestedTradeKey / suggestedTradeKeys / suggestedTradeBasis /
// suggestedTradeConfidence / suggestedNotContractor / suggestedTradeNote /
// suggestedAt / suggestedVersion — the columns the schema comment on
// Prospect describes — from tradeSuggest.js's `suggestionColumns()`, and
// nothing else. Not `tradeKey`, not `status`, not `classification`, not a
// ProspectCorrection, not a campaign counter: the row's place in the funnel
// is exactly what it was before the batch ran. The accept route
// (reviewDecide.js / reviewBulk.js) remains the ONLY writer of a trade, and
// scripts/check-trade-suggestions.mjs greps this file to keep it that way.
//
// `updatedAt` is deliberately not bumped either: the write is a raw UPDATE
// and nothing about the BUSINESS changed. A "modified 2 minutes ago" on
// 299,000 rows because a keyword table grew would be a lie on every screen
// that reads the column.
//
// ══ Why a raw UPDATE … FROM unnest, and why pages of two thousand ═════════
//
// Every row gets its own values, so this is not one updateMany. Two thousand
// individual UPDATEs a page would be two thousand round trips to Neon per
// page and hours for the folder; one statement carrying seven parallel arrays
// through unnest() writes a page in one round trip. Measured on the first
// real run (2026-09-13): see the numbers in docs/ROADMAP.md.
//
// The page is read by an explicit `id > cursor` bound rather than by "rows
// still lacking a version": the write changes the version of the rows just
// read, and a state-driven query re-reads nothing — but an id bound also
// survives a page where every row was skipped, which a state-driven query
// would loop on for ever.
//
// ══ Two selections ════════════════════════════════════════════════════════
//
//   "missing"   suggestedAt IS NULL — rows nobody has computed, index-backed.
//               The cron slice's selection: new rows from a running campaign
//               get their suggestion within a minute of arriving, without a
//               human pressing anything.
//   "stale"     suggestedVersion IS NULL OR <> SUGGEST_VERSION — a keyword
//               table changed and every row should be re-read. The button
//               and the script's selection. Includes "missing".
//
// Both are idempotent: a second pass of the same version selects nothing and
// writes nothing. The check drives that with a fake client.
//
// ══ Who this runs for ══════════════════════════════════════════════════════
//
// Every row the Review folder shows, by the folder's own reason clauses
// (reviewFolder.js's `reviewReasonSql`) — trade-less contractors, unclear
// rows, flagged duplicates — WITHOUT the untouchable guard. A suggestion is
// not a decision, so computing one for a row a rep happens to hold is
// harmless, and skipping it would leave a hole in the groups the moment the
// claim lapsed. Rows with a trade already are included on purpose: the
// By-suggestion mode's "name agrees with the current trade" and "conflict"
// groups are built from them (the coordinator's note on "Fasso Tree Service ·
// currently Landscaping").

import { Prisma } from "@prisma/client";
import { reviewReasonSql } from "./reviewFolder";
import { SUGGEST_VERSION, suggestionColumns } from "./tradeSuggest";
import { TRADE_INFERENCE_KIND } from "@/lib/sales/intel/tradeDetect";

/** Rows read and written per statement. Under Postgres's 65,535-parameter
 *  ceiling by a wide margin (seven arrays, not seven columns × rows). */
export const SUGGEST_PAGE = 2000;

/** What one cron tick may do. 5,000 rows is ~3 statements and a few seconds
 *  — inside the sales-pipeline cron's budget after its drains. */
export const SUGGEST_CRON_SLICE = 5000;

export const SUGGEST_MODES = Object.freeze(["missing", "stale"]);

/** The rows a mode selects, as SQL. Exported so the check can read it. */
export function suggestSelectionSql(mode = "stale", { version = SUGGEST_VERSION } = {}) {
  const base = reviewReasonSql(null);
  if (mode === "missing") return Prisma.sql`${base} AND "suggestedAt" IS NULL`;
  return Prisma.sql`${base} AND ("suggestedVersion" IS NULL OR "suggestedVersion" <> ${version})`;
}

/**
 * The columns one row's suggestion becomes, from the row as read. Pure.
 *
 * A row the AI pass already answered (basis `ai`, suggestTradesAi.js) keeps
 * that answer when the table still reads nothing from the name: a recompute
 * after a keyword was added must not overwrite a paid answer with a blank.
 * A table hit DOES replace it — the table is verified and free, the model is
 * neither — and the version is stamped either way so the row is not re-read.
 */
export function planSuggestion(row) {
  const cols = suggestionColumns({
    businessName: row.businessName,
    tradingNames: row.tradingNames,
    sourceProvider: row.sourceProvider,
    sourceCategories: row.sourceCategories,
    domain: row.domain,
    inferences: row.inferences,
  });
  const tableSaysNothing = !cols.suggestedTradeKey && !cols.suggestedNotContractor;
  if (tableSaysNothing && row.suggestedTradeBasis === "ai") {
    return {
      id: row.id,
      suggestedTradeKey: row.suggestedTradeKey || null,
      suggestedTradeKeys: Array.isArray(row.suggestedTradeKeys) ? row.suggestedTradeKeys : [],
      suggestedTradeBasis: "ai",
      suggestedTradeConfidence: row.suggestedTradeConfidence == null ? null : Number(row.suggestedTradeConfidence),
      suggestedNotContractor: Boolean(row.suggestedNotContractor),
      suggestedTradeNote: row.suggestedTradeNote || null,
      suggestedVersion: cols.suggestedVersion,
    };
  }
  return { id: row.id, ...cols };
}

/**
 * Write one page of planned suggestions. One statement.
 *
 * Exported so the check can drive it against a client that records the
 * statement's arrays; the property proved there is that the arrays carry
 * exactly the planned rows in the planned order, and that no column outside
 * the `suggested*` set is named in the statement.
 */
export async function writeSuggestionPage(db, planned, { now = new Date(), version = SUGGEST_VERSION } = {}) {
  if (!planned.length) return 0;
  const ids = planned.map((p) => p.id);
  const keys = planned.map((p) => p.suggestedTradeKey || "");
  const lists = planned.map((p) => p.suggestedTradeKeys.join(","));
  const bases = planned.map((p) => p.suggestedTradeBasis || "");
  const confs = planned.map((p) => (p.suggestedTradeConfidence == null ? null : String(p.suggestedTradeConfidence)));
  const notc = planned.map((p) => Boolean(p.suggestedNotContractor));
  const notes = planned.map((p) => p.suggestedTradeNote || "");
  return db.$executeRaw`
    UPDATE "Prospect" p SET
      "suggestedTradeKey" = NULLIF(v.key, ''),
      "suggestedTradeKeys" = string_to_array(v.keys, ','),
      "suggestedTradeBasis" = NULLIF(v.basis, ''),
      "suggestedTradeConfidence" = v.conf::numeric,
      "suggestedNotContractor" = v.notc,
      "suggestedTradeNote" = NULLIF(v.note, ''),
      "suggestedAt" = ${now},
      "suggestedVersion" = ${version}
    FROM unnest(${ids}::text[], ${keys}::text[], ${lists}::text[], ${bases}::text[], ${confs}::text[], ${notc}::boolean[], ${notes}::text[])
      AS v(id, key, keys, basis, conf, notc, note)
    WHERE p.id = v.id`;
}

/**
 * Run it.
 *
 * @param {{ db:object, mode?:"missing"|"stale", limit?:number, deadlineMs?:number, now?:Date, version?:string }} args
 *        `limit` caps rows considered this call; `deadlineMs` stops between
 *        pages once that many milliseconds have passed (a route's budget).
 * @returns {Promise<{ mode:string, version:string, considered:number, written:number, remaining:number,
 *                     byTrade:Record<string,number>, notContractor:number, mixed:number, none:number, seconds:number }>}
 *          `remaining` is what the same selection still holds after this
 *          call — zero means done. The distribution counts THIS call's rows.
 */
export async function suggestTradesBatch({ db, mode = "stale", limit = Infinity, deadlineMs = Infinity, now = new Date(), version = SUGGEST_VERSION } = {}) {
  if (!db) throw new Error("suggestTradesBatch: db is required");
  if (!SUGGEST_MODES.includes(mode)) throw new Error(`suggestTradesBatch: mode must be one of ${SUGGEST_MODES.join(", ")}`);
  const started = Date.now();
  const selection = suggestSelectionSql(mode, { version });

  let cursor = null;
  let considered = 0;
  let written = 0;
  const byTrade = {};
  let notContractor = 0;
  let mixed = 0;
  let none = 0;

  while (considered < limit && Date.now() - started < deadlineMs) {
    const take = Math.min(SUGGEST_PAGE, limit - considered);
    const idRows = await db.$queryRaw`SELECT id FROM "Prospect" WHERE ${selection}${cursor ? Prisma.sql` AND id > ${cursor}` : Prisma.empty} ORDER BY id ASC LIMIT ${take}`;
    if (!idRows.length) break;
    const ids = idRows.map((r) => r.id);
    cursor = ids[ids.length - 1];

    const rows = await db.prospect.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        businessName: true,
        tradingNames: true,
        sourceProvider: true,
        sourceCategories: true,
        domain: true,
        suggestedTradeKey: true,
        suggestedTradeKeys: true,
        suggestedTradeBasis: true,
        suggestedTradeConfidence: true,
        suggestedNotContractor: true,
        suggestedTradeNote: true,
        inferences: { where: { kind: TRADE_INFERENCE_KIND }, select: { kind: true, value: true } },
      },
    });
    const planned = rows.map(planSuggestion);
    for (const p of planned) {
      if (p.suggestedNotContractor && p.suggestedTradeKeys.length) mixed += 1;
      else if (p.suggestedNotContractor) notContractor += 1;
      else if (p.suggestedTradeKey) byTrade[p.suggestedTradeKey] = (byTrade[p.suggestedTradeKey] || 0) + 1;
      else none += 1;
    }
    written += await writeSuggestionPage(db, planned, { now, version });
    considered += ids.length;
    if (ids.length < take) break;
  }

  const [{ n: remaining }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "Prospect" WHERE ${selection}`;
  return {
    mode,
    version,
    considered,
    written,
    remaining: Number(remaining),
    byTrade,
    notContractor,
    mixed,
    none,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
}
