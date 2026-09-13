// app/api/quotes/[id]/duplicate/route.js
//
// POST — a fresh DRAFT copied from this quote.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The kitchen designer's locked note (app.kitchen.lockedNote) has told users
// for months to "duplicate the quote to change it" — a sent quote is a
// commitment and repricing it underneath the client is the wrong move. There
// was no Duplicate anywhere. The help-centre writers found the promise by
// reading the copy and found nothing behind it; this is the thing behind it.
//
// ── What a copy is ──────────────────────────────────────────────────────────
//
// The WORK, not the HISTORY. The new row carries the client, the language,
// the scope groups with their line items and takeoffs, the optional add-ons,
// the internal costing, the notes and the email-section choices — everything
// an estimator would otherwise retype. It carries none of what happened to
// the original: no sentAt, no signature, no share token, no acceptance, no
// client's own kitchen edits, no AI review, no tier membership. Those are
// facts about a document a homeowner saw, and a draft nobody has seen yet
// cannot honestly claim any of them.
//
// The number is the next in the company's live series, never "Q-…-copy":
// numbering is a promise to accountants that the sequence has no gaps and no
// duplicates, and a suffix would be a second numbering scheme.
//
// ── The language is copied, not resolved ────────────────────────────────────
//
// Non-negotiable 6: a document keeps the language it was created in. The copy
// is a new document, so in principle it could take the client's current
// language — but the person duplicating is starting from THIS quote's words,
// and re-languaging the lines underneath them would leave French line items
// on an "English" quote. So `language` is copied verbatim.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { nextQuoteNumberForCompany } from "@/lib/quotes/quoteNumber";
import { requireWithinLimit } from "@/lib/platform/planLimits";
import { requireCreatedVia } from "@/lib/quotes/createdVia";
import { recordActivity } from "@/lib/activity/log";
import { duplicateQuoteData } from "@/lib/quotes/duplicateQuote";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same rung POST /api/quotes asks for: a duplicate IS a created quote.
  // Someone at quotes:view_only can read this quote and cannot mint another.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_create_edit",
    "create quotes",
  );
  if (denied) return denied;

  // A copy counts against the plan's quote allowance exactly as a typed one
  // does — the ceiling is on documents, not on keystrokes.
  try {
    await requireWithinLimit(member.companyId, "quotes");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 402 },
    );
  }

  const source = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    include: {
      scopeGroups: { orderBy: { sortOrder: "asc" } },
      addOns: { orderBy: { sortOrder: "asc" } },
      costing: true,
    },
  });
  if (!source) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // The costing row is a permission of its own (jobCosting). A duplicator
  // without it still gets the quote — the cost estimate simply is not carried,
  // exactly as POST /api/quotes drops a costing block from someone who may not
  // write one. Passing `full` lets the pure helper make that call.
  const data = duplicateQuoteData(source, {
    quoteNumber: await nextQuoteNumberForCompany(db, member.companyId),
    userId: member.userId,
    member: full,
  });

  const quote = await db.quote.create({
    data: {
      ...data,
      companyId: member.companyId,
      // A signed-in member pressed Duplicate. That is a human making a quote,
      // whatever made the one it was copied from — see lib/quotes/createdVia.js
      // on why the value is never inherited or defaulted.
      createdVia: requireCreatedVia("staff"),
    },
    select: { id: true, quoteNumber: true, scopeDetails: true },
  });

  await recordActivity(member, {
    action: "quote.duplicated",
    entityType: "quote",
    entityId: quote.id,
    summary: `Duplicated quote ${source.quoteNumber} as ${quote.quoteNumber}`,
    summaryKey: "app.activity.event.quoteDuplicated",
    summaryParams: { from: source.quoteNumber, to: quote.quoteNumber },
    metadata: { sourceQuoteId: source.id },
  });

  return NextResponse.json(
    {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      // So the kitchen designer's locked note can send the user straight to
      // the copy's designer rather than to a detail page they then leave.
      hasKitchenDesign: quote.scopeDetails?.serviceType === "kitchen",
    },
    { status: 201 },
  );
}
