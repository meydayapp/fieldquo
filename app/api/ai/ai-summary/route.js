// app/api/ai/ai-summary/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { generateExpenseSummary } from "@/lib/ai/expenseSummary";
import { checkAiQuota } from "@/lib/ai/usage";

// Gated to user:manage — same bar as other financial settings pages (Company
// Settings, Overhead) — since this calls a paid model API on every click and
// surfaces burn-rate/runway numbers that are sensitive by nature.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can generate the AI expense summary" },
      { status: 403 },
    );
  }

  // Checked before spending, same as every other AI feature (AGENTS.md:
  // "checkAiQuota BEFORE, recordAiUsage AFTER... on every path"). This route
  // was the one place that recorded usage without ever having checked it
  // first — a company already over its monthly allowance could keep
  // generating expense summaries indefinitely.
  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, quotaExceeded: true },
      { status: 429 },
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
