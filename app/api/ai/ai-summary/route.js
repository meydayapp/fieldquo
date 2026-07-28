// app/api/expenses/ai-summary/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { generateExpenseSummary } from "@/lib/ai/expenseSummary";

// Gated to user:manage — same bar as other financial settings pages (Company
// Settings, Overhead) — since this calls a paid model API on every click and
// surfaces burn-rate/runway numbers that are sensitive by nature.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can generate the AI expense summary" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));

  try {
    const { summaryText, flags } = await generateExpenseSummary({
      companyId: member.companyId,
      month: body?.month,
    });
    return NextResponse.json({ summaryText, flags });
  } catch (err) {
    console.error("[expenses/ai-summary]", err);
    return NextResponse.json(
      { error: "Could not generate the AI summary right now" },
      { status: 500 },
    );
  }
}
