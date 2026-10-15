// lib/seo/structuredData.js
//
// The JSON-LD the marketing site prints: Organization on every marketing
// page, Product with Offers on /pricing, FAQPage on the homepage. Pure
// builders, so the pages and scripts/check-site-seo.mjs run the same code.
//
// ══ What each may claim ═══════════════════════════════════════════════════
//
// Organization: the name, the canonical URL, the logo and a contact address.
//   `sameAs` is OMITTED, not empty: it lists profiles elsewhere (LinkedIn,
//   G2, Capterra…) and FieldQuo has none it can point to yet. Add one only
//   when the profile exists — a sameAs to nothing is a claim a crawler checks.
//   The founder's LinkedIn is HIS profile, not the company's, so it sits on
//   `founder` (a Person) and never in the Organization's own sameAs.
//
// Product/Offer: exactly the figures /pricing prints for the plans sold in
//   CAD, resolved by the same functions (planOffer through withOffers), so a
//   sale is reflected the moment the page reflects it and the two cannot
//   disagree. Each tier offers two prices — the monthly charge and the 1-year
//   charge — as UnitPriceSpecifications with their billing period, because
//   "$82.50" without "a month, billed yearly" is not the price.
//
// FAQPage: the question and answer text the visible FAQ renders, built by
//   the SAME function (lib/marketing/homeFaq.js) from the same catalogue, in
//   English — the language the server renders the page in. Google requires
//   the marked-up text to be visible on the page; one builder makes that true
//   by construction rather than by care.

import { FOUNDER } from "@/lib/marketing/founder";

const ORG_NAME = "FieldQuo";

export function organizationLd(origin) {
  const base = String(origin || "").replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORG_NAME,
    url: `${base}/`,
    logo: `${base}/logo/FieldQuo_icon_1024.png`,
    email: "hello@fieldquo.com",
    founder: {
      "@type": "Person",
      name: FOUNDER.name,
      ...(FOUNDER.photoUrl ? { image: `${base}${FOUNDER.photoUrl}` } : {}),
      ...(FOUNDER.linkedinUrl ? { sameAs: [FOUNDER.linkedinUrl] } : {}),
    },
  };
}

/** "82.5" → "82.50": schema.org prices are decimal strings, cents always shown. */
function decimal(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : null;
}

/**
 * @param plans  ladder rows already passed through withOffers — each with
 *               { name, tierKey, currency, seats, crewSeats, offers: { month, year } }
 */
export function pricingProductLd({ origin, plans = [] }) {
  const base = String(origin || "").replace(/\/+$/, "");
  const offers = [];
  for (const plan of plans) {
    for (const interval of ["year", "month"]) {
      const offer = plan.offers?.[interval];
      if (!offer?.available) continue;
      const price = decimal(offer.charge);
      if (price === null) continue;
      offers.push({
        "@type": "Offer",
        name: `${plan.name} — ${interval === "year" ? "1-year plan" : "monthly plan"}`,
        url: `${base}/pricing`,
        price,
        priceCurrency: plan.currency,
        availability: "https://schema.org/InStock",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price,
          priceCurrency: plan.currency,
          // ISO 8601 durations, as schema.org's billingDuration takes them.
          billingDuration: interval === "year" ? "P1Y" : "P1M",
          ...(interval === "year" && decimal(offer.perMonth) !== null
            ? { description: `${decimal(offer.perMonth)} ${plan.currency} a month, billed yearly` }
            : {}),
        },
        eligibleQuantity: plan.seats
          ? { "@type": "QuantitativeValue", value: plan.seats, unitText: "office seats" }
          : undefined,
      });
    }
  }
  if (!offers.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "FieldQuo",
    description:
      "Field service software for trades contractors: quotes, scheduling, invoicing and payments in one system. Every feature on every plan; plans differ by how many people use them.",
    brand: { "@type": "Brand", name: ORG_NAME },
    url: `${base}/pricing`,
    offers: offers.map((o) => JSON.parse(JSON.stringify(o))),
  };
}

/** @param items [{ q, a }] — exactly what the visible FAQ renders. */
export function faqPageLd(items = []) {
  const rows = (items || []).filter((i) => i?.q && i?.a);
  if (!rows.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: rows.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

/**
 * Serialise for a <script type="application/ld+json">. "<" is escaped so no
 * string inside — an FAQ answer, a plan name typed in /platform — can close
 * the script element early.
 */
export function ldJson(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
