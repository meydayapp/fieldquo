// lib/demo/seedDemo.js
//
// Create, re-dress and reset the sales demo accounts.
//
// ══ The guard is the whole design ══════════════════════════════════════════
//
// `resetDemo` DELETES a company's quotes, jobs, invoices and clients. That is a
// destructive operation with a friendly name, which AGENTS.md lists as its own
// failure class — so every function here that writes or deletes calls
// `assertDemo` FIRST, which re-reads the company from the database and throws
// unless `isDemo` is true.
//
// Re-read, not trusted from the caller. An id arriving from an HTTP request is
// an id; the only thing that makes it safe to wipe is what the row says about
// itself. There is no flag, option or override that lets any of this touch a
// real tenant — if you find yourself wanting one, the answer is a different
// function, not a boolean.
//
// ══ Switching industry re-dresses, it doesn't re-create ════════════════════
//
// The login, the slug and the subdomain survive. An agent who has bookmarked
// demo3.fieldquo.com still has it after switching that account from plumbing to
// roofing — only the content changes. Anything else and the bookmark is a 404
// halfway through a sales call.
import { db } from "@/lib/db";
import { INDUSTRIES, industry as industryPreset, demoAccounts } from "./industries";

/**
 * Refuse to proceed on anything that isn't a demo.
 *
 * @returns the company row, so callers don't fetch it twice.
 */
async function assertDemo(companyId) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, isDemo: true, name: true, slug: true, demoIndustry: true },
  });
  if (!company) {
    const err = new Error("No such company.");
    err.status = 404;
    throw err;
  }
  if (!company.isDemo) {
    // Deliberately blunt. Someone reading this in a log should understand
    // immediately that a real tenant was one boolean away from being wiped.
    const err = new Error(
      `Refusing to touch "${company.name}" — it is not a demo account. ` +
        "Demo tooling only ever operates on companies with isDemo = true.",
    );
    err.status = 403;
    throw err;
  }
  return company;
}

/** Everything a demo owns that a reset should clear, in FK-safe order. */
async function wipeContent(companyId) {
  // Ordered children-first. Cascades cover most of this, but relying on cascade
  // config that may change is how a reset starts leaving orphans behind.
  await db.$transaction([
    db.invoice.deleteMany({ where: { companyId } }),
    db.job.deleteMany({ where: { companyId } }),
    db.quote.deleteMany({ where: { companyId } }),
    db.appointment.deleteMany({ where: { companyId } }),
    db.leadRequest.deleteMany({ where: { companyId } }),
    db.client.deleteMany({ where: { companyId } }),
    db.companyServiceCategory.deleteMany({ where: { companyId } }),
    // There is no Service model — priced lines live on Product with
    // type: "service". Worth stating, because "service" is the word the whole
    // product uses in its UI.
    db.product.deleteMany({ where: { companyId } }),
  ]);
}

/**
 * A representative rate for a category, from the preset's service list.
 *
 * The first service is the headline one in every preset (that ordering is
 * deliberate, not incidental), so it stands in for the trade as a whole. This
 * is demo data — it needs to be plausible, not derived.
 */
function rateFor(preset) {
  return preset.services?.[0]?.rate ?? null;
}

function unitFor(preset) {
  return preset.services?.[0]?.unit ?? null;
}

/**
 * Point a demo company at an industry preset.
 *
 * Wipes the old trade's content first — a plumbing demo that still has three
 * kitchen refinishing quotes in the list is worse than an empty one, because
 * the agent has to explain it.
 */
export async function applyIndustry(companyId, industryKey) {
  await assertDemo(companyId);

  const preset = industryPreset(industryKey);
  if (!preset) {
    const err = new Error(
      `Unknown industry "${industryKey}". Known: ${Object.keys(INDUSTRIES).join(", ")}`,
    );
    err.status = 400;
    throw err;
  }

  await wipeContent(companyId);

  // Categories, resolved by key. A preset naming a trade that isn't in
  // ServiceCategory silently yields nothing, which is why check:demo asserts
  // every key resolves — the symptom otherwise is a demo with no services,
  // discovered on a call.
  const categories = await db.serviceCategory.findMany({
    where: { key: { in: preset.categories } },
    select: { id: true, key: true },
  });

  const missing = preset.categories.filter((k) => !categories.some((c) => c.key === k));
  if (missing.length) {
    console.error(`[demo] preset "${industryKey}" names unknown categories:`, missing);
  }

  await db.company.update({
    where: { id: companyId },
    data: {
      name: preset.company,
      brandColor: preset.brandColor,
      demoIndustry: industryKey,
      // Kept off. A demo firing real review requests at seeded email addresses
      // is how a sandbox ends up in a spam trap.
      reviewRequestsEnabled: false,
      serviceCategories: {
        create: categories.map((c) => ({
          categoryId: c.id,
          enabled: true,
          // The preset's rate becomes the category's default, so an instant
          // quote in the demo produces a number rather than a blank.
          defaultRate: rateFor(preset, c.key),
          unit: unitFor(preset, c.key),
        })),
      },
    },
  });

  await db.product.createMany({
    data: preset.services.map((s) => ({
      companyId,
      name: s.name,
      type: "service",
      unit: s.unit,
      unitPrice: s.rate,
    })),
  });

  return { industry: industryKey, categories: categories.length, services: preset.services.length };
}

/**
 * Reset a demo to a clean state on its current industry.
 *
 * What a sales agent presses after a call has left the account full of
 * half-built quotes.
 */
export async function resetDemo(companyId) {
  const company = await assertDemo(companyId);
  const key = company.demoIndustry || demoAccounts()[0].industry;
  return applyIndustry(companyId, key);
}

/** Every demo account, for the platform console. */
export async function listDemos() {
  return db.company.findMany({
    where: { isDemo: true },
    select: {
      id: true, name: true, slug: true, demoIndustry: true, brandColor: true,
      _count: { select: { quotes: true, jobs: true, clients: true } },
    },
    orderBy: { slug: "asc" },
  });
}
