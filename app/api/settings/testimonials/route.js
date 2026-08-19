// app/api/settings/testimonials/route.js
//
// The reviews a contractor publishes on their own website.
//
// ── Why this route exists at all ───────────────────────────────────────────
//
// The Testimonial table has been read for a long time — /api/settings/website
// pulls the approved ones into the site's testimonials block — and until now
// nothing could write to it. Rows could only appear by someone opening a SQL
// console. The website builder's "add one below" affordance edits the site's
// block JSON, which is rebuilt from this table on the next regeneration, so
// anything typed there quietly disappeared. That is the dead-control shape
// AGENTS.md is about, and this is the missing half.
//
// ── What is NOT here ───────────────────────────────────────────────────────
//
// There is no Google Business Profile import, and no button offering one. The
// endpoint that lists Google reviews is real, but it returns nothing until
// Google approves a Basic API Access application, and the API policies cap
// storage of what it returns at 30 calendar days — which is not what an
// imported testimonial is. Both are recorded in docs/ROADMAP.md. Shipping a
// "Connect Google" button before either is settled would be a control that
// appears to work and doesn't.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import { cleanAuthor, cleanQuote, contentKey } from "@/lib/reviews/testimonials";
import {
  TESTIMONIAL_SELECT,
  TESTIMONIAL_ORDER,
  publishedCount,
  refuseUnlessAdmin,
} from "@/lib/reviews/testimonialAccess";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Unapproved ones are returned too — this is the screen where they get
  // approved, so hiding them here would strand every imported row.
  const testimonials = await db.testimonial.findMany({
    where: { companyId: member.companyId },
    orderBy: TESTIMONIAL_ORDER,
    select: TESTIMONIAL_SELECT,
  });

  return NextResponse.json({
    testimonials,
    publishedCount: publishedCount(testimonials),
  });
}

// POST { authorName, quote, authorTitle?, companyLabel? } — add one by hand.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;

  const body = await request.json().catch(() => ({}));
  const authorName = cleanAuthor(body.authorName);
  const quote = cleanQuote(body.quote);

  if (!authorName) {
    return NextResponse.json(
      { error: "Whose review is this? Add the customer's name." },
      { status: 400 },
    );
  }
  if (quote.length < 5) {
    return NextResponse.json(
      { error: "Add what the customer actually said." },
      { status: 400 },
    );
  }

  // Same content identity the bulk import uses, so a review typed in here and
  // later pasted in a list updates that one row instead of publishing twice.
  const externalId = contentKey({ authorName, quote });

  const testimonial = await db.testimonial.upsert({
    where: { companyId_externalId: { companyId: member.companyId, externalId } },
    create: {
      companyId: member.companyId,
      authorName,
      quote,
      authorTitle: cleanAuthor(body.authorTitle) || null,
      companyLabel: cleanAuthor(body.companyLabel) || null,
      source: "manual",
      externalId,
      // Typed in one at a time by the owner, who is looking at it as they save
      // — a separate approval click there would be ceremony, not a safeguard.
      // The bulk path, where a hundred rows arrive unread, defaults to off.
      approved: true,
    },
    update: {
      authorTitle: cleanAuthor(body.authorTitle) || null,
      companyLabel: cleanAuthor(body.companyLabel) || null,
    },
    select: TESTIMONIAL_SELECT,
  });

  await recordActivity(member, {
    action: "settings.testimonial.created",
    entityType: "testimonial",
    entityId: testimonial.id,
    summary: `Added a review from ${authorName}`,
  });

  return NextResponse.json(testimonial);
}
