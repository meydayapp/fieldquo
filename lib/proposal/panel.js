// lib/proposal/panel.js
//
// What the STAFF Presentation panel is drawn from (app/app/quotes/[id]/
// PresentationPanel.js): the section switches with the company default
// behind each one, how much content is behind them, the document library
// with this quote's selection marked, the day-by-day plan, and the waivers.
//
// ── Why it is a module and not a function in one route ──────────────────────
//
// The panel is mounted twice: on a saved quote, and on the quote BUILDER's
// Presentation tab before the first save. Until this existed the second case
// rendered a grey "set once the quote is saved" box (the gate left behind by
// the paused WIP port, 9d38a77a5) — so the estimator could change the
// proposal only after sending themselves back to it, which is the owner's
// complaint. The tab now opens on the same picture the saved quote shows,
// and "the same picture" is only true if it comes out of the same function.
//
// `quote: null` is the create case. Two things in the panel genuinely need a
// saved row, and they come back absent rather than faked:
//
//   plan     the hours are derived from the quote's own saved scopeGroups
//            takeoff (loadWorkPlan). A crew size with no hours to divide is
//            not a plan, and inventing hours is the padding-absent-data
//            failure AGENTS.md names.
//   waivers  a DocumentSignature carries a quoteId, and /api/waivers refuses
//            a request without one. A waiver cannot attach to a quote that
//            does not exist yet.
//
// The panel says so in words on the create screen. It does not draw the two
// controls greyed out, because a disabled control that will never enable on
// this screen is the dead button the rule is about.

import { db as realDb } from "@/lib/db";
import { PROPOSAL_SECTION_KEYS, PROPOSAL_SECTIONS, sanitisePresentation } from "@/lib/proposal/sections";
import { PROPOSAL_COMPANY_SELECT, loadProposalContent, loadWorkPlan } from "@/lib/proposal/load";
import { listDocuments } from "@/lib/company/documentLibrary";
import { localisedCompany } from "@/lib/i18n/companyText";

/**
 * @param member    the caller (companyId, impersonationMode)
 * @param quote     the saved quote — { id, language, presentation, scopeGroups }
 *                  — or null for a quote being created
 * @param language  the language the BUILDER is composing in, used only when
 *                  there is no quote to read it off. Non-negotiable #6: a
 *                  saved quote's own language always wins.
 */
export async function presentProposalPanel({ member, quote = null, language: composing = null, db = realDb }) {
  const loaded = await db.company.findUnique({
    where: { id: member.companyId },
    select: { ...PROPOSAL_COMPANY_SELECT, defaultLanguage: true },
  });
  const language = quote?.language || composing || loaded?.defaultLanguage || "en";
  // The story in the quote's language when its translation exists — what
  // the client page shows (app/api/public/quotes/[token]).
  const company = await localisedCompany(db, loaded, { companyId: member.companyId, language });
  const [{ content, sections }, plan, documents, waivers] = await Promise.all([
    loadProposalContent({
      companyId: member.companyId,
      company: company || {},
      language,
      presentation: quote?.presentation ?? null,
      readOnly: member.impersonationMode === "read_only",
      db,
    }),
    quote ? loadWorkPlan({ quote, companyId: member.companyId, db }) : null,
    listDocuments(member.companyId, { db }),
    quote
      ? db.documentSignature.findMany({
          where: { quoteId: quote.id, companyId: member.companyId },
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true, signedAt: true, sentAt: true, token: true, document: { select: { id: true, title: true } } },
        })
      : [],
  ]);
  const pres = sanitisePresentation(quote?.presentation ?? null);
  return {
    quoteId: quote?.id || null,
    sections: PROPOSAL_SECTION_KEYS.map((key) => ({
      key,
      labelKey: PROPOSAL_SECTIONS[key].labelKey,
      fillHref: PROPOSAL_SECTIONS[key].fillHref,
      on: sections[key].on,
      inherited: sections[key].inherited,
      companyDefault: sections[key].companyDefault,
      hasContent: sections[key].hasContent,
      rendered: sections[key].rendered,
      override: pres.sections[key],
    })),
    counts: {
      beforeAfter: content.gallery.length,
      documents: content.documents.length,
      testimonials: content.testimonials.length,
      services: content.services.length,
    },
    // Every library document a client could see, with whether this quote
    // includes it. `documentIds: null` means all of them.
    documents: documents
      .filter((d) => d.type !== "waiver")
      .map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        expired: d.expired,
        visibleToClients: d.visibleToClients,
        included: d.visibleToClients && (pres.documentIds === null || pres.documentIds.includes(d.id)),
      })),
    documentIds: pres.documentIds,
    // Null before the first save: see the header. The panel prints a line
    // saying the plan arrives with the save rather than drawing an empty one.
    plan: quote
      ? {
          totalHours: plan?.totalHours || 0,
          crewSize: plan?.crewSize || null,
          crewSizeOverride: pres.crewSize,
          days: plan?.days || null,
        }
      : null,
    waivers: waivers.map((w) => ({
      id: w.id,
      documentId: w.document?.id,
      title: w.document?.title || "",
      status: w.status,
      signedAt: w.signedAt,
      sentAt: w.sentAt,
    })),
    waiverLibrary: documents.filter((d) => d.type === "waiver").map((d) => ({ id: d.id, title: d.title, signable: d.signable })),
  };
}
