// app/api/reviews/qr.svg/route.js
//
// The company's QR as an SVG, for the settings screen and the download
// button. Member-only: the card is public, but which company a member
// belongs to is what decides the slug, and the review link is theirs.
//
//   ?of=card|review|contact   what it encodes — lib/reviews/qrTarget.js
//   ?ref=qr|sticker|nfc|…     the source stamped on a card URL
//   ?size=                    rendered edge in px, 96–2048
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { getAppOrigin } from "@/lib/appUrl";
import { qrSvg } from "@/lib/reviews/qr";
import { qrPayload, clampQrSize } from "@/lib/reviews/qrTarget";
import { loadCardData, cardVCards } from "@/lib/reviews/cardData";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const url = new URL(request.url);
  const origin = getAppOrigin(request);
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { slug: true, bookingSlug: true, reviewUrl: true },
  });
  const slug = company?.bookingSlug || company?.slug || "";
  const card = slug ? await loadCardData(slug, { origin }) : null;
  const compact = card ? cardVCards(card, { origin }).compact : null;

  const payload = qrPayload({
    target: url.searchParams.get("of"),
    origin,
    slug,
    ref: url.searchParams.get("ref") || "qr",
    reviewUrl: company?.reviewUrl || null,
    compactVCard: compact,
  });
  if (!payload) {
    return NextResponse.json({ error: "Nothing to encode yet — add the link or the company details first." }, { status: 404 });
  }

  const size = clampQrSize(url.searchParams.get("size"));
  const svg = qrSvg(payload.text, { size, margin: 4 });
  const download = url.searchParams.get("download") === "1";
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="qr-${payload.title}.svg"` } : {}),
    },
  });
}
