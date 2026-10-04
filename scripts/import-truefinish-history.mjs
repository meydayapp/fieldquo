// scripts/import-truefinish-history.mjs
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/import-truefinish-history.mjs \
//     --source-env ../truefinish-cabinets/.env --company <fieldquo company id> [--include-open]
//     [--keep-truefinish-numbers] [--only Q2026-0033,Q2026-0045]  [--apply]
//
// The owner, 2026-10-03: "import all the quotes that were approved from
// truefinish cabinets back end into my truefinish cabinets [company] … and the
// invoices and the jobs. we don't need to email them because they are old
// jobs.. i just want them to be entered.. so i can have record of it."
//
// TrueFinish Cabinets ran its own back office (github: truefinish-cabinets —
// Quote, Invoice, Payment, Client; no Job model: the invoice's start/end
// dates ARE the job). Each ACCEPTED TrueFinish quote becomes, in FieldQuo, the
// same four rows a past job typed in by hand becomes — Client (when new),
// Quote (accepted), Job (completed), Invoice (+ Payments) — written by THE
// SAME function the Past jobs screen uses, createPastJob in
// lib/jobs/importPastJob.js, so the records are indistinguishable from a past
// job entered by hand: historicalImportedAt stamped on all three, createdVia
// "import", no sentAt, nothing sent.
//
// What differs from typing it in is only where the figures come from: the
// `recorded` payload (lib/jobs/pastJobImport.js, "Recorded figures"). The
// quote's lines and totals are the ones the homeowner accepted; the invoice's
// are the ones they were billed; tax is the tax TrueFinish charged; every
// deposit and instalment is its own Payment. Nothing is re-priced and nothing
// is re-taxed — a line's price is TrueFinish's stored `total`, and only a line
// with no stored total would be computed, with TrueFinish's OWN rule
// (truefinish-cabinets/app/admin/lib/lineItemTotal.js), and flagged.
//
// ── Safety ─────────────────────────────────────────────────────────────────
//
//   * Dry by default. A dry run reads both databases inside
//     BEGIN TRANSACTION READ ONLY … ROLLBACK, and removes DATABASE_URL from
//     the environment before loading any product code, so the Prisma client
//     the product modules construct has nowhere to connect to: a dry run
//     CANNOT write, not merely does not.
//   * --apply additionally requires --company <id>, the exact FieldQuo company
//     to write into; the script prints its name before writing.
//   * The TrueFinish database is only ever read, in a read-only transaction.
//     Its URL is read from the file given to --source-env and never printed.
//   * Idempotent. Each job carries "[truefinish:quote:<id>]" on its internal
//     cost-review note, and createPastJob skips a source already on file under
//     the same advisory lock it takes for every past job. Re-running after a
//     failure at job 9 writes jobs 9–14 and skips 1–8.
//   * Creates only. createPastJob never updates or deletes an existing row;
//     the one update it issues is the ledger refresh of the invoice it has
//     just created.
//   * Sends nothing. No mailer, SMS or task module is imported by this script
//     or by createPastJob (scripts/check-past-jobs-import.mjs pins the
//     latter), and every cron and send route skips historicalImportedAt rows.
//
// ── What is held back, and why ────────────────────────────────────────────
//
//   paid                  imported
//   open, job in the past imported only with --include-open: an invoice
//                         TrueFinish still shows a balance on lands with that
//                         balance outstanding in FieldQuo's receivables — true
//                         if it is owed, wrong if it was paid and never
//                         recorded. The owner's call, so it is opt-in.
//   open, no job dates    held: not a past job anyone can date
//   job not started yet   held: a future job is live work, not history — it
//                         belongs in the live pipeline, where it can be
//                         scheduled and invoiced normally

import fs from "node:fs";
import pg from "pg";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return null;
  const a = argv[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[i + 1] ?? null;
};

const APPLY = flag("apply");
const INCLUDE_OPEN = flag("include-open");
const KEEP_NUMBERS = flag("keep-truefinish-numbers");
const COMPANY_ID = opt("company");
const SOURCE_ENV = opt("source-env");
const ONLY = (opt("only") || "").split(",").map((s) => s.trim()).filter(Boolean);
const TODAY = new Date();

function die(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!COMPANY_ID) die("--company <FieldQuo company id> is required — the exact company to compare against (and, with --apply, to write into).");
if (!SOURCE_ENV) die("--source-env <path to the TrueFinish .env> is required.");

// ── Connection strings — read, never printed ──────────────────────────────
function urlFromEnvFile(path) {
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch {
    die(`Cannot read ${path}.`);
  }
  const m = text.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?\s*$/m);
  if (!m) die(`${path} has no DATABASE_URL line.`);
  return m[1].trim();
}
const SOURCE_URL = urlFromEnvFile(SOURCE_ENV);
const TARGET_URL = process.env.DATABASE_URL || null;
if (!TARGET_URL) die("DATABASE_URL (FieldQuo) is not set — run with node --env-file=.env.");
if (SOURCE_URL === TARGET_URL) die("The TrueFinish and FieldQuo connection strings are the same database. Refusing.");

// A dry run must not be ABLE to write. The product modules below construct a
// Prisma client at import time (lib/db.js) from DATABASE_URL; with it gone,
// any query that slipped in would fail to connect instead of landing.
if (!APPLY) delete process.env.DATABASE_URL;

const { normalisePastJob, recordedFiguresProblems, isoDay, PAST_JOB_PAYMENT_METHODS } = await import("@/lib/jobs/pastJobImport");
const { nextHistoricalQuoteNumber, looksLikeLiveQuoteNumber } = await import("@/lib/quotes/quoteNumber");
const { nextHistoricalInvoiceNumber, looksLikeLiveInvoiceNumber } = await import("@/lib/invoices/invoiceNumber");
const { matchContactAgainst } = await import("@/lib/contacts/matchContact");
const { computeInvoiceState } = await import("@/lib/invoices/computeInvoiceState");
const { round2 } = await import("@/lib/quotes/totals");

// ── Read-only access ───────────────────────────────────────────────────────
//
// Neon scales to zero (AGENTS.md): the first connection after idle can fail
// with a connect error. One retry, then believe it.
async function readOnly(url, fn) {
  let client;
  for (let attempt = 0; attempt < 2; attempt++) {
    client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      break;
    } catch (err) {
      await client.end().catch(() => {});
      if (attempt === 1) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    return await fn((sql, params = []) => client.query(sql, params).then((r) => r.rows));
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

// ── TrueFinish, as stored ──────────────────────────────────────────────────
async function readTrueFinish() {
  return readOnly(SOURCE_URL, async (q) => {
    const quotes = await q(
      `select id, "quoteNumber", status::text as status, "clientId", "lineItems", subtotal::text, discount::text, tax::text,
              total::text, "taxEnabled", notes, language, "quoteType", "createdAt", "sentAt"
         from "Quote" where status = 'accepted' order by "createdAt", "quoteNumber"`,
    );
    const quoteIds = quotes.map((r) => r.id);
    const invoices = await q(
      `select id, "invoiceNumber", status::text as status, "clientId", "quoteId", "lineItems", subtotal::text, discount::text,
              tax::text, total::text, "amountPaid"::text, "amountDue"::text, "taxEnabled", notes, "dueDate", "startDate",
              "endDate", "paidDate", "createdAt", version, "parentInvoiceId", language
         from "Invoice" where "quoteId" = any($1) order by "createdAt"`,
      [quoteIds],
    );
    const strays = await q(
      `select i."invoiceNumber", coalesce(q.status::text, 'no quote') as "quoteStatus"
         from "Invoice" i left join "Quote" q on q.id = i."quoteId"
        where i."quoteId" is null or q.status <> 'accepted'`,
    );
    const payments = await q(
      `select id, "invoiceId", amount::text, method::text as method, notes, date, "createdAt"
         from "Payment" where "invoiceId" = any($1) order by date, "createdAt"`,
      [invoices.map((r) => r.id)],
    );
    const clients = await q(
      `select id, name, email, phone, address, city, province, "createdAt" from "Client" where id = any($1)`,
      [[...new Set(quotes.map((r) => r.clientId))]],
    );
    return { quotes, invoices, strays, payments, clients };
  });
}

// ── FieldQuo, the target company ──────────────────────────────────────────
const TARGET_SQL = {
  company: `select id, name, "defaultLanguage", province, country from "Company" where id = $1`,
  clients: `select id, "companyId", name, email, phone, address, city, province, country, language, "createdAt"
              from "Client" where "companyId" = $1`,
  quoteNumbers: `select "quoteNumber" from "Quote" where "companyId" = $1`,
  invoiceNumbers: `select "invoiceNumber" from "Invoice" where "companyId" = $1`,
  markers: `select id, "costReviewNote" from "Job" where "companyId" = $1 and "historicalImportedAt" is not null`,
  categories: `select id, key, label from "ServiceCategory" where "isSystem" or "companyId" = $1`,
};
async function readFieldQuoReadOnly() {
  return readOnly(TARGET_URL, async (q) => {
    const out = {};
    for (const [k, sql] of Object.entries(TARGET_SQL)) out[k] = await q(sql, [COMPANY_ID]);
    out.company = out.company[0] || null;
    return out;
  });
}
async function readFieldQuoPrisma(db) {
  const [company, clients, quoteNumbers, invoiceNumbers, markers, categories] = await Promise.all([
    db.company.findUnique({ where: { id: COMPANY_ID }, select: { id: true, name: true, defaultLanguage: true, province: true, country: true } }),
    db.client.findMany({
      where: { companyId: COMPANY_ID },
      select: { id: true, companyId: true, name: true, email: true, phone: true, address: true, city: true, province: true, country: true, language: true, createdAt: true },
    }),
    db.quote.findMany({ where: { companyId: COMPANY_ID }, select: { quoteNumber: true } }),
    db.invoice.findMany({ where: { companyId: COMPANY_ID }, select: { invoiceNumber: true } }),
    db.job.findMany({ where: { companyId: COMPANY_ID, historicalImportedAt: { not: null } }, select: { id: true, costReviewNote: true } }),
    db.serviceCategory.findMany({ where: { OR: [{ isSystem: true }, { companyId: COMPANY_ID }] }, select: { id: true, key: true, label: true } }),
  ]);
  return { company, clients, quoteNumbers, invoiceNumbers, markers, categories };
}

// ── Mapping ────────────────────────────────────────────────────────────────

// TrueFinish stored job and payment dates as Toronto midnights (04:00Z /
// 05:00Z) and paidDate as the moment "mark paid" was pressed. FieldQuo's past
// jobs speak UTC calendar days (lib/jobs/pastJobImport.js isoDay), so every
// TrueFinish timestamp is read as the Toronto day it was — 2026-04-25T03:39Z
// is the evening of 24 April, the day the last payment came in.
const TORONTO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" });
const tfDay = (v) => (v ? TORONTO_DAY.format(new Date(v)) : null);
const dayDate = (s) => (s ? new Date(`${s}T00:00:00.000Z`) : null);

// TrueFinish quoteType → FieldQuo ServiceCategory key. "hybrid" is a refacing
// + refinishing kitchen; FieldQuo's past-job write takes ONE category, and the
// refinishing share is the larger on the one hybrid on file — flagged in the
// plan as an owner's call. A null quoteType predates the field; every one on
// file is the "Essential Cabinet Refinishing" package (serviceId "essential").
const CATEGORY_BY_TYPE = {
  refinishing: "cabinet_refinishing",
  refacing: "cabinet_refacing",
  hybrid: "cabinet_refinishing",
  countertop: "countertop",
  stairs: "stairs",
  flooring: "flooring",
  kitchen: "kitchen_design",
};
function categoryKeyFor(quote) {
  if (quote.quoteType) return { key: CATEGORY_BY_TYPE[quote.quoteType] || null, inferred: quote.quoteType === "hybrid" };
  const lines = Array.isArray(quote.lineItems) ? quote.lineItems : [];
  if (lines.some((l) => l?.serviceId === "essential" || /cabinet refinishing/i.test(l?.name || l?.title || ""))) {
    return { key: "cabinet_refinishing", inferred: true };
  }
  return { key: null, inferred: false };
}

const clean = (v) => (typeof v === "string" ? v.trim() : "") || null;

// TrueFinish's own line rule, used ONLY for a line with no stored total —
// app/admin/lib/lineItemTotal.js: an included item (or a legacy material with
// no flag, which meant included) is $0; otherwise quantity × unit price.
function tfComputedLineTotal(l) {
  if (l?.included === true || (l?.category === "material" && l?.included === undefined)) return 0;
  const t = (Number(l?.quantity) || 0) * (Number(l?.unitPrice) || 0);
  return Number.isFinite(t) ? t : 0;
}

const LINE_TITLE_BY_CATEGORY = { "scope-group": "Cabinet work", "measured-extra": "Extra", "stair-section": "Stairs", "floor-section": "Flooring" };

/**
 * One TrueFinish line → one FieldQuo line: { description, detail, quantity,
 * rate, amount, unit }. `amount` is TrueFinish's stored `total` — the price
 * the client saw. `rate` is amount ÷ quantity, so quantity × rate = amount
 * holds on the FieldQuo side even for TrueFinish's "included" materials,
 * which carry a unit price of $150 and a total of $0.
 */
function mapLine(l, computedFlags) {
  const stored = l?.total !== undefined && l?.total !== null && Number.isFinite(Number(l.total));
  const amount = round2(stored ? Number(l.total) : tfComputedLineTotal(l));
  if (!stored) computedFlags.push(clean(l?.name) || clean(l?.title) || "line");
  const quantity = Number(l?.quantity) > 0 ? Number(l.quantity) : 1;
  const parts = [];
  if (l?.category === "scope-group") {
    // What TrueFinish's PDF printed under a scope card (generateQuotePDF.js
    // renderScopeGroupCard): doors, drawers, colour, sheen.
    const meta = [
      Number.isFinite(Number(l.doorsCount)) && l.doorsCount !== undefined ? `Doors: ${l.doorsCount}` : null,
      Number.isFinite(Number(l.drawerCount)) && l.drawerCount !== undefined ? `Drawers: ${l.drawerCount}` : null,
      clean(l.style) ? `Style: ${clean(l.style)}` : null,
      clean(l.color) ? `Color: ${clean(l.color)}` : null,
      clean(l.sheen) ? `Sheen: ${clean(l.sheen)}` : null,
    ].filter(Boolean);
    if (meta.length) parts.push(meta.join(" · "));
  }
  if (clean(l?.description)) parts.push(clean(l.description));
  if (clean(l?.notes)) parts.push(clean(l.notes));
  return {
    description: clean(l?.name) || clean(l?.title) || LINE_TITLE_BY_CATEGORY[l?.category] || "Item",
    ...(parts.length ? { detail: parts.join("\n\n") } : {}),
    quantity,
    rate: round2(amount / quantity),
    amount,
    ...(clean(l?.unit) ? { unit: clean(l.unit) } : {}),
  };
}

function docFigures(doc, computedFlags) {
  return {
    lineItems: (Array.isArray(doc.lineItems) ? doc.lineItems : []).map((l) => mapLine(l, computedFlags)),
    subtotal: round2(Number(doc.subtotal)),
    discount: round2(Number(doc.discount)),
    tax: round2(Number(doc.tax)),
    total: round2(Number(doc.total)),
    taxEnabled: Boolean(doc.taxEnabled),
    notes: clean(doc.notes),
  };
}

const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * Who this TrueFinish client is in FieldQuo. Never creates anything — it
 * decides, and createPastJob does the writing.
 *   batch      created earlier in this same run (Ayse Akgun has three jobs)
 *   existing   the shared matcher (lib/contacts/matchContact.js), at its
 *              default "likely" floor, with the NAME required to agree —
 *              the past-jobs importer's own rule (findMatchingClient). Not
 *              optional here: TrueFinish's Paul Machaka carries the same
 *              phone number as two of FieldQuo's test clients ("Emilio",
 *              "Daniel Boves"); a phone-only match is "certain" to the
 *              matcher and would have filed his job under a test client the
 *              moment one of the two was deleted and the tie went away.
 *   name_only  no likely match, but createPastJob's own name-first lookup
 *              WOULD reuse a same-named client — reported, because a past
 *              job typed in by hand behaves exactly this way
 *   new        createPastJob creates the client
 */
function resolveClient(tfClient, fqClients, createdInRun) {
  if (createdInRun.has(tfClient.id)) return { kind: "batch", clientId: createdInRun.get(tfClient.id) };
  const contact = { name: tfClient.name, email: tfClient.email, phone: tfClient.phone, address: tfClient.address };
  const m = matchContactAgainst({ clients: fqClients, companyId: COMPANY_ID, contact, requireNameAgreement: true });
  if (m.client) return { kind: "existing", clientId: m.client.id, name: m.client.name, why: m.why };
  const named = fqClients.filter((c) => sameName(c.name, tfClient.name));
  if (named.length) return { kind: "name_only", clientId: null, name: named[0].name, why: "same name, no email/phone/address agreement" };
  // Reported, never acted on: someone on file shares a phone or email with a
  // DIFFERENT name.
  const loose = matchContactAgainst({ clients: fqClients, companyId: COMPANY_ID, contact, minConfidence: "possible", onTie: "oldest" });
  const alsoSeen = loose.bestId ? fqClients.filter((c) => [loose.bestId, ...(loose.tiedIds || [])].includes(c.id)).map((c) => c.name.trim()) : [];
  return {
    kind: "new",
    clientId: null,
    ...(alsoSeen.length ? { warning: `shares ${loose.reasons.join(" + ")} with FieldQuo client(s) ${[...new Set(alsoSeen)].join(", ")} — different name, not matched` } : {}),
  };
}

/** Everything the run would do, decided from the two snapshots. Pure. */
function buildPlan(tf, fq) {
  const clientsById = new Map(tf.clients.map((c) => [c.id, c]));
  const categoriesByKey = new Map(fq.categories.map((c) => [c.key, c]));
  const markers = fq.markers.map((m) => m.costReviewNote || "").join("\n");
  const takenQuotes = new Set(fq.quoteNumbers.map((r) => r.quoteNumber));
  const takenInvoices = new Set(fq.invoiceNumbers.map((r) => r.invoiceNumber));
  const createdInRun = new Map();
  const todayDay = isoDay(TODAY);

  const items = [];
  for (const quote of tf.quotes) {
    if (ONLY.length && !ONLY.includes(quote.quoteNumber)) continue;
    const item = { quote, problems: [], notes: [] };
    items.push(item);
    const client = clientsById.get(quote.clientId);
    item.tfClient = client;
    const invoices = tf.invoices.filter((i) => i.quoteId === quote.id);
    if (invoices.length !== 1) {
      item.decision = "hold";
      item.reason = invoices.length ? `quote has ${invoices.length} invoices` : "quote was never invoiced";
      continue;
    }
    const invoice = invoices[0];
    item.invoice = invoice;
    const payments = tf.payments.filter((p) => p.invoiceId === invoice.id);
    item.payments = payments;
    item.paidSum = round2(payments.reduce((s, p) => s + Number(p.amount), 0));

    const startDay = tfDay(invoice.startDate);
    const endDay = tfDay(invoice.endDate) || startDay;
    const paid = invoice.status === "paid";
    item.sourceRef = `truefinish:quote:${quote.id}`;

    // Classify.
    if (markers.includes(`[${item.sourceRef}]`)) {
      item.decision = "skip";
      item.reason = "already imported (source marker on file)";
      continue;
    }
    if (!startDay) {
      item.decision = "hold";
      item.reason = "invoice has no job dates";
      continue;
    }
    if (startDay > todayDay) {
      item.decision = "hold";
      item.reason = `job starts ${startDay} — not a past job`;
      continue;
    }
    if (!paid && !INCLUDE_OPEN) {
      item.decision = "hold";
      item.reason = `open at TrueFinish: $${round2(Number(invoice.total) - item.paidSum).toFixed(2)} outstanding (use --include-open)`;
      continue;
    }

    // Figures, as stored.
    const computed = [];
    const qFig = docFigures(quote, computed);
    const iFig = docFigures(invoice, computed);
    if (computed.length) item.notes.push(`line total computed with TrueFinish's rule (none stored): ${computed.join(", ")}`);
    const firstPaymentDay = payments.length ? tfDay(payments[0].date) : null;
    const invoiceDay = tfDay(invoice.createdAt);
    // TrueFinish never stamped acceptance (approvedAt/acceptedAt are null on
    // every row). The earliest evidence of it is the invoice being raised
    // from the quote, or a deposit arriving — whichever came first.
    const acceptedDay = [invoiceDay, firstPaymentDay].filter(Boolean).sort()[0];
    const paidDay = paid ? tfDay(invoice.paidDate) || (payments.length ? tfDay(payments[payments.length - 1].date) : null) : null;

    const recorded = {
      sourceRef: item.sourceRef,
      sourceLabel: `TrueFinish ${quote.quoteNumber} / ${invoice.invoiceNumber}`,
      acceptedAt: dayDate(acceptedDay),
      quote: { lineItems: qFig.lineItems, subtotal: qFig.subtotal, discount: qFig.discount, tax: qFig.tax, total: qFig.total, taxEnabled: qFig.taxEnabled, notes: qFig.notes },
      invoice: {
        lineItems: iFig.lineItems, subtotal: iFig.subtotal, discount: iFig.discount, tax: iFig.tax, total: iFig.total,
        taxEnabled: iFig.taxEnabled, notes: iFig.notes, dueDate: dayDate(tfDay(invoice.dueDate)),
      },
      payments: payments.map((p) => ({
        amount: round2(Number(p.amount)),
        method: p.method,
        date: dayDate(tfDay(p.date)),
        notes: clean(p.notes),
        sourceRef: `truefinish:payment:${p.id}`,
      })),
    };
    item.recorded = recorded;
    for (const p of recordedFiguresProblems(recorded, { today: TODAY })) item.problems.push(`${p.field}: ${p.code}`);

    // The client.
    const resolved = resolveClient(client, fq.clients, createdInRun);
    item.client = resolved;
    if (resolved.warning) item.notes.push(resolved.warning);

    // The category.
    const cat = categoryKeyFor(quote);
    item.category = cat.key ? categoriesByKey.get(cat.key) || null : null;
    if (cat.key && !item.category) item.problems.push(`service category "${cat.key}" not found`);
    if (cat.inferred) item.notes.push(quote.quoteType === "hybrid" ? `hybrid (refacing + refinishing) filed as ${cat.key}` : `no quoteType at TrueFinish; filed as ${cat.key} from its lines`);

    // The row createPastJob takes — through the same normaliser the screen
    // and the CSV use, so every refusal they make is made here too.
    const lastPayment = payments[payments.length - 1] || null;
    const address = clean(client.address) || [clean(client.city), clean(client.province)].filter(Boolean).join(", ") || "";
    const raw = {
      clientId: resolved.clientId || "",
      clientName: client.name,
      clientEmail: client.email || "",
      clientPhone: client.phone || "",
      clientAddress: address,
      description: recorded.quote.lineItems[0]?.description || `TrueFinish ${quote.quoteNumber}`,
      startDate: startDay,
      endDate: endDay,
      // The invoice TOTAL, not the pre-tax amount the screen asks for: in a
      // recorded job nothing is derived from it, and it is what the
      // natural-key duplicate check compares against (Invoice.total).
      amount: String(iFig.total),
      taxApplied: iFig.taxEnabled ? "yes" : "no",
      paidDate: paidDay || "",
      paymentMethod: lastPayment?.method || "",
      quoteNumber: KEEP_NUMBERS ? quote.quoteNumber : "",
      invoiceNumber: KEEP_NUMBERS ? invoice.invoiceNumber : "",
    };
    const n = normalisePastJob(raw, { today: TODAY, defaultTaxApplied: true });
    // An open invoice has no paid date and may have no payment at all; those
    // two refusals are the screen's ("a past job is paid") and are exactly
    // what --include-open opts out of. Every other refusal stands.
    const errors = n.errors.filter(
      (e) => paid || !((e.field === "paidDate" && e.code === "required") || (e.field === "paymentMethod" && e.code === "required")),
    );
    for (const e of errors) item.problems.push(`${e.field}: ${e.code}`);
    item.row = { ...n.value, paidDate: paid ? n.value.paidDate : null, paymentMethod: lastPayment?.method || null };
    if (!PAST_JOB_PAYMENT_METHODS.includes(item.row.paymentMethod) && item.row.paymentMethod) item.problems.push(`unknown payment method ${item.row.paymentMethod}`);

    // What the ledger will say — the same pure function createPastJob's
    // refreshFamilyLedger runs, so a disagreement shows here, not mid-write.
    const state = computeInvoiceState({ total: iFig.total, payments: recorded.payments, priorStatus: "sent" });
    item.ledger = state;
    if (state.isPaid !== paid) item.problems.push(`TrueFinish says ${invoice.status} but its payments sum to ${item.paidSum} of ${iFig.total}`);
    const over = round2(item.paidSum - iFig.total);
    if (over > 0.005) item.notes.push(`payments exceed the invoice by $${over.toFixed(2)} (recorded as-is)`);
    if (Math.abs(qFig.total - iFig.total) > 0.005) item.notes.push(`invoice differs from the accepted quote: quote $${qFig.total.toFixed(2)} → invoice $${iFig.total.toFixed(2)}`);
    if (qFig.taxEnabled && !iFig.taxEnabled) item.notes.push("tax was on the quote and off the invoice (as TrueFinish stored it)");

    // Numbers.
    const year = Number(startDay.slice(0, 4));
    if (KEEP_NUMBERS) {
      if (takenQuotes.has(quote.quoteNumber)) item.problems.push(`quote number ${quote.quoteNumber} already in use`);
      if (takenInvoices.has(invoice.invoiceNumber)) item.problems.push(`invoice number ${invoice.invoiceNumber} already in use`);
      if (looksLikeLiveQuoteNumber(quote.quoteNumber) || looksLikeLiveInvoiceNumber(invoice.invoiceNumber)) item.problems.push("TrueFinish number is in FieldQuo's live format");
      item.quoteNumber = quote.quoteNumber;
      item.invoiceNumber = invoice.invoiceNumber;
    } else {
      item.quoteNumber = nextHistoricalQuoteNumber([...takenQuotes], year);
      item.invoiceNumber = nextHistoricalInvoiceNumber([...takenInvoices], year, item.quoteNumber);
    }

    item.decision = item.problems.length ? "error" : "import";
    if (item.decision === "import") {
      takenQuotes.add(item.quoteNumber);
      takenInvoices.add(item.invoiceNumber);
      if (resolved.kind === "new" || resolved.kind === "name_only") createdInRun.set(client.id, resolved.clientId || `(new: ${client.name})`);
    }
  }
  return items;
}

// ── Printing ───────────────────────────────────────────────────────────────
const money = (n) => `$${Number(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pad = (s, n) => String(s ?? "").slice(0, n).padEnd(n);

function printPlan(items, fq) {
  console.log(`\nFieldQuo company: ${fq.company?.name ?? "(not found)"} (${COMPANY_ID})`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN — nothing is written"}${INCLUDE_OPEN ? ", including open invoices" : ""}${KEEP_NUMBERS ? ", keeping TrueFinish numbers" : ", FieldQuo historical numbers"}\n`);
  console.log(
    `${pad("TrueFinish", 22)} ${pad("client", 24)} ${pad("job", 23)} ${pad("invoice", 11)} ${pad("paid", 11)} ${pad("status", 8)} ${pad("→ FieldQuo", 30)} client`,
  );
  for (const it of items) {
    const inv = it.invoice;
    const tfNum = `${it.quote.quoteNumber}/${inv ? inv.invoiceNumber.replace("INV", "") : "-"}`;
    const job = inv ? `${tfDay(inv.startDate) || "—"}…${(tfDay(inv.endDate) || "").slice(5) || "—"}` : "—";
    const to = it.decision === "import" ? `${it.quoteNumber} / ${it.invoiceNumber}` : `${it.decision.toUpperCase()}: ${it.reason || it.problems.join("; ")}`;
    const who = it.client ? (it.client.kind === "existing" ? `existing (${it.client.name})` : it.client.kind === "name_only" ? `reuses same-named "${it.client.name}"` : it.client.kind) : "";
    console.log(
      `${pad(tfNum, 22)} ${pad(it.tfClient?.name, 24)} ${pad(job, 23)} ${pad(inv ? money(inv.total) : "", 11)} ${pad(inv ? money(it.paidSum) : "", 11)} ${pad(inv?.status, 8)} ${it.decision === "import" ? pad(to, 30) : to} ${it.decision === "import" ? who : ""}`,
    );
    if (it.decision === "import" || it.decision === "error") {
      for (const n of it.notes) console.log(`${" ".repeat(24)}· ${n}`);
      for (const p of it.problems) console.log(`${" ".repeat(24)}✗ ${p}`);
    }
  }

  const imp = items.filter((i) => i.decision === "import");

  // Exactly what each job writes — the rows createPastJob will create, field
  // by field, so the dry run can be checked line by line against TrueFinish.
  console.log("\n── Each job, as it would be written ──");
  const lineOut = (l) =>
    `      ${pad(l.description, 46)} ${String(l.quantity).padStart(4)} × ${money(l.rate).padStart(10)} = ${money(l.amount).padStart(11)}${l.unit ? ` /${l.unit}` : ""}`;
  const totalsOut = (d) =>
    `      subtotal ${money(d.subtotal)}  discount ${money(d.discount)}  tax ${money(d.tax)}${d.taxEnabled ? "" : " (tax off)"}  total ${money(d.total)}${d.notes ? `\n      notes: ${JSON.stringify(d.notes)}` : ""}`;
  for (const it of imp) {
    const r = it.recorded;
    const c = it.row;
    console.log(`\n${it.quoteNumber} / ${it.invoiceNumber}  ←  ${r.sourceLabel}  [${r.sourceRef}]`);
    console.log(
      `  Client (${it.client.kind}${it.client.kind === "existing" ? `: ${it.client.name}` : ""}): ${c.clientName} | ${c.clientEmail || "—"} | ${c.clientPhone || "—"} | ${c.clientAddress || "—"} | language: company default`,
    );
    console.log(`  Quote: accepted ${isoDay(r.acceptedAt)}, service ${it.category?.key || "—"}, historical, never sent`);
    for (const l of r.quote.lineItems) console.log(lineOut(l));
    console.log(totalsOut(r.quote));
    console.log(`  Job: completed, ${isoDay(c.startDate)} → ${isoDay(c.endDate)}`);
    console.log(`  Invoice: due ${r.invoice.dueDate ? isoDay(r.invoice.dueDate) : "—"}, ends ${it.ledger.status} (paid ${money(it.ledger.amountPaid)}, due ${money(it.ledger.amountDue)})${c.paidDate ? `, paid ${isoDay(c.paidDate)}` : ""}`);
    for (const l of r.invoice.lineItems) console.log(lineOut(l));
    console.log(totalsOut(r.invoice));
    for (const p of r.payments) console.log(`  Payment: ${isoDay(p.date)}  ${money(p.amount).padStart(11)}  ${p.method}${p.notes ? `  "${p.notes}"` : ""}`);
  }

  const payments = imp.reduce((s, i) => s + i.recorded.payments.length, 0);
  const byKind = (k) => imp.filter((i) => i.client.kind === k).length;
  const newClients = new Set(imp.filter((i) => i.client.kind === "new").map((i) => i.tfClient.id)).size;
  console.log(`\nWould create, through createPastJob (one transaction per job):`);
  console.log(`  ${imp.length} quotes (accepted), ${imp.length} jobs (completed), ${imp.length} invoices, ${payments} payments`);
  console.log(`  clients: ${newClients} new, ${byKind("existing")} jobs on an existing client, ${byKind("name_only")} on a same-named client, ${byKind("batch")} on a client created earlier in this run`);
  const years = new Map();
  for (const i of imp) {
    const y = tfDay(i.invoice.startDate).slice(0, 4);
    const row = years.get(y) || { jobs: 0, invoiced: 0, paid: 0, tax: 0, outstanding: 0 };
    row.jobs += 1;
    row.invoiced += i.recorded.invoice.total;
    row.tax += i.recorded.invoice.tax;
    row.paid += i.paidSum;
    row.outstanding += i.ledger.amountDue;
    years.set(y, row);
  }
  for (const [y, r] of [...years].sort()) {
    console.log(`  ${y}: ${r.jobs} jobs, invoiced ${money(r.invoiced)} (tax ${money(r.tax)}), payments ${money(r.paid)}, outstanding ${money(r.outstanding)}`);
  }
  const held = items.filter((i) => i.decision === "hold");
  const skipped = items.filter((i) => i.decision === "skip");
  const errored = items.filter((i) => i.decision === "error");
  console.log(`  held back: ${held.length}, already imported: ${skipped.length}, refused: ${errored.length}`);
  return { imp, held, skipped, errored };
}

// ── Run ────────────────────────────────────────────────────────────────────
const tf = await readTrueFinish();
if (tf.strays.length) {
  console.log(`Note: ${tf.strays.length} TrueFinish invoice(s) not attached to an accepted quote are not imported: ${tf.strays.map((s) => `${s.invoiceNumber} (${s.quoteStatus})`).join(", ")}`);
}

if (!APPLY) {
  const fq = await readFieldQuoReadOnly();
  if (!fq.company) die(`No FieldQuo company ${COMPANY_ID}.`);
  const items = buildPlan(tf, fq);
  const { errored } = printPlan(items, fq);
  console.log(`\nDry run: nothing was written. Re-run with --apply --company ${COMPANY_ID} to write${errored.length ? " (refused rows will be skipped)" : ""}.`);
  process.exit(0);
}

// APPLY.
const { db } = await import("@/lib/db");
const { createPastJob, loadPastJobContext } = await import("@/lib/jobs/importPastJob");
const { recordActivity } = await import("@/lib/activity/log");

const fq = await readFieldQuoPrisma(db);
if (!fq.company) die(`No FieldQuo company ${COMPANY_ID}.`);
const items = buildPlan(tf, fq);
const { imp } = printPlan(items, fq);
if (!imp.length) {
  console.log("\nNothing to write.");
  await db.$disconnect();
  process.exit(0);
}
console.log(`\nWriting ${imp.length} past jobs into "${fq.company.name}" (${COMPANY_ID}) …`);

const context = await loadPastJobContext(db, COMPANY_ID);
const now = new Date();
const createdClients = new Map(); // TrueFinish client id → FieldQuo client id
const results = [];
for (const it of imp) {
  const clientId = createdClients.get(it.tfClient.id) || (it.client.kind === "existing" ? it.client.clientId : null);
  const category = it.category ? context.categories.find((c) => c.id === it.category.id) || null : null;
  let outcome;
  try {
    outcome = await createPastJob(db, {
      companyId: COMPANY_ID,
      createdByUserId: null,
      row: { ...it.row, clientId },
      category,
      context,
      now,
      recorded: it.recorded,
    });
  } catch (err) {
    outcome = { status: "error", error: err?.message || "write_failed" };
  }
  if (outcome.status === "created") createdClients.set(it.tfClient.id, outcome.clientId);
  results.push({ it, outcome });
  console.log(
    `  ${it.quote.quoteNumber}: ${outcome.status}${outcome.status === "created" ? ` → ${outcome.quoteNumber} / ${outcome.invoiceNumber} (${outcome.invoiceStatus}, paid ${money(outcome.amountPaid)}, due ${money(outcome.amountDue)})${outcome.clientCreated ? " + new client" : ""}` : ` ${outcome.reason || outcome.error || ""}${outcome.problems ? ` ${JSON.stringify(outcome.problems)}` : ""}`}`,
  );
}

const created = results.filter((r) => r.outcome.status === "created");
if (created.length) {
  // One office-trail line for the batch, as POST /api/jobs/import writes —
  // attributed to the script, not to a person who did not do it.
  await recordActivity(
    { companyId: COMPANY_ID, userId: null, id: null, role: null },
    {
      action: "job.past_imported",
      entityType: "job",
      entityId: created.length === 1 ? created[0].outcome.jobId : null,
      actorName: "TrueFinish migration",
      summary: `Entered ${created.length} past job${created.length === 1 ? "" : "s"} from TrueFinish`,
      metadata: {
        created: created.length,
        skipped: results.filter((r) => r.outcome.status === "skipped").length,
        failed: results.filter((r) => r.outcome.status === "error").length,
        clientsCreated: created.filter((r) => r.outcome.clientCreated).length,
        jobIds: created.map((r) => r.outcome.jobId),
        source: "truefinish",
      },
    },
  );
}
console.log(
  `\nDone: ${created.length} created, ${results.filter((r) => r.outcome.status === "skipped").length} skipped, ${results.filter((r) => r.outcome.status === "error").length} failed.`,
);
await db.$disconnect();
process.exit(results.some((r) => r.outcome.status === "error") ? 1 : 0);
