// app/api/settings/google-reviews/route.js
//
// The cached Google reviews, for the reviews screen. Read-only here: the
// words are Google's, refreshed nightly and purged at thirty days
// (lib/reviews/googleBusiness/sync.js). The one thing a company decides —
// whether a review shows on their site — is the PATCH in ./[id].
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const reviews = await db.googleReview.findMany({
    where: { companyId: member.companyId },
    orderBy: [{ reviewCreateTime: "desc" }],
    select: {
      id: true,
      reviewerName: true,
      starRating: true,
      comment: true,
      replyComment: true,
      reviewCreateTime: true,
      showOnSite: true,
      fetchedAt: true,
    },
    take: 500,
  });
  return NextResponse.json({ reviews });
}
