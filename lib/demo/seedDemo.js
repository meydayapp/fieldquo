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

// ── Sample content so a demo is walkable, not a blank slate ──────────────────
//
// A demo with no clients, no quotes and no jobs is a screen a sales agent has to
// apologise for. This fills every demo with a handful of realistic clients and a
// spread of quotes/jobs/invoices across statuses, plus opening hours so the
// booking page shows times — enough that the dashboard, the pipeline, the
// schedule and FieldQuo AI all have something real to show. All fake, all
// wipeable (wipeContent clears it before every re-seed), never emails anyone.

const DEMO_CLIENTS = [
  { name: "Sarah Mitchell", type: "individual", email: "sarah.mitchell@example.com", phone: "613-555-0142", address: "24 Maple Grove Rd" },
  { name: "David & Anne Chen", type: "individual", email: "chen.family@example.com", phone: "613-555-0188", address: "9 Riverside Ave" },
  { name: "Okonkwo Residence", type: "individual", email: "j.okonkwo@example.com", phone: "343-555-0117", address: "150 Hilltop Cres" },
  { name: "Riverside Property Management", type: "company", contactName: "Priya Nair", email: "priya@riversidepm.example.com", phone: "613-555-0199", address: "" },
];

const money = (n) => Math.round(Number(n) * 100) / 100;

function lineItemsFrom(services, picks) {
  return picks
    .map(({ i, qty }) => {
      const s = services[i % services.length];
      if (!s) return null;
      const unitPrice = Number(s.rate) || 0;
      return { name: s.name, description: s.name, quantity: qty, unitPrice, total: money(unitPrice * qty) };
    })
    .filter(Boolean);
}

/**
 * Populate one demo with opening hours + sample clients, quotes, jobs and
 * invoices. Called at the end of applyIndustry, AFTER wipeContent, so it's
 * idempotent — every re-seed clears the old set first.
 *
 * @param now  passed in so the caller controls "today" (the seed script stamps
 *             it once), keeping this deterministic and free of a hidden clock.
 */
export async function seedDemoContent(companyId, preset, now = new Date()) {
  const DAY = 86_400_000;
  const at = (daysFromNow) => new Date(now.getTime() + daysFromNow * DAY);

  // Opening hours: Mon–Fri 8–5, Sat 9–1, Sun closed — so the booking page shows
  // real times instead of "no availability yet".
  await db.company.update({
    where: { id: companyId },
    data: {
      businessHours: [
        { day: 0, closed: true, open: "09:00", close: "17:00" },
        { day: 1, closed: false, open: "08:00", close: "17:00" },
        { day: 2, closed: false, open: "08:00", close: "17:00" },
        { day: 3, closed: false, open: "08:00", close: "17:00" },
        { day: 4, closed: false, open: "08:00", close: "17:00" },
        { day: 5, closed: false, open: "09:00", close: "13:00" },
        { day: 6, closed: true, open: "09:00", close: "13:00" },
      ],
    },
  });

  const clients = [];
  for (const c of DEMO_CLIENTS) {
    clients.push(
      await db.client.create({
        data: {
          companyId, name: c.name, type: c.type,
          contactName: c.contactName || null, email: c.email, phone: c.phone,
          address: c.address || null,
        },
      }),
    );
  }

  const services = preset.services || [];
  const titles = preset.jobs || ["Project A", "Project B", "Project C"];
  const quoteType = preset.categories?.[0] || null;

  // A spread across the pipeline: two accepted (one long-done → invoiced, one
  // upcoming), one out for signature, one still a draft.
  const specs = [
    { client: 0, title: titles[0], status: "accepted", daysAgo: 34, picks: [{ i: 0, qty: 320 }, { i: 1, qty: 45 }] },
    { client: 2, title: titles[2] || titles[0], status: "accepted", daysAgo: 8, picks: [{ i: 0, qty: 210 }, { i: 3, qty: 6 }] },
    { client: 1, title: titles[1] || titles[0], status: "sent", daysAgo: 5, picks: [{ i: 2, qty: 130 }] },
    { client: 3, title: "Recurring maintenance", status: "draft", daysAgo: 2, picks: [{ i: 3, qty: 12 }] },
  ];

  let qn = 1001;
  let invn = 2001;
  for (const spec of specs) {
    const lineItems = lineItemsFrom(services, spec.picks);
    const subtotal = money(lineItems.reduce((s, li) => s + li.total, 0));
    const quote = await db.quote.create({
      data: {
        companyId, clientId: clients[spec.client].id,
        quoteNumber: `Q-${qn++}`, status: spec.status,
        lineItems, subtotal, tax: 0, discount: 0, total: subtotal,
        notes: `${spec.title} — quoted from standard rates.`,
        quoteType, createdAt: at(-spec.daysAgo),
      },
    });

    if (spec.status !== "accepted") continue;

    const done = spec.daysAgo > 20;
    const job = await db.job.create({
      data: {
        companyId, clientId: clients[spec.client].id, quoteId: quote.id,
        title: spec.title, status: done ? "completed" : "scheduled",
        ...(done ? { completedAt: at(-(spec.daysAgo - 6)) } : {}),
        createdAt: at(-(spec.daysAgo - 1)),
      },
    });
    await db.jobVisit.create({
      data: {
        jobId: job.id,
        scheduledAt: done ? at(-(spec.daysAgo - 5)) : at(3),
        status: done ? "completed" : "scheduled",
        notes: done ? "Completed — client happy with the result." : "Confirmed with the client for the morning.",
      },
    });

    if (done) {
      await db.invoice.create({
        data: {
          companyId, clientId: clients[spec.client].id,
          invoiceNumber: `INV-${invn++}`, status: "paid",
          lineItems, subtotal, tax: 0, total: subtotal, amountPaid: subtotal,
          dueDate: at(-(spec.daysAgo - 20)), createdAt: at(-(spec.daysAgo - 6)),
        },
      });
    }
  }

  // One invoice still out for payment, to populate the "owed" side.
  const openLi = lineItemsFrom(services, [{ i: 1, qty: 28 }]);
  const openSub = money(openLi.reduce((s, x) => s + x.total, 0));
  await db.invoice.create({
    data: {
      companyId, clientId: clients[1].id,
      invoiceNumber: `INV-${invn++}`, status: "sent",
      lineItems: openLi, subtotal: openSub, tax: 0, total: openSub, amountPaid: 0,
      dueDate: at(14),
    },
  });

  return { clients: clients.length, quotes: specs.length };
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

  // Opening hours + sample clients/quotes/jobs/invoices, so the demo is walkable
  // the moment it's created rather than a blank slate a sales agent apologises
  // for. Wiped and re-created on every re-seed (wipeContent above).
  const content = await seedDemoContent(companyId, preset);

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
