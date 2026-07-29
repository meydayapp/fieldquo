// app/api/platform/ai-health/route.js
//
// Is the configured model actually available on the key this deployment holds?
//
// ── Why this can't be a script ──────────────────────────────────────────────
//
// scripts/check-ai-model.mjs answers the same question, but it needs the API
// key — and the key is marked Sensitive in Vercel, which means it cannot be
// read back by anyone, including its owner. `vercel env pull` returns nothing
// for it. That's the flag working as intended.
//
// So the check has to run where the key already is. Same reasoning as
// email-health next door: a platform-wide dependency that is invisible from
// inside any single tenant account.
//
// ── The failure it catches ──────────────────────────────────────────────────
//
// lib/ai/provider.js catches every error from the vendor and returns "". That
// is right at runtime — a missing summary must never turn a working page into
// a 500 — but it means a RETIRED MODEL ID looks exactly like a model with
// nothing to say. Quote review, the copilot, digests and website generation
// all go quiet at once, each one degrading politely, and nothing anywhere logs
// a failure. OpenAI retires model IDs on a schedule; gpt-5-mini, which is the
// code default, has already been superseded.
//
// ── Costs a fraction of a cent ──────────────────────────────────────────────
//
// One model list plus one two-token completion. Deliberately NOT metered into
// AiUsage: that table attributes spend to a company, and this belongs to no
// company. A platform diagnostic showing up as a tenant's usage would be a
// small lie in the one place the numbers have to be trustworthy.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { AI_MODEL, AI_WRITING_MODEL } from "@/lib/ai/provider";
import { hasKnownPricing } from "@/lib/ai/usage";

// Ordered by fitness for THIS workload, not by capability. Almost every call
// FieldQuo makes is "pick one of six tools, then write two sentences about
// numbers that were already computed in code" — a mini model does that as well
// as a flagship one for a tenth of the price.
const PREFERRED = [
  "gpt-5.4-mini",
  "gpt-5-mini",
  "gpt-5.4",
  "gpt-5.5",
  "gpt-5",
  "gpt-4o-mini",
  "gpt-4o",
];

async function openai(path, init) {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    // Without this a hung vendor request hangs the platform dashboard.
    signal: AbortSignal.timeout(15_000),
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

/** One real completion. Listing a model isn't proof it will answer. */
async function probe(model) {
  // Reasoning models spend this budget thinking before emitting anything, so a
  // tight limit returns empty and reads as a failure. Same note as provider.js.
  const reasoning = /^(gpt-5|o[1-9])/.test(model);
  const res = await openai("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      max_completion_tokens: reasoning ? 2000 : 20,
      ...(reasoning ? { reasoning_effort: "low" } : {}),
    }),
  });

  return {
    ok: res.ok,
    status: res.status,
    reply: res.body?.choices?.[0]?.message?.content?.trim() || null,
    error: res.ok ? null : res.body?.error?.message || `HTTP ${res.status}`,
  };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = Boolean(process.env.OPENAI_API_KEY);
  if (!configured) {
    return NextResponse.json({
      healthy: false,
      configured: false,
      model: AI_MODEL,
      problem:
        "OPENAI_API_KEY isn't set on this deployment. Every AI feature returns nothing, quietly — there is no error to find in the logs.",
    });
  }

  const list = await openai("/models").catch((err) => ({
    ok: false,
    status: 0,
    body: { error: { message: err?.message } },
  }));

  if (!list.ok) {
    return NextResponse.json({
      healthy: false,
      configured: true,
      model: AI_MODEL,
      // 401 is a rejected key, not a bad model. Separated because the fix is
      // completely different and conflating them wastes an afternoon.
      problem:
        list.status === 401
          ? "The OpenAI key is being rejected. Nothing else here matters until it's replaced."
          : `Couldn't reach OpenAI to list models (${list.status || "network error"}). ${list.body?.error?.message || ""}`.trim(),
    });
  }

  const available = new Set((list.body.data || []).map((m) => m.id));
  const listed = available.has(AI_MODEL);
  const result = await probe(AI_MODEL);

  // The writing model only matters if it's been set to something different.
  const writingDiffers = AI_WRITING_MODEL !== AI_MODEL;
  const writing = writingDiffers
    ? { model: AI_WRITING_MODEL, listed: available.has(AI_WRITING_MODEL) }
    : null;

  const usable = PREFERRED.filter((m) => available.has(m));
  const healthy = listed && result.ok && (!writing || writing.listed);

  return NextResponse.json({
    healthy,
    configured: true,
    model: AI_MODEL,
    listed,
    probe: result,
    writing,
    usable,
    // Cost reports fall back to an estimate when a model isn't in the pricing
    // table, so an unpriced model means the numbers in Settings → AI usage are
    // a guess. Worth surfacing here rather than discovering it in a report.
    pricingKnown: hasKnownPricing(AI_MODEL),
    recommended: listed ? null : usable[0] || null,
    problem: describe({ listed, result, writing, usable, model: AI_MODEL }),
  });
}

function describe({ listed, result, writing, usable, model }) {
  if (!listed) {
    return (
      `"${model}" isn't available on this key — most likely retired. ` +
      `Quote review, the copilot, digests and website generation are all returning nothing, ` +
      `and none of them are logging an error, because provider.js catches the failure and ` +
      `degrades quietly. ` +
      (usable[0]
        ? `Set OPENAI_MODEL=${usable[0]}, or change the default in lib/ai/provider.js.`
        : `None of the expected models are available on this key either.`)
    );
  }
  if (!result.ok) {
    return `"${model}" is listed but rejected the request: ${result.error}. Being listed isn't the same as being usable on this account.`;
  }
  if (writing && !writing.listed) {
    return `OPENAI_WRITING_MODEL is set to "${writing.model}", which isn't available on this key. Website copy will fail and fall back to the factual draft. Unset it to use ${model} for everything.`;
  }
  return null;
}
