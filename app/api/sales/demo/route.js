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
// lib/demo/demoLogin.js, reached through /api/platform/demo/* — is
// superadmin-gated and derives the address from the slug so it cannot mint one
// for an arbitrary email. A rep asking for a password gets told who to ask.
//
// ══ What a rep MAY do to their own demo ═══════════════════════════════════
//
// CLAIM a free one, reset it, and change which trade it is set up as.
//
// Claiming is new, and it is the half that was missing. The rep screen has
// always said "ask a FieldQuo admin to assign you one — it takes them a
// click", and there was no such click: SalesRep.demoCompanyId was read in
// three places and written in none, on either side of the product. So the
// sentence was a control that appeared to work and did not, in its
// documentation form. A rep now takes a free one themselves — which creates no
// user, mints no credential, and touches no company row (see
// lib/sales/demoAssign.js) — and a superadmin can still assign and release on
// /platform/demo.
//
// Reset and industry are scoped by repDemoWhere() — which matches one id and
// asserts isDemo, so a rep cannot reset another rep's demo mid-walkthrough or
// touch a real tenant.
//
// ══ Why POST no longer rides requireSalesRep ══════════════════════════════
//
// Because it never worked. requireSalesRep() refuses every non-GET method
// under /api/sales — correctly, that is its whole job — so Reset and the trade
// picker both returned 403 "The sales portal is read-only" for as long as they
// have existed. Nobody hit it because those controls only render for a rep who
// has a demo, and until today nobody could have one. POST now goes through
// lib/sales/demoGate.js's requireDemoRep, the narrow named exception, which
// lists exactly what it permits.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { requireDemoRep } from "@/lib/sales/demoGate";
import { repDemoWhere } from "@/lib/sales/scope";
import { claimDemoForRep, demoPoolCounts } from "@/lib/sales/demoAssign";
import { claimRefusal } from "@/lib/sales/demoPool";
import { demoLoginReady } from "@/lib/demo/demoLogin";
import { applyIndustry, resetDemo } from "@/lib/demo/seedDemo";
import { INDUSTRIES } from "@/lib/demo/industries";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/**
 * The rep's demo, or null — never another rep's, and never a real tenant.
 *
 * `demoIndustry`, not `industry`. Company has no `industry` column and never
 * has; this select named one, so this whole route threw a Prisma validation
 * error for any rep who had a demo. That was invisible for the same reason
 * everything else here was: nobody had one.
 */
async function myDemo(rep) {
  if (!rep?.demoCompanyId) return null;
  return db.company.findFirst({
    where: repDemoWhere(rep.demoCompanyId),
    select: { id: true, name: true, slug: true, demoIndustry: true, isDemo: true },
  });
}

/**
 * Everything the screen needs to know which of its three states it is in.
 *
 * The three are real and different: no demo yet, a demo with no login on it,
 * and a demo a rep can actually sign into. A screen that collapsed the middle
 * one would render a sign-in control against an address no account exists
 * for — which fails at the password box with no explanation, mid-call.
 */
async function demoState(rep) {
  const company = await myDemo(rep);
  if (!company) {
    return { company: null, loginEmail: null, loginReady: false, pool: await demoPoolCounts() };
  }
  const login = await demoLoginReady({ companyId: company.id, slug: company.slug });
  return {
    company,
    loginEmail: login.email,
    loginReady: login.ready,
    pool: await demoPoolCounts(),
  };
}

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const state = await demoState(rep);
  return NextResponse.json({
    ...state,
    industries: Object.entries(INDUSTRIES).map(([key, v]) => ({ key, label: v.label })),
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireDemoRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();

  // Claim comes FIRST, before the "you have no demo" refusal below — it is the
  // one action whose whole purpose is to be reachable without one.
  if (action === "claim") {
    const decision = await claimDemoForRep(rep.id);
    const no = claimRefusal(decision);
    if (no) return bad(no.error, no.status);

    // Idempotent on purpose: a rep who already had one gets theirs back rather
    // than a second. `claimed` says which happened, so the screen can say
    // "here it is" instead of announcing a claim that did not occur.
    const fresh = await db.salesRep.findUnique({
      where: { id: rep.id },
      select: { id: true, demoCompanyId: true },
    });
    return NextResponse.json({
      ok: true,
      claimed: decision.claimed === true,
      ...(await demoState(fresh)),
    });
  }

  const company = await myDemo(rep);
  if (!company) {
    return bad(
      "No demo company is assigned to you yet. Claim a free one from the demo " +
        "screen, or ask a FieldQuo superadmin to assign you a particular one on " +
        "/platform/demo.",
      409,
    );
  }

  if (action === "reset") {
    // seedDemo re-reads the company and refuses anything without isDemo, so the
    // guard is in one place and this route adds none of its own beyond scope.
    await resetDemo(company.id);
    return NextResponse.json({ ok: true, ...(await demoState(rep)) });
  }

  if (action === "industry") {
    const key = String(body?.industry ?? "").trim();
    if (!INDUSTRIES[key]) return bad("That is not one of the trades a demo can be set up as.");
    await applyIndustry(company.id, key);
    return NextResponse.json({ ok: true, ...(await demoState(rep)) });
  }

  return bad('Expected "claim", "reset" or "industry".');
}
