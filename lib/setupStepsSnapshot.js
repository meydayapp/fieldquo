// lib/setupStepsSnapshot.js
//
// The database half of the "Additional set-up steps" card. One tenant-scoped
// read per signal, every one against the SAME rows the feature behind the
// step reads — see each step's comment in lib/setupSteps.js for which rows and
// why. Nothing here decides anything; `stepsFor` does, and it is pure so it
// can be executed against fixtures.
//
// Split from lib/setupSteps.js rather than kept in one file so that file has
// no "@/lib/db" import: scripts/check-setup-steps.mjs imports it under the
// alias loader alone, with no database stub, and a check that needs a stub to
// run a pure function is a check that will one day be skipped.
import { db } from "@/lib/db";
import { balanceFor, POOLS } from "@/lib/voice/credits";
import { aiCreditBundleFor } from "@/lib/ai/creditBundle";
import { loadCompanyGallery } from "@/lib/company/gallery";

/** A seeded template's updatedAt sits within a moment of its createdAt. */
const EDITED_AFTER_MS = 60_000;

/**
 * Invoice.historicalImportedAt is being added by the /app/jobs/import work.
 * Until `prisma generate` has run over that column, the count throws a
 * validation error from the client — so it is asked for on its own, and a
 * failure is reported as `null` ("not measured"), which stepsFor reads as not
 * done. The alternative, `0`, would be the same answer wearing a number, and
 * a try/catch around the whole Promise.all would take nine good signals down
 * with the one that is not there yet.
 */
async function historicalImportCount(companyId) {
  try {
    return await db.invoice.count({
      where: { companyId, historicalImportedAt: { not: null } },
    });
  } catch (err) {
    console.warn(
      "[setup-steps] historicalImportedAt not queryable yet — run `npx prisma generate`:",
      err?.message,
    );
    return null;
  }
}

export async function loadSetupSnapshot(companyId) {
  const [
    company,
    overheadFixedCosts,
    overheadSalaries,
    overheadDebts,
    overheadAssets,
    paymentScheduleStages,
    enabledCategories,
    aiCreditCents,
    aiCreditBundle,
    instantQuotesEnabled,
    bookableScheduleRows,
    materialRecipeSettings,
    products,
    templates,
    historicalImports,
    activeMembers,
    pendingInvites,
    subscription,
    galleryPairs,
    clientDocuments,
    googleBusiness,
    approvedTestimonials,
  ] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        emailDomainStatus: true,
        quoteEmailIncludeReferences: true,
        quoteEmailIncludeBeforeAfter: true,
        setupStepsDismissed: true,
        // "It's just me — no crew right now", ticked in Team Settings. The
        // team step's appliesWhen reads it; see lib/setupSteps.js.
        worksAloneAt: true,
        // The client proposal's story — the "Add your company story" row.
        story: true,
        // "Create your website": the signup's answer, the address on file,
        // and whether the builder's site is published (CompanySite.published
        // — the flag the public site route serves on).
        hasWebsite: true,
        website: true,
        site: { select: { published: true } },
      },
    }),
    // The same filter GET /api/overhead/fixed-costs lists.
    db.expense.count({
      where: { companyId, isOverhead: true, recurring: true },
    }),
    db.salary.count({ where: { companyId } }),
    db.debt.count({ where: { companyId } }),
    db.asset.count({ where: { companyId } }),
    db.paymentScheduleStage.count({ where: { companyId } }),
    // One read serves two steps (wording, rate card): both are columns on the
    // enabled categories, and a company has a handful of those.
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: {
        processSteps: true,
        includedItems: true,
        scopeDescription: true,
        rates: true,
      },
    }),
    balanceFor(companyId, db, POOLS.AI),
    aiCreditBundleFor(companyId),
    db.instantQuoteConfig.count({ where: { companyId, enabled: true } }),
    // AvailabilitySchedule hangs off the User, not the company; the tenant
    // boundary is the active membership.
    db.availabilitySchedule.count({
      where: { user: { memberships: { some: { companyId, active: true } } } },
    }),
    db.materialRecipeSetting.count({ where: { companyId } }),
    db.product.findMany({
      where: { companyId },
      select: { name: true, unitPrice: true, active: true },
    }),
    db.documentTemplate.findMany({
      where: { companyId },
      select: { createdAt: true, updatedAt: true },
    }),
    historicalImportCount(companyId),
    // The team step. These three reads used to run in lib/onboarding.js for
    // the same step; they moved with it. Active members and pending
    // invitations are the two halves of "seats used" — the same two GET
    // /api/settings/members/pending adds up — and the plan's maxUsers is the
    // headcount cap (null on a legacy plan with no cap).
    db.member.count({ where: { companyId, active: true } }),
    db.pendingTeamProfile.count({ where: { companyId } }),
    db.subscription.findUnique({
      where: { companyId },
      select: { plan: { select: { maxUsers: true } } },
    }),
    // ── The client proposal's four rows (lib/setupSteps.js) ─────────────
    // The live gallery — the same rows the proposal renders. Read through
    // the gallery module so the one-time merge of the older stores has run.
    loadCompanyGallery(companyId).then((rows) => rows.length).catch(() => 0),
    // A document a client can open right now: the same filter the proposal
    // applies (show-on-quotes, not a waiver, not archived, not expired).
    db.companyDocument.count({
      where: {
        companyId,
        archivedAt: null,
        showOnQuotes: true,
        type: { not: "waiver" },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
    db.companyGoogleBusiness.findUnique({ where: { companyId }, select: { id: true } }),
    db.testimonial.count({ where: { companyId, approved: true } }),
  ]);

  if (!company) throw new Error(`Company not found for ID ${companyId}`);

  const editedEmailTemplates = templates.filter(
    (t) =>
      t.updatedAt instanceof Date &&
      t.createdAt instanceof Date &&
      t.updatedAt.getTime() - t.createdAt.getTime() > EDITED_AFTER_MS,
  ).length;

  return {
    dismissed: company.setupStepsDismissed,
    overheadFixedCosts,
    overheadSalaries,
    overheadDebts,
    overheadAssets,
    paymentScheduleStages,
    enabledCategories,
    aiCreditCents,
    aiCreditBundle: Boolean(aiCreditBundle),
    instantQuotesEnabled,
    bookableScheduleRows,
    materialRecipeSettings,
    products: products.map((p) => ({
      name: p.name,
      unitPrice: p.unitPrice == null ? null : Number(p.unitPrice),
      active: p.active,
    })),
    emailDomainVerified: company.emailDomainStatus === "verified",
    editedEmailTemplates,
    quoteEmailSectionsOn: Boolean(
      company.quoteEmailIncludeReferences || company.quoteEmailIncludeBeforeAfter,
    ),
    historicalImports,
    activeMembers,
    pendingInvites,
    seatLimit: subscription?.plan?.maxUsers ?? null,
    worksAlone: Boolean(company.worksAloneAt),
    storySet: typeof company.story === "string" && company.story.trim().length > 0,
    galleryPairs,
    clientDocuments,
    googleReviewsConnected: Boolean(googleBusiness),
    approvedTestimonials,
    // Said yes at signup, or has an address on file (a company from before
    // the question typed it in Company Settings) — either way it has a site
    // and the "Create your website" row does not apply.
    hasOwnWebsite: company.hasWebsite === true || Boolean(String(company.website ?? "").trim()),
    sitePublished: company.site?.published === true,
  };
}
