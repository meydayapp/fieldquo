// lib/jobs/importPastJob.js
//
// Past jobs, typed in after the fact — the write.
//
// One past job becomes the same four rows the live pipeline makes — Client
// (when new), Quote (accepted), Job (completed), Invoice (paid, with its
// Payment) — so every report that reads the pipeline reads the year's history
// without a special case. What it does NOT do is anything the live pipeline
// does to a CLIENT:
//
//   no quote email, no signed-PDF email, no deposit request      (Resend)
//   no on-my-way text                                              (Twilio)
//   no "schedule the job" / "chase" / "ask for a review" task     (lib/tasks)
//   no review-request, follow-up rule or overdue reminder         (crons)
//   no AI callback                                                 (voice)
//
// None of those modules are imported here, and scripts/check-past-jobs-
// import.mjs executes this path with every one of them stubbed to record and
// asserts nothing was recorded. The crons and the send buttons are guarded
// separately, on the rows' historicalImportedAt — see the schema comments.
//
// ── One transaction per job ────────────────────────────────────────────────
//
// Client, quote, job, invoice, payment, ledger, expenses: all or nothing, so a
// failure half-way never leaves a paid invoice with no job behind it. Per JOB
// rather than per batch: a 300-row CSV inside one interactive transaction
// would sit against Prisma's transaction timeout and Neon's cold start, and
// a batch that fails at row 212 is re-run — the natural key makes the first
// 211 skip as duplicates rather than double.
//
// An advisory lock per company serialises two commits of the same file from
// two tabs, the same way app/api/payments/route.js serialises two payments
// on one invoice. The duplicate check runs INSIDE the lock, so the second tab
// sees the first tab's rows.

import { assertOwnedIds } from "@/lib/tenant/ownedIds";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { resolveDocumentTax, companyStatesNoTax } from "@/lib/tax/documentTax";
import { attachUsTaxRate } from "@/lib/tax/usRates";
import { quoteTotals, round2 } from "@/lib/quotes/totals";
import { allocateHistoricalQuoteNumber, nextQuoteNumberForCompany } from "@/lib/quotes/quoteNumber";
import { mintShareToken } from "@/lib/quotes/shareToken";
import { offlineDiscountPctFor } from "@/lib/payments/offlineDiscount";
import { requireCreatedVia } from "@/lib/quotes/createdVia";
import { allocateHistoricalInvoiceNumber } from "@/lib/invoices/invoiceNumber";
import { refreshFamilyLedger } from "@/lib/invoices/family";
import {
  pastJobNaturalKey,
  historicalInvoiceKey,
  HISTORICAL_KEY_SELECT,
  isoDay,
  recordedFiguresProblems,
  recordedQuoteProblems,
  recordedMarker,
} from "@/lib/jobs/pastJobImport";
import { matchContact } from "@/lib/contacts/matchContact";

/** The note every row this module writes carries, so a reader knows why. */
export const PAST_JOB_NOTE = "Entered as a past job";

/** Expense.importSource for the cost rows — never "csv_upload", which means a bank statement. */
export const PAST_JOB_EXPENSE_SOURCE = "past_job";

// A past job can also arrive with its figures RECORDED in another system —
// see "Recorded figures" in lib/jobs/pastJobImport.js for why, and for the
// pure check every such payload passes before createPastJob writes it.

/**
 * Everything the preview and the commit both need about the company, loaded
 * once per request. Read-only.
 */
export async function loadPastJobContext(db, companyId) {
  const [company, categories, historical, invoiceNumbers, quoteNumbers] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        defaultLanguage: true,
        taxRate: true,
        autoApplyLocalTax: true,
        taxMode: true,
        province: true,
        country: true,
        vatRegistered: true,
        usTaxOverrides: true,
        taxRates: true,
      },
    }),
    db.serviceCategory.findMany({
      where: { OR: [{ isSystem: true }, { companyId }] },
      select: { id: true, key: true, label: true, labelTranslations: true },
    }),
    // Every past job already on file, as natural keys: the idempotency set.
    db.invoice.findMany({
      where: { companyId, historicalImportedAt: { not: null } },
      select: HISTORICAL_KEY_SELECT,
    }),
    db.invoice.findMany({ where: { companyId }, select: { invoiceNumber: true } }),
    db.quote.findMany({ where: { companyId }, select: { quoteNumber: true } }),
  ]);

  return {
    company,
    categories,
    // The company default for a blank tax_applied cell. A company that has
    // STATED it charges no tax gets "no"; every other company gets "yes",
    // which is the column default on Quote and Invoice and what the send
    // gate assumes — see lib/tax/documentTax.js companyStatesNoTax.
    defaultTaxApplied: !companyStatesNoTax(company),
    // Keyed pre-tax, like the rows they are compared with — see
    // historicalInvoiceKey for the bug keying on Invoice.total caused.
    existingKeys: new Set(historical.map(historicalInvoiceKey)),
    existingInvoiceNumbers: new Set(invoiceNumbers.map((r) => r.invoiceNumber)),
    existingQuoteNumbers: new Set(quoteNumbers.map((r) => r.quoteNumber)),
  };
}

/**
 * Find the client a row names, without creating one. Exact name, case-
 * insensitive; when BOTH the row and a candidate carry an email, the emails
 * have to agree — two "J. Smith"s with different addresses are two people.
 * Returns null when nobody on file matches.
 *
 * ── Now one matcher, shared with the Meta conversation attribution ────────
 *
 * This used to be a private twenty-line helper here, and it was the ONLY
 * name-to-client matcher in the repo — so the moment a second surface needed
 * one (a Facebook message, an Instagram DM, a Lead Ad), there were going to be
 * two, and the copy is the one that rots. lib/contacts/matchContact.js is that
 * one matcher; this function is now the past-jobs importer's SETTINGS for it,
 * and the settings are what preserve this path's behaviour exactly:
 *
 *   lookup: "exact-name"     the same single case-insensitive equality query
 *                            this always issued — not a scan. A 300-row CSV
 *                            calls this once per row, and a table scan per row
 *                            is a different feature.
 *   requireNameAgreement     a candidate found any other way is not a match
 *                            here. This has always been a name-first import.
 *   minConfidence "possible" a name on its own IS a match for this path, and
 *                            deliberately is not for the conversation
 *                            attribution: a human typed this row, reviews a
 *                            preview that says "existing client" before
 *                            committing, and the alternative on a miss is a
 *                            duplicate client row. Nobody reviews an inferred
 *                            link on a Facebook thread, which is why the
 *                            shared default is the stricter "likely".
 *   onTie: "oldest"          two identical names on file used to resolve to
 *                            whichever row Postgres handed back first — an
 *                            unordered findMany. It now resolves to the
 *                            longest-standing of them. That is the one
 *                            deliberate change: same behaviour, made
 *                            deterministic rather than left to the planner.
 *
 * The email rule is unchanged in substance — an email on both sides that
 * disagrees still refuses the candidate — but it is now applied by
 * scoreCandidate, which parses addresses properly instead of comparing them as
 * folded text. Two MALFORMED addresses that differ ("a@@b" vs "c@@d") no
 * longer count as a disagreement; they count as no email at all, and the row
 * matches on name as if neither had one.
 */
export async function findMatchingClient(tx, companyId, { clientName, clientEmail }) {
  if (!clientName) return null;
  const match = await matchContact(
    tx,
    companyId,
    { name: clientName, email: clientEmail },
    { lookup: "exact-name", requireNameAgreement: true, minConfidence: "possible", onTie: "oldest" },
  );
  return match.client;
}

/**
 * The client a past job (or a recorded quote) is filed under, inside the
 * caller's transaction: the stated clientId when it is this company's, else
 * the name-first match, else a new client. Nothing is sent to the address.
 *
 * @returns {{ client, clientCreated } | { error }}  `error` is the per-row
 *   refusal the caller returns as-is.
 */
async function resolvePastJobClient(tx, companyId, row) {
  if (row.clientId) {
    const owned = await assertOwnedIds(tx, companyId, { clientId: row.clientId });
    if (!owned.ok) return { error: { status: "error", error: "client_not_found", field: "clientId" } };
    const client = await tx.client.findFirst({
      where: { id: row.clientId, companyId },
      select: { id: true, name: true, email: true, language: true, province: true, country: true },
    });
    if (!client) return { error: { status: "error", error: "client_not_found", field: "clientId" } };
    return { client, clientCreated: false };
  }
  const found = await findMatchingClient(tx, companyId, row);
  if (found) return { client: found, clientCreated: false };
  // The same shape POST /api/clients writes, and — like that route —
  // nothing is sent to the address. A welcome email for a client whose
  // job was two years ago would be the first message they ever got
  // from this software, about work they have long since paid for.
  const client = await tx.client.create({
    data: {
      companyId,
      name: row.clientName,
      type: "individual",
      email: row.clientEmail,
      phone: row.clientPhone,
      address: row.clientAddress,
      // Null means "the company default" — see the same comment on
      // POST /api/clients.
      language: null,
    },
    select: { id: true, name: true, email: true, language: true, province: true, country: true },
  });
  return { client, clientCreated: true };
}

/**
 * Write one past job. Runs its own transaction on `db`.
 *
 * @param {object} db      the Prisma client (or a stub, in the check)
 * @param {object} p
 * @param {string} p.companyId
 * @param {string|null} p.createdByUserId
 * @param {object} p.row       a normalised row (normalisePastJob's `value`)
 * @param {object|null} p.category  the resolved ServiceCategory, or null
 * @param {object} p.context   loadPastJobContext's result
 * @param {Date}   [p.now]     injected so the check can pin the import stamp
 * @param {object|null} [p.recorded]  figures carried over exactly from another
 *   system — see "Recorded figures" in lib/jobs/pastJobImport.js. When
 *   given, row.amount / row.taxApplied / row.paymentMethod are not used to
 *   derive anything; row.paidDate is null for an invoice still open at the
 *   source. Shape:
 *     { sourceRef, sourceLabel, acceptedAt,
 *       quote:   { lineItems, subtotal, discount, tax, total, taxEnabled, notes },
 *       invoice: { lineItems, subtotal, discount, tax, total, taxEnabled, notes, dueDate },
 *       payments: [{ amount, method, date, notes, sourceRef }] }
 *
 * @returns {{ status: "created", ... } | { status: "skipped", reason } | { status: "error", error }}
 *   Never throws for a per-row refusal: a batch reports each row's fate.
 */
export async function createPastJob(db, { companyId, createdByUserId = null, row, category = null, context, now = new Date(), recorded = null }) {
  if (!companyId || !row) return { status: "error", error: "companyId and row are required" };
  const company = context?.company;
  if (!company) return { status: "error", error: "Company not found" };
  if (recorded) {
    const problems = recordedFiguresProblems(recorded, { today: now });
    if (problems.length) return { status: "error", error: "recorded_figures", problems };
  }

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:past-jobs`}))`;

    // ── Already on file? Checked under the lock, against the live table ────
    if (recorded) {
      const bySource = await tx.job.findFirst({
        where: { companyId, historicalImportedAt: { not: null }, costReviewNote: { contains: recordedMarker(recorded.sourceRef) } },
        select: { id: true },
      });
      if (bySource) return { status: "skipped", reason: "source_ref", jobId: bySource.id };
    }
    if (row.invoiceNumber) {
      const byNumber = await tx.invoice.findFirst({
        where: { companyId, invoiceNumber: row.invoiceNumber },
        select: { id: true, historicalImportedAt: true },
      });
      if (byNumber) return { status: "skipped", reason: "invoice_number", invoiceId: byNumber.id };
    }
    if (row.quoteNumber) {
      const byQuote = await tx.quote.findFirst({
        where: { companyId, quoteNumber: row.quoteNumber },
        select: { id: true },
      });
      if (byQuote) return { status: "error", error: "quote_number_taken", field: "quoteNumber" };
    }
    const key = pastJobNaturalKey(row);
    const sameDay = await tx.invoice.findMany({
      where: { companyId, historicalImportedAt: { not: null }, paidDate: row.paidDate },
      select: { id: true, ...HISTORICAL_KEY_SELECT },
    });
    const twin = sameDay.find((h) => historicalInvoiceKey(h) === key);
    if (twin) return { status: "skipped", reason: "on_file", invoiceId: twin.id };

    // ── The client ─────────────────────────────────────────────────────────
    const who = await resolvePastJobClient(tx, companyId, row);
    if (who.error) return who.error;
    const { client, clientCreated } = who;

    // ── The document: language fixed now, tax from the company's own rate ──
    // A recorded job never reaches the tax table: its tax is the figure the
    // source charged, already on both documents.
    const language = resolveClientLanguage({ client, company });
    const rate = recorded
      ? 0
      : row.taxApplied
      ? resolveDocumentTax({
          company,
          taxRates: company.taxRates,
          // The ZIP row rides along for a US client; a past date the row's
          // rates do not cover resolves to "unknown" and the company default.
          // A past-job row carries the client's address only, and the
          // client record now answers from its address line when its
          // province and country columns are empty (lib/tax/addressRegion.js).
          client: await attachUsTaxRate(client),
          asOf: row.startDate,
          lang: language,
        }).rate
      : 0;
    const derived = recorded ? null : quoteTotals({ subtotal: row.amount, discount: 0, taxRate: rate, taxEnabled: row.taxApplied });
    // The two documents' figures. Typed in: one amount, the same on both.
    // Recorded: each document as the source stored it — the quote is what
    // the client accepted, the invoice what they were billed.
    const docFigures = (doc) => ({
      subtotal: round2(Number(doc.subtotal)),
      discount: round2(Number(doc.discount)),
      tax: round2(Number(doc.tax)),
      total: round2(Number(doc.total)),
      taxEnabled: Boolean(doc.taxEnabled),
    });
    const quoteFig = recorded ? docFigures(recorded.quote) : { ...derived, discount: 0, taxEnabled: row.taxApplied };
    const invoiceFig = recorded ? docFigures(recorded.invoice) : quoteFig;
    const year = row.startDate.getUTCFullYear();

    const quoteNumber = row.quoteNumber || (await allocateHistoricalQuoteNumber(tx, { companyId, year }));
    const invoiceNumber =
      row.invoiceNumber || (await allocateHistoricalInvoiceNumber(tx, { companyId, year, quoteNumber }));

    const typedLines = recorded ? null : [{ description: row.description, quantity: 1, rate: row.amount, amount: row.amount }];
    const lineItems = recorded ? recorded.quote.lineItems : typedLines;
    const invoiceLineItems = recorded ? recorded.invoice.lineItems : typedLines;
    const paidInFull = Boolean(row.paidDate);

    const quote = await tx.quote.create({
      data: {
        companyId,
        quoteNumber,
        status: "accepted",
        language,
        clientId: client.id,
        createdById: createdByUserId,
        // Typed in after the fact for work FieldQuo never touched. Recorded so
        // no figure computed off createdVia counts a back-filled year of
        // history as quotes this product produced. See lib/quotes/createdVia.js.
        createdVia: requireCreatedVia("import"),
        assignedToId: null,
        quoteType: category?.key || null,
        lineItems,
        subtotal: quoteFig.subtotal,
        discount: quoteFig.discount,
        tax: quoteFig.tax,
        total: quoteFig.total,
        taxEnabled: quoteFig.taxEnabled,
        // What the client agreed to — typed in, that is what they paid, one
        // figure on both sides; recorded, the quote as the source stored it,
        // which the invoice may since have moved away from.
        acceptedSubtotal: quoteFig.subtotal,
        acceptedTax: quoteFig.tax,
        acceptedTotal: quoteFig.total,
        // The REAL date, typed by the company: win/loss dates a quote with no
        // sentAt by its decision (lib/analytics/winLoss.js). Never the import
        // day — that is historicalImportedAt's job.
        acceptedAt: recorded ? recorded.acceptedAt : row.startDate,
        sentAt: null,
        // The quote's own notes printed on the source's document ("Kitchen
        // island is outside of scope of work"); a typed-in job has none.
        ...(recorded && recorded.quote.notes ? { notes: recorded.quote.notes } : {}),
        historicalImportedAt: now,
        ...(category
          ? {
              scopeGroups: {
                create: [{ categoryId: category.id, label: null, lineItems, subtotal: quoteFig.subtotal, sortOrder: 0 }],
              },
            }
          : {}),
      },
      select: { id: true, quoteNumber: true },
    });

    const title = `${category?.label ? `${category.label} — ` : ""}${client.name} (${quote.quoteNumber})`;
    const job = await tx.job.create({
      data: {
        companyId,
        clientId: client.id,
        quoteId: quote.id,
        title,
        status: "completed",
        startDate: row.startDate,
        endDate: row.endDate,
        completedAt: row.endDate,
        // Reviewed by the person typing it in: the cost on this job is
        // whatever they entered below, and there is nothing further to
        // approve or tag. Left null, every past job would sit in the
        // "review what this cost" prompt for ever.
        costReviewedAt: now,
        // A recorded job also carries where it came from — internal only, and
        // the key a re-run of the same migration is skipped on (above).
        costReviewNote: recorded
          ? `${PAST_JOB_NOTE} — ${recorded.sourceLabel || recorded.sourceRef} ${recordedMarker(recorded.sourceRef)}`
          : PAST_JOB_NOTE,
        historicalImportedAt: now,
      },
      select: { id: true, title: true },
    });

    // The payments as the source recorded them — a deposit, instalments, a
    // final cash payment — or, typed in, the one payment in full.
    const paymentRows = recorded
      ? recorded.payments.map((p) => ({
          amount: round2(Number(p.amount)),
          method: p.method,
          date: p.date,
          notes: `${PAST_JOB_NOTE}${p.notes ? ` — ${p.notes}` : ""}${p.sourceRef ? ` ${recordedMarker(p.sourceRef)}` : ""}`,
        }))
      : [{ amount: derived.total, method: row.paymentMethod, notes: PAST_JOB_NOTE, date: row.paidDate }];

    const invoice = await tx.invoice.create({
      data: {
        companyId,
        invoiceNumber,
        // A recorded invoice starts as the source's open document and lets
        // the ledger below decide whether its payments settle it — "paid" is
        // a conclusion from the Payment rows, never a column copied across.
        status: recorded ? "sent" : "paid",
        clientId: client.id,
        quoteId: quote.id,
        jobId: job.id,
        createdById: createdByUserId,
        lineItems: invoiceLineItems,
        subtotal: invoiceFig.subtotal,
        discount: invoiceFig.discount,
        tax: invoiceFig.tax,
        taxEnabled: invoiceFig.taxEnabled,
        total: invoiceFig.total,
        amountPaid: recorded ? 0 : invoiceFig.total,
        amountDue: recorded ? invoiceFig.total : 0,
        startDate: row.startDate,
        endDate: row.endDate,
        paidDate: row.paidDate,
        paidVia: paidInFull ? paymentRows[paymentRows.length - 1].method : null,
        language,
        sentAt: null,
        notes: recorded && recorded.invoice.notes ? recorded.invoice.notes : null,
        ...(recorded && recorded.invoice.dueDate ? { dueDate: recorded.invoice.dueDate } : {}),
        historicalImportedAt: now,
      },
      select: { id: true, invoiceNumber: true },
    });

    // The money, as Payment rows — the ledger every balance is derived from
    // (lib/invoices/family.js). Recorded against the invoice and then the
    // family ledger is recomputed from it, so the cached amountPaid above is
    // proven by the same arithmetic the live paths use rather than trusted.
    const paymentIds = [];
    for (const p of paymentRows) {
      const created = await tx.payment.create({
        data: { invoiceId: invoice.id, amount: p.amount, method: p.method, notes: p.notes, date: p.date },
        select: { id: true },
      });
      paymentIds.push(created.id);
    }
    const payment = { id: paymentIds[0] || null };
    const ledger = await refreshFamilyLedger(tx, invoice.id);
    if (Boolean(ledger?.state?.isPaid) !== paidInFull) {
      // Typed in, cannot happen — the payment equals the total. Recorded, it
      // means the source's "paid" and its own payments disagree; either way
      // an invoice whose ledger contradicts what we were told must roll back
      // rather than land.
      throw new Error(
        `Past job ${invoice.invoiceNumber}: ledger reads ${ledger?.state?.isPaid ? "paid" : "unpaid"} but the job was given as ${paidInFull ? "paid" : "open"}`,
      );
    }

    // What it cost, as expenses tagged to the job. Two plain rows, no
    // receipt: lib/costing/actualJobCost.js sums expenses by category, so
    // "Labour" and "Materials" land on the job's costing panel as-is. Dated
    // on the job's last day. Never recurring — same reasoning as the bank
    // import: a fact about one job, not a standing cost.
    const expenses = [];
    for (const [category_, amount] of [
      ["Labour", row.labourCost],
      ["Materials", row.materialsCost],
    ]) {
      if (!(Number(amount) > 0)) continue;
      const e = await tx.expense.create({
        data: {
          companyId,
          createdById: createdByUserId,
          category: category_,
          amount,
          date: row.endDate,
          notes: `${PAST_JOB_NOTE} — ${job.title}`,
          projectId: job.id,
          isOverhead: false,
          recurring: false,
          frequency: "one_time",
          importSource: PAST_JOB_EXPENSE_SOURCE,
        },
        select: { id: true },
      });
      expenses.push(e.id);
    }

    return {
      status: "created",
      clientId: client.id,
      clientName: client.name,
      clientCreated,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      jobId: job.id,
      jobTitle: job.title,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paymentId: payment.id,
      paymentIds,
      expenseIds: expenses,
      total: invoiceFig.total,
      tax: invoiceFig.tax,
      amountPaid: Number(ledger.state.amountPaid),
      amountDue: Number(ledger.state.amountDue),
      invoiceStatus: ledger.state.status,
      language,
      startDate: isoDay(row.startDate),
      paidDate: isoDay(row.paidDate),
    };
  });
}

// ── A recorded quote with no job behind it ─────────────────────────────────
//
// The owner, 2026-10-03, on three TrueFinish quotes that were accepted there
// and then fell through: "LOST jobs" — keep them as history, as declined
// quotes, with no job, no invoice and nothing owing. And on one booked for
// later: put it back in the live pipeline as a draft so he can send it again
// himself. Two kinds, one writer, the same rules as a past job:
//
//   kind "lost"   historical: Q-<year>-H series, historicalImportedAt stamped,
//                 status declined, declinedAt = the last day the source shows
//                 it live, declineReason as given. Never sent. Like every
//                 decided quote it is counted by win/loss and the KPIs — as
//                 a loss, the mirror of the past jobs counted there as wins.
//   kind "draft"  LIVE: the company's next Q-<year>-NNNN, status draft, NOT
//                 historical — it is work still to be quoted and sent, and
//                 must reach every screen a draft reaches. The draft defaults
//                 POST /api/quotes writes for an empty save are set the way
//                 lib/quotes/importTarget.js sets them (a share token, the
//                 company's "what happens next" wording, its e-transfer offer
//                 frozen now). Nothing is sent; sending is the owner's.
//
// Both carry the source's lines and figures as stored (recordedQuoteProblems
// checks they add up), the source's own document notes, and an INTERNAL
// note (Quote.reviewNotes — never rendered to a client) saying where the
// quote came from, with the bracketed source marker a re-run is skipped on.
// createdVia is "import" for both: neither was produced by this product, and
// no figure computed off createdVia should count either as one that was.

/**
 * @param {object} db
 * @param {object} p
 * @param {string} p.companyId
 * @param {string|null} [p.createdByUserId]
 * @param {object} p.row       client fields as normalisePastJob returns them
 *                             (clientId?, clientName, clientEmail, clientPhone,
 *                             clientAddress) plus `quoteDate` (Date), whose
 *                             year numbers a historical quote
 * @param {object|null} [p.category]
 * @param {object} p.context   loadPastJobContext's result
 * @param {Date}   [p.now]
 * @param {object} p.recorded  { kind: "lost"|"draft", sourceRef, sourceLabel,
 *                             internalNote, declinedAt, declineReason,
 *                             quote: { lineItems, subtotal, discount, tax,
 *                             total, taxEnabled, notes } }
 */
export async function createRecordedQuote(db, { companyId, createdByUserId = null, row, category = null, context, now = new Date(), recorded }) {
  if (!companyId || !row) return { status: "error", error: "companyId and row are required" };
  const company = context?.company;
  if (!company) return { status: "error", error: "Company not found" };
  const problems = recordedQuoteProblems(recorded, { today: now });
  if (problems.length) return { status: "error", error: "recorded_figures", problems };
  const historical = recorded.kind === "lost";
  if (historical && !(row.quoteDate instanceof Date && !Number.isNaN(row.quoteDate.getTime()))) {
    return { status: "error", error: "quote_date_required", field: "quoteDate" };
  }

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:past-jobs`}))`;

    const marker = recordedMarker(recorded.sourceRef);
    const already = await tx.quote.findFirst({
      where: { companyId, reviewNotes: { contains: marker } },
      select: { id: true, quoteNumber: true },
    });
    if (already) return { status: "skipped", reason: "source_ref", quoteId: already.id, quoteNumber: already.quoteNumber };

    const who = await resolvePastJobClient(tx, companyId, row);
    if (who.error) return who.error;
    const { client, clientCreated } = who;
    const language = resolveClientLanguage({ client, company });

    const fig = recorded.quote;
    const figures = {
      subtotal: round2(Number(fig.subtotal)),
      discount: round2(Number(fig.discount)),
      tax: round2(Number(fig.tax)),
      total: round2(Number(fig.total)),
      taxEnabled: Boolean(fig.taxEnabled),
    };
    const lineItems = fig.lineItems;

    let liveDefaults = {};
    if (!historical) {
      const c = await tx.company.findUnique({
        where: { id: companyId },
        select: { defaultProcessNotes: true, country: true, province: true, address: true, paymentMethods: true, offlinePaymentDiscount: true },
      });
      liveDefaults = {
        shareToken: mintShareToken(),
        processNotes: c?.defaultProcessNotes || null,
        offlineDiscountPct: offlineDiscountPctFor(c || {}),
      };
    }

    const quoteNumber = historical
      ? await allocateHistoricalQuoteNumber(tx, { companyId, year: row.quoteDate.getUTCFullYear() })
      : await nextQuoteNumberForCompany(tx, companyId);

    const origin = historical ? "Entered as a lost quote" : "Carried over as a draft";
    const internal = [recorded.internalNote, `${origin} — ${recorded.sourceLabel || recorded.sourceRef} ${marker}`]
      .filter(Boolean)
      .join("\n\n");

    const quote = await tx.quote.create({
      data: {
        companyId,
        quoteNumber,
        status: historical ? "declined" : "draft",
        language,
        clientId: client.id,
        createdById: createdByUserId,
        createdVia: requireCreatedVia("import"),
        assignedToId: null,
        quoteType: category?.key || null,
        lineItems,
        ...figures,
        notes: fig.notes || null,
        reviewNotes: internal,
        sentAt: null,
        ...(historical
          ? {
              declinedAt: recorded.declinedAt,
              declineReason: recorded.declineReason.trim().slice(0, 500),
              historicalImportedAt: now,
            }
          : liveDefaults),
        ...(category
          ? {
              scopeGroups: {
                create: [{ categoryId: category.id, label: null, lineItems, subtotal: figures.subtotal, sortOrder: 0 }],
              },
            }
          : {}),
      },
      select: { id: true, quoteNumber: true, status: true },
    });

    return {
      status: "created",
      kind: recorded.kind,
      clientId: client.id,
      clientName: client.name,
      clientCreated,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      quoteStatus: quote.status,
      total: figures.total,
      language,
    };
  });
}

/**
 * Change ONE sentence of the internal note on a quote this importer created —
 * the owner answering, after the fact, a question the note left open (2026-
 * 10-04: Paul Machaka's $500 deposit was kept as non-refundable, where the
 * note said "Refund or forfeit is the owner's decision").
 *
 * Deliberately the narrowest write in this module, because it is the only
 * one that touches a row that already exists:
 *   - only a quote carrying this source marker AND historicalImportedAt AND
 *     createdVia "import" — a row this importer made, never one a person did;
 *   - only Quote.reviewNotes (internal, never on a client document), and in
 *     it only the exact `from` sentence, which must appear exactly once —
 *     a note someone has since edited is refused, not overwritten;
 *   - already says `to` → skipped, so a re-run changes nothing.
 * Same per-company lock as every other write here.
 *
 * @returns {{ status: "amended"|"skipped"|"error", ... }}
 */
export async function amendRecordedQuoteNote(db, { companyId, sourceRef, from, to }) {
  if (!companyId || !sourceRef || typeof from !== "string" || typeof to !== "string" || !from || !to || from === to) {
    return { status: "error", error: "companyId, sourceRef, from and to are required, and must differ" };
  }
  if (/[[\]]/.test(sourceRef)) return { status: "error", error: "bad_ref" };
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:past-jobs`}))`;
    const rows = await tx.quote.findMany({
      where: { companyId, historicalImportedAt: { not: null }, createdVia: "import", reviewNotes: { contains: recordedMarker(sourceRef) } },
      select: { id: true, quoteNumber: true, reviewNotes: true },
    });
    if (rows.length !== 1) return { status: "error", error: rows.length ? "several_quotes_carry_this_marker" : "not_found" };
    const quote = rows[0];
    const note = quote.reviewNotes || "";
    if (note.includes(to)) return { status: "skipped", reason: "already_amended", quoteId: quote.id, quoteNumber: quote.quoteNumber };
    const at = note.indexOf(from);
    if (at === -1 || note.indexOf(from, at + 1) !== -1) {
      return { status: "error", error: "note_changed_since_import", quoteId: quote.id, quoteNumber: quote.quoteNumber };
    }
    const amended = `${note.slice(0, at)}${to}${note.slice(at + from.length)}`;
    await tx.quote.update({ where: { id: quote.id }, data: { reviewNotes: amended } });
    return { status: "amended", quoteId: quote.id, quoteNumber: quote.quoteNumber, before: note, after: amended };
  });
}
