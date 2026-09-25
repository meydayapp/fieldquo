// app/api/quotes/lawn-care-offer/route.js
//
// The company's lawn-care programs and add-ons, PRICED for one lawn size —
// what the quote builder's lawn program picker lists for a lawn_care scope
// group. Member-only: this is the back office reading its own card, the
// same figures Settings › Instant Quotes shows.
//
// Reads the saved row whether or not the PUBLIC instant quote is switched
// on: a company that priced its programs but keeps the instant page gated
// still sells them through the builder. Only a company with no row at all
// gets not_configured, and the picker says where to set one up.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { priceLawnCare } from "@/lib/estimate/lawnCare";
import { loadEnforceableMember, requireLevel, requireToggle, permissionErrorResponse } from "@/lib/permissions/enforce";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same gate the settings screen's rate card sits behind: these are
  // prices, and a member without showPricing does not see them anywhere else.
  // And the quotes dial first, at the level plan-offers' GET reads at: this
  // is the quote builder's picker, so a member with no access to quotes (a
  // bookkeeper who holds showPricing for invoices) is not handed the
  // lawn-care rate card by a route the grid never asked about.
  if (!member.impersonation) {
    const full = await loadEnforceableMember(db, member.id);
    try {
      requireLevel(full, "quotes", "view_only", "see quote pricing");
      requireToggle(full, "showPricing", "price lawn-care programs");
    } catch (err) {
      const { body, status } = permissionErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }

  const url = new URL(request.url);
  const areaSqft = Number(url.searchParams.get("areaSqft"));
  const language = String(url.searchParams.get("language") || "en").slice(0, 2);
  if (!(areaSqft > 0)) return NextResponse.json({ error: "areaSqft is required" }, { status: 400 });

  const row = await db.instantQuoteConfig.findUnique({
    where: { companyId_trade: { companyId: member.companyId, trade: "lawn_care" } },
    select: { config: true },
  });
  if (!row?.config) return NextResponse.json({ ok: false, reason: "not_configured" });

  const priced = priceLawnCare(row.config, areaSqft, language);
  if (!priced.ok) return NextResponse.json({ ok: false, reason: priced.reason });
  return NextResponse.json({ ok: true, lawn: priced.lawn, programs: priced.programs, addOns: priced.addOns });
}
