// app/api/leads/[id]/convert/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { convertLeadToQuote } from "@/lib/leads/convertLead";
import { planGapFill } from "@/lib/leads/leadGaps";
import { recordActivity } from "@/lib/activity/log";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

// Turn a lead into a draft quote. Gated on the SAME permission as creating a
// quote by hand — converting IS creating one.
//
// ── The optional `contact` body (2026-10-31) ───────────────────────────────
//
// Booking a visit from a lead converts it first (the appointment hangs off
// the quote — Appointment.quoteId — which is what puts it back on the lead
// and in the agency feed). A Messenger lead often reaches that moment with a
// name and nothing else, because Meta sends nothing else and the contractor
// got the rest on the phone. So the convert call may carry what was learned,
// and lib/leads/leadGaps.js writes it onto EMPTY columns only — never over
// something a person or a form already put there.
//
// Posting no body is the old behaviour exactly: scripts/check-lead-linking
// holds that, because "Create quote from this lead" still posts nothing.
export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "create quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // …and on the lead as well: this reads the request in full to build the
  // quote from it, so someone refused the board must not reach one through here.
  const { response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_only",
    "see requests",
  );
  if (denied) return denied;

  const { id } = await params;
  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!lead)
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // What the person typed, onto the gaps, before the quote is built from the
  // lead — so the quote and the client it creates carry it too.
  const body = await request.json().catch(() => null);
  const plan = planGapFill({ lead, contact: body?.contact });
  if (plan.written.length) {
    await db.leadRequest.update({
      where: { id: lead.id },
      data: { ...plan.data, ...(plan.intake ? { intake: plan.intake } : {}) },
    });
    Object.assign(lead, plan.data);
    if (plan.intake) lead.intake = plan.intake;
    await recordActivity(member, {
      action: "lead.details_added",
      entityType: "lead",
      entityId: lead.id,
      summary: `Added ${plan.written.join(", ")} to lead "${lead.name}"`,
      metadata: { leadId: lead.id, fields: plan.written },
    }).catch(() => null);
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { id: true, defaultLanguage: true },
  });

  const { quote, created } = await convertLeadToQuote({ lead, member, company });

  if (created) {
    await recordActivity(member, {
      action: "lead.converted",
      entityType: "quote",
      entityId: quote.id,
      summary: `Converted lead "${lead.name}" into quote ${quote.quoteNumber}`,
      metadata: { leadId: lead.id, quoteId: quote.id },
    });
  }

  return NextResponse.json({
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    created,
    // What was taken and what was refused, so the caller can say "we kept the
    // phone already on file" rather than appearing to have saved it.
    filled: plan.written,
    kept: plan.skipped,
  });
}
