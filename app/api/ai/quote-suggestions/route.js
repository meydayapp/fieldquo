// app/api/ai/quote-suggestions/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { getSuggestedAddOns } from "@/lib/ai/quoteSuggestions";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { currentCategoryIds } = await request.json();
  const suggestions = await getSuggestedAddOns({
    companyId: member.companyId,
    currentCategoryIds: currentCategoryIds || [],
  });

  return NextResponse.json(suggestions);
}
