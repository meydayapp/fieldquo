// app/api/leads/[id]/documents/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadLeadDocuments, loadLeadConversion } from "@/lib/leads/linkedDocuments";

// The lead drawer's "Linked documents": the quote linked to this lead, the
// jobs it became and the invoices billed from it, plus the Won rule's verdict
// so the status control can say why Won is (or isn't) available.
//
// `conversion` — for a lead from Facebook, Instagram or WhatsApp (or one with
// a linked conversation): did it become a quote, a job, a paid invoice, and on
// what evidence. Confirmed and possible are kept apart; see
// lib/attribution/conversionEvidence.js. Null for every other lead.
//
// Gated on requests:view_only — the same door as the lead itself — and then
// each section on its OWN category inside loadLeadDocuments, because a member
// allowed the lead is not thereby allowed its invoices. See that file's header.
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

  const { id } = await params;
  const lead = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      quoteId: true,
      name: true,
      email: true,
      phone: true,
      intake: true,
      source: true,
      createdAt: true,
      conversationEvidence: true,
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [documents, conversion] = await Promise.all([
    loadLeadDocuments(db, { lead, full, companyId: member.companyId }),
    // Best effort: the documents list must never fail because the evidence
    // line could not be worked out.
    loadLeadConversion(db, { lead, full, companyId: member.companyId }).catch((err) => {
      console.error("[leads/documents] conversion check failed:", err?.message);
      return null;
    }),
  ]);
  return NextResponse.json({ ...documents, conversion });
}
