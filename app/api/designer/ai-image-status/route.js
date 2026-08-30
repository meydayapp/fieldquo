// app/api/designer/ai-image-status/route.js
//
// Read-only: what the AI sidebar and the Remove-background sidebar need to
// render a truthful control before anyone clicks anything — see
// lib/designer/aiImageAdapter.js's module doc for why this exists as its own
// endpoint rather than only surfacing on a failed POST.
//
// NOT listed in the "marketing_designer" feature's apiPrefixes on purpose:
// this route answers "is it available", so it has to stay reachable even
// when the answer is no — the same reasoning funnels' public routes are
// carved out of their own feature's apiPrefixes for (see registry.js).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { statusForCompany } from "@/lib/designer/aiImageAdapter";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const status = await statusForCompany(member.companyId);
  return NextResponse.json(status);
}
