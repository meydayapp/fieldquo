// docs/screens/app-guide/harness/fixtures/public.js
//
// Props for the client-facing pages whose page.js reads the database on the
// server and hands a finished object to a component — the website
// (app/site/[subdomain]/page.js → SiteBlocks) and the bio link
// (app/l/[slug]/page.js → LinkPageView). esbuild cannot bundle those server
// pages for a browser (they import @/lib/db and next/headers), so the harness
// mounts the component they mount, with props built HERE the way the page
// builds them: the same pure helpers (siteFromCompany, sanitiseBlocks,
// resolvePages, documentTheme, sanitiseLinkConfig, linkCandidates), over the
// fixture company, so the figure is what the server would have produced and
// not a hand-typed copy of it. guide.jsx picks a builder by the row's
// `props` key.
import { COMPANY } from "./company.js";
import { SERVICE_CATEGORIES, EVENT_TYPES } from "./routes-settings-a.js";
import { TESTIMONIALS, SITE_BLOCKS, WEBSITE, LINK_PAGE } from "./routes-settings-b.js";
import { siteFromCompany, sanitiseBlocks } from "@/app/data/siteBlocks";
import { resolvePages, findPage, navPages, HOME_SLUG } from "@/lib/site/pages";
import { resolveSiteStyle } from "@/lib/site/siteStyles";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { sanitiseLinkConfig } from "@/lib/links/config";
import { linkCandidates } from "@/lib/links/candidates";

// Job photos, as data URIs: the fixture company has no Cloudinary account,
// and a photo that must be fetched is a photo that may not arrive before the
// frame is taken. Two tones per swatch so the gallery reads as photographs
// of wood and paint rather than as six identical tiles.
const swatch = (a, b, c) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><rect x="60" y="150" width="520" height="210" rx="6" fill="${c}" opacity="0.35"/><rect x="60" y="150" width="250" height="210" rx="6" fill="rgba(0,0,0,0.10)"/><rect x="330" y="150" width="250" height="210" rx="6" fill="rgba(255,255,255,0.14)"/></svg>`,
  );
export const JOB_PHOTOS = [
  swatch("#ede8df", "#c9c1b2", "#ffffff"),
  swatch("#b8864f", "#7a4f22", "#e6c690"),
  swatch("#dfe4e8", "#9aa6b1", "#ffffff"),
  swatch("#e9e4d8", "#b9b2a3", "#ffffff"),
  swatch("#9a7350", "#5c3f22", "#d2a878"),
  swatch("#cfd6d2", "#6f8078", "#ffffff"),
];

// ── The website ─────────────────────────────────────────────────────────────
// What loadSite() selects, plus the shape CompanySitePage makes of it: the
// work areas flattened to names, the subscription split off (the Shop plan
// is paid, so no "Site by FieldQuo" credit — lib/billing/access.js).
const siteCompany = () => ({
  name: COMPANY.name,
  logoUrl: COMPANY.logoUrl,
  brandColor: COMPANY.brandColor,
  brandColors: COMPANY.brandColors,
  phone: COMPANY.phone,
  email: COMPANY.email,
  address: COMPANY.address,
  city: COMPANY.city,
  province: COMPANY.province,
  slug: COMPANY.slug,
  bookingSlug: COMPANY.bookingSlug,
  businessHours: COMPANY.businessHours,
  timezone: COMPANY.timezone,
  weekStartsOn: COMPANY.weekStartsOn,
  workAreas: ["Laval", "Boisbriand", "Rosemère", "Sainte-Thérèse", "Blainville", "Terrebonne"],
});

// The factual site the generator falls back to, over the fixture's own
// services, testimonials and photos — then the sentences the Website screen
// shows the model wrote (SITE_BLOCKS), merged in the way
// lib/site/generateSite.js merges them: copy only, never a block the data
// does not support. Through sanitiseBlocks last, as the save route does.
const siteBlocks = () => {
  const company = siteCompany();
  const services = SERVICE_CATEGORIES.filter((c) => c.enabled).map((c) => ({ key: c.key, label: c.label }));
  const testimonials = TESTIMONIALS.filter((t) => t.approved);
  const factual = siteFromCompany({ company, services, testimonials, photos: JOB_PHOTOS, areas: company.workAreas });
  const written = Object.fromEntries(SITE_BLOCKS.map((b) => [b.type, b.content || {}]));
  const merged = factual.map((b) => {
    const w = written[b.type];
    if (!w) return b;
    if (b.type === "hero") return { ...b, content: { ...b.content, headline: w.heading || b.content.headline, subhead: w.subheading || b.content.subhead, ctaLabel: w.cta || b.content.ctaLabel } };
    if (b.type === "about") return { ...b, content: { ...b.content, heading: w.heading, body: w.body } };
    if (b.type === "cta") return { ...b, content: { ...b.content, heading: w.heading || b.content.heading, sub: w.body || b.content.sub } };
    return b;
  });
  return sanitiseBlocks(merged);
};

function site({ lang }) {
  const company = siteCompany();
  const theme = documentTheme(company);
  const blocks = siteBlocks();
  const pages = resolvePages({ blocks, pages: null });
  const page = findPage(pages, HOME_SLUG);
  const languages = WEBSITE.site.languages;
  // The site's own language list decides, as the route does: a language the
  // owner did not enable is a 404 there, and here falls back to the primary.
  const language = languages.includes(lang) ? lang : languages[0];
  return {
    blocks: page.blocks,
    company,
    theme,
    fill: fillPair(theme),
    subdomain: WEBSITE.site.subdomain,
    style: resolveSiteStyle(WEBSITE.site.styleKey),
    language,
    languages,
    menu: navPages(pages),
    currentPage: page.slug,
    linkBase: "",
    linkSuffix: "",
    showFieldquoCredit: false,
  };
}

// ── The bio link ────────────────────────────────────────────────────────────
// lib/links/load.js shape(): the company row its SELECT reads, the saved
// page through sanitiseLinkConfig, and the candidates from what the company
// actually has (a published site, active event types, no priceable
// estimator — Settings › Instant quotes has refinishing on, so one).
function bioLink({ lang }) {
  const company = {
    id: COMPANY.id,
    name: COMPANY.name,
    slug: COMPANY.slug,
    bookingSlug: COMPANY.bookingSlug,
    logoUrl: COMPANY.logoUrl,
    brandColor: COMPANY.brandColor,
    phone: COMPANY.phone,
    email: COMPANY.email,
    website: COMPANY.website,
    city: COMPANY.city,
    province: COMPANY.province,
    country: COMPANY.country,
    reviewUrl: "https://g.page/r/erable-design-cabinetry/review",
    defaultLanguage: ["en", "fr", "es"].includes(lang) ? lang : "fr",
  };
  const config = sanitiseLinkConfig({
    published: LINK_PAGE.published,
    headline: LINK_PAGE.headline,
    bio: LINK_PAGE.bio,
    items: LINK_PAGE.links.map((l) => ({ key: l.key, enabled: l.enabled, url: l.url, label: l.kind === "custom" ? l.label : undefined })),
  });
  const candidates = linkCandidates({
    company,
    site: { subdomain: WEBSITE.site.subdomain, published: WEBSITE.site.published },
    activeEventTypes: EVENT_TYPES.filter((e) => e.active).length,
    enabledEstimators: 1,
    funnels: [{ slug: "kitchen-quote", name: "Kitchen quote — landing page", status: "published" }],
  });
  return { company, config, candidates };
}

export const PUBLIC_PROPS = { site, bioLink };
