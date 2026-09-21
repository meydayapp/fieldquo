// app/api/reviews/wallet/google/route.js
//
// "Add to Google Wallet": the pay.google.com save link for the CONTRACTOR's
// own phone, as JSON { url } — the screen renders it as the button, because
// Google only honours the link when the page that opens it is one of the
// JWT's origins. Member-only; refuses in a sentence when unconfigured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { getAppOrigin } from "@/lib/appUrl";
import { googleWalletConfigured, googleWalletMissing } from "@/lib/reviews/wallet/config";
import { buildGoogleSaveUrl } from "@/lib/reviews/wallet/googlePass";
import { cardUrl } from "@/lib/reviews/card";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!googleWalletConfigured()) {
    return NextResponse.json(
      { error: `Google Wallet passes are not set up on this deployment (missing: ${googleWalletMissing().join(", ")}).` },
      { status: 503 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { id: true, name: true, logoUrl: true, brandColor: true, brandColors: true, defaultLanguage: true, slug: true, bookingSlug: true },
  });
  const origin = getAppOrigin(request);
  const slug = company?.bookingSlug || company?.slug || "";
  const target = cardUrl(origin, slug, "wallet");
  if (!target) return NextResponse.json({ error: "Set the company name first." }, { status: 404 });

  try {
    const url = buildGoogleSaveUrl({ company, reviewUrl: target, language: company.defaultLanguage, origin });
    if (!url) return NextResponse.json({ error: "Nothing to put on a pass yet." }, { status: 404 });
    return NextResponse.json({ url });
  } catch (err) {
    await recordError({
      area: "wallet_pass",
      code: "google_sign",
      message: `Google Wallet link could not be signed: ${err?.message || "unknown"}`,
      companyId: member.companyId,
    });
    return NextResponse.json({ error: `The pass could not be signed: ${err?.message || "unknown error"}` }, { status: 500 });
  }
}
