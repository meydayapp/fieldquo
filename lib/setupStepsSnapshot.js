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
  ] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        emailDomainStatus: true,
        quoteEmailIncludeReferences: true,
        quoteEmailIncludeBeforeAfter: true,
        setupStepsDismissed: true,
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
  };
}
