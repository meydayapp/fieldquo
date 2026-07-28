// app/api/ai/copilot/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { askCopilot } from "@/lib/ai/copilotClient";
import { isAiConfigured, AI_MODEL } from "@/lib/ai/provider";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  try {
    const result = await askCopilot({ companyId: member.companyId, messages });
    return NextResponse.json({ text: result.text });
  } catch (err) {
    // Rate limits, quota exhaustion, a revoked key: all things the person
    // reading this can act on, and none of them should look like a crash.
    console.error("[ai/copilot]", err);

    const status = err?.status || err?.response?.status;
    const message =
      status === 401
        ? "The OpenAI key was rejected. Check OPENAI_API_KEY."
        : status === 429
          ? "FieldQuo AI is rate-limited or out of credit right now. Try again shortly."
          : `FieldQuo AI couldn't answer (${AI_MODEL}). ${err?.message || ""}`.trim();

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
