// app/api/sales/demo/route.js
//
// The demo tenant a rep shows a prospect, from the rep's side.
//
// ══ Why a rep cannot use "Run the demo" ═══════════════════════════════════
//
// The platform console opens a demo through IMPERSONATION, which is
// superadmin-only and read-only — non-negotiable #2, enforced in middleware
// and again in lib/currentMember.js, deliberately twice. A rep impersonating a
// demo company could not write a quote, and watching a quote get written is
// the only part of a demo a prospect cares about.
//
// So the rep signs into the demo company for real, with the login a superadmin
// set on it. This route does not mint that login and cannot: creating users is
// invite-only (non-negotiable #1), and the one exception —
// /api/platform/demo/login — is superadmin-gated and derives the address from
// the slug so it cannot mint one for an arbitrary email. A rep asking for a
// password gets told who to ask.
//
// ══ What a rep MAY do to their own demo ═══════════════════════════════════
//
// Reset it, and change which trade it is set up as. Both are destructive to a
// fixture and harmless to everybody else, and both are scoped by
// repDemoWhere() — which matches one id and asserts isDemo, so a rep cannot
// reset another rep's demo mid-walkthrough or touch a real tenant.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { repDemoWhere } from "@/lib/sales/scope";
import { applyIndustry, resetDemo } from "@/lib/demo/seedDemo";
import { INDUSTRIES } from "@/lib/demo/industries";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/** The rep's demo, or null — never another rep's, and never a real tenant. */
async function myDemo(rep) {
  if (!rep.demoCompanyId) return null;
  return db.company.findFirst({
    where: repDemoWhere(rep.demoCompanyId),
    select: { id: true, name: true, slug: true, industry: true, isDemo: true },
  });
}

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const company = await myDemo(rep);
  return NextResponse.json({
    company,
    // The address the login was created against, derived the same way
    // /api/platform/demo/login derives it. Shown so a rep knows what to type;
    // the PASSWORD is not here and cannot be, which the screen says plainly
    // rather than leaving a rep guessing why sign-in fails.
    loginEmail: company ? `${company.slug}@fieldquo.com` : null,
    industries: Object.entries(INDUSTRIES).map(([key, v]) => ({ key, label: v.label })),
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const company = await myDemo(rep);
  if (!company) {
    return bad(
      "No demo company is assigned to you yet. A superadmin assigns one on /platform/demo — " +
        "there is no self-serve path, because a demo is a real tenant FieldQuo owns.",
      409,
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();

  if (action === "reset") {
    // seedDemo re-reads the company and refuses anything without isDemo, so the
    // guard is in one place and this route adds none of its own beyond scope.
    await resetDemo(company.id);
    return NextResponse.json({ ok: true, company: await myDemo(rep) });
  }

  if (action === "industry") {
    const key = String(body?.industry ?? "").trim();
    if (!INDUSTRIES[key]) return bad("That is not one of the trades a demo can be set up as.");
    await applyIndustry(company.id, key);
    return NextResponse.json({ ok: true, company: await myDemo(rep) });
  }

  return bad('Expected "reset" or "industry".');
}
