// app/api/leads/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { rescoreLead } from "@/lib/leads/createLead";
import { nudgeAgencyEvents } from "@/lib/agency/nudge";
import { cleanBudgetBand, cleanTimeline } from "@/lib/leads/qualifiers";
import {
  loadEnforceableMember,
  requireLevel,
  redactLead,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  isValidLeadStatus,
  canSetLeadStatus,
  isValidLostReason,
  LEAD_QUOTE_EVIDENCE_SELECT,
  quoteEvidence,
} from "@/lib/leads/pipeline";
import { loadMaterialLabels, materialLabelSlot } from "@/lib/estimate/instantQuoteServer";
import { deleteLeads, supportSessionRefusal } from "@/lib/leads/deleteLead";
import { captureDeletedNotALead } from "@/lib/meta/capi/capture";
import { afterResponse } from "@/lib/meta/capi/afterResponse";

// One lead, with everything the detail view shows.
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
    include: {
      category: { select: { label: true } },
      assignedTo: { select: { id: true, name: true } },
      // The Won rule's evidence (lib/leads/pipeline.js), so the drawer's
      // status control can say WHY Won is refused before anyone clicks it.
      quote: { select: LEAD_QUOTE_EVIDENCE_SELECT },
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!lead)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Do-not-call is derived (there's no column) — same rule as the list.
  let doNotCall = false;
  if (lead.phone) {
    const optOut = await db.callConsent.findFirst({
      where: { companyId: member.companyId, e164: lead.phone, optedOutAt: { not: null } },
      select: { id: true },
    });
    doNotCall = Boolean(optOut);
  }

  // ── The option they picked, by name ──────────────────────────────────────
  //
  // The instant estimate stores the option as its key (intake.material =
  // "asphalt_arch"), and the drawer printed the key. Named the way the review
  // queue names it (loadMaterialLabels: the company's own option label and its
  // drafted translations), for the trade the linked draft was priced as. Only
  // for the instant estimate's own leads: a funnel question someone keyed
  // "material" holds the homeowner's words, which are already a name.
  let materialLabel = null;
  const materialKey = lead.intake && typeof lead.intake.material === "string" ? lead.intake.material : null;
  if (materialKey && lead.source === "instant_quote") {
    const draft = lead.quoteId
      ? await db.quote
          .findFirst({ where: { id: lead.quoteId, companyId: member.companyId }, select: { quoteType: true, estimateData: true } })
          .catch(() => null)
      : null;
    const trade = draft?.estimateData?.trade || draft?.quoteType || null;
    const labels = await loadMaterialLabels(member.companyId, [{ trade, key: materialKey }]).catch(() => ({}));
    materialLabel = labels[materialLabelSlot(trade, materialKey)] || null;
  }

  // The same filter as the list beside it. Enumerating ids off a redacted
  // board and pulling each detail is precisely how the client leak was
  // reached before it — see the note in app/api/clients/[id]/route.js — so the
  // detail door closes at the same time as the list.
  return NextResponse.json(
    redactLead(full, { ...lead, quote: quoteEvidence(lead.quote), doNotCall, materialLabel }),
  );
}

// Update pipeline state, owner, or the qualifiers. Changing a qualifier
// re-triages the lead so the score never goes stale against its own inputs.
export async function PATCH(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same gate as the board's PATCH beside it. This route is the wider of
  // the two — it reassigns the lead and rewrites the qualifiers that drive the
  // score, not just the column — and it had exactly the same nothing.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "requests", "view_create_edit", "change a request");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { id } = await params;
  const existing = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    // quoteId is here for canSetLeadStatus below — "converted" is Won, and
    // this is what proves whether the lead has anything to be won FROM.
    // lostReason is here for the same function's "lost" branch — a re-drag
    // of an already-lost card carries no new reason in the request body, so
    // the existing value is what makes it a no-op rather than a refusal.
    // `quote` carries the Won rule's evidence (approved? work on it?) — a
    // bare quoteId is refused as unverified by design, see pipeline.js.
    select: {
      id: true,
      budgetBand: true,
      timeline: true,
      quoteId: true,
      lostReason: true,
      quote: { select: LEAD_QUOTE_EVIDENCE_SELECT },
    },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const data = {};

  if (body.status !== undefined) {
    if (!isValidLeadStatus(body.status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    if (body.lostReason !== undefined && body.lostReason !== null && !isValidLostReason(body.lostReason)) {
      return NextResponse.json({ error: "Invalid lost reason" }, { status: 400 });
    }
    // "Converted" is Won, and nothing may land there on nothing but the enum
    // being poked — see lib/leads/pipeline.js. Covers both the drawer's own
    // status buttons and the board's drag-to-move, which both PATCH here.
    // Same file's "lost" branch requires a real reason, new or existing.
    const statusCheck = canSetLeadStatus(existing, body.status, { lostReason: body.lostReason });
    if (!statusCheck.ok)
      return NextResponse.json(
        { error: statusCheck.reason, code: statusCheck.code || null },
        { status: 409 },
      );
    data.status = body.status;
    // A reason only means something WHILE the lead is lost — moving it
    // anywhere else clears a value that would otherwise read as still true
    // after the fact (a lead reopened and later re-lost for a DIFFERENT
    // reason must not keep showing the first one).
    data.lostReason = body.status === "lost" ? (body.lostReason ?? existing.lostReason) : null;
  }

  if (body.assignedToId !== undefined) {
    if (body.assignedToId === null || body.assignedToId === "") {
      data.assignedToId = null;
    } else {
      // Only a member of THIS company can own the lead — never assign to a user
      // from another tenant (or a stranger's id posted by hand).
      const isMember = await db.member.findFirst({
        where: { userId: body.assignedToId, companyId: member.companyId },
        select: { id: true },
      });
      if (!isMember)
        return NextResponse.json(
          { error: "That person isn't on your team." },
          { status: 400 },
        );
      data.assignedToId = body.assignedToId;
    }
  }

  let qualifiersChanged = false;
  if (body.budgetBand !== undefined) {
    data.budgetBand = cleanBudgetBand(body.budgetBand);
    qualifiersChanged = true;
  }
  if (body.timeline !== undefined) {
    data.timeline = cleanTimeline(body.timeline);
    qualifiersChanged = true;
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await db.leadRequest.update({ where: { id }, data });

  // Re-triage after a qualifier edit so score/temperature reflect the new inputs.
  if (qualifiersChanged) await rescoreLead(id);
  // lead.stage_changed for the marketing agency (rescoreLead nudges its own).
  else if (data.status) nudgeAgencyEvents(member.companyId);

  const updated = await db.leadRequest.findFirst({
    where: { id },
    include: {
      category: { select: { label: true } },
      assignedTo: { select: { id: true, name: true } },
      quote: { select: LEAD_QUOTE_EVIDENCE_SELECT },
    },
  });
  return NextResponse.json(updated ? { ...updated, quote: quoteEvidence(updated.quote) } : updated);
}

// Delete one lead — for a test row, or a conversation that was never an
// enquiry (owner, 2026-10-05). Lost stays the answer for a real enquiry that
// went nowhere; this removes a row that should never have counted. What goes,
// what survives with its pointer cleared, and why a deleted lead does not come
// back on the next Meta poll or chat message: lib/leads/deleteLead.js.
//
// The top rung of the requests dial — "View, create, edit, and delete" — a
// level the grid has always had and nothing asked for. Owner and admin hold it
// (unrestricted), the Manager preset holds it; Estimator and Dispatcher stop
// at edit, Crew at none.
//
// Body (optional): { notALead: true } — also mark the conversation(s) this
// lead came from so no lead is created from them again.
export async function DELETE(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const support = supportSessionRefusal(member);
  if (support) return NextResponse.json(support.body, { status: support.status });

  const { response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_create_edit_delete",
    "delete requests",
  );
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await deleteLeads(db, {
    companyId: member.companyId,
    ids: [id],
    actor: { userId: member.userId, memberId: member.id, role: member.role },
    notALead: body?.notALead === true,
  });
  // Another company's id, or one already gone: the same answer as GET.
  if (!result.deleted.length)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Deleted as "not a lead": a Facebook lead-form lead is a Disqualified
  // stage for Meta ("Send lead results to Meta", lib/meta/capi/capture.js).
  // Queued after the response — Meta never slows or fails a delete.
  if (result.metaDisqualify?.length) {
    afterResponse(() => captureDeletedNotALead(db, { companyId: member.companyId, leads: result.metaDisqualify }));
  }

  return NextResponse.json({
    ok: true,
    deleted: result.deleted.map((l) => l.id),
    markedThreads: result.markedThreads,
    noConversation: result.noConversation,
  });
}
