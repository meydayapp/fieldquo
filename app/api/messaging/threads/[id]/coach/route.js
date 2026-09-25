// app/api/messaging/threads/[id]/coach/route.js
//
// "Coach me on this conversation" — the paid coaching read of one thread.
// The model call and every guard on its output live in
// lib/ai/conversationCoach.js; this file is the gates, the price and the cache.
//
// ══ The two verbs ══════════════════════════════════════════════════════════
//
//   GET   the stored coaching (if any), whether anything has been said since,
//         the live likelihood from the free score, and what a run would cost
//         — quoted in the unit the payer actually spends, BEFORE the button
//         exists as an option. Spends nothing and writes nothing, ever (a GET
//         that wrote would write under impersonation, which is read-only).
//   POST  run it. meterFor("conversation_coach") checks before and records
//         after; the result replaces the thread's one cached row.
//
// ══ Re-running ═════════════════════════════════════════════════════════════
//
// Only on demand, never on a new message. When nothing has been said since the
// stored coaching, a POST without `force: true` answers `unchanged` and spends
// nothing — a double-click must not buy the same advice twice. The panel sends
// `force` only from its explicit "Coach me again anyway" button, which states
// the price again beside it.
//
// ══ Who may ════════════════════════════════════════════════════════════════
//
// Reading the coaching: requests:view_only (it is about a conversation) AND
// clientsProperties:full_view — the coaching is built from this company's
// other clients' conversations and won/lost record, which a member limited to
// names and addresses is not shown anywhere else. Running it: requests one rung
// higher (view_create_edit), because it spends the company's allowance — the
// same rung the temperature read and the monthly review sit at. Both re-checked
// here; the hidden button on the screen is a courtesy, not the gate.
//
// ══ Never sends ════════════════════════════════════════════════════════════
//
// Nothing in this file imports a send path. The draft goes back to the browser,
// "Use this reply" puts it in the composer, and the contractor's own Send —
// the reply route, with all of its own gates — is the only way it leaves.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { messagingConnection } from "@/lib/messaging/channels";
import { AI_MODEL, isAiConfigured } from "@/lib/ai/provider";
import { meterFor } from "@/lib/ai/featurePayer";
import { scoreThreadFresh } from "@/lib/messaging/rescoreThread";
import { loadCoachThread, loadCoachContext, loadStoredCoach } from "@/lib/messaging/coachContext";
import { buildExamples } from "@/lib/ai/conversationTemperature";
import { ConversationReviewTenantError } from "@/lib/ai/conversationReview";
import {
  runConversationCoach,
  buildCoachSubject,
  estimateCoachCost,
  tradeRollup,
  reviewLessons,
  likelihoodFrom,
  coachIsStale,
} from "@/lib/ai/conversationCoach";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { readerLanguage as readerLanguageOf } from "@/lib/i18n/readerLanguage";
import { isSupported, DEFAULT_LANGUAGE } from "@/app/i18n/languages";

/** The gate for both verbs, re-checked on the fresh grid. */
async function gate(member, runLevel) {
  const full = member.id ? await loadEnforceableMember(db, member.id) : member;
  try {
    requireLevel(full, "requests", runLevel ? "view_create_edit" : "view_only", runLevel ? "coach a conversation with AI" : "read conversation coaching");
    requireLevel(full, "clientsProperties", "full_view", "read conversation coaching");
    return null;
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }
}

/** The stored row, shaped for the browser. Tokens only — costMicros is FieldQuo's, not the tenant's. */
function publicCoach(row, messageCount) {
  if (!row) return null;
  return {
    generatedAt: row.generatedAt,
    basedOnMessages: row.basedOnMessages,
    messagesSince: Math.max(0, (messageCount || 0) - (row.basedOnMessages || 0)),
    stale: coachIsStale(row, messageCount),
    readerLanguage: row.readerLanguage,
    replyLanguage: row.replyLanguage,
    tokens: (row.promptTokens || 0) + (row.completionTokens || 0),
    result: row.result,
  };
}

/** Both languages for one run: the reader's for the coaching, the client's for the draft. */
async function languagesFor(member, thread) {
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { defaultLanguage: true },
  });
  const reader = await readerLanguageOf({ userId: member.userId || null, companyId: member.companyId });
  // No document: a chat reply is correspondence, not a covering note for a
  // quote, so the client's own language leads (clientLanguage.js rule 2).
  const reply = resolveClientLanguage({ client: thread.client, company });
  const ok = (c) => (isSupported(c) ? c : DEFAULT_LANGUAGE);
  return { readerLanguage: ok(reader), replyLanguage: ok(reply) };
}

/** The grounding, fenced. Throws ConversationReviewTenantError on a foreign row. */
async function groundingFor(companyId, thread) {
  const ctx = await loadCoachContext({ db, companyId, thread });
  const examples = buildExamples({ conversations: ctx.exampleThreads, companyId, excludeId: thread.id });
  const rollup = tradeRollup(ctx.rollupRows, { companyId, categoryIds: ctx.categoryIds });
  const lessons = reviewLessons(ctx.reviewRow);
  return { examples, rollup, lessons, tradeLabel: ctx.tradeLabel };
}

const fenceTripped = (err) => {
  console.error("[conversation-coach] tenant fence tripped:", err.message);
  return NextResponse.json({ error: "That conversation could not be assembled." }, { status: 500 });
};

export async function GET(request, { params }) {
  // params is a Promise in Next 16.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refused = await gate(member, false);
  if (refused) return refused;

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    return NextResponse.json({ available: false, coach: null, reasonKey: "app.messages.coach.demoUnavailable" });
  }

  const thread = await loadCoachThread({ db, companyId: member.companyId, id });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ scored }, stored] = await Promise.all([
    scoreThreadFresh(member.companyId, thread, { db }),
    loadStoredCoach({ db, companyId: member.companyId, threadId: thread.id }),
  ]);
  const coach = publicCoach(stored, scored.messageCount);
  const likelihood = likelihoodFrom(scored);

  if (!isAiConfigured()) {
    return NextResponse.json({ available: false, coach, likelihood, reasonKey: "app.messages.coach.aiUnavailable" });
  }

  const subject = buildCoachSubject(thread);
  if (!subject.them.length) {
    return NextResponse.json({ available: false, coach, likelihood, reasonKey: "app.messages.coach.tooShort" });
  }

  let grounding;
  try {
    grounding = await groundingFor(member.companyId, thread);
  } catch (err) {
    if (err instanceof ConversationReviewTenantError) return fenceTripped(err);
    throw err;
  }
  const langs = await languagesFor(member, thread);

  // The payer's own check — the same one the POST will make, so "you can
  // afford this" on screen and the refusal after the click cannot disagree.
  const meter = await meterFor("conversation_coach", { companyId: member.companyId, userId: member.userId || null });
  const check = await meter.check();

  const price = estimateCoachCost({
    model: AI_MODEL,
    subject,
    examples: grounding.examples,
    rollup: grounding.rollup,
    lessons: grounding.lessons,
    tradeLabel: grounding.tradeLabel,
    platform: thread.platform,
    ...langs,
  });

  return NextResponse.json({
    available: Boolean(check.allowed),
    coach,
    likelihood,
    replyLanguage: langs.replyLanguage,
    price: {
      estimatedTokens: price.promptTokens + price.completionTokens,
      estimated: true,
      // Who pays, so the sentence under the button can be true: the company's
      // allowance, or FieldQuo when a superadmin has switched the feature.
      payer: meter.payer,
      remaining: Number.isFinite(check.remaining) ? check.remaining : null,
      cap: Number.isFinite(check.cap) ? check.cap : null,
      allowed: Boolean(check.allowed),
      ...(check.allowed ? {} : { reason: check.reason || null }),
    },
    grounding: {
      scope: grounding.rollup.scope,
      tradeLabel: grounding.rollup.scope === "trade" ? grounding.tradeLabel : null,
      judged: grounding.rollup.judged,
      examplesWon: grounding.examples.filter((e) => e.group === "won").length,
      examplesOther: grounding.examples.filter((e) => e.group !== "won").length,
      review: Boolean(grounding.lessons),
    },
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refused = await gate(member, true);
  if (refused) return refused;

  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    return NextResponse.json(
      { error: "This is a sample conversation, so there is nothing real to coach on.", reasonKey: "app.messages.coach.demoUnavailable" },
      { status: 400 },
    );
  }

  const thread = await loadCoachThread({ db, companyId: member.companyId, id });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const [{ scored }, stored] = await Promise.all([
    scoreThreadFresh(member.companyId, thread, { db, now }),
    loadStoredCoach({ db, companyId: member.companyId, threadId: thread.id }),
  ]);

  if (stored && !force && !coachIsStale(stored, scored.messageCount)) {
    return NextResponse.json({ status: "unchanged", coach: publicCoach(stored, scored.messageCount) });
  }

  let grounding;
  try {
    grounding = await groundingFor(member.companyId, thread);
  } catch (err) {
    if (err instanceof ConversationReviewTenantError) return fenceTripped(err);
    throw err;
  }
  const langs = await languagesFor(member, thread);
  const meter = await meterFor("conversation_coach", { companyId: member.companyId, userId: member.userId || null });

  let run;
  try {
    run = await runConversationCoach({
      companyId: member.companyId,
      thread,
      examples: grounding.examples,
      rollup: grounding.rollup,
      lessons: grounding.lessons,
      tradeLabel: grounding.tradeLabel,
      scored,
      meter,
      now,
      ...langs,
    });
  } catch (err) {
    if (err instanceof ConversationReviewTenantError) return fenceTripped(err);
    throw err;
  }

  if (run.status === "quota") {
    // 402, not 403: they may do this; the payer's ledger has nothing left.
    // Nothing was called and nothing is stored.
    return NextResponse.json(
      {
        error: run.refusal || "This month's AI allowance is used up.",
        quota: { cap: run.gate?.cap ?? null, remaining: run.gate?.remaining ?? 0 },
      },
      { status: 402 },
    );
  }
  if (run.status === "too_short") {
    return NextResponse.json({ status: "too_short", reasonKey: run.reasonKey });
  }
  if (run.status !== "ready") {
    // The vendor failed or answered off-schema. Tokens it billed were already
    // recorded by the meter; nothing is stored, and the previous coaching (if
    // any) stays exactly as it was. No English `error` sentence: the panel
    // shows its own translated one for this status.
    return NextResponse.json({ status: run.status, failure: run.failure || null }, { status: 502 });
  }

  const data = {
    companyId: member.companyId,
    generatedAt: now,
    generatedByUserId: member.userId || null,
    basedOnMessages: scored.messageCount || 0,
    model: run.model,
    promptTokens: run.promptTokens,
    completionTokens: run.completionTokens,
    costMicros: run.costMicros,
    readerLanguage: langs.readerLanguage,
    replyLanguage: langs.replyLanguage,
    result: run.result,
  };
  const row = await db.conversationCoach.upsert({
    where: { threadId: thread.id },
    create: { threadId: thread.id, ...data },
    // `companyId` is rewritten with the same value the (id, companyId) load
    // proved; a threadId is globally unique, so this row can only ever be this
    // company's.
    update: data,
  });

  return NextResponse.json({ status: "ready", coach: publicCoach(row, scored.messageCount) });
}
