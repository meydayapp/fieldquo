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
//
// …unless the owner has said otherwise for that quote — OWNER_DECISIONS below,
// which win over the rules above and are printed on every run.


// ── The owner's answers, 2026-10-03 ───────────────────────────────────────
//
// Keyed by TrueFinish quote number. Each is checked against the data before
// it is applied: a decision whose premise no longer holds (the duplicate
// payments are not there, the quote is no longer open) refuses the record
// rather than being applied to something it was not said about.
//
//   lost        the job fell through: a historical DECLINED quote, no job, no
//               invoice, nothing owing (createRecordedQuote kind "lost")
//   live_draft  still to happen: a LIVE draft quote in the company's normal
//               series, for the owner to send again himself (kind "draft")
//   one_payment two identical payments on one day are a typing error: keep
//               the first, record the invoice paid in full
const LOST_REASON = "Lost — recorded from TrueFinish history";
const OWNER_DECISIONS = {
  "Q2026-0082": {
    kind: "one_payment",
    expect: { count: 2, amount: 1000, method: "cash" },
    said: "the two $1,000 cash payments on the same day are a typo — one $1,000 payment",
  },
  "Q2026-0075": { kind: "lost", said: "lost job (Emery Mbonigaba)" },
  // 2026-10-04: the deposit was kept — deposits are non-refundable by policy.
  // On a fresh run the note is written that way; on the quote already
  // imported on 2026-10-04 the one open sentence is amended in place
  // (amendRecordedQuoteNote — that row's internal note, nothing else).
  "Q2026-0012": { kind: "lost", said: "lost job (Paul Machaka)", deposit: "kept" },
  "Q2026-0077": { kind: "lost", said: "lost job (Pierre Paul Racicot)" },
  "Q2026-0150": { kind: "live_draft", said: "re-quote as a live draft to send again (David Paul Kingsbury)" },
  // 2026-10-04: she cancelled the project.
  "Q2026-0086": {
    kind: "lost",
    said: "client cancelled the project (Debbi Driscoll)",
    on: "2026-10-04",
    note: "Client cancelled; invoice $282.50 never paid — written off as lost revenue.",
  },
};

// The deposit sentence of a lost quote's internal note, before and after the
// owner decided. DEPOSIT_UNDECIDED is the exact text the 2026-10-04 apply
// wrote — amendRecordedQuoteNote replaces it and nothing else, and refuses if
// it is no longer there word for word.
const DEPOSIT_UNDECIDED = "Refund or forfeit is the owner's decision.";
const depositKept = (payments) =>
  `${payments.length === 1 ? "The" : "These"} ${payments.map((p) => `${money(p.amount)} deposit received ${tfDay(p.date)}`).join(" and ")} ` +
  `${payments.length === 1 ? "was" : "were"} kept as non-refundable — deposits are non-refundable by policy; not refunded (owner, 2026-10-04).`;

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
const TARGET_URL = process.env.DATABASE_URL || null;
if (!TARGET_URL) die("DATABASE_URL (FieldQuo) is not set — run with node --env-file=.env.");

// A dry run must not be ABLE to write. The product modules below construct a
// Prisma client at import time (lib/db.js) from DATABASE_URL; with it gone,
// any query that slipped in would fail to connect instead of landing.
if (!APPLY) delete process.env.DATABASE_URL;

// Reading TrueFinish read-only, and its documents → FieldQuo lines: shared
// with scripts/import-truefinish-quotes.mjs (scripts/truefinish/source.mjs).
// Loaded after the line above, like every other module.
const { urlFromEnvFile, readOnly, tfDay, dayDate, categoryKeyFor, clean, docFigures, money } = await import("./truefinish/source.mjs");
const SOURCE_URL = urlFromEnvFile(SOURCE_ENV, die);
if (SOURCE_URL === TARGET_URL) die("The TrueFinish and FieldQuo connection strings are the same database. Refusing.");

const { normalisePastJob, recordedFiguresProblems, recordedQuoteProblems, isoDay, PAST_JOB_PAYMENT_METHODS } = await import("@/lib/jobs/pastJobImport");
const { nextHistoricalQuoteNumber, looksLikeLiveQuoteNumber, getNextQuoteNumber, LIVE_QUOTE_NUMBER_WHERE } = await import("@/lib/quotes/quoteNumber");
const { nextHistoricalInvoiceNumber, looksLikeLiveInvoiceNumber } = await import("@/lib/invoices/invoiceNumber");
const { matchContactAgainst } = await import("@/lib/contacts/matchContact");
const { computeInvoiceState } = await import("@/lib/invoices/computeInvoiceState");
const { round2 } = await import("@/lib/quotes/totals");

// ── TrueFinish, as stored ──────────────────────────────────────────────────
async function readTrueFinish() {
  return readOnly(SOURCE_URL, async (q) => {
    const quotes = await q(
      `select id, "quoteNumber", status::text as status, "clientId", "lineItems", subtotal::text, discount::text, tax::text,
              total::text, "taxEnabled", notes, language, "quoteType", "createdAt", "sentAt", "updatedAt"
         from "Quote" where status = 'accepted' order by "createdAt", "quoteNumber"`,
    );
    const quoteIds = quotes.map((r) => r.id);
    const invoices = await q(
      `select id, "invoiceNumber", status::text as status, "clientId", "quoteId", "lineItems", subtotal::text, discount::text,
              tax::text, total::text, "amountPaid"::text, "amountDue"::text, "taxEnabled", notes, "dueDate", "startDate",
              "endDate", "paidDate", "createdAt", "sentAt", version, "parentInvoiceId", language
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
  // Lost quotes and the live draft have no job; their marker is on the quote's
  // internal note (createRecordedQuote).
  quoteMarkers: `select id, "quoteNumber", "reviewNotes", "historicalImportedAt", "createdVia" from "Quote" where "companyId" = $1 and "reviewNotes" like '%[truefinish:%'`,
  // The live series' last number, as nextQuoteNumberForCompany reads it.
  lastLiveQuote: `select "quoteNumber" from "Quote" where "companyId" = $1 and "historicalImportedAt" is null order by "createdAt" desc limit 1`,
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
  const [company, clients, quoteNumbers, invoiceNumbers, markers, categories, quoteMarkers, lastLive] = await Promise.all([
    db.company.findUnique({ where: { id: COMPANY_ID }, select: { id: true, name: true, defaultLanguage: true, province: true, country: true } }),
    db.client.findMany({
      where: { companyId: COMPANY_ID },
      select: { id: true, companyId: true, name: true, email: true, phone: true, address: true, city: true, province: true, country: true, language: true, createdAt: true },
    }),
    db.quote.findMany({ where: { companyId: COMPANY_ID }, select: { quoteNumber: true } }),
    db.invoice.findMany({ where: { companyId: COMPANY_ID }, select: { invoiceNumber: true } }),
    db.job.findMany({ where: { companyId: COMPANY_ID, historicalImportedAt: { not: null } }, select: { id: true, costReviewNote: true } }),
    db.serviceCategory.findMany({ where: { OR: [{ isSystem: true }, { companyId: COMPANY_ID }] }, select: { id: true, key: true, label: true } }),
    db.quote.findMany({
      where: { companyId: COMPANY_ID, reviewNotes: { contains: "[truefinish:" } },
      select: { id: true, quoteNumber: true, reviewNotes: true, historicalImportedAt: true, createdVia: true },
    }),
    db.quote.findFirst({ where: { companyId: COMPANY_ID, ...LIVE_QUOTE_NUMBER_WHERE }, orderBy: { createdAt: "desc" }, select: { quoteNumber: true } }),
  ]);
  return { company, clients, quoteNumbers, invoiceNumbers, markers, categories, quoteMarkers, lastLiveQuote: lastLive ? [lastLive] : [] };
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
  const markers = [...fq.markers.map((m) => m.costReviewNote || ""), ...(fq.quoteMarkers || []).map((m) => m.reviewNotes || "")].join("\n");
  const takenQuotes = new Set(fq.quoteNumbers.map((r) => r.quoteNumber));
  const takenInvoices = new Set(fq.invoiceNumbers.map((r) => r.invoiceNumber));
  const createdInRun = new Map();
  const todayDay = isoDay(TODAY);
  let lastLiveQuote = fq.lastLiveQuote?.[0]?.quoteNumber || null;

  // A quote that carries over WITHOUT a job (owner: lost, or re-send as a
  // draft) — createRecordedQuote's payload, built from the TrueFinish QUOTE
  // (what was offered), never from its invoice.
  function planRecordedQuote(item, decision) {
    const { quote, invoice, payments, tfClient: client } = item;
    const lost = decision.kind === "lost";
    const computed = [];
    const qFig = docFigures(quote, computed);
    if (computed.length) item.notes.push(`line total computed with TrueFinish's rule (none stored): ${computed.join(", ")}`);
    const startDay = tfDay(invoice?.startDate);
    const endDay = tfDay(invoice?.endDate) || startDay;

    // The last day TrueFinish shows the job alive: the latest thing that
    // reached the client or came from them — quote sent, invoice raised or
    // sent, a payment. updatedAt is NOT used: a bulk touch on 2026-08-11 moved
    // it on rows nobody had opened in months. The day it was actually lost is
    // not recorded anywhere; this is the honest lower bound.
    const alive = [tfDay(quote.sentAt), tfDay(quote.createdAt), tfDay(invoice?.createdAt), tfDay(invoice?.sentAt), ...payments.map((p) => tfDay(p.date))]
      .filter(Boolean)
      .sort();
    const lastAlive = alive[alive.length - 1];

    const internal = [];
    if (lost) {
      internal.push(
        `Lost job (owner, ${decision.on || "2026-10-03"}). Accepted at TrueFinish${invoice ? `, invoiced as ${invoice.invoiceNumber} for ${money(invoice.total)}` : ""}` +
          `${startDay ? `, job booked ${startDay} → ${endDay}` : ", no job dates"}. Last seen live ${lastAlive}; the day it was lost is not recorded.`,
      );
      if (decision.note) internal.push(decision.note);
      if (payments.length) {
        const sum = round2(payments.reduce((s, p) => s + Number(p.amount), 0));
        const kept = decision.deposit === "kept";
        internal.push(
          `Money received at TrueFinish: ${payments.map((p) => `${money(p.amount)} ${p.method.replace("_", "-")} on ${tfDay(p.date)}`).join(", ")} (total ${money(sum)}). ` +
            `Not entered as a payment — there is no invoice. ${kept ? depositKept(payments) : DEPOSIT_UNDECIDED}`,
        );
        if (!kept) {
          item.notes.push(`OWNER DECISION NEEDED: ${money(sum)} received at TrueFinish (${payments.map((p) => `${p.method} ${tfDay(p.date)}`).join(", ")}) — recorded in the quote's internal note only; refund or forfeit?`);
        }
      }
    } else {
      internal.push(
        `Carried over from TrueFinish (owner, 2026-10-03), where it was accepted${startDay ? ` and booked for ${startDay} → ${endDay}` : ""}` +
          `${invoice ? `; TrueFinish invoice ${invoice.invoiceNumber} (${money(invoice.total)}, ${invoice.status}) is NOT carried over` : ""}. Send it again when ready.`,
      );
    }

    item.recorded = {
      kind: lost ? "lost" : "draft",
      sourceRef: item.sourceRef,
      sourceLabel: `TrueFinish ${quote.quoteNumber}${invoice ? ` / ${invoice.invoiceNumber}` : ""}`,
      internalNote: internal.join("\n\n"),
      ...(lost ? { declinedAt: dayDate(lastAlive), declineReason: LOST_REASON } : {}),
      quote: { lineItems: qFig.lineItems, subtotal: qFig.subtotal, discount: qFig.discount, tax: qFig.tax, total: qFig.total, taxEnabled: qFig.taxEnabled, notes: qFig.notes },
    };
    for (const p of recordedQuoteProblems(item.recorded, { today: TODAY })) item.problems.push(`${p.field}: ${p.code}`);

    const resolved = resolveClient(client, fq.clients, createdInRun);
    item.client = resolved;
    if (resolved.warning) item.notes.push(resolved.warning);
    const cat = categoryKeyFor(quote);
    item.category = cat.key ? categoriesByKey.get(cat.key) || null : null;
    if (cat.key && !item.category) item.problems.push(`service category "${cat.key}" not found`);
    if (cat.inferred) item.notes.push(`no quoteType at TrueFinish; filed as ${cat.key} from its lines`);

    // Client fields through the same normaliser; only its client refusals
    // apply — a quote with no job has no dates, amount or payment to check.
    const address = clean(client.address) || [clean(client.city), clean(client.province)].filter(Boolean).join(", ") || "";
    const n = normalisePastJob(
      { clientId: resolved.clientId || "", clientName: client.name, clientEmail: client.email || "", clientPhone: client.phone || "", clientAddress: address },
      { today: TODAY, defaultTaxApplied: true },
    );
    for (const e of n.errors.filter((x) => x.field.startsWith("client"))) item.problems.push(`${e.field}: ${e.code}`);
    item.row = {
      clientId: n.value.clientId,
      clientName: n.value.clientName,
      clientEmail: n.value.clientEmail,
      clientPhone: n.value.clientPhone,
      clientAddress: n.value.clientAddress,
      quoteDate: dayDate(tfDay(quote.createdAt)),
    };

    if (lost) {
      item.quoteNumber = nextHistoricalQuoteNumber([...takenQuotes], Number(tfDay(quote.createdAt).slice(0, 4)));
    } else {
      item.quoteNumber = getNextQuoteNumber(lastLiveQuote);
      if (takenQuotes.has(item.quoteNumber)) item.problems.push(`live number ${item.quoteNumber} is already taken — the live allocator would collide`);
    }
    item.decision = item.problems.length ? "error" : lost ? "lost" : "draft";
    if (item.decision !== "error") {
      takenQuotes.add(item.quoteNumber);
      if (!lost) lastLiveQuote = item.quoteNumber;
      if (resolved.kind === "new" || resolved.kind === "name_only") createdInRun.set(client.id, resolved.clientId || `(new: ${client.name})`);
    }
  }

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
    let payments = tf.payments.filter((p) => p.invoiceId === invoice.id);
    item.sourceRef = `truefinish:quote:${quote.id}`;
    const decision = OWNER_DECISIONS[quote.quoteNumber] || null;
    item.ownerDecision = decision;

    // Classify. A marker on file means it landed already, whatever kind.
    if (markers.includes(`[${item.sourceRef}]`)) {
      item.decision = "skip";
      item.reason = "already imported (source marker on file)";
      item.payments = payments;
      item.paidSum = round2(payments.reduce((s, p) => s + Number(p.amount), 0));
      // A decision taken AFTER the import that changes what its note says:
      // amend that one sentence on the row the import made.
      if (decision?.kind === "lost" && decision.deposit === "kept" && payments.length) {
        const row = (fq.quoteMarkers || []).filter((m) => (m.reviewNotes || "").includes(`[${item.sourceRef}]`));
        const to = depositKept(payments);
        const note = row[0]?.reviewNotes || "";
        if (row.length !== 1) {
          item.decision = "error";
          item.problems.push(`deposit decision: ${row.length} quotes carry this marker, expected 1`);
        } else if (row[0].historicalImportedAt == null || row[0].createdVia !== "import") {
          item.decision = "error";
          item.problems.push(`deposit decision: ${row[0].quoteNumber} was not made by this import — not touched`);
        } else if (note.includes(to)) {
          item.reason = "already imported, deposit decision already in its note";
        } else if (note.split(DEPOSIT_UNDECIDED).length !== 2) {
          item.decision = "error";
          item.problems.push(`deposit decision: ${row[0].quoteNumber}'s note no longer says "${DEPOSIT_UNDECIDED}" exactly once — edited since; not touched`);
        } else {
          item.decision = "amend";
          item.amend = { sourceRef: item.sourceRef, from: DEPOSIT_UNDECIDED, to, quoteNumber: row[0].quoteNumber, before: note, after: note.replace(DEPOSIT_UNDECIDED, () => to) };
        }
      }
      continue;
    }

    // The owner's correction to the payments, checked against what it was
    // said about before it is applied.
    if (decision?.kind === "one_payment") {
      const { count, amount, method } = decision.expect;
      const days = new Set(payments.map((p) => tfDay(p.date)));
      const matchesPremise =
        payments.length === count && days.size === 1 && payments.every((p) => Number(p.amount) === amount && p.method === method);
      if (!matchesPremise) {
        item.payments = payments;
        item.paidSum = round2(payments.reduce((s, p) => s + Number(p.amount), 0));
        item.decision = "error";
        item.problems.push(`owner correction "${decision.said}" no longer matches TrueFinish's payments — not applied, record refused`);
        continue;
      }
      const dropped = payments.slice(1);
      payments = payments.slice(0, 1);
      item.notes.push(
        `OWNER CORRECTION (2026-10-03): ${decision.said}. Importing payment ${payments[0].id} only; not importing ${dropped.map((p) => p.id).join(", ")}.`,
      );
    }
    item.payments = payments;
    item.paidSum = round2(payments.reduce((s, p) => s + Number(p.amount), 0));

    if (decision?.kind === "lost" || decision?.kind === "live_draft") {
      if (invoice.status === "paid") {
        item.decision = "error";
        item.problems.push(`owner said "${decision.said}" but TrueFinish shows this invoice paid — refused`);
        continue;
      }
      planRecordedQuote(item, decision);
      continue;
    }

    const startDay = tfDay(invoice.startDate);
    const endDay = tfDay(invoice.endDate) || startDay;
    const paid = invoice.status === "paid";
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
      // The invoice's pre-tax amount, as the screen asks for. In a recorded
      // job nothing is derived from it; it is what the natural-key duplicate
      // check compares against (historicalInvoiceKey: subtotal − discount).
      amount: String(round2(iFig.subtotal - iFig.discount)),
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
const pad = (s, n) => String(s ?? "").slice(0, n).padEnd(n);

const WRITES = new Set(["import", "lost", "draft", "amend"]);

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
    const writes = WRITES.has(it.decision);
    const to =
      it.decision === "import"
        ? `${it.quoteNumber} / ${it.invoiceNumber}`
        : it.decision === "lost"
          ? `${it.quoteNumber} declined (lost)`
          : it.decision === "draft"
            ? `${it.quoteNumber} LIVE draft`
            : it.decision === "amend"
              ? `AMEND note ${it.amend.quoteNumber}`
              : `${it.decision.toUpperCase()}: ${it.reason || it.problems.join("; ")}`;
    const who = it.decision === "amend" ? "(existing row)" : it.client ? (it.client.kind === "existing" ? `existing (${it.client.name})` : it.client.kind === "name_only" ? `reuses same-named "${it.client.name}"` : it.client.kind) : "";
    console.log(
      `${pad(tfNum, 22)} ${pad(it.tfClient?.name, 24)} ${pad(job, 23)} ${pad(inv ? money(inv.total) : "", 11)} ${pad(inv ? money(it.paidSum) : "", 11)} ${pad(inv?.status, 8)} ${writes ? pad(to, 30) : to} ${writes ? who : ""}`,
    );
    if (writes || it.decision === "error") {
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

  // The quotes that carry over without a job (owner's decisions).
  const quotesOnly = items.filter((i) => i.decision === "lost" || i.decision === "draft");
  if (quotesOnly.length) console.log("\n── Quotes carried over without a job, as they would be written ──");
  for (const it of quotesOnly) {
    const r = it.recorded;
    const c = it.row;
    const lost = it.decision === "lost";
    console.log(`\n${it.quoteNumber}  ←  ${r.sourceLabel}  [${r.sourceRef}]  — owner: ${it.ownerDecision.said}`);
    console.log(
      `  Client (${it.client.kind}${it.client.kind === "existing" ? `: ${it.client.name}` : ""}): ${c.clientName} | ${c.clientEmail || "—"} | ${c.clientPhone || "—"} | ${c.clientAddress || "—"} | language: company default`,
    );
    console.log(
      lost
        ? `  Quote: DECLINED ${isoDay(r.declinedAt)}, reason "${r.declineReason}", service ${it.category?.key || "—"}, historical (H series, historicalImportedAt), never sent`
        : `  Quote: DRAFT in the live series, NOT historical, never sent (share token, company wording and e-transfer offer as any new quote), service ${it.category?.key || "—"}`,
    );
    for (const l of r.quote.lineItems) console.log(lineOut(l));
    console.log(totalsOut(r.quote));
    console.log(`  Internal note (Quote.reviewNotes, never shown to the client):`);
    const marker = `${lost ? "Entered as a lost quote" : "Carried over as a draft"} — ${r.sourceLabel} [${r.sourceRef}]`;
    for (const line of `${r.internalNote}\n\n${marker}`.split("\n")) console.log(`      ${line}`);
    console.log(`  No job. No invoice. No payment. Nothing owing.`);
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
  // Notes amended on rows a previous run created (owner decided afterwards).
  const amends = items.filter((i) => i.decision === "amend");
  if (amends.length) console.log("\n── Internal notes amended on quotes already imported ──");
  for (const it of amends) {
    const a = it.amend;
    console.log(`\n${a.quoteNumber}  ←  TrueFinish ${it.quote.quoteNumber}  [${a.sourceRef}]  — Quote.reviewNotes only; nothing else on the row changes`);
    console.log(`  replace: ${JSON.stringify(a.from)}`);
    console.log(`  with:    ${JSON.stringify(a.to)}`);
    console.log("  note after:");
    for (const line of a.after.split("\n")) console.log(`      ${line}`);
  }

  const lostItems = items.filter((i) => i.decision === "lost");
  const drafts = items.filter((i) => i.decision === "draft");
  console.log(`Would create, through createRecordedQuote (one transaction per quote):`);
  console.log(`  ${lostItems.length} historical declined quotes (lost): ${lostItems.map((i) => `${i.quoteNumber} ${money(i.recorded.quote.total)}`).join(", ") || "none"}`);
  console.log(`  ${drafts.length} live draft quote${drafts.length === 1 ? "" : "s"}: ${drafts.map((i) => `${i.quoteNumber} ${money(i.recorded.quote.total)}`).join(", ") || "none"}`);
  const quoteNew = new Set([...lostItems, ...drafts].filter((i) => i.client.kind === "new").map((i) => i.tfClient.id)).size;
  console.log(`  clients: ${quoteNew} new`);
  console.log(`Would amend, through amendRecordedQuoteNote: ${amends.length} internal note${amends.length === 1 ? "" : "s"}${amends.length ? ` (${amends.map((i) => i.amend.quoteNumber).join(", ")})` : ""}`);
  const corrections = items.filter((i) => i.ownerDecision?.kind === "one_payment" && i.decision === "import");
  if (corrections.length) console.log(`Owner corrections applied: ${corrections.map((i) => `${i.quote.quoteNumber} — ${i.ownerDecision.said}`).join("; ")}`);
  const held = items.filter((i) => i.decision === "hold");
  const skipped = items.filter((i) => i.decision === "skip");
  const errored = items.filter((i) => i.decision === "error");
  console.log(
    `Held back: ${held.length}${held.length ? ` (${held.map((i) => `${i.quote.quoteNumber} ${i.tfClient?.name}`).join(", ")})` : ""}, already imported: ${skipped.length}, refused: ${errored.length}`,
  );
  return { imp, held, skipped, errored, writable: items.filter((i) => WRITES.has(i.decision)) };
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
const { createPastJob, createRecordedQuote, amendRecordedQuoteNote, loadPastJobContext } = await import("@/lib/jobs/importPastJob");
const { recordActivity } = await import("@/lib/activity/log");

const fq = await readFieldQuoPrisma(db);
if (!fq.company) die(`No FieldQuo company ${COMPANY_ID}.`);
const items = buildPlan(tf, fq);
const { writable } = printPlan(items, fq);
if (!writable.length) {
  console.log("\nNothing to write.");
  await db.$disconnect();
  process.exit(0);
}
console.log(`\nWriting ${writable.length} records into "${fq.company.name}" (${COMPANY_ID}) …`);

const context = await loadPastJobContext(db, COMPANY_ID);
const now = new Date();
const createdClients = new Map(); // TrueFinish client id → FieldQuo client id
const results = [];
// In plan order, so the numbers allocated are the numbers printed above.
for (const it of writable) {
  if (it.decision === "amend") {
    let outcome;
    try {
      outcome = await amendRecordedQuoteNote(db, { companyId: COMPANY_ID, sourceRef: it.amend.sourceRef, from: it.amend.from, to: it.amend.to });
    } catch (err) {
      outcome = { status: "error", error: err?.message || "write_failed" };
    }
    results.push({ it, outcome });
    console.log(`  ${it.quote.quoteNumber}: note ${outcome.status}${outcome.quoteNumber ? ` on ${outcome.quoteNumber}` : ""}${outcome.error ? ` ${outcome.error}` : outcome.reason ? ` ${outcome.reason}` : ""}`);
    continue;
  }
  const clientId = createdClients.get(it.tfClient.id) || (it.client.kind === "existing" ? it.client.clientId : null);
  const category = it.category ? context.categories.find((c) => c.id === it.category.id) || null : null;
  const args = { companyId: COMPANY_ID, createdByUserId: null, row: { ...it.row, clientId }, category, context, now, recorded: it.recorded };
  let outcome;
  try {
    outcome = it.decision === "import" ? await createPastJob(db, args) : await createRecordedQuote(db, args);
  } catch (err) {
    outcome = { status: "error", error: err?.message || "write_failed" };
  }
  if (outcome.status === "created") createdClients.set(it.tfClient.id, outcome.clientId);
  results.push({ it, outcome });
  const what =
    outcome.status !== "created"
      ? ` ${outcome.reason || outcome.error || ""}${outcome.problems ? ` ${JSON.stringify(outcome.problems)}` : ""}`
      : it.decision === "import"
        ? ` → ${outcome.quoteNumber} / ${outcome.invoiceNumber} (${outcome.invoiceStatus}, paid ${money(outcome.amountPaid)}, due ${money(outcome.amountDue)})`
        : ` → ${outcome.quoteNumber} (${outcome.quoteStatus})`;
  console.log(`  ${it.quote.quoteNumber}: ${outcome.status}${what}${outcome.clientCreated ? " + new client" : ""}`);
}

const created = results.filter((r) => r.outcome.status === "created");
const amended = results.filter((r) => r.outcome.status === "amended");
if (created.length || amended.length) {
  // One office-trail line for the batch, as POST /api/jobs/import writes —
  // attributed to the script, not to a person who did not do it.
  const jobs = created.filter((r) => r.it.decision === "import");
  const quotesOnly = created.filter((r) => r.it.decision !== "import");
  const parts = [
    jobs.length ? `${jobs.length} past job${jobs.length === 1 ? "" : "s"}` : null,
    quotesOnly.length ? `${quotesOnly.length} quote${quotesOnly.length === 1 ? "" : "s"} with no job (lost, or to send again)` : null,
    amended.length ? `the owner's decision on ${amended.map((r) => r.outcome.quoteNumber).join(", ")}'s internal note` : null,
  ].filter(Boolean);
  await recordActivity(
    { companyId: COMPANY_ID, userId: null, id: null, role: null },
    {
      action: "job.past_imported",
      entityType: "job",
      entityId: jobs.length === 1 ? jobs[0].outcome.jobId : null,
      actorName: "TrueFinish migration",
      summary: `Entered from TrueFinish: ${parts.join("; ")}`,
      metadata: {
        amendedQuoteIds: amended.map((r) => r.outcome.quoteId),
        created: created.length,
        skipped: results.filter((r) => r.outcome.status === "skipped").length,
        failed: results.filter((r) => r.outcome.status === "error").length,
        clientsCreated: created.filter((r) => r.outcome.clientCreated).length,
        jobIds: jobs.map((r) => r.outcome.jobId),
        lostQuoteIds: quotesOnly.filter((r) => r.it.decision === "lost").map((r) => r.outcome.quoteId),
        draftQuoteIds: quotesOnly.filter((r) => r.it.decision === "draft").map((r) => r.outcome.quoteId),
        source: "truefinish",
      },
    },
  );
}
console.log(
  `\nDone: ${created.length} created, ${results.filter((r) => r.outcome.status === "amended").length} note(s) amended, ${results.filter((r) => r.outcome.status === "skipped").length} skipped, ${results.filter((r) => r.outcome.status === "error").length} failed.`,
);
await db.$disconnect();
process.exit(results.some((r) => r.outcome.status === "error") ? 1 : 0);
