// app/api/leads/[id]/quote-link/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasLevel } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import {
  canSetLeadStatus,
  wonCheck,
  quoteEvidence,
  LEAD_QUOTE_EVIDENCE_SELECT,
} from "@/lib/leads/pipeline";
import { findQuoteCandidates } from "@/lib/leads/linkedDocuments";

// Link a lead to a quote that already exists — the missing half of
// LeadRequest.quoteId, which until now only lib/leads/convertLead.js (a NEW
// draft) and the instant-quote route could write. A lead whose win was
// recorded on a quote typed from scratch had no way to point at it, so once
// the card left Won it could never return (the owner's report, 2026-09-24;
// see lib/leads/pipeline.js).
//
//   GET     ?q=   quotes this lead could be linked to (lib/leads/linkedDocuments.js)
//   POST    { quoteId, markWon?, replace? }   link; with markWon, also move
//                 to Won IF the Won rule accepts the linked quote — never
//                 otherwise; with replace, swap out a different linked quote
//                 (refused on a Won lead)
//   DELETE        unlink (refused while the lead is Won)
//
// Linking writes the LEAD, never the quote: the quote's own status, totals and
// history are untouched, so this is the requests dial's write, plus
// quotes:view_only because the person picking a quote must be allowed to see
// quotes at all.

const QUOTE_FOR_LINK = {
  ...LEAD_QUOTE_EVIDENCE_SELECT,
  // Who, if anyone, already holds it. LeadRequest.quoteId is @unique.
  lead: { select: { id: true } },
};

async function quotesGate(full) {
  if (hasLevel(full, "quotes", "view_only")) return null;
  return NextResponse.json(
    { error: "Your access level for Quotes doesn't allow you to see quotes." },
    { status: 403 },
  );
}

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_only",
    "see requests",
  );
  if (denied) return denied;
  const noQuotes = await quotesGate(full);
  if (noQuotes) return noQuotes;

  const { id } = await params;
  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, email: true, phone: true, quoteId: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const q = new URL(request.url).searchParams.get("q") || "";
  const candidates = await findQuoteCandidates(db, {
    lead,
    full,
    companyId: member.companyId,
    q,
  });
  return NextResponse.json({ candidates });
}

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_create_edit",
    "change a request",
  );
  if (denied) return denied;
  const noQuotes = await quotesGate(full);
  if (noQuotes) return noQuotes;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const quoteId = typeof body?.quoteId === "string" ? body.quoteId.trim() : "";
  if (!quoteId) {
    return NextResponse.json({ error: "Pick a quote to link." }, { status: 400 });
  }

  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, name: true, status: true, quoteId: true, lostReason: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // companyId in the where, so another tenant's quote id is simply not found
  // — 404, the same answer as an id that does not exist, and never a 409
  // that would confirm it exists somewhere.
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId: member.companyId },
    select: QUOTE_FOR_LINK,
  });
  if (!quote) {
    return NextResponse.json({ error: "That quote isn't on this account." }, { status: 404 });
  }

  // Replacing a link is allowed only when asked for by name (`replace`), and
  // never on a Won lead: "Link the quote that won it" on a lead pointing at a
  // declined or unapproved quote IS a replacement, but a Won lead's quote is
  // the evidence its status stands on — the same reason DELETE refuses.
  const replacing = Boolean(lead.quoteId && lead.quoteId !== quote.id);
  if (replacing && body?.replace !== true) {
    return NextResponse.json(
      {
        error:
          "This request already has a quote linked. Unlink it first, then link the right one.",
        code: "lead_has_quote",
      },
      { status: 409 },
    );
  }
  if (replacing && lead.status === "converted") {
    return NextResponse.json(
      {
        error: "This lead is Won. Move it to another status before changing its quote.",
        code: "unlink_won",
      },
      { status: 409 },
    );
  }
  if (quote.lead && quote.lead.id !== lead.id) {
    return NextResponse.json(
      {
        error: `Quote ${quote.quoteNumber} is already linked to another request.`,
        code: "quote_taken",
      },
      { status: 409 },
    );
  }

  const { lead: _holder, ...evidence } = quote;
  const data = { quoteId: quote.id };

  // "Link the quote that won it": the link and the move in ONE write, but the
  // move is still the Won rule's decision, not the request's. A quote that
  // doesn't qualify is linked and the lead stays where it was, with the
  // reason — linking is useful on its own (the documents appear) and
  // refusing it would throw away the half that was right.
  let won = wonCheck({ quote: evidence });
  if (body?.markWon === true) {
    const check = canSetLeadStatus({ ...lead, quote: evidence }, "converted");
    won = check.ok ? { ok: true, basis: won.basis } : check;
    if (check.ok) {
      data.status = "converted";
      data.lostReason = null;
    }
  }

  let updated;
  try {
    updated = await db.leadRequest.update({
      where: { id: lead.id },
      data,
      select: { id: true, status: true, quoteId: true, lostReason: true },
    });
  } catch (err) {
    // Two people linking the same quote to two leads at once: the unique
    // index on quoteId answers, and it is the same sentence as above.
    if (err?.code === "P2002") {
      return NextResponse.json(
        {
          error: `Quote ${quote.quoteNumber} is already linked to another request.`,
          code: "quote_taken",
        },
        { status: 409 },
      );
    }
    throw err;
  }

  if (lead.quoteId !== quote.id || data.status) {
    await recordActivity(member, {
      action: "lead.quote_linked",
      entityType: "lead",
      entityId: lead.id,
      summary: data.status
        ? `Linked quote ${quote.quoteNumber} to lead "${lead.name}" and marked it Won`
        : `Linked quote ${quote.quoteNumber} to lead "${lead.name}"`,
      metadata: {
        leadId: lead.id,
        quoteId: quote.id,
        markedWon: Boolean(data.status),
        // The pointer this replaced, so the log can answer "what was it before".
        ...(replacing && { replacedQuoteId: lead.quoteId }),
      },
    });
  }

  return NextResponse.json({
    lead: { ...updated, quote: quoteEvidence(evidence) },
    won,
    markedWon: data.status === "converted",
  });
}

export async function DELETE(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_create_edit",
    "change a request",
  );
  if (denied) return denied;

  const { id } = await params;
  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, name: true, status: true, quoteId: true, quote: { select: { quoteNumber: true } } },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Unlinking a Won lead would leave exactly the state the Won rule exists to
  // refuse — Won with nothing behind it. Move it first; the order makes the
  // person say which of the two facts is wrong.
  if (lead.status === "converted") {
    return NextResponse.json(
      {
        error: "This lead is Won. Move it to another status before unlinking its quote.",
        code: "unlink_won",
      },
      { status: 409 },
    );
  }

  if (!lead.quoteId) {
    return NextResponse.json({ lead: { id: lead.id, status: lead.status, quoteId: null, quote: null } });
  }

  // Clears the pointer only. The quote, its jobs and its invoices are not
  // touched — this says "this request is not where that quote came from",
  // nothing more.
  const updated = await db.leadRequest.update({
    where: { id: lead.id },
    data: { quoteId: null },
    select: { id: true, status: true, quoteId: true, lostReason: true },
  });

  await recordActivity(member, {
    action: "lead.quote_unlinked",
    entityType: "lead",
    entityId: lead.id,
    summary: lead.quote?.quoteNumber
      ? `Unlinked quote ${lead.quote.quoteNumber} from lead "${lead.name}"`
      : `Unlinked the quote from lead "${lead.name}"`,
    metadata: { leadId: lead.id, quoteId: lead.quoteId },
  });

  return NextResponse.json({ lead: { ...updated, quote: null } });
}
