// app/api/ai/allowance/route.js
//
// GET — this month's FieldQuo AI use against the company's allowance, for the
// "US$X of US$Y AI used this month" card on Settings → Account & billing
// (app/components/billing/AiAllowance.js).
//
// Read-only, and it asks the very functions the gates ask — checkAiQuota for
// the AI tools' allowance, meterFor("copilot").check() for the assistant's own
// fair-use ceiling — so the card cannot disagree with what the next request
// will be told. Neither check spends or writes anything.
//
// `assistant` is null unless the assistant really is counted apart: when
// /platform/ai-billing puts it back on the company's allowance, its use is
// already inside `allowance`, and a second line would count it twice.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { checkAiQuota, allowanceDisplay } from "@/lib/ai/usage";
import { meterFor } from "@/lib/ai/featurePayer";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const quota = await checkAiQuota(member.companyId);
  let assistant = null;
  try {
    const meter = await meterFor("copilot", { companyId: member.companyId, userId: member.userId || null });
    if (meter.ledger === "fieldquo") assistant = allowanceDisplay(await meter.check());
  } catch (err) {
    // The assistant's line is the secondary one; the allowance still answers.
    console.error("[ai/allowance] assistant meter unreadable:", err?.message);
  }

  return NextResponse.json({
    allowance: allowanceDisplay(quota),
    assistant,
    // "No AI on this account" (a cap of 0) is a statement, not a usage line.
    off: quota.cap === 0,
  });
}
