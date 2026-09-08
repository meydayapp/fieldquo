// app/api/ai-employee/test/route.js
//
// The test box: type what a customer would write, see exactly what the
// employee would answer, and which of your own documents it used.
//
// ══ This is the honesty mechanism, so it runs the real path ════════════════
//
// It calls respondToMessage() — the same function an inbound Facebook message
// calls, with the same prompt, the same role preset, the same source selection
// and the same tools. `dryRun` changes exactly two things and both are named
// in lib/aiEmployee/tools.js: the two tools with SIDE EFFECTS return what they
// would have done instead of doing it, and nothing is written or sent.
//
// A separate "preview" implementation would be the reassuring version of this
// screen and a worthless one: it would show a contractor an answer produced by
// code that never runs in production, which is the failure AGENTS.md's first
// rule describes with a demo attached.
//
// It still costs AI credit, because it really does call the model. The screen
// says so beside the button, and checkAiQuota runs first like everywhere else.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { respondToMessage } from "@/lib/aiEmployee/respond";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can test the AI employee." },
      { status: 403 },
    );
  }

  // A real model call per press. Rate limited for the same reason
  // lib/ai/usage.js exists at all: this is the one button in the product that
  // spends money and invites being pressed repeatedly.
  const limited = rateLimit(request, "ai-employee-test", {
    limit: 20,
    windowMs: 60 * 1000,
    message: "That's a lot of tests in a minute — give it a moment.",
  });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Type a customer message first." }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "That's longer than a message can be." }, { status: 400 });
  }

  const result = await respondToMessage({
    companyId: member.companyId,
    dryRun: true,
    testText: text,
  });

  return NextResponse.json({
    // Null when it would have answered. A named reason otherwise — the same
    // reasons a real message would be refused for, which is the point of
    // running the real decision here.
    reason: result.reason || null,
    mode: result.mode,
    text: result.text || null,
    // Named, so a contractor can see WHICH of their documents an answer came
    // from. An answer with no sources beside it is an answer from the role's
    // own instructions, and that difference is worth seeing.
    sources: result.sources || [],
    tools: result.tools || [],
    handedOff: Boolean(result.handedOff),
    costCents: result.costCents || 0,
  });
}
