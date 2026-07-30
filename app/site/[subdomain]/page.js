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
import { recentJobPhotos, jobPhotoPairs } from "@/lib/site/jobPhotos";
import { resolveSiteStyle } from "@/lib/site/siteStyles";
import { categoryLabel } from "@/lib/i18n/translateContent";

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
      languages: true,
      translations: true,
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
          // Read at request time, not snapshotted into the block, so adding a
          // town in Settings changes the public page without regenerating it.
          // The whole reason the areas block is `derived`.
          workAreas: { select: { name: true }, orderBy: { name: "asc" }, take: 40 },
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

export async function generateMetadata({ params, language: langParam }) {
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

  const enabled =
    Array.isArray(site.languages) && site.languages.length ? site.languages : ["en"];
  const primary = enabled[0];
  const language = langParam || primary;
  const origin = `https://${site.subdomain}.fieldquo.com`;

  // Translated title/description when this is a translated page. Falling back to
  // the primary's would put an English <title> on a French page, which is what
  // search engines actually read.
  const tr =
    language !== primary && site.translations?.[language]
      ? site.translations[language]
      : null;

  return {
    title: tr?.seoTitle || title,
    description: tr?.seoDescription || description,
    // Indexable, unlike every other public surface in this product. A
    // marketing site nobody can find is the one thing this feature must not
    // be.
    robots: { index: true, follow: true },
    // hreflang. Without these, two languages of the same page look like
    // duplicate content and search engines pick one and drop the other — which
    // wastes the whole point of translating it.
    ...(enabled.length > 1
      ? {
          alternates: {
            canonical: language === primary ? origin : `${origin}/${language}`,
            languages: Object.fromEntries(
              enabled.map((code) => [
                code,
                code === primary ? origin : `${origin}/${code}`,
              ]),
            ),
          },
        }
      : {}),
    openGraph: {
      title,
      description,
      type: "website",
      ...(c.logoUrl ? { images: [c.logoUrl] } : {}),
    },
  };
}

export default async function CompanySitePage({ params, searchParams, language: langParam }) {
  const { subdomain } = await params;
  // Next 16: searchParams is a Promise, like params.
  const query = (await searchParams) || {};
  const site = await loadSite(subdomain, { preview: query.preview === "1" });
  if (!site) notFound();

  // workAreas comes back as [{ name }]; the renderer wants names. Flattened
  // here rather than in the component so the component stays a pure function of
  // its props and can be rendered in the editor preview with the same shape.
  const company = {
    ...site.company,
    workAreas: (site.company.workAreas || []).map((a) => a.name).filter(Boolean),
  };
  const theme = documentTheme(company);
  const fill = fillPair(theme);

  // ── Which language ──────────────────────────────────────────────────────
  //
  // The first entry in `languages` is the PRIMARY and lives at the root URL;
  // the rest live at /<code>. An unknown or not-enabled code 404s rather than
  // silently serving the primary — a link to /de that quietly returns English
  // gets indexed as a duplicate and tells the visitor nothing went wrong.
  const enabled =
    Array.isArray(site.languages) && site.languages.length
      ? site.languages
      : ["en"];
  const primary = enabled[0];
  const language = langParam || primary;
  if (langParam && !enabled.includes(langParam)) notFound();

  const translations = site.translations && typeof site.translations === "object"
    ? site.translations
    : {};
  const translated = language !== primary ? translations[language] : null;

  let blocks = Array.isArray(translated?.blocks)
    ? translated.blocks
    : Array.isArray(site.blocks)
      ? site.blocks
      : [];

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

  // Same rule for the before/after slider: a pair the company curated wins, an
  // empty block fills itself from two-photo job visits. This is what makes the
  // section keep working as crews upload more work, without anyone opening the
  // builder again.
  const emptyPairs = blocks.some(
    (b) => b.type === "beforeafter" && b.visible !== false && !(b.content?.pairs?.length),
  );
  if (emptyPairs) {
    const pairs = await jobPhotoPairs(site.companyId, 6);
    if (pairs.length) {
      blocks = blocks.map((b) =>
        b.type === "beforeafter" && !(b.content?.pairs?.length)
          ? { ...b, content: { ...b.content, pairs } }
          : b,
      );
    }
  }

  // ── Services reconcile against what the company CURRENTLY offers ─────────
  //
  // The services block stores names and blurbs, so it was a snapshot taken when
  // the page was generated: enable a new trade in Settings and the website kept
  // advertising the old list until somebody remembered to regenerate. A public
  // page that omits a service you now offer costs you the call; one that lists a
  // service you dropped costs you the argument.
  //
  // So: the LIST comes from the database every request, and the blurbs come from
  // the block. A service that's still offered keeps whatever was written about
  // it; a new one appears with no blurb (the renderer shows the name alone);
  // a removed one disappears.
  //
  // The NAME comes from the database in the page's language. This block used to
  // read `label` unconditionally, which is why a French site listed "Interior
  // Painting" under a French heading — the reconcile overwrote whatever was
  // there with English on every request, so no amount of regenerating could fix
  // it. Blurbs are then matched on EITHER the translated name or the English
  // one, because a translation generated before this existed has English names
  // in the block and its blurbs are still worth keeping.
  const servicesBlock = blocks.find((b) => b.type === "services" && b.visible !== false);
  if (servicesBlock) {
    const enabled = await db.companyServiceCategory.findMany({
      where: { companyId: site.companyId, enabled: true },
      select: { category: { select: { label: true, labelTranslations: true } } },
    });
    const current = enabled
      .map((e) => e.category)
      .filter(Boolean)
      .map((c) => ({ name: categoryLabel(c, language), fallback: c.label }))
      .filter((c) => c.name);
    if (current.length) {
      const key = (s) => String(s || "").trim().toLowerCase();
      const blurbs = new Map(
        (servicesBlock.content?.items || [])
          .filter((it) => it?.name)
          .map((it) => [key(it.name), it.description || ""]),
      );
      const items = current.slice(0, 8).map(({ name, fallback }) => ({
        name,
        description: blurbs.get(key(name)) || blurbs.get(key(fallback)) || "",
      }));
      blocks = blocks.map((b) =>
        b === servicesBlock ? { ...b, content: { ...b.content, items } } : b,
      );
    }
  }

  // The `feature` services variant needs a photo per row. Threaded from the same
  // pool the gallery uses rather than asking the company to upload twice — and
  // without this the variant silently fell back to text-only rows, which is a
  // layout choice that looks available and isn't.
  const featureServices = blocks.some(
    (b) => b.type === "services" && b.visible !== false && b.content?.variant === "feature",
  );
  if (featureServices) {
    const pool = await recentJobPhotos(site.companyId, 8);
    const gallery = blocks.find((b) => b.type === "gallery")?.content?.images || [];
    const images = [...new Set([...gallery, ...pool])];
    if (images.length) {
      blocks = blocks.map((b) =>
        b.type === "services" && b.content?.variant === "feature"
          ? { ...b, content: { ...b.content, featureImages: images } }
          : b,
      );
    }
  }

  // Company map: workAreas arrives on `company` and the areas block reads it
  // from there, so nothing needs to be threaded separately into SiteBlocks.

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
        language={language}
        languages={enabled}
      />
    </div>
  );
}
