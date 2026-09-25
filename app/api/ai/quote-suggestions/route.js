// app/api/ai/quote-suggestions/route.js
//
// RULE-BASED co-occurrence over this company's own quotes — no model call,
// no AI cost, despite the /ai prefix it has always lived under
// (lib/ai/quoteSuggestions.js).
//
// Two shapes:
//   { currentCategoryIds }               → the original flat list (the
//                                          review's candidates, unpriced).
//   { byCategory: true, categoryIds,     → the quote builder's "Often added
//     onQuote, language }                  with this": per service on the
//                                          quote, the services sold alongside
//                                          it, each with the median this
//                                          company's accepted quotes carried.
//
// The medians are the company's own pricing, so they are only returned to a
// member who can build quotes AND see prices — the two things the builder
// itself refuses to open without (QuoteBuilder, canWrite / canSeePrices).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle } from "@/lib/permissions/enforce";
import { isSupported } from "@/app/i18n/languages";
import { getSuggestedAddOns, getSuggestionsByCategory } from "@/lib/ai/quoteSuggestions";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const body = await request.json().catch(() => ({}));

  if (body?.byCategory === true) {
    const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "see suggested add-ons");
    if (denied) return denied;
    if (!hasToggle(full, "showPricing")) {
      return NextResponse.json(
        { error: "Suggested add-ons carry your prices, and your access level hides prices." },
        { status: 403 },
      );
    }
    const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);
    const language = isSupported(body.language) ? String(body.language).toLowerCase() : "en";
    const byCategory = await getSuggestionsByCategory({
      companyId: member.companyId,
      categoryIds: strings(body.categoryIds),
      onQuote: strings(body.onQuote),
      language,
    });
    return NextResponse.json({ byCategory });
  }

  const { currentCategoryIds } = body || {};
  const suggestions = await getSuggestedAddOns({
    companyId: member.companyId,
    currentCategoryIds: currentCategoryIds || [],
  });

  return NextResponse.json(suggestions);
}
