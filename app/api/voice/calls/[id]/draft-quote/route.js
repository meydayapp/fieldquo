// app/api/voice/calls/[id]/draft-quote/route.js
//
// GET  — the draft this call already has. Free, no tokens.
// POST — read the call and produce one. Costs tokens, so it needs a click.
//
// Split the same way app/api/quotes/[id]/review does, and for the same reason:
// opening a screen must never quietly spend somebody's AI allowance. The
// expensive path is the one with a button behind it.
//
// ── This is the back office, not the phone ─────────────────────────────────
//
// The receptionist that took this call cannot quote and never will —
// lib/voice/prompt.js absolute rule 1, enforced by there being no tool for it.
// This endpoint runs afterwards, requires a signed-in member who is allowed to
// create quotes, and produces SCOPE with no prices in it. The result is a
// prefill for the quote builder; the Quote row is created by the ordinary
// POST /api/quotes when a human presses Save, with every guardrail that route
// already has.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { draftQuoteFromCall, DRAFT_REASONS } from "@/lib/ai/callQuoteDraft";
import { AI_MODEL, isAiConfigured } from "@/lib/ai/provider";

/**
 * The reason a draft could not be made, as a key the UI translates.
 *
 * Named rather than a generic failure because these are four different
 * situations with four different answers: turn AI on, turn a service on, this
 * call had no words, the model found nothing to quote. A single "couldn't do
 * that" would send all four to support.
 */
function reasonResponse(reason, status = 422) {
  return NextResponse.json({ draft: null, reason }, { status });
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const call = await db.voiceCall.findFirst({
    // Scoped in the WHERE. A call id from another tenant resolves to nothing
    // rather than to their customer's transcript.
    where: { id, companyId: member.companyId },
    select: { quoteDraft: true, quoteDraftAt: true, transcript: true },
  });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    draft: call.quoteDraft || null,
    draftedAt: call.quoteDraftAt,
    // Whether a draft is even possible, so the button can be absent rather than
    // present-and-broken on a call with no words in it.
    hasTranscript: Boolean(call.transcript),
    aiAvailable: isAiConfigured(),
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Drafting scope is the first half of writing a quote, so it takes the same
  // permission writing one does. The coarse role is not enough — a member set
  // to "Quotes: view only" must not be able to start one here either.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "draft quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  if (!isAiConfigured()) {
    // 503, not 500. Nothing is broken — the deployment has no key, which is the
    // normal state locally (OPENAI_API_KEY is Sensitive in Vercel and cannot be
    // pulled down). Says so instead of returning an empty draft.
    return reasonResponse(DRAFT_REASONS.AI_UNAVAILABLE, 503);
  }

  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, quotaExceeded: true },
      { status: 429 },
    );
  }

  try {
    const result = await draftQuoteFromCall({
      companyId: member.companyId,
      callId: id,
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "call_quote_draft",
          userId: member.userId,
          ...u,
        }),
    });

    if (!result.ok) {
      if (result.notFound)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      // A crisis call flags itself for review here too, not only on the
      // automatic path — a member who presses this button on a company whose
      // automatic drafting is off (no AI configured, or over quota when the
      // call finished) must not be the one place this signal is lost. Same
      // flag lib/voice/autoDraft.js sets, same queue the receptionist screen
      // already reads.
      if (result.reason === DRAFT_REASONS.CRISIS_DETECTED) {
        await db.voiceCall
          .updateMany({ where: { id, companyId: member.companyId }, data: { needsReview: true } })
          .catch(() => {});
      }
      return reasonResponse(result.reason);
    }

    // Stored so reopening the screen costs nothing, and so a contractor who
    // walks away can come back to what the model said rather than paying for it
    // twice. updateMany with the company in the WHERE, same as the review PATCH
    // on this resource — the row was already scoped, and this keeps it scoped
    // at the write too.
    await db.voiceCall.updateMany({
      where: { id, companyId: member.companyId },
      data: { quoteDraft: result.draft, quoteDraftAt: new Date() },
    });

    return NextResponse.json({
      draft: result.draft,
      draftedAt: result.draft.generatedAt,
      usage: quota.cap
        ? { used: quota.usage.tokens, cap: quota.cap, nearLimit: quota.nearLimit }
        : null,
    });
  } catch (err) {
    console.error("[voice/draft-quote]", err);

    const status = err?.status || err?.response?.status;
    const code = err?.code || err?.error?.code;

    const message =
      status === 401
        ? "The OpenAI key was rejected. Check OPENAI_API_KEY in your Vercel settings."
        : code === "insufficient_quota"
          ? "The OpenAI account has no credit. Add funds at platform.openai.com to use AI features."
          : status === 429
            ? "FieldQuo AI is being rate-limited. Wait a few seconds and try again."
            : code === "model_not_found"
              ? `The model "${AI_MODEL}" isn't available on this OpenAI account.`
              : "Couldn't read that call. The details are in the server log.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
