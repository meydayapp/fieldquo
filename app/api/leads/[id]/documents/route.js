// app/api/leads/[id]/documents/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadLeadDocuments, loadLeadConversion, documentAccess } from "@/lib/leads/linkedDocuments";
import { listIdentityLinks } from "@/lib/leads/identityLinks";
import { publicReview } from "@/lib/leads/messageReview";
import { seesOnlyAssignedJobs } from "@/lib/permissions/enforce";

// The lead drawer's "Linked documents": the quote linked to this lead, the
// jobs it became and the invoices billed from it, plus the Won rule's verdict
// so the status control can say why Won is (or isn't) available.
//
// `conversion` — for a lead from Facebook, Instagram or WhatsApp (or one with
// a linked conversation): did it become a quote, a job, a paid invoice, and on
// what evidence. Confirmed and possible are kept apart; see
// lib/attribution/conversionEvidence.js. Null for every other lead.
//
// `identityLinks` — other records that are the same person as this lead (a
// Facebook form submission folded in instead of becoming a second lead, a
// conversation joined by phone or email, a client on file), each with what
// matched and a "Not the same person" undo (POST /api/leads/[id]/identity).
// `review` — the message reviewer's verdict on the linked conversation
// (lib/leads/messageReview.js), with document numbers only on the dials that
// own them.
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

  const [documents, conversion, identityLinks, thread] = await Promise.all([
    loadLeadDocuments(db, { lead, full, companyId: member.companyId }),
    // Best effort: the documents list must never fail because the evidence
    // line could not be worked out.
    loadLeadConversion(db, { lead, full, companyId: member.companyId }).catch((err) => {
      console.error("[leads/documents] conversion check failed:", err?.message);
      return null;
    }),
    listIdentityLinks(db, { companyId: member.companyId, leadId: lead.id }).catch(() => []),
    // Best effort, like the two above: an async wrapper so even a failure to
    // reach the model at all becomes a null review, never a failed drawer.
    (async () =>
      db.messageThread.findFirst({ where: { companyId: member.companyId, leadId: lead.id }, orderBy: { createdAt: "asc" }, select: { leadCapture: true } }))().catch(() => null),
  ]);
  const access = { ...documentAccess(full), scoped: seesOnlyAssignedJobs(full) };
  // The thread's own review carries the document numbers; the lead's copy
  // does not (lib/leads/messageReview.js reviewForLead). Either way, shaped
  // for this member.
  const review = publicReview(thread?.leadCapture?.review || lead.conversationEvidence?.review || null, access);
  // The same dials for the links' evidence; an assignment-scoped member (a
  // crew member) gets no client id and no documents from them at all.
  const links = identityLinks.map((l) => ({
    ...l,
    clientId: access.scoped ? null : l.clientId,
    documents: (l.documents || []).map((d) =>
      !access.scoped && ((d.type === "quote" && access.quotes) || (d.type === "job" && access.jobs) || (d.type === "invoice" && access.invoices))
        ? d
        : { type: d.type, restricted: true },
    ),
  }));
  return NextResponse.json({ ...documents, conversion, identityLinks: links, review });
}
