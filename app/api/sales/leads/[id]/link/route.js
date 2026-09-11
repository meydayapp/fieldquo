// app/api/sales/leads/[id]/link/route.js
//
// "This prospect is that company." The join that stops the pipeline and the
// commission ledger being two lists that disagree.
//
// ══ What changed on 2026-09-11, and why ═══════════════════════════════════
//
// This route used to list every company attributed to the rep that no lead
// claimed, and POST took a `companyId` off that list. The owner's lead
// "truefinish cabinets" got linked to "Easy Roofers Inc." — different email,
// different business — because it was the only candidate offered. The list
// is gone. The rep now types the email the client registered with, GET says
// whether that names a linkable company and why or why not, and POST re-runs
// the same decision inside its transaction and writes only if it still holds.
// lib/sales/leadLink.js holds the decision; its header lists every reason.
//
// ══ What this writes now, and what it still does not ══════════════════════
//
// SalesLead.convertedCompanyId/convertedAt/status, a SalesLeadLinkEvent for
// every change — and, on `ok_unclaimed` ONLY, a SalesAttribution through
// lib/sales/attribution.js's captureAttributionWithin with source "lead_link".
// That is the one rep-side write to the attribution table, reopened by the
// owner on purpose; the header of lib/sales/attribution.js says what it costs
// to walk through (the email must match, the lead must predate the signup,
// nothing may have claimed the company, and the rep may not be selling to
// themselves). `salesRepId` is the session's rep, never a body field.
//
// DELETE undoes a link inside 30 days and touches SalesAttribution not at all
// — unlinkLeadWithin's comment says why a wrong lead link is not a wrong
// attribution.
//
// ══ Why GET and POST call the same function ═══════════════════════════════
//
// One predicate, read and write, so the verdict the screen shows can never
// differ from the one the write enforces — except by the rows having changed
// in between, which is exactly why POST reads them again.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { isPlausibleEmail, leadWhere, sanitiseHeaderText } from "@/lib/sales/outreach";
import { withUniqueRetry } from "@/lib/sales/attribution";
import {
  decideLeadLink,
  linkLeadWithin,
  loadLinkCandidates,
  normaliseEmail,
  unlinkLeadWithin,
} from "@/lib/sales/leadLink";

// The lead columns every handler here needs, and no more. `email` is NOT
// read: the rep types the address, and the lead's own address is not a
// shortcut — a lead entered from a directory listing carries the shop's
// info@ while the owner signed up with their own.
const LEAD_SELECT = { id: true, createdAt: true, convertedCompanyId: true, convertedAt: true, status: true };

/**
 * English fallbacks for the verdicts a rep can read. The screen resolves the
 * `reason` code through its own catalogue (LEAD_LINK_REASON_KEYS); these are
 * what a script, a log or a curl sees, and the fallback for a language with
 * no entry yet — the same split lib/sales/authRefusals.js makes.
 */
const REASON_TEXT = {
  not_found: "No company has registered with that email.",
  lead_already_linked: "This lead is already linked to a company.",
  demo_company: "That email belongs to a demo account, which can't be linked to a lead.",
  already_linked_to_lead: "That company is already linked to a lead.",
  self_deal: "You can't link a company you belong to.",
  attributed_to_another_rep: "That company is attributed to another rep.",
  signed_up_before_lead: "That company signed up before this lead was created, so it can't be claimed from it.",
  referral_code: "That company came in through a referral code, so it isn't a rep's sale to claim.",
  ok_already_yours: "That company is attributed to you. Linking records that this lead became them.",
  ok_unclaimed: "That company is unclaimed. Linking attributes it to you.",
  not_linked: "This lead isn't linked to a company.",
  no_link_date: "This link has no date on it, so the 30-day window can't be checked. Ask a superadmin.",
  window_expired: "This link is more than 30 days old. Ask a superadmin to change it.",
};

/** A refusal the screen can translate: sentence in `error`, code in `code`/`reason`. */
function refuse(reason, status = 409) {
  return NextResponse.json({ error: REASON_TEXT[reason] || "Couldn't do that.", code: reason, reason }, { status });
}

/**
 * The email off a query string or a body, or null.
 *
 * Exact-match only. Length-capped and markup-refused before it reaches a
 * query — the same second layer every rep-typed string here gets — and
 * plausibility-checked so a bare word is refused as a bad email rather than
 * reported as "no company has registered with that".
 */
function readEmail(raw) {
  const text = sanitiseHeaderText(typeof raw === "string" ? raw : "").slice(0, 254);
  const email = normaliseEmail(text);
  return email && isPlausibleEmail(email) ? email : null;
}

export async function GET(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const lead = await db.salesLead.findFirst({ where: leadWhere(rep.id, id), select: LEAD_SELECT });
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const email = readEmail(new URL(request.url).searchParams.get("email"));
  if (!email) {
    return NextResponse.json({ error: "Enter the email the client registered with." }, { status: 400 });
  }

  // One lookup per request, exact email, no prefix — see loadLinkCandidates.
  const companies = await loadLinkCandidates(db, { email, rep });
  const v = decideLeadLink({ email, lead, rep, companies });
  return NextResponse.json({
    found: v.found,
    company: v.company,
    eligible: v.eligible,
    reason: v.reason,
    text: REASON_TEXT[v.reason] || "",
  });
}

/**
 * A captureAttributionWithin outcome that disagreed with the decision, named
 * in the lead-link vocabulary so the rep reads one kind of sentence. Reached
 * only when the rows moved between the decision and the write inside the
 * same transaction — which the retry below re-decides anyway.
 */
const ATTRIBUTION_OUTCOME_REASON = {
  self_dealing: "self_deal",
  touch: "attributed_to_another_rep",
  already_attributed: "ok_already_yours",
  unverified_claim: "signed_up_before_lead",
};

export async function POST(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const email = readEmail(body?.email);
  if (!email) {
    return NextResponse.json({ error: "Enter the email the client registered with." }, { status: 400 });
  }

  // Everything — the lead, the companies, the decision, the three writes — in
  // ONE transaction, and re-run once if Postgres refuses on a unique index:
  // convertedCompanyId (another rep's lead took the company a moment ago) or
  // SalesAttribution.companyId (another rep's signup link landed first). The
  // second pass re-reads and refuses with the right reason rather than the
  // rep seeing a constraint error. Same shape as captureSalesAttribution.
  let result;
  try {
    result = await withUniqueRetry(
      () =>
        db.$transaction(async (tx) => {
          const lead = await tx.salesLead.findFirst({ where: leadWhere(rep.id, id), select: LEAD_SELECT });
          if (!lead) return { notFound: true };
          return linkLeadWithin(tx, { email, lead, rep });
        }),
      null,
    );
  } catch (err) {
    if (err?.code === "LEAD_LINK_ATTRIBUTION_REFUSED") {
      return refuse(ATTRIBUTION_OUTCOME_REASON[err.outcome] || "attributed_to_another_rep");
    }
    if (err?.code === "P2002") return refuse("already_linked_to_lead");
    throw err;
  }

  if (result.notFound) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!result.linked) return refuse(result.reason, result.reason === "not_found" ? 404 : 409);

  return NextResponse.json({
    linked: { companyId: result.linked.companyId, name: result.linked.name },
    reason: result.reason,
    attributed: Boolean(result.linked.attribution),
  });
}

export async function DELETE(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  // Kept short and header-clean: it lands in an audit row a superadmin reads.
  const reason = sanitiseHeaderText(typeof body?.reason === "string" ? body.reason : "").slice(0, 500);

  const result = await db.$transaction(async (tx) => {
    const lead = await tx.salesLead.findFirst({ where: leadWhere(rep.id, id), select: LEAD_SELECT });
    if (!lead) return { notFound: true };
    return unlinkLeadWithin(tx, { lead, rep, reason });
  });

  if (result.notFound) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!result.unlinked) return refuse(result.reason);

  return NextResponse.json({ unlinked: result.unlinked });
}
