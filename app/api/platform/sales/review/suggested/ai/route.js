// app/api/platform/sales/review/suggested/ai/route.js
//
// Phase 2 of the By-suggestion mode: the model over the names the table
// could not read. Costs money; gated twice.
//
// ══ GET — the estimate ═════════════════════════════════════════════════════
//
// How many rows the "no suggestion" card still holds that the model has not
// been asked about, and what asking would cost: lib/sales/discovery/
// suggestTradesAi.js's `estimateAiCost`, from the rows' measured lengths and
// lib/ai/usage.js's price table for the configured model. No price is typed
// here or in the screen; when the model has no checked price the estimate
// says "unpriced" and the button says so too.
//
// ══ POST — the approval, and the first slice ═══════════════════════════════
//
// `{ confirm: "COMPUTE AI SUGGESTIONS" }`, typed, or nothing happens. Typing
// it APPROVES the pass (lib/sales/discovery/suggestTradesAiApproval.js: a
// PlatformAiBudget "job" row with the $10 cap, the typist's name, and what
// was known) and runs the first slice — up to four minutes of batches, each
// one `complete()` call through lib/ai/provider.js with the platform budget
// checked before and the spend recorded after. The sales-pipeline cron then
// carries on every minute, unattended, until the rows run out or the cap is
// hit, and clears the approval saying which. `{ clear: true }` withdraws it.
//
// The reply reports rows read, what the model said, and what it actually
// cost from the vendor's counts, beside the estimate that was shown — so the
// assumption in the estimate is corrected by the first real run rather than
// believed for ever. Writes `suggested*` columns only; never a trade.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { isAiConfigured } from "@/lib/ai/provider";
import { formatCost } from "@/lib/ai/usage";
import { AI_CONFIRM_PHRASE, estimateAiCost } from "@/lib/sales/discovery/suggestTradesAi";
import {
  TRADE_SUGGEST_AI_CAP_MICROS,
  approveTradeSuggestAi,
  clearTradeSuggestAiApproval,
  loadTradeSuggestAiApproval,
  runTradeSuggestAiSlice,
} from "@/lib/sales/discovery/suggestTradesAiApproval";

const RUN_DEADLINE_MS = 240 * 1000;

function approvalForScreen(a) {
  return {
    approved: a.approved,
    approvedAt: a.approvedAt ? a.approvedAt.toISOString() : null,
    approvedBy: a.approvedBy,
    limitMicros: a.limitMicros,
    limit: formatCost(a.limitMicros),
    spentMicros: a.spentMicros,
    spent: formatCost(a.spentMicros),
    note: a.note,
  };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();
  const [estimate, approval] = await Promise.all([estimateAiCost({ db, now }), loadTradeSuggestAiApproval(db)]);
  return NextResponse.json({
    ...estimate,
    cost: estimate.costMicros === null ? null : formatCost(estimate.costMicros),
    configured: isAiConfigured(),
    confirmPhrase: AI_CONFIRM_PHRASE,
    capMicros: TRADE_SUGGEST_AI_CAP_MICROS,
    cap: formatCost(TRADE_SUGGEST_AI_CAP_MICROS),
    approval: approvalForScreen(approval),
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const body = await request.json().catch(() => ({}));
  const now = new Date();
  if (body?.clear === true) {
    try {
      await clearTradeSuggestAiApproval(db, { reason: "stopped", adminId: admin.id, now });
      return NextResponse.json({ ok: true, approval: approvalForScreen(await loadTradeSuggestAiApproval(db)) });
    } catch (err) {
      return NextResponse.json({ error: err?.message || "Could not stop the pass." }, { status: 500 });
    }
  }
  if (body?.confirm !== AI_CONFIRM_PHRASE) {
    return NextResponse.json({ error: `Type "${AI_CONFIRM_PHRASE}" to approve and run the paid pass.` }, { status: 400 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI is not configured on this deployment (OPENAI_API_KEY). Nothing was sent." }, { status: 409 });
  }
  try {
    // The gate hands back { id, role } only; the row has the email.
    const who = await db.platformAdmin.findUnique({ where: { id: admin.id }, select: { email: true } });
    const { estimate } = await approveTradeSuggestAi(db, { approvedBy: `${who?.email || admin.id} via the folder button`, adminId: admin.id, now });
    const slice = await runTradeSuggestAiSlice({ db, deadlineMs: RUN_DEADLINE_MS, now, trigger: "button", adminId: admin.id });
    const result = slice.result || {};
    return NextResponse.json({
      ...result,
      cost: formatCost(result.costMicros || 0),
      estimate,
      cleared: slice.cleared || null,
      approval: approvalForScreen(await loadTradeSuggestAiApproval(db)),
    });
  } catch (err) {
    console.error("[platform/sales/review/suggested/ai]", err);
    return NextResponse.json({ error: err?.message || "The AI pass did not finish." }, { status: 500 });
  }
}
