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
// ══ POST — the run ═════════════════════════════════════════════════════════
//
// `{ confirm: "COMPUTE AI SUGGESTIONS" }`, typed, or nothing happens. Then
// up to four minutes of batches, each one `complete()` call through
// lib/ai/provider.js with the platform budget checked before and the spend
// recorded after (lib/ai/platformUsage.js). The reply reports rows read,
// what the model said, and what it actually cost from the vendor's counts,
// beside the estimate that was shown — so the assumption in the estimate is
// corrected by the first real run rather than believed for ever. One audit
// row per run. Writes `suggested*` columns only; never a trade.
//
// Deliberately NOT idempotent across a second confirmation: every press asks
// again for what remains and costs again. That is the point of the gate.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { isAiConfigured } from "@/lib/ai/provider";
import { formatCost } from "@/lib/ai/usage";
import { AI_CONFIRM_PHRASE, estimateAiCost, suggestTradesAi } from "@/lib/sales/discovery/suggestTradesAi";

const RUN_DEADLINE_MS = 240 * 1000;

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const estimate = await estimateAiCost({ db, now: new Date() });
  return NextResponse.json({
    ...estimate,
    cost: estimate.costMicros === null ? null : formatCost(estimate.costMicros),
    configured: isAiConfigured(),
    confirmPhrase: AI_CONFIRM_PHRASE,
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== AI_CONFIRM_PHRASE) {
    return NextResponse.json({ error: `Type "${AI_CONFIRM_PHRASE}" to run the paid pass.` }, { status: 400 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI is not configured on this deployment (OPENAI_API_KEY). Nothing was sent." }, { status: 409 });
  }
  const now = new Date();
  try {
    const estimate = await estimateAiCost({ db, now });
    const result = await suggestTradesAi({ db, deadlineMs: RUN_DEADLINE_MS, now });
    await db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_trade_suggestions_ai",
        details: {
          model: result.model,
          considered: result.considered,
          written: result.written,
          unknown: result.unknown,
          notContractor: result.notContractor,
          batches: result.batches,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          costMicros: result.costMicros,
          estimatedMicros: estimate.costMicros,
          stopped: result.stopped,
          remaining: result.remaining,
        },
      },
    });
    return NextResponse.json({ ...result, cost: formatCost(result.costMicros), estimate });
  } catch (err) {
    console.error("[platform/sales/review/suggested/ai]", err);
    return NextResponse.json({ error: err?.message || "The AI pass did not finish." }, { status: 500 });
  }
}
