// app/site/[subdomain]/page.js
//
// A company's public website. Reached by rewrite from
// <subdomain>.fieldquo.com — see middleware.js.
//
// ── Server-rendered on purpose ──────────────────────────────────────────────
//
// This is the one page in the product whose whole job is to be found by
// Google and read by a stranger on a bad connection. A client component that
// fetches its own content ships an empty shell to the crawler and a spinner to
// the visitor. Everything here renders on the server, in one query, and works
// with JavaScript switched off.
//
// ── Unpublished is a 404, not a preview ─────────────────────────────────────
//
// A company that hasn't published gets notFound(), not a "coming soon" page.
// A half-finished site indexed by Google is worse than no site: it's the
// result that comes up when someone searches their name.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import SiteBlocks from "./SiteBlocks";

async function loadSite(subdomain) {
  const site = await db.companySite.findUnique({
    where: { subdomain: String(subdomain || "").toLowerCase() },
    select: {
      blocks: true,
      published: true,
      seoTitle: true,
      seoDescription: true,
      subdomain: true,
      company: {
        select: {
          name: true,
          logoUrl: true,
          brandColor: true,
          phone: true,
          email: true,
          address: true,
          city: true,
          province: true,
          slug: true,
          bookingSlug: true,
        },
      },
    },
  });

  if (!site || !site.published) return null;
  return site;
}

export async function generateMetadata({ params }) {
  const { subdomain } = await params;
  const site = await loadSite(subdomain);
  if (!site) return { title: "Not found", robots: { index: false } };

  const c = site.company;
  const place = [c.city, c.province].filter(Boolean).join(", ");

  const title = site.seoTitle || (place ? `${c.name} — ${place}` : c.name);
  const description =
    site.seoDescription ||
    `${c.name}${place ? ` in ${place}` : ""}. Get a free quote.`;

  return {
    title,
    description,
    // Indexable, unlike every other public surface in this product. A
    // marketing site nobody can find is the one thing this feature must not
    // be.
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      ...(c.logoUrl ? { images: [c.logoUrl] } : {}),
    },
  };
}

export default async function CompanySitePage({ params }) {
  const { subdomain } = await params;
  const site = await loadSite(subdomain);
  if (!site) notFound();

  const company = site.company;
  const theme = documentTheme(company);
  const fill = fillPair(theme);

  const blocks = Array.isArray(site.blocks) ? site.blocks : [];

  return (
    <div style={{ backgroundColor: "#ffffff", color: theme.ink }}>
      {/* Structured data so a search engine can read the business rather than
          infer it. This is most of the value of the feature for a contractor
          who will never think about SEO. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: company.name,
            ...(company.phone ? { telephone: company.phone } : {}),
            ...(company.email ? { email: company.email } : {}),
            ...(company.logoUrl ? { image: company.logoUrl } : {}),
            url: `https://${site.subdomain}.fieldquo.com`,
            ...(company.address || company.city
              ? {
                  address: {
                    "@type": "PostalAddress",
                    ...(company.address ? { streetAddress: company.address } : {}),
                    ...(company.city ? { addressLocality: company.city } : {}),
                    ...(company.province ? { addressRegion: company.province } : {}),
                  },
                }
              : {}),
          }),
        }}
      />

      <SiteBlocks
        blocks={blocks}
        company={company}
        theme={theme}
        fill={fill}
        subdomain={site.subdomain}
      />
    </div>
  );
}
