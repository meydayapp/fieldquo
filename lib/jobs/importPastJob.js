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
import { quoteTotals } from "@/lib/quotes/totals";
import { allocateHistoricalQuoteNumber } from "@/lib/quotes/quoteNumber";
import { allocateHistoricalInvoiceNumber } from "@/lib/invoices/invoiceNumber";
import { refreshFamilyLedger } from "@/lib/invoices/family";
import { normaliseDescription } from "@/lib/expenses/csvImport";
import { pastJobNaturalKey, isoDay } from "@/lib/jobs/pastJobImport";

/** The note every row this module writes carries, so a reader knows why. */
export const PAST_JOB_NOTE = "Entered as a past job";

/** Expense.importSource for the cost rows — never "csv_upload", which means a bank statement. */
export const PAST_JOB_EXPENSE_SOURCE = "past_job";

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
        province: true,
        country: true,
        vatRegistered: true,
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
      select: {
        total: true,
        paidDate: true,
        client: { select: { name: true } },
        job: { select: { startDate: true } },
      },
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
    existingKeys: new Set(
      historical.map((h) =>
        pastJobNaturalKey({
          clientName: h.client?.name,
          startDate: h.job?.startDate,
          amount: h.total,
          paidDate: h.paidDate,
        }),
      ),
    ),
    existingInvoiceNumbers: new Set(invoiceNumbers.map((r) => r.invoiceNumber)),
    existingQuoteNumbers: new Set(quoteNumbers.map((r) => r.quoteNumber)),
  };
}

/**
 * Find the client a row names, without creating one. Exact name, case-
 * insensitive; when BOTH the row and a candidate carry an email, the emails
 * have to agree — two "J. Smith"s with different addresses are two people.
 * Returns null when nobody on file matches.
 */
export async function findMatchingClient(tx, companyId, { clientName, clientEmail }) {
  if (!clientName) return null;
  const candidates = await tx.client.findMany({
    where: { companyId, name: { equals: clientName, mode: "insensitive" } },
    select: { id: true, name: true, email: true, language: true, province: true, country: true },
  });
  const rowEmail = normaliseDescription(clientEmail);
  return (
    candidates.find((c) => {
      const theirs = normaliseDescription(c.email);
      return !rowEmail || !theirs || rowEmail === theirs;
    }) || null
  );
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
 *
 * @returns {{ status: "created", ... } | { status: "skipped", reason } | { status: "error", error }}
 *   Never throws for a per-row refusal: a batch reports each row's fate.
 */
export async function createPastJob(db, { companyId, createdByUserId = null, row, category = null, context, now = new Date() }) {
  if (!companyId || !row) return { status: "error", error: "companyId and row are required" };
  const company = context?.company;
  if (!company) return { status: "error", error: "Company not found" };

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:past-jobs`}))`;

    // ── Already on file? Checked under the lock, against the live table ────
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
      select: { id: true, total: true, paidDate: true, client: { select: { name: true } }, job: { select: { startDate: true } } },
    });
    const twin = sameDay.find(
      (h) =>
        pastJobNaturalKey({ clientName: h.client?.name, startDate: h.job?.startDate, amount: h.total, paidDate: h.paidDate }) === key,
    );
    if (twin) return { status: "skipped", reason: "on_file", invoiceId: twin.id };

    // ── The client ─────────────────────────────────────────────────────────
    let client = null;
    let clientCreated = false;
    if (row.clientId) {
      const owned = await assertOwnedIds(tx, companyId, { clientId: row.clientId });
      if (!owned.ok) return { status: "error", error: "client_not_found", field: "clientId" };
      client = await tx.client.findFirst({
        where: { id: row.clientId, companyId },
        select: { id: true, name: true, email: true, language: true, province: true, country: true },
      });
      if (!client) return { status: "error", error: "client_not_found", field: "clientId" };
    } else {
      client = await findMatchingClient(tx, companyId, row);
      if (!client) {
        // The same shape POST /api/clients writes, and — like that route —
        // nothing is sent to the address. A welcome email for a client whose
        // job was two years ago would be the first message they ever got
        // from this software, about work they have long since paid for.
        client = await tx.client.create({
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
        clientCreated = true;
      }
    }

    // ── The document: language fixed now, tax from the company's own rate ──
    const language = resolveClientLanguage({ client, company });
    const rate = row.taxApplied
      ? resolveDocumentTax({ company, taxRates: company.taxRates, client, asOf: row.startDate, lang: language }).rate
      : 0;
    const totals = quoteTotals({ subtotal: row.amount, discount: 0, taxRate: rate, taxEnabled: row.taxApplied });
    const year = row.startDate.getUTCFullYear();

    const quoteNumber = row.quoteNumber || (await allocateHistoricalQuoteNumber(tx, { companyId, year }));
    const invoiceNumber =
      row.invoiceNumber || (await allocateHistoricalInvoiceNumber(tx, { companyId, year, quoteNumber }));

    const lineItems = [{ description: row.description, quantity: 1, rate: row.amount, amount: row.amount }];

    const quote = await tx.quote.create({
      data: {
        companyId,
        quoteNumber,
        status: "accepted",
        language,
        clientId: client.id,
        createdById: createdByUserId,
        assignedToId: null,
        quoteType: category?.key || null,
        lineItems,
        subtotal: totals.subtotal,
        discount: 0,
        tax: totals.tax,
        total: totals.total,
        taxEnabled: row.taxApplied,
        // What the client agreed to is what they paid — one figure, recorded
        // on both sides so reports that prefer acceptedTotal find it.
        acceptedSubtotal: totals.subtotal,
        acceptedTax: totals.tax,
        acceptedTotal: totals.total,
        // The REAL date, typed by the company: win/loss dates a quote with no
        // sentAt by its decision (lib/analytics/winLoss.js). Never the import
        // day — that is historicalImportedAt's job.
        acceptedAt: row.startDate,
        sentAt: null,
        historicalImportedAt: now,
        ...(category
          ? {
              scopeGroups: {
                create: [{ categoryId: category.id, label: null, lineItems, subtotal: totals.subtotal, sortOrder: 0 }],
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
        costReviewNote: PAST_JOB_NOTE,
        historicalImportedAt: now,
      },
      select: { id: true, title: true },
    });

    const invoice = await tx.invoice.create({
      data: {
        companyId,
        invoiceNumber,
        status: "paid",
        clientId: client.id,
        quoteId: quote.id,
        jobId: job.id,
        createdById: createdByUserId,
        lineItems,
        subtotal: totals.subtotal,
        discount: 0,
        tax: totals.tax,
        taxEnabled: row.taxApplied,
        total: totals.total,
        amountPaid: totals.total,
        amountDue: 0,
        startDate: row.startDate,
        endDate: row.endDate,
        paidDate: row.paidDate,
        paidVia: row.paymentMethod,
        language,
        sentAt: null,
        notes: null,
        historicalImportedAt: now,
      },
      select: { id: true, invoiceNumber: true },
    });

    // The money, as a Payment row — the ledger every balance is derived from
    // (lib/invoices/family.js). Recorded against the invoice and then the
    // family ledger is recomputed from it, so the cached amountPaid above is
    // proven by the same arithmetic the live paths use rather than trusted.
    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: totals.total,
        method: row.paymentMethod,
        notes: PAST_JOB_NOTE,
        date: row.paidDate,
      },
      select: { id: true },
    });
    const ledger = await refreshFamilyLedger(tx, invoice.id);
    if (!ledger?.state?.isPaid) {
      // Cannot happen — the payment equals the total — but a paid invoice
      // whose own ledger says otherwise must roll back rather than land.
      throw new Error(`Past job ${invoice.invoiceNumber}: ledger does not read as paid after recording its payment`);
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
      expenseIds: expenses,
      total: totals.total,
      tax: totals.tax,
      language,
      startDate: isoDay(row.startDate),
      paidDate: isoDay(row.paidDate),
    };
  });
}
