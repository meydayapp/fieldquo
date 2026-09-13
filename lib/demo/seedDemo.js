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
import { INDUSTRIES, INDUSTRY_KEYS, industry as industryPreset, demoAccounts } from "./industries";
import { seedDemoCompany } from "./seedContent";
import { grantDemoAiCredit } from "@/lib/voice/credits";

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
    // Simulated crew lines only. A demo's line is provider "simulated" with no
    // providerId, so deleting the row destroys nothing at a vendor — and the
    // next rep needs the un-provisioned state to demo provisioning at all.
    //
    // Scoped by provider rather than by company on purpose: if a demo somehow
    // carries a REAL twilio row (one bought before purchaseCrewLine learned to
    // refuse), deleting it would orphan a number that keeps billing with
    // nothing pointing at it — the exact failure purchaseCrewLine's own
    // comment warns about. Such a row is left alone and shows up in
    // /platform/crew-lines, which exists to find and release them.
    db.crewInboxNumber.deleteMany({ where: { companyId, provider: "simulated" } }),
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
    // Seeded so the receptionist's call list is never empty on a demo that has
    // never really rung — see seedDemoContent below. Safe to wipe on every
    // reset the same way the quotes and jobs are: these are fixture rows this
    // module wrote, never real calls (a real call needs a real VoicePhoneNumber,
    // and lib/voice/numbers.js's demo path never creates one — see
    // lib/voice/demoLine.js). Deliberately NOT in the list check-demo-number.mjs
    // guards (VoicePhoneNumber, VoiceAgent, VoiceCreditEntry): those are the
    // real, billable or balance-carrying rows a reseed must never touch. A
    // VoiceCall is neither — it is demo dressing, exactly like the quotes above
    // it.
    db.voiceCall.deleteMany({ where: { companyId } }),
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

// ── Sample content so a demo is walkable, not a blank slate ──────────────────
//
// A demo with no clients, no quotes and no jobs is a screen a sales agent has to
// apologise for. Until 2026-09-12 this file filled each demo with four clients
// and four quotes; the owner asked for "fake real names and real addresses and
// random phone numbers in the parts and sections where it is warranted, same
// for payroll and calendar etc and booking", because he records product videos
// from a demo and the help centre screenshots one. That seed now lives in
// lib/demo/seedContent.js — six months of a business, on every screen — and
// this is the one call site the three doors (the pool script, a rep's own
// demo, the platform console's reset) all pass through.
//
// Idempotent by natural keys, never by deletion: seedDemoCompany looks every
// row up before it writes it. wipeContent above still clears the pool's
// fixture rows on a reset — that is the pool's long-standing contract — and
// the seed then finds nothing and writes everything afresh.

/**
 * Populate one demo with the full six-month business.
 *
 * @param now  passed in so the caller controls "today" (the seed script stamps
 *             it once), keeping this deterministic and free of a hidden clock.
 */
export async function seedDemoContent(companyId, preset, now = new Date(), industryKey = null) {
  const key = industryKey || INDUSTRY_KEYS.find((k) => INDUSTRIES[k] === preset) || null;
  const result = await seedDemoCompany(companyId, { trade: key, now });
  const n = (model) => (result.created[model] || 0) + (result.existing[model] || 0);
  return { clients: n("client"), quotes: n("quote"), jobs: n("job"), invoices: n("invoice"), calls: n("voiceCall"), created: result.created };
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

  // The one-time AI credit grant — 1,000 credits so the AI vision pass and
  // image generation work in a sales call with nothing to pay for. Called on
  // every pass through here (creation, an industry switch, a reset) rather
  // than tracked separately, because grantDemoAiCredit is exactly-once on its
  // own unique ledger ref (DEMO_AI_CREDIT_REF) — a second call for a company
  // that already has it is a confirmed no-op, the same guarantee
  // grantFreeTrial gives the phone side. `isDemo` was just re-verified by
  // assertDemo() above; this never runs for a real tenant.
  await grantDemoAiCredit(companyId);

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

  // Opening hours + sample clients/quotes/jobs/invoices, so the demo is walkable
  // the moment it's created rather than a blank slate a sales agent apologises
  // for. Wiped and re-created on every re-seed (wipeContent above).
  const content = await seedDemoContent(companyId, preset, new Date(), industryKey);

  return {
    industry: industryKey,
    categories: categories.length,
    services: preset.services.length,
    ...content,
  };
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

/**
 * Every POOL demo account, for the platform console.
 *
 * The pool is the ten seeded fixtures nobody owns. A rep's own demo
 * (Company.demoOwnerRepId set — lib/sales/repDemo.js) is not listed here: it
 * is not assignable, its reset goes through the rep's page and retires rather
 * than wipes, and offering "Reset" or "Assign" on it from the console would be
 * a control on somebody else's walkthrough. The console shows them read-only
 * through listRepDemos() in lib/sales/repDemo.js instead.
 */
export async function listDemos() {
  return db.company.findMany({
    where: { isDemo: true, demoOwnerRepId: null },
    select: {
      id: true, name: true, slug: true, demoIndustry: true, brandColor: true,
      // Whether the public website link is worth showing. No demo has a site
      // by default, and linking to demo1.fieldquo.com when there is nothing
      // published sends an agent to a 404 mid-call.
      sitePublished: true,
      site: { select: { id: true } },
      // Whether a login exists yet, so the page can say "set one" or "change
      // it" rather than guessing.
      members: {
        where: { active: true },
        select: { role: true, user: { select: { email: true } } },
        take: 1,
      },
      _count: { select: { quotes: true, jobs: true, clients: true } },
    },
    orderBy: { slug: "asc" },
  });
}
