// app/api/reviews/wallet/apple/route.js
//
// "Add to Apple Wallet": the signed .pkpass for the CONTRACTOR's own phone.
// Member-only. Refuses, in a sentence, when the signing identity is not on
// this deployment — the screen already says "not set up yet", and this is
// the second gate behind it.
//
// The pass's QR opens the digital business card with ?ref=wallet, so a
// customer who scans the phone held up at the door lands on the same page
// the sticker opens, and the tap is counted under its own source.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { getAppOrigin } from "@/lib/appUrl";
import { appleWalletConfigured, appleWalletMissing } from "@/lib/reviews/wallet/config";
import { buildApplePass, PKPASS_MIME } from "@/lib/reviews/wallet/applePass";
import { cardUrl } from "@/lib/reviews/card";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!appleWalletConfigured()) {
    return NextResponse.json(
      { error: `Apple Wallet passes are not set up on this deployment (missing: ${appleWalletMissing().join(", ")}).` },
      { status: 503 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { id: true, name: true, logoUrl: true, brandColor: true, brandColors: true, defaultLanguage: true, slug: true, bookingSlug: true },
  });
  const slug = company?.bookingSlug || company?.slug || "";
  const target = cardUrl(getAppOrigin(request), slug, "wallet");
  if (!target) return NextResponse.json({ error: "Set the company name first." }, { status: 404 });

  let pass;
  try {
    pass = await buildApplePass({ company, reviewUrl: target, language: company.defaultLanguage });
  } catch (err) {
    await recordError({
      area: "wallet_pass",
      code: "apple_sign",
      message: `Apple Wallet pass could not be signed: ${err?.message || "unknown"}`,
      companyId: member.companyId,
    });
    return NextResponse.json({ error: `The pass could not be signed: ${err?.message || "unknown error"}` }, { status: 500 });
  }
  if (!pass) return NextResponse.json({ error: "Nothing to put on a pass yet." }, { status: 404 });

  return new NextResponse(pass, {
    status: 200,
    headers: {
      "Content-Type": PKPASS_MIME,
      "Content-Disposition": `attachment; filename="${(company.name || "card").replace(/[^A-Za-z0-9 _-]/g, "").trim() || "card"}.pkpass"`,
      "Cache-Control": "private, no-store",
    },
  });
}
