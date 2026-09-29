// app/api/dashboard/focus/route.js
//
// PATCH { signupPriority, signupFocus } — "What should your dashboard focus
// on?", for a company that never answered the welcome questions (every
// company from before 2026-09-29) and for "Change focus" afterwards.
//
// Why not PATCH /api/signup/personalize: that endpoint is the welcome FLOW —
// it refuses a company that is not on it (`not_on_flow`) and one that has
// finished it (`already_personalized`), walks the steps in order, and
// recomputes onboardingStep. None of that applies here. What IS shared is the
// meaning of the two columns, so the validation is the same rule:
// lib/dashboard/focus.js cleanFocusChoice keeps only focus keys the priority
// offers, in the order lib/signup/welcome.js lists them — what
// readWelcomeAnswer does — so a company answering here and one answering at
// signup store the same shape.
//
// Idempotent: the same body twice writes the same row twice. Writes the two
// columns and nothing else — never personalizedAt or onboardingStep, which
// belong to the flow and would move a company onto or off it.
//
// Owner or admin. Never a support session: middleware.js refuses the PATCH
// first, and this is the second refusal (non-negotiable #2).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { cleanFocusChoice } from "@/lib/dashboard/focus";

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "A support session is read-only.", code: "read_only" }, { status: 403 });
  }
  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json(
      { error: "Only the owner or an admin can change what the dashboard focuses on.", code: "not_admin" },
      { status: 403 },
    );
  }
  const body = await request.json().catch(() => null);
  const choice = cleanFocusChoice({ priority: body?.signupPriority, focus: body?.signupFocus });
  if (!choice.priority) {
    return NextResponse.json({ error: "Pick what matters most right now.", code: "priority", field: "signupPriority" }, { status: 400 });
  }
  await db.company.update({
    where: { id: member.companyId },
    data: { signupPriority: choice.priority, signupFocus: choice.focus },
  });
  return NextResponse.json({ ok: true, signupPriority: choice.priority, signupFocus: choice.focus });
}
