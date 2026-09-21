// app/r/[token]/qr.png/route.js
//
// The review QR as a public PNG, for the review-request email. Public
// because a mail client's image proxy fetches it with no cookie; keyed by
// Company.reviewQrToken (random, minted on first send) rather than the
// company id so the address enumerates nothing. See lib/reviews/qrToken.js.
//
// Encodes the REVIEW link, not the card: the email's one job is the review,
// and a QR beside a "Leave a review" button that opened a menu instead
// would be the wrong kind of surprise.
//
// Cached for a day at the edge: the token is stable and the link changes
// rarely; a changed link mints a new email with the same token and the
// worst case is a day-old QR that still opens a review page.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { looksLikeQrToken } from "@/lib/reviews/qrToken";
import { validReviewUrl } from "@/lib/reviews/request";
import { qrPng } from "@/lib/reviews/qrPng";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  if (!looksLikeQrToken(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const limited = rateLimit(request, "review-qr-png", { limit: 120, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const company = await db.company.findUnique({
    where: { reviewQrToken: token },
    select: { reviewUrl: true },
  });
  if (!company || !validReviewUrl(company.reviewUrl)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const png = await qrPng(company.reviewUrl, { size: 360 });
  return new NextResponse(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
