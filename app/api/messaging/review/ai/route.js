// app/api/messaging/review/ai/route.js
//
// The AI half of the month-end read — the thing app/api/messaging/review/route.js
// deliberately left out.
//
// That file's own header says why it stopped where it did: "The obvious next
// feature is 'summarise what the won conversations did differently'. It is not
// here, because it would be a metered model call and every one of those in this
// codebase goes through lib/ai/provider.js with checkAiQuota before and
// recordAiUsage after, and is labelled to the contractor as a paid action.
// Half-doing that — a summary that quietly spends somebody's allowance — is
// worse than not having it."
//
// This is that feature, done the whole way. It is a SEPARATE route rather than
// a flag on that one for two reasons: the free report must keep loading when
// this refuses, and the two have different gates — reading counts is
// requests:view_only, spending a company's AI allowance is not.
//
// ══ The two verbs ══════════════════════════════════════════════════════════
//
//   GET   what this month WOULD cost, whether it can be assessed at all, and
//         the stored review if one exists. Spends nothing, ever. This is what
//         lets a person agree to the price before the click rather than
//         discover it afterwards.
//   POST  generate. Quota-checked before, metered after, stored with what it
//         cost. Upserts on (company, year, month): asking twice replaces the
//         answer rather than filing a second one.
//
// ══ What "the cost" means here ═════════════════════════════════════════════
//
// Not dollars. A contractor does not pay OpenAI — FieldQuo does — and what the
// contractor actually spends is their monthly AI allowance, in tokens
// (lib/ai/usage.js). So the price quoted before the click is in the units the
// person is spending, next to what they have left. The dollar figure is
// FieldQuo's own cost and is recorded on the row for the platform's AI-usage
// view, which is the only place it means anything.
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
import { monthRange } from "@/lib/messaging/monthlyReview";
import { loadMonthlyConversations } from "@/lib/attribution/loadMonthlyConversations";
import { checkAiQuota } from "@/lib/ai/usage";
import { AI_WRITING_MODEL, isAiConfigured } from "@/lib/ai/provider";
import {
  buildConversationReview,
  buildSample,
  estimateReviewCost,
  reviewEligibility,
  ConversationReviewTenantError,
  MIN_CONVERSATIONS_FOR_REVIEW,
  MIN_WON_FOR_PATTERN,
} from "@/lib/ai/conversationReview";

/** Year and month off the query string, defaulting to now. Shared by both verbs. */
function periodFrom(request) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getUTCFullYear();
  const month = Number(searchParams.get("month")) || now.getUTCMonth() + 1;
  return { year, month, range: monthRange(year, month) };
}

/** The label the model is given. English on purpose — it is prompt text, not UI. */
const labelFor = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** The stored row for one company-month, shaped for the browser. */
async function storedReview(companyId, year, month) {
  const row = await db.conversationReview.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
  if (!row) return null;
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    generatedAt: row.generatedAt,
    status: row.status,
    sampleSize: row.sampleSize,
    wonSampled: row.wonSampled,
    findings: row.findings,
    // Tokens, because that is what the company spent. costMicros is FieldQuo's
    // vendor cost and stays out of a tenant-facing payload — it is not their
    // number and it is not their currency.
    tokens: row.promptTokens + row.completionTokens,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = member.id ? await loadEnforceableMember(db, member.id) : member;
  try {
    requireLevel(full, "requests", "view_only", "read the message review");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const { year, month, range } = periodFrom(request);
  if (!range) return NextResponse.json({ error: "Unknown month." }, { status: 400 });

  const review = await storedReview(member.companyId, year, month);

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    // A demo tenant's conversations are fixtures. Assessing them would spend
    // real allowance on invented text and hand back advice about people who do
    // not exist — see lib/messaging/demoThreads.js. Refused by name rather
    // than by a disabled button with no explanation.
    return NextResponse.json({
      connection,
      review,
      available: false,
      reasonKey: "app.messages.aiReview.demoUnavailable",
    });
  }

  if (!isAiConfigured()) {
    return NextResponse.json({
      connection,
      review,
      available: false,
      reasonKey: "app.messages.aiReview.aiUnavailable",
    });
  }

  // The whole month, loaded to answer two questions that must both be honest
  // BEFORE anything is spent: can this month be assessed at all, and what will
  // it cost. Neither is guessable from a count.
  const loaded = await loadMonthlyConversations({
    db,
    companyId: member.companyId,
    year,
    month,
  });
  if (!loaded.ok) return NextResponse.json({ error: "Unknown month." }, { status: 400 });

  const sample = buildSample({ conversations: loaded.threads, companyId: member.companyId });
  const eligible = reviewEligibility(sample);
  const [quota, price] = await Promise.all([
    checkAiQuota(member.companyId),
    Promise.resolve(
      estimateReviewCost({ sample, monthLabel: labelFor(year, month), model: AI_WRITING_MODEL }),
    ),
  ]);

  return NextResponse.json({
    connection,
    review,
    available: eligible.ok && quota.allowed,
    ...(eligible.ok ? {} : { reasonKey: eligible.reasonKey, reasonValues: eligible.reasonValues }),
    // Present even when unavailable: "you cannot afford this" and "this is what
    // it would have cost" belong on screen together.
    price: {
      estimatedTokens: price.promptTokens + price.completionTokens,
      estimated: true,
      remaining: quota.remaining,
      cap: quota.cap,
      allowed: quota.allowed,
      ...(quota.allowed ? {} : { reason: quota.reason }),
    },
    sample: {
      scored: sample.scoredCount,
      won: sample.wonCount,
      unmatched: sample.unmatched,
      minConversations: MIN_CONVERSATIONS_FOR_REVIEW,
      minWon: MIN_WON_FOR_PATTERN,
    },
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = member.id ? await loadEnforceableMember(db, member.id) : member;
  try {
    // A rung ABOVE the read. Generating spends the company's shared monthly AI
    // allowance, which is a decision about a company resource — the same reason
    // the deep photo read is not on the same gate as opening a quote.
    requireLevel(full, "requests", "view_create_edit", "run the AI conversation review");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const { year, month, range } = periodFrom(request);
  if (!range) return NextResponse.json({ error: "Unknown month." }, { status: 400 });

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    return NextResponse.json(
      { error: "Demo conversations can't be assessed — they aren't real messages.", reasonKey: "app.messages.aiReview.demoUnavailable" },
      { status: 400 },
    );
  }

  const loaded = await loadMonthlyConversations({
    db,
    companyId: member.companyId,
    year,
    month,
  });
  if (!loaded.ok) return NextResponse.json({ error: "Unknown month." }, { status: 400 });

  let built;
  try {
    built = await buildConversationReview({
      companyId: member.companyId,
      year,
      month,
      monthLabel: labelFor(year, month),
      rollup: loaded.rollup,
      conversations: loaded.threads,
    });
  } catch (err) {
    if (err instanceof ConversationReviewTenantError) {
      // Never reachable through a correct query — which is exactly why it is
      // logged loudly and answered as the server error it is, rather than
      // quietly dropping the row and returning a review computed over a subset
      // nobody knows about.
      console.error("[conversation-review] tenant fence tripped:", err.message);
      return NextResponse.json({ error: "That month could not be assembled." }, { status: 500 });
    }
    throw err;
  }

  // Over the monthly allowance. 402, not 403: they may do this, they just have
  // no allowance left this month — the same status and the same sentence every
  // other capped AI surface answers with. Nothing is stored: a refusal for want
  // of allowance is not a review, and writing one would occupy the
  // company-month row a real review needs later.
  if (built.status === "quota") {
    return NextResponse.json(
      {
        error: built.refusal,
        quota: { cap: built.quota?.cap ?? null, remaining: built.quota?.remaining ?? 0 },
      },
      { status: 402 },
    );
  }

  const row = await db.conversationReview.upsert({
    where: { companyId_year_month: { companyId: member.companyId, year, month } },
    create: {
      companyId: member.companyId,
      year,
      month,
      generatedByUserId: member.userId || null,
      status: built.status,
      model: built.model,
      promptTokens: built.promptTokens,
      completionTokens: built.completionTokens,
      costMicros: built.costMicros,
      sampleSize: built.sampleSize,
      wonSampled: built.wonSampled,
      findings: built.findings,
    },
    update: {
      generatedAt: new Date(),
      generatedByUserId: member.userId || null,
      status: built.status,
      model: built.model,
      promptTokens: built.promptTokens,
      completionTokens: built.completionTokens,
      costMicros: built.costMicros,
      sampleSize: built.sampleSize,
      wonSampled: built.wonSampled,
      findings: built.findings,
    },
  });

  return NextResponse.json({
    review: {
      id: row.id,
      year: row.year,
      month: row.month,
      generatedAt: row.generatedAt,
      status: row.status,
      sampleSize: row.sampleSize,
      wonSampled: row.wonSampled,
      findings: row.findings,
      tokens: row.promptTokens + row.completionTokens,
    },
  });
}
