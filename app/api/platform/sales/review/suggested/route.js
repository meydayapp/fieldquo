// app/api/platform/sales/review/suggested/route.js
//
// The Review folder's By-suggestion mode: the cards, and the button that
// fills them.
//
// ══ GET — the cards ════════════════════════════════════════════════════════
//
// One card per suggested trade over the trade-less, non-duplicate folder
// rows ("Heating and cooling — 1,204 suggested from the name"), plus the
// fixed cards suggestedGroups.js describes: agree, conflict, mixed, not a
// contractor, no suggestion, current trade only, not computed yet. Every
// count is a COUNT over reviewFolder.js's `suggestedGroupSql` for that card
// AND the folder's own WHERE, so the number on the card is the number the
// page and the bulk write see. Held for a minute per instance, like the
// folder's facets: eight aggregates over 300,000 rows are ~3 s together and
// a card that lags a decision by a minute still says the right thing to
// within one page.
//
// ══ POST — compute ═════════════════════════════════════════════════════════
//
// `{ mode: "stale" | "missing" }` runs lib/sales/discovery/suggestTradesBatch
// .js for up to four minutes of this invocation's five and reports how many
// rows remain, so the screen can call again until zero. Writes the
// `suggested*` columns and NOTHING else — no trade, no status, no counter;
// the batch's header and scripts/check-trade-suggestions.mjs hold that line.
// The same function runs from a laptop as scripts/suggest-trades.mjs for a
// first full pass over the pile, and from the sales-pipeline cron in slices
// for rows that arrive afterwards.
//
// Superadmin only, like the folder.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { reviewWhereSql, suggestedGroupSql } from "@/lib/sales/discovery/reviewFolder";
import { SUGGESTED_GROUPS, suggestedGroupAccepts, suggestedGroupReject } from "@/lib/sales/discovery/suggestedGroups";
import { SUGGEST_MODES, suggestTradesBatch } from "@/lib/sales/discovery/suggestTradesBatch";
import { SUGGEST_VERSION } from "@/lib/sales/discovery/tradeSuggest";
import { discoveryTradeLabel, isDiscoveryTradeKey } from "@/lib/sales/discovery/trades";

const CARDS_TTL_MS = 60 * 1000;
let cardsCache = { at: 0, data: null };

/** Four minutes of a five-minute function: the rest is the last page's write and the count. */
const COMPUTE_DEADLINE_MS = 240 * 1000;

async function loadCards(now) {
  const base = reviewWhereSql({}, { now });
  const fixedKeys = Object.keys(SUGGESTED_GROUPS);
  const [byTrade, fixed, [{ n: duplicates }], [{ n: staleN }]] = await Promise.all([
    db.$queryRaw`SELECT "suggestedTradeKey" AS key, COUNT(*)::int AS n FROM "Prospect" WHERE ${base} AND "possibleDuplicateOfId" IS NULL AND "tradeKey" IS NULL AND "suggestedNotContractor" IS NOT TRUE AND "suggestedTradeKey" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`,
    Promise.all(
      fixedKeys.map(async (key) => {
        const [{ n }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "Prospect" WHERE ${base} AND ${suggestedGroupSql(key)}`;
        return { key, count: Number(n) };
      }),
    ),
    db.$queryRaw`SELECT COUNT(*)::int AS n FROM "Prospect" WHERE ${base} AND "possibleDuplicateOfId" IS NOT NULL`,
    db.$queryRaw`SELECT COUNT(*)::int AS n FROM "Prospect" WHERE ${base} AND "suggestedAt" IS NOT NULL AND "suggestedVersion" <> ${SUGGEST_VERSION}`,
  ]);
  const card = (key, label, note, count) => ({
    key,
    label,
    note,
    count,
    accepts: suggestedGroupAccepts(key, { isTradeKey: isDiscoveryTradeKey }),
    reject: suggestedGroupReject(key, { isTradeKey: isDiscoveryTradeKey }),
    checkedByDefault: isDiscoveryTradeKey(key) ? true : Boolean(SUGGESTED_GROUPS[key]?.checkedByDefault),
  });
  return {
    version: SUGGEST_VERSION,
    trades: byTrade
      .filter((r) => isDiscoveryTradeKey(r.key))
      .map((r) => card(r.key, discoveryTradeLabel(r.key), "Trade-less rows whose name, licence, site or domain says this trade.", Number(r.n))),
    fixed: fixed.map(({ key, count }) => card(key, SUGGESTED_GROUPS[key].label, SUGGESTED_GROUPS[key].note, count)),
    duplicatesExcluded: Number(duplicates),
    // Rows computed under an older keyword table. A number the screen turns
    // into "Recompute" rather than a silent second pass.
    stale: Number(staleN),
  };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();
  if (!cardsCache.data || now.getTime() - cardsCache.at >= CARDS_TTL_MS) {
    cardsCache = { at: now.getTime(), data: await loadCards(now) };
  }
  return NextResponse.json({ ...cardsCache.data, cachedFor: Math.round((now.getTime() - cardsCache.at) / 1000) });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const mode = SUGGEST_MODES.includes(body?.mode) ? body.mode : "stale";
  try {
    const result = await suggestTradesBatch({ db, mode, deadlineMs: COMPUTE_DEADLINE_MS, now: new Date() });
    // The cards are stale the moment a batch writes; drop them rather than
    // show yesterday's zero for a minute after the button was pressed.
    cardsCache = { at: 0, data: null };
    if (result.written) {
      await db.platformAuditLog.create({
        data: {
          platformAdminId: admin.id,
          action: "sales_trade_suggestions_computed",
          details: { mode, version: result.version, considered: result.considered, written: result.written, remaining: result.remaining, seconds: result.seconds },
        },
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[platform/sales/review/suggested]", err);
    return NextResponse.json({ error: err?.message || "The suggestion batch did not finish." }, { status: 500 });
  }
}
