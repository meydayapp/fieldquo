// app/api/sales/leads/route.js
//
// A rep's own pipeline: the prospects they are working, and nobody else's.
//
// ══ Scoped by salesRepId, re-derived every request ═════════════════════════
//
// Not "filtered" — scoped. There is no outer tenant boundary behind this the
// way there is behind every /api/* route in the product, so the salesRepId in
// the where clause IS the boundary, exactly as lib/sales/scope.js argues for a
// rep's company list. The fragment is built by leadListWhere() rather than
// written here, so it cannot be written slightly differently in the next route,
// and it never collapses to `{}` for a caller it could not identify.
//
// ══ Why a rep may write here at all ════════════════════════════════════════
//
// lib/sales/gate.js refuses every non-GET under /api/sales, for the good reason
// its header gives. Leads, threads and messages are the narrow exception: they
// are the rep's own notes about people who are not customers, they decide no
// money, and the feature is meaningless without them. See
// lib/sales/outreachGate.js, which is where that exception is written down.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { outreachStatus } from "@/lib/sales/outreachSender";
import {
  isLeadStatus,
  isPlausibleEmail,
  leadListWhere,
  sanitiseHeaderText,
} from "@/lib/sales/outreach";

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const leads = await db.salesLead.findMany({
    where: leadListWhere(rep.id, status),
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      status: true,
      convertedCompanyId: true,
      convertedAt: true,
      createdAt: true,
      updatedAt: true,
      threads: {
        orderBy: { lastMessageAt: "desc" },
        take: 1,
        select: { id: true, subject: true, lastMessageAt: true },
      },
      _count: { select: { threads: true } },
    },
  });

  // The counts the pipeline header shows. Computed from the rep's whole book
  // rather than from the filtered page, so switching filters doesn't make the
  // totals change — a tab that renumbers itself when you click it is the kind
  // of small lie that makes people stop trusting a screen.
  const counts = await db.salesLead.groupBy({
    by: ["status"],
    where: leadListWhere(rep.id),
    _count: { _all: true },
  });

  return NextResponse.json({
    leads,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    // Sent with the list so the screen never has to guess whether composing is
    // possible. See lib/sales/outreachReadiness.js.
    outreach: await outreachStatus(rep),
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const businessName = sanitiseHeaderText(body.businessName, 200);
  // A lead carried across from the queue supplies its name from the prospect,
  // so the rep is not asked to retype what is already on the screen in front
  // of them. Typing one by hand still requires it.
  const fromProspect = typeof body.prospectId === "string" && body.prospectId.trim().length > 0;
  if (!businessName && !fromProspect) {
    return NextResponse.json({ error: "A business name is required." }, { status: 400 });
  }

  const email = sanitiseHeaderText(body.email, 254).toLowerCase();
  if (email && !isPlausibleEmail(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }

  const status = isLeadStatus(body.status) ? body.status : "new";

  // ── Carrying a claimed prospect across, instead of retyping it ──────────
  //
  // SalesLead.prospectId has existed since the queue did, and nothing ever
  // wrote it from the queue: there was no control that turned a prospect a rep
  // had just researched and phoned into a lead they could email or text. The
  // rep retyped the name and the number by hand, which is slow, and which
  // silently breaks the link — two records about one business with no way for
  // either screen to know about the other.
  //
  // The prospect is READ here rather than trusted from the body. A prospectId
  // a client could name unchecked is a client that can copy any business out
  // of the pool, including one held by another rep.
  let source = null;
  const prospectId = typeof body.prospectId === "string" ? body.prospectId.trim() : "";
  if (prospectId) {
    source = await db.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true,
        businessName: true,
        phoneE164: true,
        // The address the crawler read off their site. Copied onto the lead
        // only when the rep typed none — see the create below.
        email: true,
        country: true,
        province: true,
        assignedRepId: true,
        doNotContactAt: true,
      },
    });
    if (!source) {
      return NextResponse.json({ error: "No such prospect." }, { status: 404 });
    }
    // Only the rep holding the claim. A prospect somebody else is working is
    // not yours to copy — the claim is the whole mechanism that stops two reps
    // phoning one contractor, and a lead made from it would route around that.
    if (source.assignedRepId !== rep.id) {
      return NextResponse.json(
        { error: "That prospect is not claimed by you. Claim it in the queue first." },
        { status: 409 },
      );
    }
    // Refused rather than copied. Carrying a do-not-contact business into the
    // leads screen would put it somewhere the flag is not shown and the email
    // and text controls are.
    if (source.doNotContactAt) {
      return NextResponse.json(
        { error: "That business asked not to be contacted, so it cannot be worked as a lead." },
        { status: 409 },
      );
    }

    // Already carried across? Hand back the lead that exists rather than
    // making a second one. A rep pressing the button twice is the ordinary
    // case, and two leads about one business is the exact mess this feature
    // was meant to prevent.
    const existing = await db.salesLead.findFirst({
      where: { prospectId: source.id, salesRepId: rep.id },
      select: { id: true, businessName: true, status: true, email: true },
    });
    if (existing) {
      // A lead carried across before the crawler had read the address gets
      // it now — and ONLY if the lead has none. `email: null` in the WHERE is
      // what keeps a rep's own typing safe: an address a person entered is
      // never replaced by one a crawler read, however the two compare.
      if (!existing.email && source.email) {
        await db.salesLead.updateMany({
          where: { id: existing.id, salesRepId: rep.id, email: null },
          data: { email: source.email },
        });
      }
      return NextResponse.json({ lead: existing, alreadyExisted: true }, { status: 200 });
    }
  }

  const lead = await db.salesLead.create({
    data: {
      // From the gate's fresh read of the session, never from the body. A
      // salesRepId a client could name is a client that can file a prospect
      // into a colleague's pipeline.
      salesRepId: rep.id,
      // What the rep typed wins over what discovery found: they have spoken to
      // the business and the directory has not.
      businessName: businessName || source?.businessName || "",
      contactName: sanitiseHeaderText(body.contactName, 200) || null,
      // Typed wins; the crawler's address fills the blank. Same order as
      // the phone number below and for the same reason.
      email: email || source?.email || null,
      phone: sanitiseHeaderText(body.phone, 40) || source?.phoneE164 || null,
      // Carried so lib/sales/callingRules.js can answer the calling-hours
      // question on the lead screen too. Null stays null — a missing province
      // makes the rules answer "unknown", which is the correct answer and the
      // one the screen offers a way to fix.
      country: source?.country || null,
      province: source?.province || null,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 5000) : null,
      status,
      prospectId: source?.id || null,
    },
    select: { id: true, businessName: true, status: true },
  });

  return NextResponse.json({ lead }, { status: 201 });
}
