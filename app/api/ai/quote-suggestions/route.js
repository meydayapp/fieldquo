// app/api/ai/quote-suggestions/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { getSuggestedAddOns } from "@/lib/ai/quoteSuggestions";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentCategoryIds } = await request.json();
  const suggestions = await getSuggestedAddOns({
    companyId: member.companyId,
    currentCategoryIds: currentCategoryIds || [],
  });

  return NextResponse.json(suggestions);
}
