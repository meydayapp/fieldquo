// app/api/messaging/threads/[id]/temperature/route.js
//
// One conversation's hot / warm / cold, and the optional paid reading of it.
//
// ══ WHEN THE PAID READ RUNS, AND WHY IT IS THIS ════════════════════════════
//
// The free rule score runs continuously and costs nothing: on every new
// message (lib/messaging/ingest.js), on every reply we send, and on the quiet
// threads once a day (app/api/cron/messaging-snooze). It is never absent, and
// a company with no AI credit gets a fully scored inbox.
//
// The MODEL reading runs on ONE trigger: **the contractor asks for it, on the
// thread, with the price on the button.** Not per message, and not
// automatically at all. The three candidates were:
//
//   a quote going out — the most valuable moment, and the moment the corpus's
//     acceptance test is written about. Rejected as an AUTOMATIC trigger
//     because it would spend a company's allowance every time anybody sent a
//     quote, whether or not they wanted a reading, and quoting is the single
//     most common action in this product. Instead the BUTTON is highlighted at
//     that moment: the thread screen recommends the read when a quote has gone
//     out and nothing has been read since.
//
//   a thread going quiet — rejected for the same reason with worse odds: it
//     would spend most on the conversations that turned out to be worth least.
//     Silence is a FREE signal, and it is already measured on the cron.
//
//   the contractor asking — chosen. It is the only trigger where the person
//     spending the allowance is the person deciding to, which is the rule every
//     other paid surface in this codebase follows: the GET quotes the price
//     BEFORE the POST exists as an option.
//
// And it cannot be bought twice for nothing: a re-read is refused with
// `unchanged` when not a single message has been said since the last one
// (aiReadIsStale). A chatty thread costs exactly what a quiet one does.
//
// ══ The two verbs ══════════════════════════════════════════════════════════
//
//   GET   the current score, computed FRESH from this thread's messages, plus
//         what a reading would cost and whether one is worth buying. Spends
//         nothing, ever.
//   POST  read it. Quota-checked before, metered after, stored into the same
//         scoreReasons column so a later free rescore re-applies it rather than
//         erasing something a company paid for.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { messagingConnection } from "@/lib/messaging/channels";
import { AI_WRITING_MODEL, isAiConfigured } from "@/lib/ai/provider";
import { checkAiQuota } from "@/lib/ai/usage";
import { scoreConversation, applyAiRead, storableScore } from "@/lib/messaging/conversationScore";
import { scoringContext } from "@/lib/messaging/rescoreThread";
import {
  readConversationTemperature,
  buildExamples,
  buildSubject,
  estimateReadCost,
  aiReadIsStale,
  MIN_MESSAGES_FOR_AI_READ,
} from "@/lib/ai/conversationTemperature";
import { ConversationReviewTenantError } from "@/lib/ai/conversationReview";

/** The thread, its messages, and the stored reading. Company-scoped by findFirst. */
async function loadThread(companyId, id) {
  return db.messageThread.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      companyId: true,
      participantName: true,
      quoteId: true,
      scoreReasons: true,
      scoredAt: true,
      client: { select: { name: true } },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          direction: true,
          private: true,
          body: true,
          sentAt: true,
          failedReason: true,
        },
      },
    },
  });
}

/**
 * The company's own won and lost conversations, for the few-shot.
 *
 * Scoped by companyId in the WHERE and proved again by assertOneTenant inside
 * buildExamples — the same deliberate doubling the monthly assessment uses,
 * because a stranger's conversation reaching this prompt is a contractor's
 * client list arriving in a competitor's reading.
 *
 * Capped hard, and outcome-judged only: a thread nobody has judged is not an
 * example of anything.
 */
async function loadExamples(companyId, excludeId) {
  const rows = await db.messageThread
    .findMany({
      where: { companyId, outcome: { in: ["won", "lost", "no_reply"] }, id: { not: excludeId } },
      orderBy: { lastMessageAt: "desc" },
      take: 12,
      select: {
        id: true,
        companyId: true,
        outcome: true,
        participantName: true,
        client: { select: { name: true } },
        messages: {
          orderBy: { sentAt: "asc" },
          take: 40,
          select: { direction: true, private: true, body: true, sentAt: true, failedReason: true },
        },
      },
    })
    .catch(() => []);
  return rows.map((r) => ({ ...r, clientName: r.client?.name || null }));
}

/**
 * Score this thread from its own messages, with the stored reading re-applied.
 *
 * Computed, NOT written. A GET that wrote would be a GET that writes under
 * impersonation, which is read-only twice over in this codebase on purpose
 * (AGENTS.md non-negotiable #2) — so the columns are refreshed by the paths
 * that already change something: a message arriving, a reply going out, and the
 * quiet-thread pass of the messaging cron. Both call the SAME
 * scoreConversation(), so the panel and the column cannot disagree about what a
 * conversation means; the column can only be older, by at most one cron tick,
 * and only about silence.
 */
async function scoreNow(companyId, thread, now = new Date()) {
  const context = await scoringContext(companyId, { db });
  const rule = scoreConversation({
    messages: thread.messages,
    now,
    serviceArea: context.serviceArea,
    minimumJobPrice: context.minimumJobPrice,
    quoteSentAt: thread.quoteId ? true : null,
  });
  const storedAi =
    thread.scoreReasons && typeof thread.scoreReasons === "object" ? thread.scoreReasons.ai : null;
  return { rule, scored: applyAiRead(rule, storedAi), storedAi, context };
}

export async function GET(request, { params }) {
  // params is a Promise in Next 16.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = member.id ? await loadEnforceableMember(db, member.id) : member;
  try {
    requireLevel(full, "requests", "view_only", "read messages");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    // A demo thread is computed, not stored. There is nothing to score and
    // nothing to read, and saying so is better than a panel that never fills.
    return NextResponse.json({
      connection,
      score: null,
      available: false,
      reasonKey: "app.messages.temperature.demoUnavailable",
    });
  }

  const thread = await loadThread(member.companyId, id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { scored, storedAi } = await scoreNow(member.companyId, thread);

  if (!isAiConfigured()) {
    // The free score still goes down. The paid layer being unavailable is not
    // a reason to show a blank verdict — it was never the verdict.
    return NextResponse.json({
      connection,
      score: scored,
      available: false,
      reasonKey: "app.messages.temperature.aiUnavailable",
    });
  }

  const stale = aiReadIsStale(storedAi, scored.messageCount);
  const tooShort = scored.messageCount < MIN_MESSAGES_FOR_AI_READ;

  const [quota, examples] = await Promise.all([
    checkAiQuota(member.companyId),
    loadExamples(member.companyId, thread.id),
  ]);

  let price = null;
  try {
    price = estimateReadCost({
      subject: buildSubject({ ...thread, clientName: thread.client?.name || null }),
      examples: buildExamples({
        conversations: examples,
        companyId: member.companyId,
        excludeId: thread.id,
      }),
      model: AI_WRITING_MODEL,
    });
  } catch (err) {
    if (!(err instanceof ConversationReviewTenantError)) throw err;
    console.error("[conversation-temperature] tenant fence tripped:", err.message);
    return NextResponse.json({ error: "That conversation could not be assembled." }, { status: 500 });
  }

  return NextResponse.json({
    connection,
    score: scored,
    available: quota.allowed && stale && !tooShort,
    // ── The moment the corpus's acceptance test is written about ─────────
    //
    // "At the moment each quote goes out." A quote has gone out on this thread
    // and nothing has been read since, so this is when a reading is worth
    // buying — and the screen says so rather than leaving an identical button
    // sitting there on every conversation forever. A NUDGE, not an automatic
    // spend: the person paying still decides.
    recommended: Boolean(thread.quoteId) && quota.allowed && stale && !tooShort,
    ...(tooShort
      ? {
          reasonKey: "app.messages.temperature.tooShort",
          reasonValues: { have: scored.messageCount, need: MIN_MESSAGES_FOR_AI_READ },
        }
      : !stale
        ? { reasonKey: "app.messages.temperature.unchanged" }
        : {}),
    // Quoted BEFORE the click, in the unit the company actually spends. Present
    // even when unavailable: "you cannot afford this" and "this is what it
    // would have cost" belong on screen together.
    price: {
      estimatedTokens: price.promptTokens + price.completionTokens,
      estimated: true,
      remaining: quota.remaining,
      cap: quota.cap,
      allowed: quota.allowed,
      ...(quota.allowed ? {} : { reason: quota.reason }),
    },
    examples: {
      // How much of THIS company's own history the reading will be built from.
      // A read with no examples is a generic read, and the screen says so
      // rather than implying a local one.
      won: examples.filter((e) => e.outcome === "won").length,
      other: examples.filter((e) => e.outcome !== "won").length,
    },
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = member.id ? await loadEnforceableMember(db, member.id) : member;
  try {
    // A rung ABOVE the read, exactly as the monthly assessment is: spending the
    // company's shared allowance is a decision about a company resource.
    requireLevel(full, "requests", "view_create_edit", "read a conversation with AI");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    return NextResponse.json(
      {
        error: "This is a sample conversation, so there is nothing real to read.",
        reasonKey: "app.messages.temperature.demoUnavailable",
      },
      { status: 400 },
    );
  }

  const thread = await loadThread(member.companyId, id);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const { rule, scored, storedAi } = await scoreNow(member.companyId, thread, now);

  // Nothing said since the last reading. Refused rather than re-bought: this is
  // the whole cost control, and a button that quietly charged again for the
  // same answer would be the "appears to work" failure with a bill attached.
  if (!aiReadIsStale(storedAi, scored.messageCount)) {
    return NextResponse.json({ status: "unchanged", score: scored });
  }

  let examples = [];
  try {
    examples = buildExamples({
      conversations: await loadExamples(member.companyId, thread.id),
      companyId: member.companyId,
      excludeId: thread.id,
    });
  } catch (err) {
    if (!(err instanceof ConversationReviewTenantError)) throw err;
    console.error("[conversation-temperature] tenant fence tripped:", err.message);
    return NextResponse.json({ error: "That conversation could not be assembled." }, { status: 500 });
  }

  const result = await readConversationTemperature({
    companyId: member.companyId,
    conversation: { ...thread, clientName: thread.client?.name || null },
    examples,
    ruleScore: rule,
    now,
  });

  if (result.status === "quota") {
    // 402, not 403: they may do this, they have simply used the month's
    // allowance. The free score rides along, because it is still the answer.
    return NextResponse.json(
      {
        error: result.refusal,
        score: scored,
        quota: { cap: result.quota?.cap ?? null, remaining: result.quota?.remaining ?? 0 },
      },
      { status: 402 },
    );
  }

  if (result.status !== "ready") {
    // Too short, or the vendor declined. Nothing is stored and nothing is
    // claimed; the rule score is returned unchanged so the screen never blanks.
    return NextResponse.json({
      status: result.status,
      score: scored,
      ...(result.refusalKey
        ? { reasonKey: result.refusalKey, reasonValues: result.refusalValues }
        : {}),
      ...(result.failure ? { failure: result.failure } : {}),
    });
  }

  const combined = applyAiRead(rule, result.read);
  await db.messageThread.update({
    where: { id: thread.id },
    data: storableScore(combined, { at: now }),
  });

  return NextResponse.json({ status: "ready", score: combined });
}
