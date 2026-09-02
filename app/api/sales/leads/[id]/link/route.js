// app/api/sales/leads/[id]/link/route.js
//
// "This prospect is that company." The join that stops the pipeline and the
// commission ledger being two lists that disagree.
//
// ══ What this writes, and what it deliberately does not ════════════════════
//
// It writes SalesLead.convertedCompanyId — a field on the rep's own note about
// a prospect. It does NOT write SalesAttribution, and cannot: attribution is
// who gets PAID, it is captured and locked by lib/sales/attribution.js at
// signup, and lib/sales/gate.js's REP_FORBIDDEN_WRITES lists it first precisely
// because a rep who can write it is a rep who can pay themselves.
//
// So the direction of trust runs one way. A company may only be named here if
// it is ALREADY attributed to this rep — the attribution is the fact, and this
// link is the rep's own bookkeeping catching up to it. A rep cannot invent the
// connection, and linking the wrong company gains them nothing, because nothing
// downstream reads this field for money.
//
// ══ Why the candidate list is a GET on the same route ══════════════════════
//
// The screen has to offer the rep something to choose from, and the only safe
// source for that list is the same scoping rule the POST enforces. One route,
// one predicate, read and write — so the list can never offer a company the
// write would then refuse.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { leadWhere } from "@/lib/sales/outreach";
import { assignedCompanyWhere } from "@/lib/sales/scope";

/**
 * The companies this rep brought in that no lead claims yet.
 *
 * REP_COMPANY_SELECT is not reused here on purpose: this list answers "which of
 * my signups is this prospect?", so it needs the name, when they signed up, and
 * whether the row is a demo — and nothing about their billing state, which is a
 * different screen's question.
 */
async function candidates(repId) {
  const companies = await db.company.findMany({
    where: assignedCompanyWhere(repId),
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, email: true, createdAt: true, isDemo: true },
  });
  if (!companies.length) return [];

  const claimed = await db.salesLead.findMany({
    where: { convertedCompanyId: { in: companies.map((c) => c.id) } },
    select: { convertedCompanyId: true },
  });
  const taken = new Set(claimed.map((l) => l.convertedCompanyId));

  return companies.filter((c) => !taken.has(c.id));
}

export async function GET(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const lead = await db.salesLead.findFirst({
    where: leadWhere(rep.id, id),
    select: { id: true, email: true, convertedCompanyId: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const rows = await candidates(rep.id);
  const leadEmail = String(lead.email || "").toLowerCase();

  return NextResponse.json({
    // `matchesEmail` is a HINT for the rep's eyes, never an automatic link. The
    // rep is the one who knows whether the Northline that signed up is the
    // Northline they called; an address match is evidence, not a decision, and
    // auto-linking on it would quietly rewrite their pipeline.
    candidates: rows.map((c) => ({
      ...c,
      matchesEmail: Boolean(leadEmail) && String(c.email || "").toLowerCase() === leadEmail,
    })),
    convertedCompanyId: lead.convertedCompanyId,
  });
}

export async function POST(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const companyId = typeof body?.companyId === "string" ? body.companyId : "";
  if (!companyId) {
    return NextResponse.json({ error: "Pick the company that signed up." }, { status: 400 });
  }

  const lead = await db.salesLead.findFirst({
    where: leadWhere(rep.id, id),
    select: { id: true, convertedCompanyId: true, status: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (lead.convertedCompanyId) {
    return NextResponse.json(
      { error: "This lead is already linked to a company." },
      { status: 409 },
    );
  }

  // Re-read at write time from the attribution itself, never from the candidate
  // list the browser was shown — that list could be minutes old, and an
  // attribution correction by a superadmin in between is exactly the case this
  // has to notice. Same rule as lib/migrations/state.js's canWrite().
  const company = await db.company.findFirst({
    where: { id: companyId, ...assignedCompanyWhere(rep.id) },
    select: { id: true, name: true },
  });
  if (!company) {
    return NextResponse.json(
      {
        error:
          "That company isn't attributed to you, so it can't be linked. If you " +
          "brought them in, ask a superadmin to correct the attribution first.",
      },
      { status: 403 },
    );
  }

  try {
    const { count } = await db.salesLead.updateMany({
      // Both halves again, plus `convertedCompanyId: null` — which makes this
      // a compare-and-set rather than a read-then-write, so two clicks a
      // moment apart cannot both win.
      where: { ...leadWhere(rep.id, id), convertedCompanyId: null },
      data: {
        convertedCompanyId: company.id,
        convertedAt: new Date(),
        // A signup IS the pipeline reaching its end. Set rather than left to
        // the rep to remember, because a lead that converted and still reads
        // "contacted" is the disagreement this whole route exists to remove.
        status: "signed",
      },
    });
    if (!count) {
      return NextResponse.json({ error: "This lead is already linked." }, { status: 409 });
    }
  } catch (err) {
    // convertedCompanyId is @unique across every rep's leads, so the database
    // is the real arbiter of "one lead per company" — including against a lead
    // belonging to a DIFFERENT rep, which this rep must not be told about.
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "That company is already linked to a lead." },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({ linked: { companyId: company.id, name: company.name } });
}
