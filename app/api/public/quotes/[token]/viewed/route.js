// app/api/public/quotes/[token]/viewed/route.js
//
// POST — the client's page saying "I was opened". Stamps Quote.viewedAt (the
// first time) and bumps Quote.viewCount; lib/quotes/quoteViews.js decides
// whether this open counts and explains every refusal.
//
// A separate route, not a side effect of GET /api/public/quotes/[token], on
// purpose: that GET serves the office's own draft preview and is promised to
// write nothing (scripts/check-quote-preview.mjs), and a GET is exactly what
// a mail scanner or a prefetch fetches. This POST is sent by the page's script
// after the document renders (app/q/[token]/QuoteApproval.js).
//
// Always answers 200 with { recorded } for a real token — a refusal here is
// not an error the client's page should ever show — and 404 for a token that
// resolves to nothing, like every other /q endpoint. Nothing about the quote
// is returned.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { memberMayPreview } from "@/lib/quotes/previewAccess";
import { viewVerdict, isPrefetchRequest } from "@/lib/quotes/quoteViews";
import { nudgeAgencyEvents } from "@/lib/agency/nudge";

export async function POST(request, { params }) {
  const { token } = await params;
  const quote = token
    ? await db.quote.findFirst({
        where: { shareToken: token },
        select: { id: true, status: true, companyId: true },
      })
    : null;
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Who is looking, if anyone is signed in. A refusal from any gate inside
  // getCurrentMember is "nobody we know", which is what a homeowner is.
  const member = await getCurrentMember(request, { skipBillingGate: true }).catch(() => null);

  const verdict = viewVerdict({
    status: quote.status,
    userAgent: request.headers.get("user-agent"),
    prefetch: isPrefetchRequest(request.headers),
    staffOfCompany: memberMayPreview(member, quote.companyId),
    impersonating: Boolean(member?.impersonation),
  });
  if (!verdict.record) return NextResponse.json({ recorded: false, reason: verdict.reason });

  // Raw, so Quote.updatedAt does not move: somebody reading a quote is not an
  // edit to it, and "last updated" on the quote list must keep meaning that.
  // The status is in the predicate so a quote that became a draft again
  // between the read above and here is not stamped.
  await db.$executeRaw`UPDATE "Quote" SET "viewCount" = "viewCount" + 1, "viewedAt" = COALESCE("viewedAt", NOW()) WHERE "id" = ${quote.id} AND "status" <> 'draft'`;
  // quote.viewed for the company's marketing agency — after the response.
  nudgeAgencyEvents(quote.companyId);
  return NextResponse.json({ recorded: true });
}
