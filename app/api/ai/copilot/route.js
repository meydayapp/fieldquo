// app/api/ai/copilot/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { askCopilot } from "@/lib/ai/copilotClient";
import { isAiConfigured, AI_MODEL } from "@/lib/ai/provider";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { messages } = await request.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages array required" },
      { status: 400 },
    );
  }

  // Say so plainly before spending a request. Without this the call reaches
  // the SDK, throws on a missing key, and Next returns a 500 HTML page — which
  // the browser then fails to parse as JSON and reports as a parser error,
  // telling the user nothing about the actual cause.
  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error:
          "FieldQuo AI isn't switched on for this deployment yet — OPENAI_API_KEY is missing.",
      },
      { status: 503 },
    );
  }

  // Checked BEFORE the call, not after. Recording after only tells you what
  // you already spent — this is the part that stops a scripted loop turning
  // into an unbounded bill on FieldQuo's card.
  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, quotaExceeded: true },
      { status: 429 },
    );
  }

  try {
    const result = await askCopilot({
      companyId: member.companyId,
      messages,
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "copilot",
          userId: member.userId,
          ...u,
        }),
    });

    return NextResponse.json({
      text: result.text,
      // Surfaced so the UI can warn at 80% rather than letting someone hit a
      // wall with no notice. A limit you were told about is a limit; one you
      // discover is a bug.
      usage: quota.cap
        ? {
            used: quota.usage.tokens,
            cap: quota.cap,
            nearLimit: quota.nearLimit,
          }
        : null,
    });
  } catch (err) {
    // Rate limits, quota exhaustion, a revoked key: all things the person
    // reading this can act on, and none of them should look like a crash.
    console.error("[ai/copilot]", err);

    const status = err?.status || err?.response?.status;
    const code = err?.code || err?.error?.code;

    // A 429 means two completely different things and they need opposite
    // responses. `insufficient_quota` is "the account has no credit" — waiting
    // achieves nothing, someone has to go and add funds. Genuine rate limiting
    // resolves on its own. Lumping them together sends people to sit and wait
    // for a problem that will never clear.
    const message =
      status === 401
        ? "The OpenAI key was rejected. Check OPENAI_API_KEY in your Vercel settings."
        : code === "insufficient_quota"
          ? "The OpenAI account has no credit. API usage is prepaid and separate from any ChatGPT subscription — add a payment method and buy credits at platform.openai.com/settings/organization/billing."
          : status === 429
            ? "FieldQuo AI is being rate-limited. Wait a few seconds and try again."
            : code === "model_not_found"
              ? `The model "${AI_MODEL}" isn't available on this OpenAI account. Set OPENAI_MODEL to one that is.`
              : `FieldQuo AI couldn't answer. ${err?.message || ""}`.trim();

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
