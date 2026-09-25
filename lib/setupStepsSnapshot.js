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
import { tradeCoverage } from "@/lib/services/confirmServices";
import { tradeEntry } from "@/lib/trades/catalog";
import { signupSeededRows } from "@/lib/services/addedForYou";

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
    historicalImports,
    activeMembers,
    pendingInvites,
    subscription,
    galleryPairs,
    clientDocuments,
    googleBusiness,
    approvedTestimonials,
    enabledTradeRows,
  ] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
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
        // "Confirm what you quote" — stamped by POST
        // /api/settings/products/confirm-services, the step's only way to done.
        servicesConfirmedAt: true,
        // …and when the company was created, so the step can say how many
        // services signup added (lib/services/addedForYou.js).
        createdAt: true,
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
    // seedKey too, for "Confirm what you quote": how many of each trade's
    // seeded services the company actually holds.
    db.product.findMany({
      where: { companyId },
      select: { name: true, unitPrice: true, active: true, seedKey: true, createdAt: true },
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
    // "Confirm what you quote": the trades switched on, by key. The same
    // enabled rows as above, read apart because that read feeds two steps
    // with columns this one does not need.
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { category: { select: { key: true } } },
    }),
  ]);

  if (!company) throw new Error(`Company not found for ID ${companyId}`);


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
    // One row per enabled CATALOGUE trade: does it ship a seed file, and how
    // many of its seeded services does the company hold (lib/services/
    // confirmServices.js#tradeCoverage). A company's own custom quote type is
    // left out — it has no seed by construction, and counting it would put
    // every company that ever typed one on this step for good.
    quoteCoverage: [
      ...new Set(enabledTradeRows.map((r) => r.category?.key).filter((k) => k && tradeEntry(k))),
    ].map((key) => tradeCoverage(key, products.map((p) => p.seedKey).filter(Boolean))),
    servicesConfirmed: company.servicesConfirmedAt instanceof Date,
    // How many services signup seeded — the confirm step's title says it
    // ("Review the services we added for you (N)", lib/setupSteps.js).
    signupSeededServices: signupSeededRows(products, company.createdAt).length,
  };
}
