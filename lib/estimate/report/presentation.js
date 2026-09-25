// lib/estimate/report/presentation.js
//
// The company half of the instant-estimate presentation — what turns the
// report at /estimate-report/<token> into "the same presentation but with
// the range" (owner, 2026-09-22): the About us story, the before & after
// gallery, the documents, the reviews and the services, plus the trade's
// numbered process steps.
//
// ── Loaded exactly as the quote page loads them ─────────────────────────────
//
// loadProposalContent + projectProposal (lib/proposal/load.js) are the two
// calls behind /q/<token>'s sections, and they are the two calls here: the
// same company rows, the same "on AND has content" rule, the same projection
// with no ids and no price. The story is localised into the report's
// language the way the quote's is (lib/i18n/companyText.js), and a draft has
// no Quote.presentation overrides yet, so the company defaults decide.
//
// The process steps are lib/documents/serviceContent.js#dominantProcessSteps
// over the draft's own scope group (the category createEstimateDraft filed
// it under) with the company's step overrides attached — the steps the
// quote this draft becomes will print. A draft filed under no category (an
// instant painting estimate, deliberately — see lib/trades/catalog.js) gets
// the generic steps that function already returns for "no groups".
//
// Only the public page calls this. publishEstimateReport (the PDF and the
// email) does not, so a submit pays for none of these reads.
//
// Best effort as a whole, like the quote route's proposal block: a failure
// here returns the empty projection and the report still renders.

import { db as realDb } from "@/lib/db";
import { PROPOSAL_COMPANY_SELECT, loadProposalContent, projectProposal } from "@/lib/proposal/load";
import { EMPTY_PROPOSAL } from "@/lib/proposal/sections";
import { localisedCompany } from "@/lib/i18n/companyText";
import { attachServiceSettings } from "@/lib/documents/loadServiceSettings";
import { dominantProcessSteps } from "@/lib/documents/serviceContent";

/** What the page draws when nothing could be loaded: no sections, no steps. */
export const EMPTY_PRESENTATION = Object.freeze({ proposal: EMPTY_PROPOSAL, processSteps: [] });

/**
 * @param {object} p
 * @param {{ id, companyId }} p.quote   the draft the report was built from
 * @param {string} p.language           the report's language (fixed at creation)
 * @returns {Promise<{ proposal, processSteps }>}
 */
export async function loadEstimatePresentation({ quote, language, db = realDb }) {
  if (!quote?.id || !quote?.companyId) return EMPTY_PRESENTATION;
  try {
    const [row, groups] = await Promise.all([
      db.company.findUnique({
        where: { id: quote.companyId },
        select: { id: true, defaultLanguage: true, ...PROPOSAL_COMPANY_SELECT },
      }),
      db.quoteScopeGroup.findMany({
        where: { quoteId: quote.id },
        select: { categoryId: true, category: { select: { key: true } } },
      }),
    ]);
    if (!row) return EMPTY_PRESENTATION;
    const company = await localisedCompany(db, row, { companyId: quote.companyId, language });
    const [loaded, withSettings] = await Promise.all([
      loadProposalContent({ companyId: quote.companyId, company, language, presentation: null, db }),
      attachServiceSettings(db, quote.companyId, groups),
    ]);
    const processSteps = dominantProcessSteps(
      withSettings
        .filter((g) => g.category?.key)
        .map((g) => ({ categoryKey: g.category.key, override: g.companySettings || null, subtotal: 0 })),
      language,
    );
    return {
      proposal: projectProposal(loaded),
      processSteps: Array.isArray(processSteps) ? processSteps : [],
    };
  } catch (err) {
    console.error("[estimate-report] presentation load failed:", err?.message);
    return EMPTY_PRESENTATION;
  }
}
