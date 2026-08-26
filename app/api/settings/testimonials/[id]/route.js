// app/api/settings/testimonials/[id]/route.js
//
// Approve, edit, reorder, remove.
//
// Next 16: `params` is a Promise and must be awaited before reading `.id`.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { cleanAuthor, cleanQuote, contentKey } from "@/lib/reviews/testimonials";
import { TESTIMONIAL_SELECT, refuseUnlessAdmin } from "@/lib/reviews/testimonialAccess";

// Scoped by companyId, not just by id. A cuid is unguessable but that is not
// an access control, and this is the only thing standing between one tenant
// and another's reviews.
async function loadOwned(id, companyId) {
  const row = await db.testimonial.findUnique({ where: { id } });
  if (!row || row.companyId !== companyId) return null;
  return row;
}

// PATCH { approved?, sortOrder?, authorName?, quote?, authorTitle?, companyLabel? }
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;

  const existing = await loadOwned(id, member.companyId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};

  if (body.approved !== undefined) data.approved = Boolean(body.approved);

  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "That position isn't a number." }, { status: 400 });
    }
    data.sortOrder = Math.round(n);
  }

  if (body.authorName !== undefined) {
    const authorName = cleanAuthor(body.authorName);
    if (!authorName) {
      return NextResponse.json({ error: "A review needs a name on it." }, { status: 400 });
    }
    data.authorName = authorName;
  }

  if (body.quote !== undefined) {
    const quote = cleanQuote(body.quote);
    if (quote.length < 5) {
      return NextResponse.json({ error: "Add what the customer actually said." }, { status: 400 });
    }
    data.quote = quote;
  }

  if (body.authorTitle !== undefined) data.authorTitle = cleanAuthor(body.authorTitle) || null;
  if (body.companyLabel !== undefined) data.companyLabel = cleanAuthor(body.companyLabel) || null;

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  // The content identity is derived from the author and the words, so editing
  // either has to move it — otherwise a corrected review keeps the old row's
  // fingerprint, and the next import of the uncorrected list sees a match and
  // silently reverts the correction.
  if (data.authorName || data.quote) {
    const externalId = contentKey({
      authorName: data.authorName ?? existing.authorName,
      quote: data.quote ?? existing.quote,
    });
    const clash = await db.testimonial.findUnique({
      where: { companyId_externalId: { companyId: member.companyId, externalId } },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      return NextResponse.json(
        { error: "You already have that exact review in the list." },
        { status: 409 },
      );
    }
    data.externalId = externalId;
  }

  const testimonial = await db.testimonial.update({
    where: { id },
    data,
    select: TESTIMONIAL_SELECT,
  });

  await recordActivity(member, {
    action: "settings.testimonial.updated",
    entityType: "testimonial",
    entityId: id,
    summary:
      data.approved === true
        ? `Published a review from ${testimonial.authorName}`
        : data.approved === false
          ? `Took a review from ${testimonial.authorName} off the website`
          : `Edited a review from ${testimonial.authorName}`,
    metadata: data,
  });

  return NextResponse.json(testimonial);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;

  const existing = await loadOwned(id, member.companyId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.testimonial.delete({ where: { id } });

  await recordActivity(member, {
    action: "settings.testimonial.deleted",
    entityType: "testimonial",
    entityId: id,
    summary: `Removed the review from ${existing.authorName}`,
    metadata: { authorName: existing.authorName, quote: existing.quote },
  });

  return NextResponse.json({ deleted: true });
}
