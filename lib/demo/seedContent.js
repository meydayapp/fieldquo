// lib/demo/seedContent.js
//
// Six months of a realistic business, on every screen a contractor sees.
//
// ══ Why ═══════════════════════════════════════════════════════════════════
//
// The owner records product videos from a demo account, and the help centre
// screenshots one. A demo with four clients and four quotes photographs as a
// shop that opened last week; the pipeline, the reports, payroll, the
// calendar and the inbox all read as empty screens with a sentence on them.
// His instruction (2026-09-12): real-looking names, real streets, fictional
// phones, "same for payroll and calendar etc and booking".
//
// ══ The three rules this file keeps ═══════════════════════════════════════
//
//   1. Demo only. seedDemoCompany re-reads the company and refuses unless
//      isDemo is true — the same guard lib/demo/seedDemo.js's assertDemo
//      applies, restated here because this file can be called from a script.
//
//   2. Idempotent WITHOUT deleting. Every top-level row is looked up by a
//      natural key before it is written (a client by email, a quote by its
//      number, a worker by email, a purchase order by its number) and a
//      parent that already exists keeps the children it has — so a second
//      run adds nothing, and nothing is ever removed. A demo that has been
//      walked through keeps the quote a rep wrote in it; the seed only fills
//      what is missing. scripts/check-demo-content.mjs runs it twice against
//      an in-memory database and asserts the row count did not move.
//
//   3. The product's own writers, where one exists and can be back-dated.
//      A lead is scored by lib/leads/score.js; a signature is built by
//      lib/documents/signatureAudit.js; a Stripe payment is recorded by
//      lib/invoices/recordStripePayment.js with a synthetic intent id that
//      says "demo" on sight; a pay run is computed by lib/payroll; chat
//      messages go through lib/company/chat/store.js. Where a writer stamps
//      `new Date()` and would email or notify somebody, its notifier seams
//      are handed no-ops and the timestamp is set afterwards — the row is
//      still the writer's row. Where no writer exists (a client, a visit, an
//      expense) the row is written in the shape the screens read, taken from
//      the route that writes it in production.
//
// ══ Dates are relative to `now` ═══════════════════════════════════════════
//
// "Three weeks ago" is computed from the `now` the caller passes, so a demo
// seeded in March and one seeded in September both show a business with six
// months behind it and a week ahead of it. The seed script stamps `now`
// once; the check pins it.
import { db as defaultDb } from "@/lib/db";
import { industry as industryPreset } from "./industries";
import { profile as profileFor } from "./profiles";
import {
  rng,
  pick,
  between,
  person,
  business,
  fictionalPhone,
  fictionalEmail,
  addressFor,
  staffFor,
} from "./people";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import { scoreLead } from "@/lib/leads/score";
import { UNASKABLE_BY_SOURCE } from "@/lib/leads/createLead";
import { requireCreatedVia } from "@/lib/quotes/createdVia";
import { buildSignatureRecord } from "@/lib/documents/signatureAudit";
import { normalizeChecklistItems } from "@/lib/jobs/checklistItems";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import { recordStripePayment } from "@/lib/invoices/recordStripePayment";
import { feeBreakdown } from "@/lib/stripe/processingFee";
import { computePayRun } from "@/lib/payroll/computePayRun";
import { DEFAULT_PAY_CYCLE, payPeriodFor } from "@/lib/payroll/payCycle";
import { ensureCompanyRooms, postMessage } from "@/lib/company/chat/store";

const DAY = 86_400_000;
const money = (n) => Math.round(Number(n) * 100) / 100;
const cents = (n) => Math.round(Number(n) * 100);

/** A one-pixel transparent PNG — enough for buildSignatureRecord's "a mark was drawn". */
const SIGNATURE_MARK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** Deterministic, always-resolving photo for a job gallery. */
const photoUrl = (key, n) => `https://picsum.photos/seed/${encodeURIComponent(key)}-${n}/1200/900`;

/**
 * Fill a demo company with six months of business.
 *
 * @param companyId
 * @param opts.trade   an INDUSTRIES key; defaults to the company's demoIndustry
 * @param opts.now     "today"; every date is relative to it
 * @param opts.db      a Prisma-shaped client (the check passes an in-memory one)
 * @returns { trade, created: { model: n }, existing: { model: n } }
 */
export async function seedDemoCompany(companyId, { trade = null, now = new Date(), db = defaultDb } = {}) {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw Object.assign(new Error("No such company."), { status: 404 });
  if (company.isDemo !== true) {
    throw Object.assign(
      new Error(`Refusing to seed "${company.name}" — it is not a demo account (isDemo must be true).`),
      { status: 403 },
    );
  }
  const key = trade || company.demoIndustry;
  const preset = industryPreset(key);
  const prof = profileFor(key);
  if (!preset || !prof) throw Object.assign(new Error(`Unknown demo trade "${key}".`), { status: 400 });

  const ctx = makeContext({ db, company, key, preset, prof, now });

  await seedCompany(ctx);
  await seedPriceBook(ctx);
  await seedStaff(ctx);
  await seedClients(ctx);
  await seedLeads(ctx);
  await seedPipeline(ctx);
  await seedServicePlan(ctx);
  await seedBookings(ctx);
  await seedPayroll(ctx);
  await seedOperations(ctx);
  await seedMarketing(ctx);
  await seedChat(ctx);
  await seedCallLog(ctx);
  await seedActivity(ctx);

  return { trade: key, created: ctx.counts.created, existing: ctx.counts.existing };
}

// ═══════════════════════════════════════════════════════════════════════════
// Context: the clock, the dice, the find-or-create
// ═══════════════════════════════════════════════════════════════════════════

function makeContext({ db, company, key, preset, prof, now }) {
  // Local wall clock for the company's timezone, so a visit "at 9:00" is at
  // 9:00 on the calendar a rep in that city is looking at. A fixed offset
  // (not DST-aware) is the honest simplification for a demo.
  const off = prof.utcOffset;
  const local = new Date(now.getTime() + off * 3_600_000);
  const Y = local.getUTCFullYear();
  const M = local.getUTCMonth();
  const D = local.getUTCDate();
  const dow = local.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;

  const day = (offset, hour = 9, minute = 0) => new Date(Date.UTC(Y, M, D + offset, hour - off, minute));
  const week = (weeks, weekday = 0, hour = 9, minute = 0) => day(mondayOffset + weeks * 7 + weekday, hour, minute);

  const counts = { created: {}, existing: {} };
  const bump = (bag, model) => {
    bag[model] = (bag[model] || 0) + 1;
  };

  /** Find by natural key or create. Returns the row, and whether it was new. */
  async function ensure(model, where, data) {
    const found = await db[model].findFirst({ where });
    if (found) {
      bump(counts.existing, model);
      return { row: found, created: false };
    }
    const row = await db[model].create({ data });
    bump(counts.created, model);
    return { row, created: true };
  }

  async function create(model, data) {
    const row = await db[model].create({ data });
    bump(counts.created, model);
    return row;
  }

  const random = rng(`${key}:${company.slug}`);
  const defaultTax = prof.taxRates.find((t) => t.isDefault) || prof.taxRates[0];

  return {
    db,
    company,
    companyId: company.id,
    slug: company.slug,
    key,
    preset,
    prof,
    now,
    day,
    week,
    year: Y,
    random,
    ensure,
    create,
    counts,
    taxPct: Number(defaultTax.rate),
    currency: prof.currency,
    language: prof.languages[0],
    // Filled as the sections run; later sections read earlier ones.
    people: [],
    owner: null,
    estimator: null,
    dispatcher: null,
    crew: [],
    workers: [],
    clients: [],
    leads: [],
    quotes: [],
    jobs: [],
    invoices: [],
    services: [],
    materials: [],
  };
}

/**
 * Find-or-create for a quote, written out rather than through ctx.ensure so
 * the `quote.create(` call site is visible to scripts/check-conversation-
 * review.mjs, which scans every one in the repo for a `createdVia`. A demo
 * tenant's quotes must be distinguishable from a real company's on any figure
 * grouped by origin — that is what the value is for.
 */
async function ensureQuote(ctx, quoteNumber, data) {
  const { db, companyId } = ctx;
  const found = await db.quote.findFirst({ where: { companyId, quoteNumber } });
  if (found) {
    ctx.counts.existing.quote = (ctx.counts.existing.quote || 0) + 1;
    return { row: found, created: false };
  }
  const row = await db.quote.create({
    data: { createdVia: requireCreatedVia("demo"), ...data, companyId, quoteNumber },
  });
  ctx.counts.created.quote = (ctx.counts.created.quote || 0) + 1;
  return { row, created: true };
}

/** The line items a quote or invoice carries, priced from the preset. */
function lineItems(ctx, picks) {
  return picks
    .map(({ i, qty, note }) => {
      const s = ctx.preset.services[i % ctx.preset.services.length];
      const unitPrice = Number(s.rate);
      return {
        name: s.name,
        description: note || s.name,
        quantity: qty,
        unit: s.unit,
        unitPrice,
        total: money(unitPrice * qty),
      };
    });
}

function totalsFor(ctx, items, { taxEnabled = true } = {}) {
  const subtotal = money(items.reduce((s, li) => s + li.total, 0));
  const tax = taxEnabled ? money((subtotal * ctx.taxPct) / 100) : 0;
  return { subtotal, tax, total: money(subtotal + tax) };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. The company: where it is, what it charges, when it is open
// ═══════════════════════════════════════════════════════════════════════════

async function seedCompany(ctx) {
  const { db, companyId, prof, preset, key } = ctx;
  const defaultTax = prof.taxRates.find((t) => t.isDefault) || prof.taxRates[0];

  await db.company.update({
    where: { id: companyId },
    data: {
      address: prof.address,
      city: prof.city,
      province: prof.province,
      postalCode: prof.postalCode,
      country: prof.country,
      phone: fictionalPhone(prof.phoneArea, 80),
      website: `https://${ctx.slug}.example.com`,
      currency: prof.currency,
      timezone: prof.timezone,
      taxRate: defaultTax.rate,
      taxIdName: prof.taxIdName,
      taxIdNumber: prof.taxIdNumber,
      autoApplyLocalTax: true,
      paymentTerms:
        key === "cleaning" || key === "landscaping"
          ? "Due on receipt. Recurring clients are invoiced monthly."
          : "50% deposit to book, balance due on completion.",
      paymentMethods: ["card", "etransfer", "cheque"],
      payCycle: DEFAULT_PAY_CYCLE,
      revenueGoalAnnual: 480_000,
      defaultVisitMinutes: 60,
      arrivalWindowMinutes: 60,
      bookingModes: ["visit", "call"],
      businessHours: [
        { day: 0, closed: true, open: "09:00", close: "17:00" },
        { day: 1, closed: false, open: "08:00", close: "17:00" },
        { day: 2, closed: false, open: "08:00", close: "17:00" },
        { day: 3, closed: false, open: "08:00", close: "17:00" },
        { day: 4, closed: false, open: "08:00", close: "17:00" },
        { day: 5, closed: false, open: "08:00", close: "16:00" },
        { day: 6, closed: true, open: "09:00", close: "13:00" },
      ],
      defaultProcessNotes: `${preset.tagline}. We confirm the visit the day before, protect the site, and walk the finished work with you before we leave.`,
    },
  });

  for (const t of prof.taxRates) {
    await ctx.ensure("taxRate", { companyId, name: t.name }, { companyId, name: t.name, rate: t.rate, isDefault: t.isDefault });
  }

  // Deposit / balance, the schedule a job's payment stages are frozen from.
  const stages = [
    { seq: 1, label: "Deposit", trigger: "on_approval", percentage: 50 },
    { seq: 2, label: "Balance", trigger: "on_completion", percentage: 50 },
  ];
  for (const s of stages) {
    await ctx.ensure("paymentScheduleStage", { companyId, seq: s.seq }, { companyId, ...s });
  }

  const found = await db.forecastSettings.findFirst({ where: { companyId } });
  if (!found) {
    await ctx.create("forecastSettings", {
      companyId,
      quoteSentToPaid: 0.42,
      invoiceSentToPaid: 0.86,
      avgJobValue: 6400,
      jobsPerWeekCapacity: 4,
      targetMargin: 0.32,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Price book, materials, overhead
// ═══════════════════════════════════════════════════════════════════════════

async function seedPriceBook(ctx) {
  const { companyId, preset, prof } = ctx;

  // Services: applyIndustry already wrote these from the preset (Product,
  // type "service"); found here, never duplicated.
  for (const s of preset.services) {
    const { row } = await ctx.ensure(
      "product",
      { companyId, name: s.name, type: "service" },
      { companyId, name: s.name, type: "service", unit: s.unit, unitPrice: s.rate },
    );
    ctx.services.push(row);
  }

  for (const m of prof.materials) {
    const { row } = await ctx.ensure(
      "material",
      { companyId, name: m.name },
      { companyId, name: m.name, unit: m.unit, category: m.category, currentAvgCost: m.cost, reorderThreshold: 4 },
    );
    ctx.materials.push(row);
    await ctx.ensure(
      "product",
      { companyId, name: m.name, type: "product" },
      { companyId, name: m.name, type: "product", unit: m.unit, unitPrice: money(m.cost * 1.35) },
    );
  }

  // Overhead: the monthly lines every job carries a share of.
  const overhead = [
    { category: "Rent", amount: 2400, notes: `Shop lease — ${prof.address}` },
    { category: "Insurance", amount: 415, notes: "Commercial general liability" },
    { category: "Vehicle", amount: 690, notes: `${prof.vehicle.makeModel} — lease + insurance` },
    { category: "Phone & software", amount: 210, notes: "Mobile plans, FieldQuo, accounting" },
    { category: "Fuel", amount: 520, notes: "Fleet fuel — monthly average" },
  ];
  for (const o of overhead) {
    for (let m = 5; m >= 0; m--) {
      const date = ctx.day(-30 * m - 2, 10);
      await ctx.ensure(
        "expense",
        { companyId, category: o.category, isOverhead: true, externalId: `demo:overhead:${o.category}:${m}` },
        {
          companyId,
          category: o.category,
          amount: o.amount,
          date,
          notes: o.notes,
          isOverhead: true,
          recurring: true,
          frequency: "monthly",
          paidAt: date,
          externalId: `demo:overhead:${o.category}:${m}`,
          importSource: "demo",
        },
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. The people: owner, estimator, dispatcher, crew — with hours and leave
// ═══════════════════════════════════════════════════════════════════════════

async function seedStaff(ctx) {
  const { db, companyId, prof, key } = ctx;
  const roster = staffFor(key);
  const domain = `${ctx.slug}.example.com`;

  let n = 0;
  for (const p of roster) {
    n += 1;
    const name = `${p.firstName} ${p.lastName}`;
    // User.email is unique across the platform, so the address carries the
    // company's slug: marc.tremblay@demo2.example.com and
    // marc.tremblay@demo-ana-cabinets.example.com can both exist.
    const email = fictionalEmail(p.firstName, p.lastName, domain);
    const language = /[éèçô]/i.test(name) ? "fr" : /[íáñó]/i.test(name) ? "es" : "en";
    const { row: user } = await ctx.ensure("user", { email }, { name, email, emailVerified: true, language });

    const grid = p.preset ? { ...PERMISSION_PRESETS[p.preset].values } : null;
    const { row: member } = await ctx.ensure(
      "member",
      { userId: user.id, companyId },
      {
        userId: user.id,
        companyId,
        role: p.role,
        active: true,
        phone: fictionalPhone(prof.phoneArea, 80 + n),
        city: prof.city,
        province: prof.province,
        country: prof.country,
        laborCostPerHour: p.rate || null,
        permissions: grid,
        invitationLanguage: language,
        createdAt: ctx.day(-400 + n * 40),
      },
    );

    const { row: worker } = await ctx.ensure(
      "worker",
      { companyId, email },
      {
        companyId,
        userId: user.id,
        name,
        email,
        phone: fictionalPhone(prof.phoneArea, 80 + n),
        city: prof.city,
        province: prof.province,
        type: "employee",
        hourlyRate: p.rate || null,
        workType: p.preset === "worker" ? "field" : "office",
        scheduledHoursPerWeek: 40,
        hiredOn: ctx.day(-400 + n * 40),
      },
    );

    // Availability, Mon–Fri. WorkingHours is what the schedule reads;
    // AvailabilitySchedule is what the booking page reads. Both, because
    // they are allowed to disagree and here they don't.
    for (let d = 1; d <= 5; d++) {
      await ctx.ensure(
        "workingHours",
        { userId: user.id, dayOfWeek: d },
        { userId: user.id, companyId, dayOfWeek: d, startTime: "08:00", endTime: "16:30", timezone: prof.timezone },
      );
      await ctx.ensure(
        "availabilitySchedule",
        { userId: user.id, dayOfWeek: d },
        { userId: user.id, dayOfWeek: d, startTime: "08:00", endTime: "16:30", timezone: prof.timezone },
      );
    }

    const entry = { ...p, name, email, user, member, worker };
    ctx.people.push(entry);
    if (p.role === "owner") ctx.owner = entry;
    else if (p.preset === "estimator") ctx.estimator = entry;
    else if (p.preset === "dispatcher") ctx.dispatcher = entry;
    else if (p.preset === "worker") ctx.crew.push(entry);
    ctx.workers.push(entry);
  }

  // Leave: two policies, a balance per person, one approved next week, one
  // pending.
  const { row: vacation } = await ctx.ensure(
    "leavePolicy",
    { companyId, name: "Vacation" },
    { companyId, name: "Vacation", kind: "vacation", paid: true, accrualMethod: "annual_allotment", annualDays: 15, carryoverMaxDays: 5 },
  );
  const { row: sick } = await ctx.ensure(
    "leavePolicy",
    { companyId, name: "Sick leave" },
    { companyId, name: "Sick leave", kind: "sick", paid: true, accrualMethod: "annual_allotment", annualDays: 5 },
  );
  let i = 0;
  for (const w of ctx.workers) {
    i += 1;
    await ctx.ensure(
      "leaveBalance",
      { policyId: vacation.id, workerId: w.worker.id, year: ctx.year },
      { policyId: vacation.id, workerId: w.worker.id, year: ctx.year, accruedDays: 15, usedDays: (i * 2) % 7 },
    );
    await ctx.ensure(
      "leaveBalance",
      { policyId: sick.id, workerId: w.worker.id, year: ctx.year },
      { policyId: sick.id, workerId: w.worker.id, year: ctx.year, accruedDays: 5, usedDays: i % 3 },
    );
  }
  const [c1, c2] = ctx.crew;
  if (c1) {
    await ctx.ensure(
      "leaveRequest",
      { companyId, workerId: c1.worker.id, policyId: vacation.id, status: "approved" },
      {
        companyId,
        policyId: vacation.id,
        workerId: c1.worker.id,
        startDate: ctx.week(1, 2),
        endDate: ctx.week(1, 4),
        days: 3,
        reason: "Family trip",
        status: "approved",
        reviewedById: ctx.owner.user.id,
        reviewedAt: ctx.day(-9, 14),
        reviewNote: "Approved — coverage arranged.",
        createdAt: ctx.day(-12, 8),
      },
    );
  }
  if (c2) {
    await ctx.ensure(
      "leaveRequest",
      { companyId, workerId: c2.worker.id, policyId: sick.id, status: "pending" },
      {
        companyId,
        policyId: sick.id,
        workerId: c2.worker.id,
        startDate: ctx.week(2, 0),
        endDate: ctx.week(2, 0),
        days: 1,
        reason: "Dental appointment",
        status: "pending",
        createdAt: ctx.day(-1, 17),
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Clients: 30 households and businesses on real streets
// ═══════════════════════════════════════════════════════════════════════════

export const CLIENT_COUNT = 30;

async function seedClients(ctx) {
  const { companyId, prof, random, key } = ctx;

  // Two draws from a 24-name pool can collide; the second one gets a numbered
  // address so the row is still its own client, not a merge into the first.
  const used = new Set();
  const unique = (email) => {
    let out = email;
    let n = 1;
    while (used.has(out)) out = email.replace("@", `${++n}@`);
    used.add(out);
    return out;
  };

  for (let i = 0; i < CLIENT_COUNT; i++) {
    const lang = pick(random, prof.languages);
    const isBusiness = i % 10 === 4; // three businesses in thirty
    const addr = addressFor(random, prof.streets);
    let data;
    if (isBusiness) {
      const contact = person(random, lang);
      const name = business(random, lang);
      data = {
        name,
        type: "company",
        contactName: `${contact.firstName} ${contact.lastName}`,
        email: fictionalEmail(name.split(/\s+/)[0], "accounts"),
        notes: "Net 30. Send invoices to accounts payable; site contact is the manager on duty.",
      };
    } else if (i === 0 && key === "cabinets") {
      // The help-centre harness's client, so the guide and the demo agree.
      data = {
        name: "Sophie Dubois",
        type: "individual",
        contactName: null,
        email: "sophie.dubois@example.com",
        notes: "Kitchen refit — wants shaker doors, white oak island.",
      };
      addr.line1 = "88 rue des Érables";
    } else {
      const p = person(random, lang);
      data = {
        name: `${p.firstName} ${p.lastName}`,
        type: "individual",
        contactName: null,
        email: fictionalEmail(p.firstName, p.lastName),
        notes: i % 4 === 1 ? pick(random, CLIENT_NOTES) : null,
      };
    }
    data.email = unique(data.email);
    const { row } = await ctx.ensure(
      "client",
      { companyId, email: data.email },
      {
        companyId,
        ...data,
        phone: i === 0 && key === "cabinets" ? "+1 514 555 0147" : fictionalPhone(prof.phoneArea, i),
        address: addr.line1,
        city: prof.city,
        province: prof.province,
        country: prof.country,
        language: lang,
        createdAt: ctx.day(-190 + i * 6, 11),
      },
    );
    ctx.clients.push(row);
  }

  // Consent. Every client with an email is on the marketing list (the way a
  // client import puts them there); one has unsubscribed; one has texted
  // STOP.
  let k = 0;
  for (const c of ctx.clients) {
    k += 1;
    const unsubscribed = k === 7;
    await ctx.ensure(
      "marketingSubscriber",
      { companyId, email: c.email },
      {
        companyId,
        email: c.email,
        name: c.name,
        phone: c.phone,
        address: c.address,
        clientId: c.id,
        subscribed: !unsubscribed,
        source: "client_import",
        unsubscribeToken: `demo-unsub-${companyId}-${k}`,
        unsubscribedAt: unsubscribed ? ctx.day(-40, 20) : null,
        createdAt: c.createdAt,
      },
    );
  }
  const stop = ctx.clients[11];
  if (stop) {
    const e164 = `+1${String(stop.phone).replace(/\D/g, "").slice(-10)}`;
    await ctx.ensure(
      "smsOptOut",
      { companyId, e164 },
      { companyId, e164, optedOut: true, lastMessageBody: "STOP", createdAt: ctx.day(-33, 19) },
    );
  }

  // Equipment and warranties, for the trades that service what a client owns.
  if (prof.equipment) {
    let e = 0;
    for (const c of ctx.clients.slice(1, 6)) {
      const spec = prof.equipment[e % prof.equipment.length];
      e += 1;
      const installedAt = ctx.day(-(120 + e * 45), 10);
      const { row: eq } = await ctx.ensure(
        "clientEquipment",
        { companyId, clientId: c.id, name: spec.name },
        {
          companyId,
          clientId: c.id,
          name: spec.name,
          manufacturer: spec.manufacturer,
          modelNumber: spec.modelNumber,
          serialNumber: `${spec.modelNumber.replace(/\W/g, "").slice(0, 4).toUpperCase()}-${String(4100 + e * 37)}`,
          siteAddress: c.address,
          installedAt,
          warrantyEndsAt: new Date(installedAt.getTime() + spec.warrantyYears * 365 * DAY),
          warrantyProvider: spec.manufacturer,
          warrantyNotes: "Parts only; labour covered for the first year.",
          createdAt: installedAt,
        },
      );
      if (e === 1) {
        await ctx.ensure(
          "clientEquipmentService",
          { equipmentId: eq.id },
          { equipmentId: eq.id, servicedAt: ctx.day(-20, 13), description: "Annual inspection — filter changed, connections tightened.", underWarranty: true },
        );
      }
    }
  }
}

const CLIENT_NOTES = [
  "Prefers texts over calls. Dog in the yard — ring first.",
  "Referred by a neighbour. Wants an itemised quote.",
  "Gate code 4471. Park on the street, not the driveway.",
  "Second property — the rental on the same street.",
  "Home after 3 pm on weekdays.",
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. Leads: every source, every score band
// ═══════════════════════════════════════════════════════════════════════════

async function seedLeads(ctx) {
  const { companyId, prof, random, preset } = ctx;
  const specs = [
    { source: "self_quote", budget: "5k_15k", timeline: "2_weeks", status: "new", days: 1, hasPhone: true },
    { source: "meta_lead_form", budget: "15k_plus", timeline: "asap", status: "new", days: 2, hasPhone: true, meta: true },
    { source: "phone_assistant", budget: null, timeline: "1_3_months", status: "contacted", days: 4, hasPhone: true },
    { source: "referral", budget: "1k_5k", timeline: "2_weeks", status: "contacted", days: 6, hasPhone: true },
    { source: "self_quote", budget: "unsure", timeline: "exploring", status: "new", days: 9, hasPhone: false },
    { source: "meta_lead_form", budget: "under_1k", timeline: "exploring", status: "lost", days: 30, hasPhone: false, meta: true, lostReason: "Went with another contractor" },
    { source: "self_quote", budget: "5k_15k", timeline: "asap", status: "converted", days: 26, hasPhone: true },
    { source: "referral", budget: "15k_plus", timeline: "1_3_months", status: "contacted", days: 12, hasPhone: true },
    { source: "phone_assistant", budget: null, timeline: "asap", status: "new", days: 0, hasPhone: true, emergency: true },
    { source: "self_quote", budget: "1k_5k", timeline: "1_3_months", status: "lost", days: 55, hasPhone: true, lostReason: "No response after two follow-ups" },
  ];

  let n = 0;
  for (const s of specs) {
    n += 1;
    const lang = pick(random, prof.languages);
    const p = person(random, lang);
    const name = `${p.firstName} ${p.lastName}`;
    const email = fictionalEmail(p.firstName, p.lastName);
    const phone = s.hasPhone ? fictionalPhone(prof.phoneArea, 40 + n) : null;
    const service = preset.services[n % preset.services.length];
    const message = `${service.name} — ${pick(random, LEAD_MESSAGES)}`;
    const intake = s.emergency ? { isEmergency: true, address: addressFor(random, prof.streets).line1 } : { address: addressFor(random, prof.streets).line1 };

    // Scored by the product's own scorer, with the same "this channel could
    // not ask that" rule createScoredLead applies.
    const scored = scoreLead(
      { budgetBand: s.budget, timeline: s.timeline, phone, email, message, intake },
      { unasked: UNASKABLE_BY_SOURCE[s.source] || [] },
    );

    const { row: lead, created } = await ctx.ensure(
      "leadRequest",
      { companyId, email },
      {
        companyId,
        name,
        email,
        phone,
        message,
        status: s.status,
        lostReason: s.lostReason || null,
        source: s.source,
        budgetBand: s.budget,
        timeline: s.timeline,
        intake,
        language: lang,
        score: scored.score,
        temperature: scored.temperature,
        scoreReasons: scored.reasons,
        assignedToId: s.status === "contacted" ? ctx.estimator?.user.id || null : null,
        ...(s.meta ? { metaLeadId: `demo_lead_${companyId}_${n}`, metaFormId: "demo_form_1", metaCampaignName: "Spring promo — lead form" } : {}),
        createdAt: ctx.day(-s.days, 9 + (n % 8)),
      },
    );
    if (created && s.status !== "new") {
      await ctx.create("leadNote", {
        leadId: lead.id,
        authorId: ctx.estimator?.user.id || ctx.owner.user.id,
        body: s.status === "lost" ? `Closed: ${s.lostReason}.` : "Called back, left a message. Site visit proposed for next week.",
        createdAt: ctx.day(-s.days + 1, 15),
      });
    }
    ctx.leads.push({ row: lead, spec: s });
  }
}

const LEAD_MESSAGES = [
  "looking for a quote, can you come by this week?",
  "we just bought the house and want this done before we move in",
  "saw your truck on our street — what would this cost roughly?",
  "the previous contractor never came back, need someone reliable",
  "is there a rough range before you visit?",
  "please text rather than call, I work nights",
];

// ═══════════════════════════════════════════════════════════════════════════
// 6. The pipeline: quotes → jobs → visits → invoices → payments
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The stories. One row each; the order fixes the quote and invoice numbers.
 *
 *   days     when the quote was written, days ago
 *   status   Quote.status — draft / sent / accepted / declined
 *   job      what happened after acceptance: done (completed, invoiced,
 *            paid a given way), inProgress (this week, deposit paid),
 *            upcoming (next month), recurring
 *   pay      how the final invoice was settled
 */
const STORIES = [
  { days: 168, status: "accepted", job: "done", pay: "card", signed: true, picks: [[0, 1.0], [1, 1.0]], review: 5 },
  { days: 150, status: "accepted", job: "done", pay: "etransfer", picks: [[2, 1.0], [3, 1.0]], review: 4 },
  { days: 131, status: "declined", declineReason: "Went with a lower quote", picks: [[0, 0.6]] },
  { days: 118, status: "accepted", job: "done", pay: "bank", picks: [[1, 1.4], [3, 0.5]], review: 5, safety: true },
  { days: 104, status: "accepted", job: "done", pay: "refunded", picks: [[0, 0.5]] },
  { days: 92, status: "accepted", job: "done", pay: "disputed", picks: [[2, 0.8]] },
  { days: 80, status: "accepted", job: "recurring", pay: null, picks: [[3, 1.0]] },
  { days: 66, status: "accepted", job: "done", pay: "overdue", picks: [[0, 1.2], [2, 0.4]], addOns: true },
  { days: 48, status: "sent", expired: true, picks: [[1, 0.8]] },
  { days: 40, status: "accepted", job: "done", pay: "card", signed: true, picks: [[0, 0.9], [1, 1.2], [3, 1.0]], review: 5, tiered: true },
  { days: 21, status: "declined", declineReason: "Postponed to next spring", picks: [[2, 1.1]] },
  { days: 18, status: "accepted", job: "inProgress", pay: "deposit", signed: true, picks: [[0, 1.0], [1, 1.0], [2, 0.5], [3, 1.0]], addOns: true, hero: true },
  { days: 9, status: "sent", viewed: true, picks: [[0, 1.3]], addOns: true },
  { days: 7, status: "accepted", job: "upcoming", pay: null, picks: [[1, 1.0], [3, 2.0]] },
  { days: 3, status: "sent", picks: [[2, 0.7]] },
  { days: 2, status: "draft", aiReview: true, picks: [[0, 1.1], [3, 1.0]] },
  { days: 1, status: "draft", large: true, picks: [[0, 4.5], [1, 3.0], [2, 4.0], [3, 6.0]] },
];

async function seedPipeline(ctx) {
  const { companyId, prof, preset, random, key, db } = ctx;
  let qn = 0;
  let inv = 0;
  const quoteNumber = (seq, suffix = "") => `Q-${ctx.year}-${String(seq).padStart(4, "0")}${suffix}`;
  const invoiceNumber = () => `INV-${ctx.year}-${String(++inv).padStart(4, "0")}`;
  const titles = preset.jobs;

  let storyIndex = 0;
  for (const st of STORIES) {
    storyIndex += 1;
    qn += 1;
    // The hero story is the harness's client; the rest walk the client list.
    const client = st.hero && key === "cabinets" ? ctx.clients[0] : ctx.clients[(storyIndex * 7 + 3) % ctx.clients.length];
    const items = lineItems(
      ctx,
      st.picks.map(([i, f]) => ({ i, qty: Math.max(1, Math.round(prof.qty[i] * f)) })),
    );
    const { subtotal, tax, total } = totalsFor(ctx, items);
    // The hero story on the cabinets demo is the harness's J-318, by name.
    const title = st.hero && key === "cabinets" ? "Dubois kitchen — build & install" : titles[storyIndex % titles.length];
    const createdAt = ctx.day(-st.days, 10 + (storyIndex % 6));
    const sentAt = st.status === "draft" ? null : ctx.day(-st.days, 16);
    const decidedAt = st.status === "accepted" || st.status === "declined" ? ctx.day(-st.days + 2, 11) : null;
    const validUntil = st.expired ? ctx.day(-st.days + 30, 23) : ctx.day(-st.days + 45, 23);

    const base = {
      companyId,
      clientId: client.id,
      status: st.status,
      language: client.language || ctx.language,
      createdById: ctx.estimator?.user.id || ctx.owner.user.id,
      assignedToId: ctx.estimator?.user.id || null,
      lineItems: items,
      subtotal,
      tax,
      discount: 0,
      total,
      taxEnabled: true,
      notes: `${title} — ${client.address}, ${prof.city}.`,
      quoteType: preset.categories[0],
      validUntil,
      sentAt,
      sentToEmail: sentAt ? client.email : null,
      createdAt,
      ...(st.viewed ? { followUpSentAt: ctx.day(-st.days + 4, 9), followUpCount: 1 } : {}),
      ...(st.status === "accepted" ? { acceptedAt: decidedAt, acceptedTotal: total, acceptedSubtotal: subtotal, acceptedTax: tax } : {}),
      ...(st.status === "declined" ? { declinedAt: decidedAt, declineReason: st.declineReason } : {}),
      ...(st.large ? { needsReview: true, reviewNotes: "Large quote — owner review before it goes out." } : {}),
      ...(st.aiReview
        ? {
            aiReview: {
              summary: "Scope reads clearly. Two lines could carry more detail for the client.",
              issues: [
                { severity: "medium", text: `"${items[0].name}" — say what is included (prep, protection, cleanup).` },
                { severity: "low", text: "No validity date shown on the cover note." },
              ],
              suggestedAddOns: [{ description: `Extended warranty on ${items[0].name.toLowerCase()}`, amount: money(subtotal * 0.06) }],
            },
            aiReviewedAt: ctx.day(-st.days, 15),
          }
        : {}),
    };

    let quote;
    if (st.tiered) {
      // Good / better / best: three rows sharing a sequence and a group.
      const groupId = `demo-tier-${companyId}-${qn}`;
      const tiers = [
        ["good", "G", 0.85],
        ["better", "B", 1],
        ["best", "T", 1.25],
      ];
      for (const [label, suffix, f] of tiers) {
        const tItems = items.map((li) => ({ ...li, unitPrice: money(li.unitPrice * f), total: money(li.total * f) }));
        const t = totalsFor(ctx, tItems);
        const { row } = await ensureQuote(
          ctx,
          quoteNumber(qn, `-${suffix}`),
          {
            ...base,
            lineItems: tItems,
            ...t,
            tierGroupId: groupId,
            tierLabel: label,
            status: label === "better" ? "accepted" : "sent",
            ...(label === "better" ? {} : { acceptedAt: null, acceptedTotal: null, acceptedSubtotal: null, acceptedTax: null }),
          },
        );
        if (label === "better") quote = row;
      }
    } else {
      const res = await ensureQuote(ctx, quoteNumber(qn), base);
      quote = res.row;
      if (res.created && st.signed) {
        const signature = buildSignatureRecord({
          quote,
          name: client.contactName || client.name,
          signatureDataUrl: SIGNATURE_MARK,
          consent: true,
          ip: "203.0.113.42",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
          now: decidedAt.toISOString(),
        });
        quote = await db.quote.update({ where: { id: quote.id }, data: { signature } });
      }
      if (res.created && st.addOns) {
        const addOns = [
          { description: `Extended warranty — ${items[0].name.toLowerCase()}`, amount: money(subtotal * 0.06), source: "ai", selected: st.status === "accepted" },
          { description: pick(random, ADD_ONS), amount: money(subtotal * 0.09), source: "manual", selected: false },
        ];
        let so = 0;
        for (const a of addOns) {
          await ctx.create("quoteAddOn", {
            quoteId: quote.id,
            description: a.description,
            detail: "Optional — added to the total if selected.",
            amount: a.amount,
            taxable: true,
            sortOrder: so++,
            source: a.source,
            selected: a.selected,
            selectedAt: a.selected ? decidedAt : null,
            createdAt,
          });
        }
      }
      if (res.created && st.status === "accepted") {
        const labourHours = money(items.reduce((s, li) => s + li.quantity, 0) / (key === "cleaning" ? 1 : 12) + 6);
        const labourCost = money(labourHours * 28);
        const materialTotal = money(subtotal * 0.31);
        const overhead = money(subtotal * 0.12);
        const totalCost = money(labourCost + materialTotal + overhead);
        await ctx.create("quoteCosting", {
          quoteId: quote.id,
          labourRate: 28,
          labourHours,
          labourCost,
          materialTotal,
          overhead,
          overheadPct: 12,
          totalCost,
          price: subtotal,
          profit: money(subtotal - totalCost),
          marginPct: money(((subtotal - totalCost) / subtotal) * 100),
          marginTargetPct: 30,
          signal: subtotal - totalCost > subtotal * 0.3 ? "healthy" : "thin",
          crew: [{ name: ctx.crew[0]?.name || "Crew", hours: labourHours, rate: 28 }],
        });
      }
    }
    ctx.quotes.push({ row: quote, story: st, client, items, subtotal, tax, total, title });

    // The lead that converted points at this quote.
    if (storyIndex === 12 && ctx.leads) {
      const converted = ctx.leads.find((l) => l.spec.status === "converted");
      if (converted && !converted.row.quoteId) {
        await db.leadRequest.update({ where: { id: converted.row.id }, data: { quoteId: quote.id } });
      }
    }

    if (st.status !== "accepted" || !st.job) continue;

    // ── The job ───────────────────────────────────────────────────────────
    const done = st.job === "done";
    const status = done ? "completed" : st.job === "inProgress" ? "in_progress" : "scheduled";
    const jobStart = done ? ctx.day(-st.days + 9, 8) : st.job === "inProgress" ? ctx.week(0, 1, 8) : st.job === "recurring" ? ctx.day(-st.days + 7, 9) : ctx.day(28, 8);
    const jobEnd = done ? ctx.day(-st.days + 10, 17) : st.job === "inProgress" ? ctx.week(0, 2, 17) : st.job === "recurring" ? null : ctx.day(29, 17);
    const { row: job, created: jobCreated } = await ctx.ensure(
      "job",
      { companyId, quoteId: quote.id },
      {
        companyId,
        clientId: client.id,
        quoteId: quote.id,
        title: st.job === "recurring" ? `${title} — ${st.days > 60 ? "weekly" : "monthly"}` : title,
        status,
        recurring: st.job === "recurring",
        recurrenceRule: st.job === "recurring" ? "weekly" : null,
        startDate: jobStart,
        endDate: jobEnd,
        completedAt: done ? jobEnd : null,
        costReviewedAt: done ? ctx.day(-st.days + 12, 9) : null,
        siteAddress: client.address,
        siteCity: prof.city,
        siteProvince: prof.province,
        createdAt: decidedAt,
      },
    );
    ctx.jobs.push({ row: job, story: st, client, quote, items, subtotal, tax, total, title });
    if (!jobCreated) continue;

    // Visits, materials, time, photos, checklist.
    const crewA = ctx.crew[storyIndex % ctx.crew.length];
    const crewB = ctx.crew[(storyIndex + 1) % ctx.crew.length];
    const checklist = normalizeChecklistItems(prof.checklist.map((label) => ({ label, done: done, phase: "during" })), { keepDone: true });
    const visitDays = [];
    if (done) visitDays.push([-st.days + 9, "completed"], [-st.days + 10, "completed"]);
    else if (st.job === "inProgress") visitDays.push([ctx.week(0, 1, 8), "completed"], [ctx.week(0, 2, 8), "in_progress"], [ctx.week(0, 3, 8), "scheduled"]);
    else if (st.job === "upcoming") visitDays.push([28, "scheduled"], [29, "scheduled"]);
    else if (st.job === "recurring") {
      for (let w = -8; w <= 4; w++) visitDays.push([ctx.week(w, 3, 9), w < 0 ? "completed" : "scheduled"]);
    }
    let v = 0;
    for (const [when, vstatus] of visitDays) {
      v += 1;
      const scheduledAt = when instanceof Date ? when : ctx.day(when, 8);
      const isDone = vstatus === "completed";
      const visitPhotos = isDone ? [photoUrl(`${ctx.slug}-${qn}-${v}`, 1), photoUrl(`${ctx.slug}-${qn}-${v}`, 2)] : [];
      const visit = await ctx.create("jobVisit", {
        jobId: job.id,
        scheduledAt,
        assignedToId: (v % 2 ? crewA : crewB)?.user.id || null,
        status: vstatus,
        checklistItems: isDone ? checklist : checklist.map((c) => ({ ...c, done: false })),
        photos: visitPhotos,
        notes: isDone ? pick(random, VISIT_NOTES) : "Confirmed with the client the day before.",
        createdAt: decidedAt,
      });
      let pn = 0;
      for (const url of visitPhotos) {
        pn += 1;
        await ctx.create("jobPhoto", {
          companyId,
          jobId: job.id,
          jobVisitId: visit.id,
          url,
          stage: pn === 1 ? "before" : "after",
          caption: pn === 1 ? "Before" : "After — client walkthrough",
          featured: st.review === 5 && pn === 2,
          sortOrder: pn,
          createdAt: new Date(scheduledAt.getTime() + (pn === 1 ? 1 : 7) * 3_600_000),
        });
      }
      // Time on site, for costing and the timesheet.
      if (isDone) {
        for (const c of [crewA, crewB]) {
          if (!c) continue;
          const clockIn = new Date(scheduledAt.getTime() - 15 * 60_000);
          const hours = 7.5 + (v % 2);
          await ctx.create("timeEntry", {
            workerId: c.worker.id,
            jobId: job.id,
            clockIn,
            clockOut: new Date(clockIn.getTime() + hours * 3_600_000),
            hours,
            status: scheduledAt < ctx.week(0, 0) ? "approved" : "pending",
            approvedById: scheduledAt < ctx.week(0, 0) ? ctx.dispatcher?.user.id || ctx.owner.user.id : null,
            createdAt: clockIn,
          });
        }
      }
    }

    // Materials on the job, and the expense for buying them.
    let mo = 0;
    for (const m of prof.materials.slice(0, 3)) {
      mo += 1;
      const qty = Math.max(1, Math.round(items[0].quantity / (mo * 8)));
      const purchased = done || st.job === "inProgress";
      await ctx.create("jobMaterial", {
        jobId: job.id,
        name: m.name,
        qty,
        unit: m.unit,
        actualQty: purchased ? qty : null,
        categoryKey: m.category,
        estUnitCost: m.cost,
        actualCost: purchased ? money(m.cost * qty) : null,
        supplier: purchased ? prof.supplier.name : null,
        purchasedAt: purchased ? new Date(jobStart.getTime() - 2 * DAY) : null,
        purchasedById: purchased ? ctx.dispatcher?.user.id || null : null,
        sortOrder: mo,
        createdAt: decidedAt,
      });
      if (purchased) {
        await ctx.ensure("expense", { companyId, externalId: `demo:job:${qn}:material:${mo}` }, {
          companyId,
          category: "Materials",
          amount: money(m.cost * qty),
          date: new Date(jobStart.getTime() - 2 * DAY),
          notes: `${m.name} × ${qty} — ${prof.supplier.name}`,
          projectId: job.id,
          isOverhead: false,
          vendorName: prof.supplier.name,
          createdById: ctx.dispatcher?.user.id || null,
          paidAt: new Date(jobStart.getTime() - 2 * DAY),
          externalId: `demo:job:${qn}:material:${mo}`,
          importSource: "demo",
        });
      }
    }

    if (st.job === "inProgress") {
      await ctx.create("changeOrder", {
        jobId: job.id,
        description: `Client added: ${preset.services[3].name.toLowerCase()} (${prof.qty[3]} ${preset.services[3].unit})`,
        priceDelta: money(preset.services[3].rate * prof.qty[3] * 0.5),
        status: "approved",
        decidedAt: ctx.week(0, 1, 16),
        decidedById: ctx.owner.user.id,
        createdById: crewA?.user.id || ctx.owner.user.id,
        createdAt: ctx.week(0, 1, 15),
      });
      await ctx.create("jobDailyLog", {
        companyId,
        jobId: job.id,
        logDate: ctx.week(0, 1, 12),
        bodyText: `Day one on site. ${prof.checklist[0]}. ${prof.checklist[1]}. Client asked about an extra — change order raised.`,
        weather: "Sunny, 21°C",
        crewCount: 2,
        hoursOnSite: 8,
        delays: null,
        authorUserId: crewA?.user.id || null,
        authorName: crewA?.name || null,
        createdAt: ctx.week(0, 1, 17),
      });
      // Payment stages frozen from the schedule: deposit invoiced and paid,
      // balance pending.
      const stages = await db.paymentScheduleStage.findMany({ where: { companyId }, orderBy: { seq: "asc" } });
      for (const s of stages) {
        await ctx.create("jobPaymentStage", {
          companyId,
          jobId: job.id,
          quoteId: quote.id,
          templateStageId: s.id,
          seq: s.seq,
          label: s.label,
          trigger: s.trigger,
          percentage: s.percentage,
          status: s.seq === 1 ? "invoiced" : "pending",
          amountCents: Math.round(cents(total) * (Number(s.percentage) / 100)),
          requestedAt: s.seq === 1 ? decidedAt : null,
          createdAt: decidedAt,
        });
      }
    }

    if (st.safety) {
      await ctx.create("safetyIncident", {
        companyId,
        jobId: job.id,
        reportedByMemberId: crewA?.member.id || ctx.owner.member.id,
        involvedWorkerId: crewB?.worker.id || null,
        occurredAt: ctx.day(-st.days + 9, 14, 20),
        location: `${client.address}, ${prof.city}`,
        kind: "near_miss",
        description: pick(random, SAFETY_TEXT),
        workStopped: false,
        status: "closed",
        followUpNotes: "Toolbox talk held the next morning. Procedure reminded to the whole crew.",
        followUpAt: ctx.day(-st.days + 10, 8),
        reviewedByMemberId: ctx.owner.member.id,
        reviewedAt: ctx.day(-st.days + 10, 8),
        createdAt: ctx.day(-st.days + 9, 15),
      });
    }

    if (done && st.review) {
      await ctx.create("satisfactionResponse", {
        companyId,
        jobId: job.id,
        clientId: client.id,
        token: `demo-review-${companyId}-${qn}`,
        language: client.language || ctx.language,
        score: st.review,
        comment: pick(random, REVIEW_TEXT[st.review]),
        respondedAt: ctx.day(-st.days + 13, 19),
        createdAt: ctx.day(-st.days + 11, 9),
      });
    }

    // ── The invoice ───────────────────────────────────────────────────────
    if (!st.pay) continue;
    const isDeposit = st.pay === "deposit";
    const invItems = isDeposit
      ? [{ name: `Deposit — 50% of ${quote.quoteNumber}`, description: title, quantity: 1, unit: "ea", unitPrice: money(subtotal / 2), total: money(subtotal / 2) }]
      : items;
    const it = totalsFor(ctx, invItems);
    const issuedAt = isDeposit ? decidedAt : jobEnd;
    const dueDate = new Date(issuedAt.getTime() + (st.pay === "overdue" ? 14 : 30) * DAY);
    const invoice = await ctx.create("invoice", {
      companyId,
      clientId: client.id,
      quoteId: quote.id,
      jobId: job.id,
      invoiceNumber: invoiceNumber(),
      status: "sent",
      createdById: ctx.owner.user.id,
      lineItems: invItems,
      ...it,
      discount: 0,
      taxEnabled: true,
      amountPaid: 0,
      amountDue: it.total,
      dueDate,
      language: client.language || ctx.language,
      notes: isDeposit ? "Deposit as agreed on the quote. Balance invoiced on completion." : "Thank you for your business.",
      sentAt: issuedAt,
      sentToEmail: client.email,
      createdAt: issuedAt,
    });
    ctx.invoices.push({ row: invoice, story: st, client, job, total: it.total });
    if (isDeposit) {
      const stage = await db.jobPaymentStage.findFirst({ where: { jobId: job.id, seq: 1 } });
      if (stage) await db.jobPaymentStage.update({ where: { id: stage.id }, data: { invoiceId: invoice.id, status: "paid" } });
    }

    await settleInvoice(ctx, { invoice, story: st, total: it.total, issuedAt, dueDate, qn });

    if (done) {
      const labourHours = 2 * 8.5 * (visitDays.length || 1);
      const labourCost = money(labourHours * ((crewA?.rate || 26) + (crewB?.rate || 24)) / 2);
      const materialCost = money(prof.materials.slice(0, 3).reduce((s, m, i) => s + m.cost * Math.max(1, Math.round(items[0].quantity / ((i + 1) * 8))), 0));
      const overhead = money(subtotal * 0.12);
      await ctx.create("invoiceCosting", {
        invoiceId: invoice.id,
        crew: [crewA, crewB].filter(Boolean).map((c) => ({ name: c.name, hours: labourHours / 2, rate: c.rate })),
        materialCost,
        overheadPct: 12,
        labourHours,
        labourCost,
        overhead,
        totalCost: money(labourCost + materialCost + overhead),
      });
    }
  }
}

/**
 * Settle an invoice the way the story says — through recordStripePayment for
 * anything Stripe would have handled, with a synthetic intent id that reads
 * "demo" in any ledger, and a manual Payment row for an e-transfer.
 */
async function settleInvoice(ctx, { invoice, story, total, issuedAt, dueDate, qn }) {
  const { db, companyId, currency } = ctx;
  const paidAt = new Date(issuedAt.getTime() + 3 * DAY);
  const stripeDeps = { notify: async () => {}, notifyEvent: async () => {} };
  const pi = (tag) => `demo_pi_${companyId}_${qn}_${tag}`;

  const stripe = async (method, amount, tag) => {
    // Bank debit is CAD-only in the product (authorisableMethods); a US demo
    // pays the "bank" story by card rather than pretend at a rail it lacks.
    const rail = method === "bank" && currency === "CAD" ? "acss_debit" : "card";
    const fee = feeBreakdown({ amountCents: cents(amount), currency: currency.toLowerCase(), method: rail });
    const res = await recordStripePayment(
      db,
      {
        invoiceId: invoice.id,
        paymentIntentId: pi(tag),
        amountCents: cents(amount),
        method: "stripe",
        fee: {
          processingFeeCents: fee.feeCents,
          netCents: fee.netCents,
          feeRateLabel: fee.rateLabel,
          estimatedFeeCents: fee.feeCents,
          stripeFeeCents: fee.feeCents,
        },
      },
      stripeDeps,
    );
    // The writer stamps "now"; the story happened three days after issue.
    const payment = await db.payment.findFirst({ where: { stripePaymentIntentId: pi(tag) } });
    if (payment) {
      await db.payment.update({ where: { id: payment.id }, data: { date: paidAt, createdAt: paidAt } });
      ctx.counts.created.payment = (ctx.counts.created.payment || 0) + 1;
    }
    if (res.isPaid) await db.invoice.update({ where: { id: invoice.id }, data: { paidDate: paidAt } });
    return payment;
  };

  switch (story.pay) {
    case "card":
    case "bank":
    case "deposit":
      await stripe(story.pay === "bank" ? "bank" : "card", total, "full");
      return;

    case "etransfer": {
      await ctx.create("payment", {
        invoiceId: invoice.id,
        amount: total,
        method: "e_transfer",
        notes: "Interac e-Transfer — auto-deposit",
        date: paidAt,
        createdAt: paidAt,
      });
      const state = computeInvoiceState({ total, payments: [{ amount: total, kind: "payment" }], priorStatus: "sent" });
      await db.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: state.amountPaid, amountDue: state.amountDue, status: state.status, paidDate: paidAt, paidVia: "manual" },
      });
      return;
    }

    case "overdue":
      await db.invoice.update({
        where: { id: invoice.id },
        data: { status: "overdue", lastChasedAt: new Date(dueDate.getTime() + 9 * DAY), chaseCount: 2 },
      });
      return;

    case "refunded": {
      const payment = await stripe("card", total, "full");
      if (!payment) return;
      const refundedAt = new Date(paidAt.getTime() + 6 * DAY);
      await ctx.create("payment", {
        invoiceId: invoice.id,
        amount: -total,
        method: "stripe",
        kind: "refund",
        refundOfPaymentId: payment.id,
        stripeRefundId: `demo_re_${companyId}_${qn}`,
        refundReason: "Client cancelled the second phase; first phase refunded in full as agreed.",
        refundedById: ctx.owner.user.id,
        date: refundedAt,
        createdAt: refundedAt,
      });
      const state = computeInvoiceState({
        total,
        payments: [
          { amount: total, kind: "payment" },
          { amount: -total, kind: "refund" },
        ],
        priorStatus: "paid",
      });
      await db.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: state.amountPaid, amountDue: state.amountDue, amountRefunded: state.amountRefunded, status: "refunded", refundedAt },
      });
      return;
    }

    case "disputed": {
      const payment = await stripe("card", total, "full");
      if (!payment) return;
      const disputedAt = new Date(paidAt.getTime() + 11 * DAY);
      await db.payment.update({
        where: { id: payment.id },
        data: { disputeStatus: "needs_response", disputedAt, disputeHeldCents: cents(total), disputeFeeCents: 1500 },
      });
      await db.invoice.update({ where: { id: invoice.id }, data: { status: "disputed", disputedAt } });
      return;
    }

    default:
      return;
  }
}

const ADD_ONS = [
  "Premium finish upgrade",
  "Same-week scheduling",
  "Haul-away and disposal",
  "Annual maintenance visit",
];
const VISIT_NOTES = [
  "Completed — client walked through and signed off.",
  "Done. Left the spare materials in the garage as asked.",
  "Finished early; client very happy with the result.",
  "Completed. One touch-up noted for the return visit.",
];
const SAFETY_TEXT = [
  "Extension ladder slipped on wet pavers; caught before anyone was on it. No injury.",
  "Extension cord run across the walkway — crew member tripped, no injury. Cord re-routed.",
  "Dust barrier came loose and the client's child walked into the work area. Barrier re-taped and a sign added.",
];
const REVIEW_TEXT = {
  5: [
    "Fantastic work, on time and spotless. Would hire again in a heartbeat.",
    "The crew were polite and the finish is exactly what we hoped for.",
    "Clear quote, no surprises, beautiful result. Thank you!",
  ],
  4: [
    "Great result. Took a day longer than planned but they kept us informed.",
    "Very happy overall — a couple of small touch-ups needed, handled quickly.",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. A service plan with a mandate
// ═══════════════════════════════════════════════════════════════════════════

async function seedServicePlan(ctx) {
  const { companyId, preset, db } = ctx;
  const client = ctx.clients[4]; // a business client
  if (!client) return;
  const service = preset.services[3] || preset.services[0];
  const amount = money(Number(service.rate) * (preset.services[3] ? 1 : 2));
  const startDate = ctx.day(-95, 9);
  const { row: plan, created } = await ctx.ensure(
    "servicePlan",
    { companyId, clientId: client.id, name: "Maintenance plan" },
    {
      companyId,
      clientId: client.id,
      name: "Maintenance plan",
      serviceName: service.name,
      status: "active",
      frequency: "monthly",
      startDate,
      endMode: "count",
      occurrenceCount: 12,
      amountPerOccurrence: amount,
      discountPct: 5,
      taxRatePct: ctx.taxPct,
      collectionMode: "automatic",
      language: client.language || ctx.language,
      authToken: `demo-plan-${companyId}`,
      createdById: ctx.owner.user.id,
      createdAt: startDate,
    },
  );
  if (!created) return;

  await ctx.create("servicePlanAuthorisation", {
    planId: plan.id,
    stripeCustomerId: `demo_cus_${companyId}`,
    stripeSetupIntentId: `demo_seti_${companyId}`,
    stripePaymentMethodId: `demo_pm_${companyId}`,
    stripeMandateId: ctx.currency === "CAD" ? `demo_mandate_${companyId}` : null,
    paymentMethodType: ctx.currency === "CAD" ? "acss_debit" : "card",
    paymentMethodBrand: ctx.currency === "CAD" ? null : "visa",
    paymentMethodLast4: "4242",
    acceptedAt: startDate,
    acceptedIp: "203.0.113.42",
    acceptedAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    termsText: `I authorise ${ctx.company.name} to charge ${amount.toFixed(2)} ${ctx.currency} monthly for ${service.name} until cancelled.`,
    termsLanguage: client.language || ctx.language,
    createdAt: startDate,
  });

  let inv = await db.invoice.count({ where: { companyId } });
  // Four occurrences behind, one ahead — the pending one is what the plan's
  // "next charge" line reads.
  for (let seq = 1; seq <= 5; seq++) {
    const dueDate = new Date(startDate.getTime() + (seq - 1) * 30 * DAY);
    const paid = dueDate < ctx.now;
    const subtotal = amount;
    const discount = money(subtotal * 0.05);
    const tax = money(((subtotal - discount) * ctx.taxPct) / 100);
    const total = money(subtotal - discount + tax);
    let invoiceId = null;
    if (paid) {
      inv += 1;
      const invoice = await ctx.create("invoice", {
        companyId,
        clientId: client.id,
        invoiceNumber: `INV-${ctx.year}-${String(inv).padStart(4, "0")}`,
        status: "paid",
        createdById: ctx.owner.user.id,
        lineItems: [{ name: service.name, description: "Maintenance plan — monthly", quantity: 1, unit: service.unit, unitPrice: subtotal, total: subtotal }],
        subtotal,
        discount,
        tax,
        total,
        amountPaid: total,
        amountDue: 0,
        paidDate: dueDate,
        paidVia: "stripe",
        stripePaymentIntentId: `demo_pi_${companyId}_plan_${seq}`,
        dueDate,
        sentAt: dueDate,
        sentToEmail: client.email,
        language: client.language || ctx.language,
        createdAt: dueDate,
      });
      invoiceId = invoice.id;
      const fee = feeBreakdown({ amountCents: cents(total), currency: ctx.currency.toLowerCase(), method: ctx.currency === "CAD" ? "acss_debit" : "card" });
      await ctx.create("payment", {
        invoiceId,
        amount: total,
        method: "stripe",
        stripePaymentIntentId: `demo_pi_${companyId}_plan_${seq}`,
        processingFeeCents: fee.feeCents,
        netCents: fee.netCents,
        feeRateLabel: fee.rateLabel,
        date: dueDate,
        createdAt: dueDate,
      });
    }
    await ctx.create("servicePlanOccurrence", {
      planId: plan.id,
      seq,
      dueDate,
      status: paid ? "paid" : "pending",
      subtotal,
      discount,
      tax,
      total,
      invoiceId,
      stripePaymentIntentId: paid ? `demo_pi_${companyId}_plan_${seq}` : null,
      chargeAttemptedAt: paid ? dueDate : null,
      createdAt: startDate,
    });
    // The visit that goes with each occurrence, on the calendar.
    const job = ctx.jobs.find((j) => j.story.job === "recurring");
    if (job) {
      await ctx.create("jobVisit", {
        jobId: job.row.id,
        scheduledAt: new Date(dueDate.getTime() + 2 * DAY + 10 * 3_600_000),
        assignedToId: ctx.crew[2]?.user.id || ctx.crew[0]?.user.id || null,
        status: paid ? "completed" : "scheduled",
        notes: `Maintenance plan — visit ${seq} of 12.`,
        createdAt: startDate,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Bookings from the booking page, one with a fee
// ═══════════════════════════════════════════════════════════════════════════

async function seedBookings(ctx) {
  const { companyId, prof, random } = ctx;
  const { row: visitType } = await ctx.ensure(
    "eventType",
    { companyId, slug: "estimate-visit" },
    { companyId, userId: ctx.estimator?.user.id || null, name: "Free estimate visit", slug: "estimate-visit", durationMinutes: 60, bufferAfter: 15, location: "At your address" },
  );
  const { row: consultType } = await ctx.ensure(
    "eventType",
    { companyId, slug: "design-consultation" },
    { companyId, userId: ctx.estimator?.user.id || null, name: "Design consultation", slug: "design-consultation", durationMinutes: 90, feeCents: 4900, location: "At your address" },
  );

  const specs = [
    { type: visitType, when: ctx.day(-24, 10), status: "completed", client: 8 },
    { type: visitType, when: ctx.day(-6, 14), status: "completed", client: 13 },
    { type: visitType, when: ctx.week(0, 3, 13), status: "confirmed", client: 17 },
    { type: consultType, when: ctx.week(1, 1, 10), status: "confirmed", client: 21, fee: true },
    { type: visitType, when: ctx.day(-3, 9), status: "cancelled", client: 25, cancelReason: "Client rescheduled by phone" },
  ];
  let n = 0;
  for (const s of specs) {
    n += 1;
    const client = ctx.clients[s.client] || ctx.clients[n];
    const manageToken = `demo-booking-${companyId}-${n}`;
    const exists = await ctx.db.booking.findFirst({ where: { manageToken } });
    if (exists) {
      ctx.counts.existing.booking = (ctx.counts.existing.booking || 0) + 1;
      continue;
    }
    const appointment = await ctx.create("appointment", {
      companyId,
      clientId: client.id,
      scheduledAt: s.when,
      location: `${client.address}, ${prof.city}`,
      status: s.status === "completed" ? "completed" : s.status === "cancelled" ? "cancelled" : "scheduled",
      notes: `${s.type.name} — booked from the booking page.`,
      cancelReason: s.cancelReason || null,
      createdById: ctx.owner.user.id,
      assignedToId: ctx.estimator?.user.id || null,
      createdAt: new Date(s.when.getTime() - 5 * DAY),
    });
    const fee = s.fee ? feeBreakdown({ amountCents: 4900, currency: ctx.currency.toLowerCase(), method: "card" }) : null;
    await ctx.create("booking", {
      eventTypeId: s.type.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      startTime: s.when,
      endTime: new Date(s.when.getTime() + s.type.durationMinutes * 60_000),
      mode: "visit",
      source: "booking_page",
      notes: pick(random, LEAD_MESSAGES),
      status: s.status,
      manageToken,
      appointmentId: appointment.id,
      address: `${client.address}, ${prof.city}`,
      cancelReason: s.cancelReason || null,
      ...(fee
        ? {
            feePaidCents: 4900,
            feeCurrency: ctx.currency.toLowerCase(),
            feeStripePaymentIntentId: `demo_pi_${companyId}_booking_${n}`,
            feeProcessingCents: fee.feeCents,
            feeNetCents: fee.netCents,
            feeRateLabel: fee.rateLabel,
            feeEstimatedCents: fee.feeCents,
          }
        : {}),
      createdAt: new Date(s.when.getTime() - 5 * DAY),
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. Payroll: two weeks of timesheets, one run paid, one approved
// ═══════════════════════════════════════════════════════════════════════════

async function seedPayroll(ctx) {
  const { companyId, db } = ctx;
  const field = ctx.crew;
  if (!field.length) return;

  // Office-hours entries for the last two weeks, on top of the job entries
  // the pipeline wrote, so every crew member has a full timesheet.
  for (let w = -2; w <= 0; w++) {
    for (let d = 0; d < 5; d++) {
      const clockIn = ctx.week(w, d, 7, 45);
      if (clockIn > ctx.now) continue;
      for (const c of field) {
        const already = await db.timeEntry.findFirst({
          where: { workerId: c.worker.id, clockIn },
        });
        if (already) continue;
        const hours = 8;
        await ctx.create("timeEntry", {
          workerId: c.worker.id,
          clockIn,
          clockOut: new Date(clockIn.getTime() + hours * 3_600_000),
          hours,
          status: w < 0 ? "approved" : "pending",
          approvedById: w < 0 ? ctx.dispatcher?.user.id || ctx.owner.user.id : null,
          createdAt: clockIn,
        });
      }
    }
  }

  // Two closed periods: the previous one approved, the one before it paid.
  const current = payPeriodFor(ctx.now, DEFAULT_PAY_CYCLE);
  if (!current) return;
  const periods = [];
  let cursor = new Date(current.start.getTime() - DAY);
  for (let i = 0; i < 2; i++) {
    const p = payPeriodFor(cursor, DEFAULT_PAY_CYCLE);
    periods.push(p);
    cursor = new Date(p.start.getTime() - DAY);
  }
  const [previous, older] = periods;

  for (const [period, state] of [
    [older, "paid"],
    [previous, "approved"],
  ]) {
    const exists = await db.payRun.findFirst({ where: { companyId, periodStart: period.start } });
    if (exists) {
      ctx.counts.existing.payRun = (ctx.counts.existing.payRun || 0) + 1;
      continue;
    }
    const workers = [];
    for (const w of ctx.workers) {
      if (!w.rate) continue;
      const entries = await db.timeEntry.findMany({
        where: { workerId: w.worker.id, status: "approved", clockIn: { gte: period.start, lte: new Date(period.end.getTime() + DAY) } },
      });
      const fromSheet = entries.reduce((s, e) => s + Number(e.hours || 0), 0);
      // A period before the timesheets we wrote still needs hours on it.
      const totalHours = fromSheet || 76 + (w.rate % 7);
      workers.push({
        worker: { id: w.worker.id, name: w.name, type: "employee", hourlyRate: w.rate },
        totalHours,
        deductions: [
          { label: "Income tax", percent: 15 },
          { label: ctx.prof.country === "US" ? "Social Security" : "CPP", percent: 5.95 },
          { label: ctx.prof.country === "US" ? "Medicare" : "EI", percent: 1.64 },
        ],
      });
    }
    const run = computePayRun({ workers, region: ctx.prof.country === "US" ? "US" : "CA", weeks: period.weeks || 2, frequency: DEFAULT_PAY_CYCLE.frequency });
    const approvedAt = new Date(period.end.getTime() + 2 * DAY);
    const paidAt = period.payDate || new Date(period.end.getTime() + 4 * DAY);
    const payRun = await ctx.create("payRun", {
      companyId,
      periodStart: period.start,
      periodEnd: period.end,
      status: state,
      grossTotal: run.grossTotal,
      deductionTotal: run.deductionTotal,
      netTotal: run.netTotal,
      region: run.region,
      approvedById: ctx.owner.user.id,
      approvedAt,
      paidAt: state === "paid" ? paidAt : null,
      createdById: ctx.owner.user.id,
      createdAt: new Date(period.end.getTime() + DAY),
    });
    for (const line of run.lines) {
      const w = workers.find((x) => x.worker.id === line.workerId) || workers.find((x) => x.worker.name === line.workerName);
      await ctx.create("payRunLine", {
        payRunId: payRun.id,
        workerId: w?.worker.id || line.workerId,
        workerName: line.workerName,
        workerType: "employee",
        hourlyRate: line.hourlyRate ?? w?.worker.hourlyRate ?? null,
        regularHours: line.regularHours,
        overtimeHours: line.overtimeHours,
        items: line.items,
        gross: line.gross,
        deductions: line.deductions,
        net: line.net,
        paidAt: state === "paid" ? paidAt : null,
        createdAt: new Date(period.end.getTime() + DAY),
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. Operations: purchasing, fleet, a subcontractor, tasks
// ═══════════════════════════════════════════════════════════════════════════

async function seedOperations(ctx) {
  const { companyId, prof, db } = ctx;

  const { row: supplier } = await ctx.ensure(
    "supplier",
    { companyId, name: prof.supplier.name },
    {
      companyId,
      name: prof.supplier.name,
      accountRef: prof.supplier.accountRef,
      contactName: prof.supplier.contactName,
      email: fictionalEmail("orders", prof.supplier.name.split(/\s+/)[0]),
      phone: fictionalPhone(prof.phoneArea, 90),
      address: `${prof.city}, ${prof.province}`,
      notes: "Net 30 trade account. Deliveries Tuesday and Thursday.",
    },
  );

  const doneJob = ctx.jobs.find((j) => j.story.job === "done");
  const liveJob = ctx.jobs.find((j) => j.story.job === "inProgress");
  const orders = [
    { number: "PO-0001", status: "received", ordered: -31, expected: -27, received: -27, job: doneJob, lines: prof.materials.slice(0, 3) },
    { number: "PO-0002", status: "ordered", ordered: -2, expected: 3, received: null, job: liveJob, lines: prof.materials.slice(2, 5) },
  ];
  for (const o of orders) {
    const lines = o.lines.map((m, i) => ({ m, qty: 4 + i * 2 }));
    const expectedTotal = money(lines.reduce((s, l) => s + l.m.cost * l.qty, 0));
    const { row: po, created } = await ctx.ensure(
      "purchaseOrder",
      { companyId, number: o.number },
      {
        companyId,
        supplierId: supplier.id,
        jobId: o.job?.row.id || null,
        number: o.number,
        status: o.status,
        expectedTotal,
        currency: ctx.currency,
        orderedAt: ctx.day(o.ordered, 9),
        expectedAt: ctx.day(o.expected, 9),
        receivedAt: o.received == null ? null : ctx.day(o.received, 11),
        notes: o.job ? `For ${o.job.title}` : null,
        createdAt: ctx.day(o.ordered, 9),
      },
    );
    if (!created) continue;
    let ln = 0;
    for (const l of lines) {
      ln += 1;
      const material = ctx.materials.find((x) => x.name === l.m.name);
      await ctx.create("purchaseOrderLine", {
        purchaseOrderId: po.id,
        materialId: material?.id || null,
        description: l.m.name,
        quantity: l.qty,
        unit: l.m.unit,
        unitCost: l.m.cost,
        quantityReceived: o.status === "received" ? l.qty : 0,
      });
      if (o.status === "received" && material) {
        await ctx.create("stockMovement", {
          companyId,
          materialId: material.id,
          quantity: l.qty,
          kind: "receipt",
          purchaseOrderId: po.id,
          jobId: o.job?.row.id || null,
          note: `Received against ${o.number}`,
          ref: `demo:${companyId}:${o.number}:${ln}`,
          occurredAt: ctx.day(o.received, 11),
          createdById: ctx.dispatcher?.user.id || null,
        });
      }
    }
  }

  // The van, and its maintenance.
  const { row: van, created: vanCreated } = await ctx.ensure(
    "asset",
    { companyId, name: `${prof.vehicle.makeModel} (${prof.vehicle.plate})` },
    {
      companyId,
      name: `${prof.vehicle.makeModel} (${prof.vehicle.plate})`,
      cost: 48_500,
      salvageValue: 9_000,
      inServiceDate: ctx.day(-700),
      usefulLifeMonths: 84,
      category: "vehicle",
      notes: "Primary crew van.",
    },
  );
  if (vanCreated) {
    const vehicle = await ctx.create("vehicleDetail", {
      companyId,
      assetId: van.id,
      vin: "1FTBW2CM0NKA12345",
      plate: prof.vehicle.plate,
      makeModel: prof.vehicle.makeModel,
      year: prof.vehicle.year,
      odometerKm: prof.vehicle.odometerKm,
      odometerAtUtc: ctx.day(-1, 17),
      assignedToUserId: ctx.crew[0]?.user.id || null,
      insuranceExpiresAt: ctx.day(140),
      registrationExpiresAt: ctx.day(200),
      nextServiceDueKm: prof.vehicle.odometerKm + 6_000,
      nextServiceDueAt: ctx.day(75),
    });
    const maint = [
      { kind: "oil_change", description: "Oil and filter, tire rotation", days: -44, km: prof.vehicle.odometerKm - 3_100, cents: 18_900 },
      { kind: "tires", description: "Four all-season tires, alignment", days: -160, km: prof.vehicle.odometerKm - 14_800, cents: 129_500 },
      { kind: "brakes", description: "Front pads and rotors", days: -290, km: prof.vehicle.odometerKm - 26_200, cents: 74_200 },
    ];
    for (const m of maint) {
      await ctx.create("vehicleMaintenance", {
        vehicleId: vehicle.id,
        kind: m.kind,
        description: m.description,
        odometerKm: m.km,
        costCents: m.cents,
        performedAt: ctx.day(m.days, 8),
      });
      await ctx.ensure("expense", { companyId, externalId: `demo:vehicle:${m.kind}` }, {
        companyId,
        category: "Vehicle maintenance",
        amount: m.cents / 100,
        date: ctx.day(m.days, 8),
        notes: `${m.description} — ${prof.vehicle.makeModel}`,
        isOverhead: true,
        assetId: van.id,
        paidAt: ctx.day(m.days, 8),
        externalId: `demo:vehicle:${m.kind}`,
        importSource: "demo",
      });
    }
    if (doneJob) {
      await ctx.create("assetUseLog", {
        companyId,
        assetId: van.id,
        jobId: doneJob.row.id,
        usedOn: doneJob.row.startDate || ctx.day(-30),
        hours: 9,
        loggedByMemberId: ctx.crew[0]?.member.id || null,
        note: "Crew and materials to site.",
      });
    }
  }
  await ctx.ensure(
    "asset",
    { companyId, name: "Site equipment set" },
    {
      companyId,
      name: "Site equipment set",
      cost: 6_800,
      salvageValue: 400,
      inServiceDate: ctx.day(-420),
      usefulLifeMonths: 60,
      category: "equipment",
      notes: "Ladders, sprayer, dust extraction, tool chest.",
    },
  );

  // A subcontractor with insurance on file, on one of the finished jobs.
  const { row: sub, created: subCreated } = await ctx.ensure(
    "subcontractor",
    { companyId, name: prof.subcontractor.name },
    {
      companyId,
      name: prof.subcontractor.name,
      trade: prof.subcontractor.trade,
      contactName: `${person(ctx.random, ctx.language).firstName} ${person(ctx.random, ctx.language).lastName}`,
      email: fictionalEmail("info", prof.subcontractor.name.split(/\s+/)[0]),
      phone: fictionalPhone(prof.phoneArea, 91),
      insuranceExpiresAt: ctx.day(210),
      clearanceExpiresAt: ctx.day(95),
      taxFormRequired: true,
      notes: "COI on file. Invoices net 15.",
    },
  );
  if (subCreated && doneJob) {
    const agreed = money(doneJob.subtotal * 0.18);
    const js = await ctx.create("jobSubcontractor", {
      companyId,
      jobId: doneJob.row.id,
      subcontractorId: sub.id,
      description: `${prof.subcontractor.trade} — ${doneJob.title}`,
      agreedAmount: agreed,
      status: "paid",
      createdAt: doneJob.row.createdAt,
    });
    await ctx.create("subcontractorPayment", {
      companyId,
      subcontractorId: sub.id,
      jobSubcontractorId: js.id,
      amount: agreed,
      method: "e_transfer",
      date: doneJob.row.completedAt || ctx.day(-20),
      notes: "Paid on completion.",
      createdById: ctx.owner.user.id,
    });
  }

  // Tasks on the office board.
  const overdue = ctx.invoices.find((i) => i.story.pay === "overdue");
  const tasks = [
    { key: "chase", title: `Chase ${overdue?.row.invoiceNumber || "the overdue invoice"} — ${overdue?.client.name || ""}`, due: ctx.day(1, 10), status: "open", priority: "high", invoiceId: overdue?.row.id, clientId: overdue?.client.id },
    { key: "order", title: `Confirm PO-0002 delivery with ${prof.supplier.name}`, due: ctx.day(2, 9), status: "open", priority: "normal" },
    { key: "review", title: `Review the large quote before it goes out`, due: ctx.day(0, 16), status: "in_progress", priority: "urgent", quoteId: ctx.quotes.find((q) => q.story.large)?.row.id },
    { key: "van", title: `Book the van's service (${prof.vehicle.makeModel})`, due: ctx.day(-3, 9), status: "done", priority: "low" },
  ];
  for (const t of tasks) {
    await ctx.ensure(
      "task",
      { sourceKey: `demo:${companyId}:task:${t.key}` },
      {
        companyId,
        title: t.title,
        dueDate: t.due,
        status: t.status,
        priority: t.priority,
        createdById: ctx.owner.user.id,
        assignedToId: t.key === "chase" ? ctx.owner.user.id : ctx.dispatcher?.user.id || ctx.owner.user.id,
        invoiceId: t.invoiceId || null,
        clientId: t.clientId || null,
        quoteId: t.quoteId || null,
        sourceKey: `demo:${companyId}:task:${t.key}`,
        createdAt: ctx.day(-5, 9),
      },
    );
  }
  void db;
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. Marketing: a pamphlet route, an email campaign, a post, a testimonial
// ═══════════════════════════════════════════════════════════════════════════

async function seedMarketing(ctx) {
  const { companyId, prof, random, key } = ctx;

  const street = prof.streets[1];
  const { row: route, created: routeCreated } = await ctx.ensure(
    "marketingCampaign",
    { companyId, name: `Door-to-door — ${street.name}` },
    {
      companyId,
      name: `Door-to-door — ${street.name}`,
      type: "pamphlet",
      status: "active",
      notes: "Spring flyer. Knock, leave the pamphlet, note who was home.",
      assignedToId: ctx.crew[1]?.user.id || null,
      budget: 350,
      createdAt: ctx.day(-16, 9),
    },
  );
  if (routeCreated) {
    const statuses = ["delivered", "spoke", "not_home", "delivered", "pending", "pending", "delivered", "skipped"];
    for (let i = 0; i < 12; i++) {
      const status = statuses[i % statuses.length];
      await ctx.create("pamphletStop", {
        campaignId: route.id,
        address: `${street.min + i * 4} ${street.name}, ${prof.city}`,
        sortOrder: i + 1,
        status,
        spokeToOwner: status === "spoke",
        notes: status === "spoke" ? "Interested — wants a quote in the spring." : null,
        assignedToId: ctx.crew[1]?.user.id || null,
        createdAt: ctx.day(-16, 9),
      });
    }
  }

  await ctx.ensure(
    "marketingCampaign",
    { companyId, name: "Spring tune-up — email" },
    {
      companyId,
      name: "Spring tune-up — email",
      type: "email",
      status: "completed",
      notes: "Sent to every subscribed client.",
      sentAt: ctx.day(-58, 10),
      recipientCount: CLIENT_COUNT - 1,
      createdAt: ctx.day(-60, 9),
    },
  );

  const featured = ctx.jobs.find((j) => j.story.review === 5);
  const { row: social, created: socialCreated } = await ctx.ensure(
    "marketingCampaign",
    { companyId, name: "Instagram — finished work" },
    { companyId, name: "Instagram — finished work", type: "other", status: "active", notes: "One post per finished job.", createdAt: ctx.day(-30, 9) },
  );
  if (socialCreated) {
    await ctx.create("marketingDesign", {
      companyId,
      campaignId: social.id,
      name: featured ? `Post — ${featured.title}` : "Post — this week's job",
      sourceJobId: featured?.row.id || null,
      caption: `${featured?.title || "Another one done"} in ${prof.city}. ${pick(random, REVIEW_TEXT[5])}`,
      hashtags: [key, prof.city.toLowerCase().replace(/[^a-z]/g, ""), "beforeandafter", "localbusiness"],
      approvedAt: ctx.day(-12, 15),
      approvedById: ctx.owner.user.id,
      createdAt: ctx.day(-13, 11),
    });
  }

  const reviewer = ctx.clients[3];
  await ctx.ensure(
    "testimonial",
    { companyId, externalId: `demo:testimonial:1` },
    {
      companyId,
      authorName: reviewer?.name || "A client",
      authorTitle: "Homeowner",
      companyLabel: prof.city,
      quote: pick(random, REVIEW_TEXT[5]),
      approved: true,
      featured: true,
      sortOrder: 1,
      source: "manual",
      externalId: `demo:testimonial:1`,
      createdAt: ctx.day(-70, 12),
    },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. Crew chat: #general and the live job's room, through the store
// ═══════════════════════════════════════════════════════════════════════════

async function seedChat(ctx) {
  const { companyId, db } = ctx;
  const rooms = await ensureCompanyRooms(companyId, { client: db });
  if (!rooms.general) return;
  const already = await db.companyChatMessage.count({ where: { companyId, roomId: rooms.general.id || rooms.general } });
  if (already > 0) {
    ctx.counts.existing.companyChatMessage = already;
    return;
  }
  const generalId = rooms.general.id || rooms.general;
  const live = ctx.jobs.find((j) => j.story.job === "inProgress");
  const jobRoom = live ? rooms.jobs.find((r) => r.jobId === live.row.id) : null;
  const asMember = (p) => ({ id: p.member.id, userId: p.user.id, companyId, role: p.role, permissions: p.member.permissions });
  const quiet = { client: db, notify: async () => {} };

  const lines = [
    [generalId, ctx.owner, `Morning all — ${ctx.crew[0]?.firstName || "crew"} is off next week, ${ctx.dispatcher?.firstName || "dispatch"} has the schedule.`, ctx.day(-1, 7, 40)],
    [generalId, ctx.dispatcher, `Van is due for service — booking it for the ${ctx.day(75).getDate()}th. Shout if that clashes with anything.`, ctx.day(-1, 8, 5)],
    [generalId, ctx.crew[1], "Can someone grab another box of gloves from the shop? We're out.", ctx.day(0, 7, 55)],
    [jobRoom?.roomId, ctx.crew[0], `On site at ${live?.client.address || "the job"}. Client is home, starting now.`, ctx.week(0, 1, 8, 12)],
    [jobRoom?.roomId, ctx.crew[0], "Client wants an extra — raised a change order, can you approve?", ctx.week(0, 1, 15, 2)],
    [jobRoom?.roomId, ctx.owner, "Approved. Add it to day two.", ctx.week(0, 1, 16, 10)],
  ];
  for (const [roomId, author, body, at] of lines) {
    if (!roomId || !author) continue;
    const res = await postMessage({ member: asMember(author), roomId, body }, quiet);
    if (res?.ok === false || !res?.message) continue;
    await db.companyChatMessage.update({ where: { id: res.message.id }, data: { createdAt: at } });
    ctx.counts.created.companyChatMessage = (ctx.counts.created.companyChatMessage || 0) + 1;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. The receptionist's call log
// ═══════════════════════════════════════════════════════════════════════════

async function seedCallLog(ctx) {
  const { companyId, preset } = ctx;
  const calls = [
    { client: 2, days: 6, sec: 143, disposition: "answered", summary: `Asked about ${preset.jobs[0].toLowerCase()} — took the address and said someone would follow up with a quote.` },
    { client: 9, days: 3, sec: 96, disposition: "answered", summary: "Wanted to know if photos could be emailed in instead of a site visit — pointed them to the address on file." },
    { client: 14, days: 1, sec: 58, disposition: "answered", summary: "Confirmed the upcoming visit time and asked for a reminder call the morning of." },
    { client: 19, days: 1, sec: 212, disposition: "answered", summary: "Existing client — asked whether the warranty covers a second visit. Flagged for the office to call back.", needsReview: true },
    { client: null, days: 0, sec: 21, disposition: "voicemail", summary: "Caller hung up before leaving details.", needsReview: true },
  ];
  let n = 0;
  for (const c of calls) {
    n += 1;
    const client = c.client == null ? null : ctx.clients[c.client];
    const startedAt = ctx.day(-c.days, 9 + n);
    await ctx.ensure(
      "voiceCall",
      { providerCallId: `demo-seed-${companyId}-${n}` },
      {
        companyId,
        providerCallId: `demo-seed-${companyId}-${n}`,
        direction: "inbound",
        fromE164: client?.phone ? `+1${String(client.phone).replace(/\D/g, "").slice(-10)}` : null,
        startedAt,
        endedAt: new Date(startedAt.getTime() + c.sec * 1000),
        durationSec: c.sec,
        disposition: c.disposition,
        summary: c.summary,
        clientId: client?.id || null,
        needsReview: Boolean(c.needsReview),
        createdAt: startedAt,
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. The activity trail, in the shape lib/activity/log.js writes
// ═══════════════════════════════════════════════════════════════════════════

async function seedActivity(ctx) {
  const { companyId, db } = ctx;
  const already = await db.activityLog.count({ where: { companyId } });
  if (already >= 20) {
    ctx.counts.existing.activityLog = already;
    return;
  }
  const actor = (p) => ({ actorUserId: p.user.id, actorMemberId: p.member.id, actorName: p.name, actorRole: p.role });
  const rows = [];
  for (const q of ctx.quotes) {
    const who = ctx.estimator || ctx.owner;
    if (q.row.sentAt) rows.push({ ...actor(who), action: "quote.sent", entityType: "quote", entityId: q.row.id, summary: `Sent quote ${q.row.quoteNumber} to ${q.client.name}`, createdAt: q.row.sentAt });
    if (q.row.acceptedAt) rows.push({ actorName: q.client.name, action: "quote.accepted", entityType: "quote", entityId: q.row.id, summary: `${q.client.name} approved quote ${q.row.quoteNumber}`, createdAt: q.row.acceptedAt });
    if (q.row.declinedAt) rows.push({ actorName: q.client.name, action: "quote.declined", entityType: "quote", entityId: q.row.id, summary: `${q.client.name} declined quote ${q.row.quoteNumber}${q.story.declineReason ? ` — ${q.story.declineReason}` : ""}`, createdAt: q.row.declinedAt });
  }
  for (const j of ctx.jobs) {
    if (j.row.completedAt) rows.push({ ...actor(ctx.crew[0] || ctx.owner), action: "job.completed", entityType: "job", entityId: j.row.id, summary: `Completed ${j.title} for ${j.client.name}`, createdAt: j.row.completedAt });
  }
  for (const i of ctx.invoices) {
    rows.push({ ...actor(ctx.owner), action: "invoice.sent", entityType: "invoice", entityId: i.row.id, summary: `Sent invoice ${i.row.invoiceNumber} to ${i.client.name}`, createdAt: i.row.sentAt || i.row.createdAt });
    if (["card", "bank", "etransfer", "deposit"].includes(i.story.pay)) {
      rows.push({ actorName: i.client.name, action: "invoice.paid", entityType: "invoice", entityId: i.row.id, summary: `${i.client.name} paid invoice ${i.row.invoiceNumber}`, createdAt: new Date((i.row.sentAt || i.row.createdAt).getTime() + 3 * DAY) });
    }
    if (i.story.pay === "overdue") {
      rows.push({ ...actor(ctx.owner), action: "invoice.chased", entityType: "invoice", entityId: i.row.id, summary: `Reminder sent for ${i.row.invoiceNumber} — ${i.client.name}`, createdAt: ctx.day(-9, 9) });
    }
  }
  rows.push({ ...actor(ctx.owner), action: "settings.updated", entityType: "settings", entityId: null, summary: "Updated business hours", createdAt: ctx.day(-45, 18) });
  rows.push({ ...actor(ctx.dispatcher || ctx.owner), action: "payroll.approved", entityType: "payroll", entityId: null, summary: "Approved last period's timesheets", createdAt: ctx.day(-4, 17) });
  for (const r of rows) {
    await ctx.create("activityLog", { companyId, ...r });
  }
}
