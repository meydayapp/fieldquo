// app/api/reviews/google/refresh/route.js
//
// "Refresh now": the same refresh the nightly cron runs, for the company
// that just connected and wants to see something. The answer carries what
// Google said, so a quota-0 project learns it here and not tomorrow.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { refuseUnlessAdmin } from "@/lib/reviews/testimonialAccess";
import { getBusinessConnection } from "@/lib/reviews/googleBusiness/connection";
import { refreshCompanyReviews } from "@/lib/reviews/googleBusiness/sync";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;

  const connection = await getBusinessConnection(member.companyId);
  if (!connection) return NextResponse.json({ error: "Google Business Profile is not connected." }, { status: 404 });

  const result = await refreshCompanyReviews(connection);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
