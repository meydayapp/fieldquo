// scripts/suggest-trades.mjs
//
// Run the Review folder's trade-suggestion batch from a laptop.
//
//   node --import ./scripts/alias-loader.mjs scripts/suggest-trades.mjs                # stale: every row not on this version
//   node --import ./scripts/alias-loader.mjs scripts/suggest-trades.mjs --missing      # only rows never computed
//   node --import ./scripts/alias-loader.mjs scripts/suggest-trades.mjs --ai           # Phase 2 ESTIMATE (no model call)
//   node --import ./scripts/alias-loader.mjs scripts/suggest-trades.mjs --ai --apply   # Phase 2 RUN here — costs money, needs a key
//   node --import ./scripts/alias-loader.mjs scripts/suggest-trades.mjs --ai --approve --budget=1000 --by="owner via chat 2026-09-13"
//                                                # Phase 2 APPROVAL: no model call here; the sales-pipeline cron on
//                                                # Vercel (where the key lives) runs it unattended up to the cap (cents)
//   node --import ./scripts/alias-loader.mjs scripts/suggest-trades.mjs --ai --clear   # withdraw the approval
//
// The same functions the platform buttons call (lib/sales/discovery/
// suggestTradesBatch.js and suggestTradesAi.js), against the DATABASE_URL in
// the environment. The first full pass over ~300,000 rows is minutes of
// two-thousand-row statements and a laptop has no 300-second budget, which
// is why this exists beside the route — the same reason
// reclassify-licence-registers.mjs does.
//
// Phase 1 writes the `suggested*` columns and nothing else — never a trade,
// never a status, never a decision. Idempotent: the same version twice
// writes nothing. Phase 2 without --apply prints the row count and the cost
// estimate and sends nothing to a vendor.
import "dotenv/config";
import { db } from "../lib/db.js";
import { suggestTradesBatch } from "../lib/sales/discovery/suggestTradesBatch.js";
import { estimateAiCost, suggestTradesAi } from "../lib/sales/discovery/suggestTradesAi.js";
import { approveTradeSuggestAi, clearTradeSuggestAiApproval, loadTradeSuggestAiApproval } from "../lib/sales/discovery/suggestTradesAiApproval.js";
import { discoveryTradeLabel } from "../lib/sales/discovery/trades.js";
import { formatCost } from "../lib/ai/usage.js";

const ai = process.argv.includes("--ai");
const apply = process.argv.includes("--apply");
const approve = process.argv.includes("--approve");
const clear = process.argv.includes("--clear");
const budgetArg = process.argv.find((a) => a.startsWith("--budget="));
const budgetCents = budgetArg ? Number(budgetArg.slice("--budget=".length)) : 1000;
const byArg = process.argv.find((a) => a.startsWith("--by="));
const approvedBy = byArg ? byArg.slice("--by=".length) : "owner via chat 2026-09-13";
const mode = process.argv.includes("--missing") ? "missing" : "stale";
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : Infinity;

function printDistribution(byTrade) {
  const entries = Object.entries(byTrade).sort((a, b) => b[1] - a[1]);
  for (const [key, n] of entries) console.log(`    ${discoveryTradeLabel(key).padEnd(22)} ${String(n).padStart(8)}`);
}

try {
  if (ai) {
    const estimate = await estimateAiCost({ db, now: new Date() });
    console.log(
      `Phase 2 — ${estimate.rows} rows with no suggestion, ${estimate.batches} batches of 100 on ${estimate.model}` +
        ` · ≈${estimate.promptTokens} prompt + ${estimate.completionTokens} completion tokens · ` +
        (estimate.priced ? `≈ ${formatCost(estimate.costMicros)}` : "model has no checked price"),
    );
    const approval = await loadTradeSuggestAiApproval(db);
    console.log(
      approval.approved
        ? `  approval: ACTIVE since ${approval.approvedAt?.toISOString()} by ${approval.approvedBy} · spent ${formatCost(approval.spentMicros)} of ${formatCost(approval.limitMicros)}`
        : `  approval: none active${approval.note ? ` · last: ${approval.note}` : ""}`,
    );
    if (clear) {
      await clearTradeSuggestAiApproval(db, { reason: "stopped", now: new Date() });
      console.log("  approval cleared.");
    } else if (approve) {
      if (!Number.isFinite(budgetCents) || budgetCents <= 0) throw new Error("--budget must be a positive number of cents");
      const { row } = await approveTradeSuggestAi(db, { approvedBy, budgetMicros: Math.round(budgetCents * 10_000), now: new Date() });
      console.log(`  approved by "${row.approvedBy}" at ${row.approvedAt.toISOString()} · cap ${formatCost(row.limitMicros)} · the cron takes it from here.`);
      console.log(`  ${row.note}`);
    } else if (!apply) {
      console.log("Estimate only. --approve lets the cron run it on Vercel; --apply runs it here (costs money, needs a key).");
    } else {
      const started = Date.now();
      const result = await suggestTradesAi({ db, limit, now: new Date() });
      console.log(
        `  read ${result.considered} · written ${result.written} · unknown ${result.unknown} · not contractor ${result.notContractor}` +
          ` · dropped ${result.dropped} · ${result.batches} calls · ${result.promptTokens}+${result.completionTokens} tokens · ${formatCost(result.costMicros)}` +
          ` · remaining ${result.remaining}${result.stopped ? ` · STOPPED: ${result.stopped}` : ""} · ${Math.round((Date.now() - started) / 1000)}s`,
      );
      printDistribution(result.byTrade);
    }
  } else {
    console.log(`Computing trade suggestions — mode ${mode}${Number.isFinite(limit) ? `, limit ${limit}` : ""}`);
    const result = await suggestTradesBatch({ db, mode, limit, now: new Date() });
    console.log(
      `  version ${result.version} · considered ${result.considered} · written ${result.written} · remaining ${result.remaining} · ${result.seconds}s`,
    );
    console.log(`  not contractor ${result.notContractor} · shop word beside a trade ${result.mixed} · no suggestion ${result.none}`);
    printDistribution(result.byTrade);
  }
} finally {
  await db.$disconnect();
}
