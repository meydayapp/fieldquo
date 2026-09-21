// app/api/reviews/qr.png/route.js
//
// The same QR as app/api/reviews/qr.svg, rasterised — for the download
// button, because a print shop's order form takes a PNG and rarely an SVG.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { getAppOrigin } from "@/lib/appUrl";
import { qrPng } from "@/lib/reviews/qrPng";
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

  const size = clampQrSize(url.searchParams.get("size"), { fallback: 1024 });
  const png = await qrPng(payload.text, { size });
  const download = url.searchParams.get("download") === "1";
  return new NextResponse(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="qr-${payload.title}.png"` } : {}),
    },
  });
}
