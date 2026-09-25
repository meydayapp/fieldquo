// app/api/sales/signups/route.js
//
// GET — "Your signups": every signup that came in on THIS rep's link, with
// the facts the owner reads on /platform/signups and the welcome-call prompt.
//
// ══ What is a rep's, and why nothing else is here ══════════════════════════
//
// Two shapes, both already the rep's by a rule older than this route:
//
//   finished   a Company whose SalesAttribution names this rep — the same
//              `assignedCompanyWhere` the rep's book (/api/sales/companies)
//              is read through, and the ONLY tenant boundary in front of a
//              rep reading a Company. Facts off the row: signed up when, card
//              or not, first quote or not, stalled or not
//              (lib/signup/leads.js stalledDecision — the same reading the
//              owner's badge turns on).
//   unfinished a SignupLead the cron promoted to this rep's own SalesLead
//              because `?sales=<their code>` was on the link
//              (lib/signup/salesFloor.js promoteSignupLeads, "rep_lead").
//
// A signup NOBODY referred is not here and never will be: it is the owner's
// to hand out from the review folder, and it reaches a rep through their
// queue, not through this list.
//
// ══ Read-only ═════════════════════════════════════════════════════════════
//
// requireSalesRep refuses anything but a read before the handler runs.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { assignedCompanyWhere } from "@/lib/sales/scope";
import { CHECKOUT_GRACE_MS } from "@/lib/signup/setupGate";
import { STEP_LABELS, signupFact, stalledDecision, tradeLabelFor } from "@/lib/signup/leads";
import { companyFactsOf } from "@/lib/signup/salesFloor";
import { signupOpenerFor } from "@/lib/sales/playbook/signupOpener";
import { repPublicName } from "@/lib/sales/repIdentity";
import { normalizeScriptLanguage } from "@/lib/sales/intel/callScript";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();

  const [companies, leads] = await Promise.all([
    db.company.findMany({
      where: { ...assignedCompanyWhere(rep.id), isDemo: false },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, name: true, city: true, province: true, industries: true, defaultLanguage: true, createdAt: true, isDemo: true, trialEndsAt: true,
        subscription: { select: { id: true, status: true } },
        salesAttribution: { select: { salesRepId: true, capturedAt: true } },
        quotes: { where: { sentAt: { not: null } }, orderBy: { sentAt: "asc" }, take: 1, select: { sentAt: true } },
        members: { where: { role: "owner" }, take: 1, select: { user: { select: { name: true } } } },
      },
    }),
    db.signupLead.findMany({
      where: { referredRepId: rep.id, promotedLeadId: { not: null }, completedCompanyId: null },
      orderBy: { lastSeenAt: "desc" },
      take: 100,
      select: {
        id: true, firstName: true, lastName: true, companyName: true, phoneE164: true, city: true, province: true, trades: true, language: true,
        stepReached: true, startedAt: true, lastSeenAt: true, promotedLeadId: true, prospectId: true,
      },
    }),
  ]);

  // This rep's lead on each company, when one exists (lead_link, or the
  // check-in materialiser's) — where the intro email and the notes live.
  // SalesLead.convertedCompanyId is a plain unique column, not a relation.
  const convertedLeads = companies.length
    ? await db.salesLead.findMany({ where: { salesRepId: rep.id, convertedCompanyId: { in: companies.map((c) => c.id) } }, select: { id: true, convertedCompanyId: true } })
    : [];
  const leadByCompany = new Map(convertedLeads.map((l) => [l.convertedCompanyId, l.id]));

  const finished = companies.map((c) => {
    const facts = companyFactsOf(c);
    const verdict = stalledDecision({ company: facts, now, checkoutGraceMs: CHECKOUT_GRACE_MS });
    const kind = verdict.stalled ? "stalled" : "new";
    const ownerName = c.members?.[0]?.user?.name || null;
    const first = ownerName ? ownerName.split(/\s+/)[0] : null;
    const language = normalizeScriptLanguage(c.defaultLanguage) || "en";
    return {
      id: c.id,
      name: c.name,
      kind,
      badge: kind,
      signedUpAt: c.createdAt,
      cardAdded: Boolean(c.subscription),
      firstQuoteSentAt: facts.firstQuoteSentAt,
      stalledReason: verdict.reason,
      trade: tradeLabelFor(c.industries),
      city: c.city || null,
      language: c.defaultLanguage || null,
      leadId: leadByCompany.get(c.id) || null,
      fact: signupFact({ kind, stateReason: verdict.reason, company: { ...facts, city: c.city, industries: c.industries, defaultLanguage: c.defaultLanguage } }, { now }),
      opener: signupOpenerFor({ kind, language, first, business: c.name, rep: repPublicName(rep), at: c.createdAt, stalledReason: verdict.reason, now }),
    };
  });

  const unfinished = leads.map((l) => {
    const language = normalizeScriptLanguage(l.language) || "en";
    const lead = { ...l };
    return {
      id: l.id,
      name: l.companyName || [l.firstName, l.lastName].filter(Boolean).join(" ") || "—",
      kind: "abandoned",
      badge: "hot",
      startedAt: l.startedAt,
      lastSeenAt: l.lastSeenAt,
      stepReached: l.stepReached,
      stepLabel: STEP_LABELS[l.stepReached] || l.stepReached,
      trade: tradeLabelFor(l.trades),
      city: l.city || null,
      language: l.language || null,
      phone: l.phoneE164,
      leadId: l.promotedLeadId,
      prospectId: l.prospectId,
      fact: signupFact({ kind: "abandoned", lead }, { now }),
      opener: signupOpenerFor({ kind: "abandoned", language, first: l.firstName || null, business: l.companyName || "", rep: repPublicName(rep), step: STEP_LABELS[l.stepReached] || l.stepReached, at: l.lastSeenAt, now }),
    };
  });

  return NextResponse.json({ finished, unfinished });
}
