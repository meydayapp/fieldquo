// app/c/[slug]/page.js
//
// The digital business card. The page a stranger lands on from the QR on
// the van door, the NFC tag on the counter, the wallet pass held up at the
// end of a job, or the sticker on an invoice.
//
// ── What it reuses, and what it adds ────────────────────────────────────────
//
// The rows are the bio link's (lib/links, app/l/[slug]): the same loader,
// the same on/off choices, the same social handles, the same measured theme
// — so a contractor who arranged their bio-link page has arranged their card
// too, and the settings preview of one is a preview of the other. What a
// card has that a bio link does not: "Save our contact" at the top (a plain
// anchor to ./contact.vcf, which every phone opens as a contact), the
// address under the name linked to a map, and the labels in the VISITOR's
// language — a bio link is read by the contractor's own audience, a card by
// whoever scanned it. lib/reviews/card.js says why.
//
// ── ?ref= is recorded here, server-side ─────────────────────────────────────
//
// One `card_tap` row with the source as its path, written as the page
// renders, inside `after()` so the render is not held for it. Not a beacon:
// a browser cannot post "taps from the van sticker". A page served to a
// link-preview bot counts too, which is the same floor every server-side
// view count has and the settings screen says "taps", not "people".
//
// ── Always renders when the company exists ──────────────────────────────────
//
// Not gated on the bio link's `published` switch: this page is what the
// QR prints, and a QR that opens a 404 because a different screen's toggle
// is off is the dead-control shape AGENTS.md is about. A company with every
// row switched off gets its name, logo, address and the save-contact button
// — a card, not an empty page.
//
// ── noindex, follow — the bio link's reasoning applies whole ────────────────
//
// A search result shows its domain, and `fieldquo.com/c/northline` under
// "Northline Painting" tells the searcher which software the contractor
// uses. See app/l/[slug]/page.js.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { getAppOrigin } from "@/lib/appUrl";
import { pickVisitorLanguage } from "@/lib/i18n/acceptLanguage";
import { loadCardData } from "@/lib/reviews/cardData";
import { cleanCardSource } from "@/lib/reviews/card";
import { recordCardTap } from "@/lib/analytics/product/server";
import LinkPageView from "@/app/components/links/LinkPageView";

async function load(slug) {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  let origin;
  try {
    origin = getAppOrigin();
  } catch {
    origin = host ? `${proto}://${host}` : "";
  }
  // The visitor's language first; the company's default decides the
  // fallback, so loadCardData's own fallback is only reached for a company
  // with no default at all.
  const accept = h.get("accept-language");
  const probe = await loadCardData(slug, { origin });
  if (!probe) return null;
  const language = pickVisitorLanguage(accept, probe.company.defaultLanguage);
  return language === probe.language ? probe : loadCardData(slug, { language, origin });
}

export async function generateMetadata({ params }) {
  // Next 16: params is a Promise.
  const { slug } = await params;
  const card = await load(slug);
  if (!card) return { robots: { index: false, follow: false } };
  const { company } = card;
  return {
    title: company.name,
    robots: { index: false, follow: true },
    openGraph: {
      title: company.name,
      ...(company.logoUrl ? { images: [company.logoUrl] } : {}),
    },
  };
}

export default async function BusinessCardPage({ params, searchParams }) {
  const { slug } = await params;
  // Next 16: searchParams is a Promise too.
  const { ref } = (await searchParams) || {};
  const card = await load(slug);
  if (!card) notFound();

  const source = cleanCardSource(ref);
  after(() => recordCardTap({ companyId: card.company.id, source, language: card.language }));

  return (
    <LinkPageView
      company={card.company}
      config={card.config}
      candidates={card.candidates}
      language={card.language}
      saveContact={card.saveContact}
      address={card.address}
    />
  );
}
