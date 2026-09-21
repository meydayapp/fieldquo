// app/c/[slug]/contact.vcf/route.js
//
// The company as a contact file. "Save our contact" on the card links here;
// so does the NFC "Contact" record's fallback URL.
//
// ── The headers that make a phone prompt ────────────────────────────────────
//
//   Content-Type: text/vcard; charset=utf-8   the registered type (RFC 6350).
//       iOS Safari opens a text/vcard response in the Contacts sheet —
//       "Create New Contact / Add to Existing" — and Android hands it to the
//       Contacts app. Served as text/plain, both would DISPLAY the file as
//       text, which is the failure this header exists to prevent.
//   Content-Disposition: attachment; filename="<name>.vcf"
//       Android Chrome downloads a .vcf and offers to open it; without
//       `attachment` some builds render it inline as text. iOS Safari shows
//       its download sheet first for an attachment and opens Contacts from
//       it; the tap-through is one more than `inline`, but `inline` breaks
//       the Android path, and one flow that works on both is worth the tap.
//   X-Content-Type-Options: nosniff
//       so nothing second-guesses the type.
//
// No caching: the logo and the links are live.
//
// ── The photo ───────────────────────────────────────────────────────────────
//
// The logo, fetched from Cloudinary, flattened onto white (JPEG has no
// alpha), 400px on its long side, quality stepped down until the encoded
// file is under 100 KB. A logo that will not download is left out; the
// contact is still complete without it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/appUrl";
import { loadCardData, cardVCards, vcfFilename } from "@/lib/reviews/cardData";
import { rateLimit } from "@/lib/rateLimit";

const PHOTO_MAX_BYTES = 100 * 1024;

async function logoPhoto(logoUrl) {
  if (!logoUrl || !/^https:\/\//i.test(logoUrl)) return null;
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    const sharp = (await import("sharp")).default;
    for (const [size, quality] of [[400, 82], [320, 72], [240, 60], [160, 50]]) {
      const jpeg = await sharp(raw)
        .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (jpeg.length <= PHOTO_MAX_BYTES) return { base64: jpeg.toString("base64"), type: "JPEG" };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { slug } = await params;
  const limited = rateLimit(request, "card-vcf", { limit: 60, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const origin = getAppOrigin(request);
  const card = await loadCardData(slug, { origin });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The company's default language for the NOTE labels: the file lives on
  // the homeowner's phone in the company's words, not the browser's.
  const inCompanyLanguage = card.language === (card.company.defaultLanguage || "en")
    ? card
    : await loadCardData(slug, { origin, language: card.company.defaultLanguage || "en" });

  const photo = await logoPhoto(card.company.logoUrl);
  const { full } = cardVCards(inCompanyLanguage, { origin, photo });
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(full, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${vcfFilename(card.company.name)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
