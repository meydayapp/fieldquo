// app/api/ai/copilot/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { askCopilot } from "@/lib/ai/copilotClient";

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

  const result = await askCopilot({ companyId: member.companyId, messages });
  return NextResponse.json({ text: result.text });
}
