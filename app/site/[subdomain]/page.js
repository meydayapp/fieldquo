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
// ── Unpublished is a 404 for the public, and visible to its owner ───────────
//
// A stranger who finds an unpublished site gets notFound(). A half-finished
// site indexed by Google is worse than no site: it's the result that comes up
// when someone searches their name.
//
// But `?preview=1` renders it for a signed-in member of THAT company, which is
// how the editor shows a draft. Without this the preview panel could only show
// a page that was already public, so the only way to see your site was to
// publish it — which is the opposite of what a preview is for.
//
// The check is a real session lookup, not a secret in the URL: a guessable
// preview token pasted into a group chat is a published site nobody meant to
// publish.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { openingHoursSpecification, hasBusinessHours } from "@/lib/company/businessHours";
import SiteBlocks from "./SiteBlocks";
import { recentJobPhotos } from "@/lib/site/jobPhotos";
import { resolveSiteStyle } from "@/lib/site/siteStyles";

async function loadSite(subdomain, { preview = false } = {}) {
  const site = await db.companySite.findUnique({
    where: { subdomain: String(subdomain || "").toLowerCase() },
    select: {
      companyId: true,
      blocks: true,
      styleKey: true,
      published: true,
      seoTitle: true,
      seoDescription: true,
      subdomain: true,
      company: {
        select: {
          name: true,
          logoUrl: true,
          brandColor: true,
          brandColors: true,
          phone: true,
          email: true,
          address: true,
          city: true,
          province: true,
          slug: true,
          bookingSlug: true,
          // Feed the hours block, the "Open now" pill in the header, and
          // openingHoursSpecification below.
          businessHours: true,
          timezone: true,
          weekStartsOn: true,
        },
      },
    },
  });

  if (!site) return null;
  if (site.published) return site;
  if (!preview) return null;

  // Unpublished and a preview was asked for. Only the company that owns it may
  // see it — and only its own, which is why this compares companyId rather
  // than merely checking that somebody is signed in.
  try {
    const member = await getCurrentMember({
      headers: await headers(),
      method: "GET",
    });
    return member?.companyId === site.companyId ? { ...site, draft: true } : null;
  } catch {
    // getCurrentMember throws on a read-only impersonation session attempting a
    // write; it can also throw if auth is misconfigured. Either way an
    // unpublished page must not render.
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { subdomain } = await params;
  // Deliberately NOT preview-aware. Metadata for a draft would be metadata for
  // a page that doesn't exist publicly, and getting it wrong is how an
  // unpublished title ends up in a link preview when someone shares the URL.
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

export default async function CompanySitePage({ params, searchParams }) {
  const { subdomain } = await params;
  // Next 16: searchParams is a Promise, like params.
  const query = (await searchParams) || {};
  const site = await loadSite(subdomain, { preview: query.preview === "1" });
  if (!site) notFound();

  const company = site.company;
  const theme = documentTheme(company);
  const fill = fillPair(theme);

  let blocks = Array.isArray(site.blocks) ? site.blocks : [];

  // Auto-fill an empty gallery with real before/after job photos. A gallery the
  // company has curated (uploaded its own images) always wins; this only fills
  // one they left empty, turning their crews' on-site photos into a portfolio
  // with zero effort. Best-effort — recentJobPhotos never throws.
  const emptyGallery = blocks.some(
    (b) => b.type === "gallery" && b.visible !== false && !(b.content?.images?.length),
  );
  if (emptyGallery) {
    const photos = await recentJobPhotos(site.companyId, 8);
    if (photos.length) {
      blocks = blocks.map((b) =>
        b.type === "gallery" && !(b.content?.images?.length)
          ? { ...b, content: { ...b.content, images: photos } }
          : b,
      );
    }
  }

  return (
    <div style={{ backgroundColor: "#ffffff", color: theme.ink }}>
      {/* Only reachable by a signed-in member of this company. Says so out
          loud, because a preview that looks identical to the live site is how
          someone concludes they've published when they haven't.

          generateMetadata returns noindex for an unpublished page, so this is
          never crawled. */}
      {site.draft && (
        <div className="bg-amber-500 text-black text-center text-xs font-bold py-1.5 px-3">
          Draft preview — this page is not public yet.
        </div>
      )}

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
            // This is the line that puts "Open ⋅ Closes 5 PM" in a Google
            // result. For a contractor who will never think about SEO it is
            // most of the value of having a site at all — the box is seen by
            // people who never load the page.
            //
            // Omitted entirely when no hours are set. An empty array here has
            // been read as "open by appointment only" and as "always open",
            // neither of which anyone asked for.
            ...(hasBusinessHours(company.businessHours)
              ? { openingHoursSpecification: openingHoursSpecification(company.businessHours) }
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
        style={resolveSiteStyle(site.styleKey)}
      />
    </div>
  );
}
