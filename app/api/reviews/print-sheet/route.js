// app/api/reviews/print-sheet/route.js
//
// The printable sheet — lib/reviews/printSheet.js — as a page the browser
// opens in a new tab and prints. Member-only for the same reason the QR is.
// The document language is the COMPANY's default (a van sticker is in the
// company's language); the toolbar's one word is in the member's.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { getAppOrigin } from "@/lib/appUrl";
import { readerLanguage } from "@/lib/i18n/readerLanguage";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { printSheetHtml } from "@/lib/reviews/printSheet";
import { cardUrl } from "@/lib/reviews/card";
import { loadCardData, cardVCards } from "@/lib/reviews/cardData";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const origin = getAppOrigin(request);
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      name: true, logoUrl: true, brandColor: true, brandColors: true,
      defaultLanguage: true, slug: true, bookingSlug: true,
    },
  });
  const slug = company?.bookingSlug || company?.slug || "";
  const card = slug ? await loadCardData(slug, { origin }) : null;
  if (!card) return NextResponse.json({ error: "Set the company name first." }, { status: 404 });
  const { compact } = cardVCards(card, { origin });

  const ui = await readerLanguage({ userId: member.userId, companyId: member.companyId });
  const printLabel = APP_MESSAGES[ui]?.["app.action.print"] || APP_MESSAGES.en["app.action.print"] || "Print";

  const html = printSheetHtml({
    company,
    cardUrl: cardUrl(origin, slug, "sticker"),
    vcard: compact,
    language: company.defaultLanguage,
    printLabel,
  });
  if (!html) return NextResponse.json({ error: "Nothing to print yet." }, { status: 404 });

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
