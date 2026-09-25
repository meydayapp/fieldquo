// lib/proposal/load.js
//
// The database half of the client proposal: everything the sections beside
// the quote are built from, read per company, plus the waivers attached to
// one quote. lib/proposal/sections.js decides what renders; this only loads.
//
// Every read is scoped to the company the QUOTE row names — the public
// route reaches this with a share token and no session, and the tenant is
// whatever the quote says it is. Nothing here selects a price, a rate, an
// expiry date or an internal id for a client-facing projection; the
// projections (`presentDocument`, the gallery's two URLs and a caption, a
// review's words and name) are the whole of what leaves the building.

import { db as realDb } from "@/lib/db";
import { loadCompanyGallery } from "@/lib/company/gallery";
import { clientVisibleDocuments, presentDocument, sanitiseWaiverBody } from "@/lib/company/documents";
import { loadPublicReviews } from "@/lib/reviews/publicReviews";
import { loadPhrases } from "@/lib/i18n/phrases";
import { serviceName, customCategoryPhrases } from "@/lib/i18n/serviceName";
import { resolveProposalSections, renderedSectionKeys, sanitisePresentation, dayPlan, paintSpec } from "@/lib/proposal/sections";
import { tradeLabourDetail, tradeLabourHours } from "@/lib/pricing/tradeScope";
import { paintTakeoff } from "@/lib/pricing/paintTakeoff";
import { getPriceBook } from "@/app/data/tradePriceBooks";

const HTTP_URL = /^https?:\/\//i;
const str = (v) => (typeof v === "string" ? v.trim() : "");

/** The Company columns the proposal reads. Spread into a select. */
export const PROPOSAL_COMPANY_SELECT = {
  story: true,
  storyHeadline: true,
  storyVideoUrl: true,
  teamPhotoUrl: true,
  proposalSections: true,
};

/** The "About us" content, or null when the company wrote nothing. */
export function aboutFrom(company) {
  const story = str(company?.story);
  if (!story) return null;
  const video = str(company?.storyVideoUrl);
  const photo = str(company?.teamPhotoUrl);
  return {
    headline: str(company?.storyHeadline) || null,
    story,
    videoUrl: HTTP_URL.test(video) ? video : null,
    teamPhotoUrl: HTTP_URL.test(photo) ? photo : null,
  };
}

/**
 * Everything behind the optional sections, for one company, in the
 * document's language. `presentation` is the quote's own overrides (already
 * sanitised or raw — both are accepted).
 */
export async function loadProposalContent({ companyId, company, language = "en", presentation = null, db = realDb }) {
  const pres = sanitisePresentation(presentation);
  const [gallery, documents, reviews, enabled] = await Promise.all([
    loadCompanyGallery(companyId, { db }).catch(() => []),
    db.companyDocument.findMany({
      where: { companyId, archivedAt: null, showOnQuotes: true, type: { not: "waiver" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, type: true, title: true, summary: true, fileUrl: true, mimeType: true, expiresAt: true, showOnQuotes: true, archivedAt: true },
    }),
    loadPublicReviews(companyId).catch(() => []),
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      // companyId only to tell the company's own services from the catalogue's
      // (lib/i18n/serviceName.js); it never leaves this function.
      select: { category: { select: { key: true, label: true, labelTranslations: true, companyId: true } } },
    }),
  ]);

  const visibleDocs = clientVisibleDocuments(documents, { ids: pres.documentIds });
  const categories = enabled.map((e) => e.category).filter(Boolean);

  // The company's own short texts in the document's language — captions,
  // document titles and summaries, and the names of services it created
  // itself, are drafted on save (lib/i18n/phrases.js); anything not yet
  // drafted prints as the company wrote it.
  const tr = await loadPhrases(db, companyId, language, [
    ...gallery.map((p) => ({ ns: "galleryCaption", text: p.caption })),
    ...visibleDocs.flatMap((d) => [{ ns: "documentTitle", text: d.title }, { ns: "documentSummary", text: d.summary }]),
    ...customCategoryPhrases(categories),
  ]);

  const services = categories
    .map((c) => ({ key: c.key, label: serviceName(c, language, tr) }))
    .filter((s) => s.label);

  const about = aboutFrom(company);
  const content = {
    about,
    gallery: gallery.map((p) => ({ before: p.beforeUrl, after: p.afterUrl, caption: p.caption ? tr("galleryCaption", p.caption) : "" })),
    documents: visibleDocs
      .map((d) => ({ ...d, title: tr("documentTitle", d.title), summary: d.summary ? tr("documentSummary", d.summary) : d.summary }))
      .map(presentDocument),
    testimonials: reviews,
    services,
  };
  const sections = resolveProposalSections({
    company,
    quote: { presentation },
    content: {
      about: Boolean(about),
      beforeAfter: content.gallery.length,
      documents: content.documents.length,
      testimonials: content.testimonials.length,
      services: content.services.length,
    },
  });
  return { content, sections };
}

/**
 * What a homeowner's browser is sent for the company sections: the keys to
 * draw, and the content behind ONLY those keys — a section that is switched
 * off or empty sends nothing at all, not an empty heading's worth of data.
 *
 * One projection for both proposal pages (the quote at /q/<token> and the
 * instant-estimate presentation at /estimate-report/<token>), so the list of
 * sections a company's two documents carry cannot drift apart. Pure.
 *
 * @param {{ content, sections }} loaded  loadProposalContent()'s result
 */
export function projectProposal({ content, sections } = {}) {
  const on = (key) => Boolean(sections?.[key]?.rendered);
  return {
    sections: renderedSectionKeys(sections),
    about: on("about") ? content?.about || null : null,
    gallery: on("beforeAfter") ? content?.gallery || [] : [],
    documents: on("documents") ? content?.documents || [] : [],
    testimonials: on("testimonials") ? content?.testimonials || [] : [],
    services: on("services") ? content?.services || [] : [],
  };
}

/**
 * The waivers attached to a quote, as the client sees them: the text in
 * plain sections, the acknowledgement lines, whether it is signed, and the
 * public token the signing POST goes to. Nothing internal — no document id,
 * no company id.
 */
export async function loadQuoteWaivers({ quoteId, companyId, db = realDb }) {
  const rows = await db.documentSignature.findMany({
    where: { quoteId, companyId },
    orderBy: { createdAt: "asc" },
    select: {
      token: true, status: true, signedAt: true, acknowledgements: true, signature: true,
      document: { select: { title: true, body: true, archivedAt: true } },
    },
  });
  return rows
    .map((r) => {
      const body = sanitiseWaiverBody(r.document?.body);
      if (!body) return null;
      return {
        token: r.token,
        title: str(r.document?.title),
        sections: body.sections,
        acknowledgements: body.acknowledgements,
        status: r.status === "signed" ? "signed" : "pending",
        signedAt: r.signedAt || null,
        signedName: r.status === "signed" ? str(r.signature?.name) : null,
      };
    })
    .filter(Boolean);
}

// ── The day-by-day plan ─────────────────────────────────────────────────────
//
// Hours come from the takeoff — tradeLabourDetail / tradeLabourHours, the
// same figures the price was built from and the cost panel scores against
// — read with the company's own rate overrides, server-side only. Nothing
// numeric about rates travels: what leaves is a list of days, each naming
// the parts of the work that fall on it.
//
// Crew size, in order: the quote's Presentation tab (Quote.presentation.
// crewSize), then the crew the estimator named in the costing
// (QuoteCosting.crew), then a crewSize a takeoff itself carries (insulation
// does). None of those → no plan. A default crew would be a number nobody
// stated, printed on a document the homeowner signs.

const PAINT_KEYS = new Set(["interior_painting", "exterior_painting"]);

/**
 * Hours and parts for a quote's scope groups. Pure apart from the price
 * book import; exported so the check script can run it on a fixture.
 *
 * @param groups  [{ categoryKey, takeoff, rateOverrides }]
 * @returns { totalHours, parts: [{ name, hours }], paint: { products, coats } | null, crewSizeFromTakeoff }
 */
export function workFromGroups(groups) {
  const parts = [];
  let totalHours = 0;
  let paint = null;
  let crewSizeFromTakeoff = null;
  for (const g of Array.isArray(groups) ? groups : []) {
    const key = g?.categoryKey;
    const takeoff = g?.takeoff;
    if (!key || !takeoff || typeof takeoff !== "object") continue;
    let detail = null;
    try {
      detail = tradeLabourDetail(key, takeoff, g.rateOverrides || null);
    } catch {
      detail = null;
    }
    let hours = 0;
    if (detail && !detail.incomplete) {
      hours = Number(detail.hours) || 0;
      const list = Array.isArray(detail.parts) ? detail.parts : Array.isArray(detail.breakdown) ? detail.breakdown : [];
      for (const p of list) {
        const name = String(p?.name || p?.label || "").trim();
        const h = Number(p?.hours);
        if (name && Number.isFinite(h) && h > 0) parts.push({ name, hours: h });
      }
    } else {
      try {
        hours = Number(tradeLabourHours(key, takeoff, g.rateOverrides || null)) || 0;
      } catch {
        hours = 0;
      }
    }
    totalHours += hours;
    if (PAINT_KEYS.has(key) && takeoff.model === "area_substrate" && !paint) {
      try {
        const book = getPriceBook(key, g.rateOverrides || null);
        paint = paintSpec(paintTakeoff(takeoff, book?.takeoff));
      } catch {
        paint = null;
      }
    }
    const crew = Number(takeoff.crewSize);
    if (!crewSizeFromTakeoff && Number.isInteger(crew) && crew >= 1 && crew <= 20) crewSizeFromTakeoff = crew;
  }
  return { totalHours: Math.round(totalHours * 100) / 100, parts, paint, crewSizeFromTakeoff };
}

/**
 * The plan for one quote, or null. `quote.scopeGroups` must carry
 * `categoryId`, `category.key` and `takeoff`; the rates are read here.
 */
export async function loadWorkPlan({ quote, companyId, db = realDb }) {
  const groups = Array.isArray(quote?.scopeGroups) ? quote.scopeGroups : [];
  const categoryIds = [...new Set(groups.map((g) => g.categoryId).filter(Boolean))];
  if (!categoryIds.length) return null;
  const [settings, costing] = await Promise.all([
    db.companyServiceCategory.findMany({
      where: { companyId, categoryId: { in: categoryIds } },
      select: { categoryId: true, rates: true },
    }),
    db.quoteCosting.findUnique({ where: { quoteId: quote.id }, select: { crew: true } }).catch(() => null),
  ]);
  const ratesById = new Map(settings.map((s) => [s.categoryId, s.rates]));
  const work = workFromGroups(
    groups.map((g) => ({
      categoryKey: g.category?.key || null,
      takeoff: g.takeoff,
      rateOverrides: ratesById.get(g.categoryId) ?? null,
    })),
  );
  const pres = sanitisePresentation(quote?.presentation);
  const namedCrew = Array.isArray(costing?.crew) ? costing.crew.filter((m) => m && typeof m === "object").length : 0;
  const crewSize = pres.crewSize || (namedCrew > 0 ? namedCrew : null) || work.crewSizeFromTakeoff || null;
  const days = dayPlan({ parts: work.parts, totalHours: work.totalHours, crewSize });
  return {
    totalHours: work.totalHours,
    crewSize,
    days,
    paint: work.paint,
  };
}
