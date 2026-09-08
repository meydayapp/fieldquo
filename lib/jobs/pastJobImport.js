// lib/jobs/pastJobImport.js
//
// Past jobs, typed in after the fact — the pure half.
//
// ── What this is for ───────────────────────────────────────────────────────
//
// The owner, 2026-09-08: "For importing older jobs that have already been paid
// — is there an option so that we don't send email to those clients? More like
// data entry: quotes, invoices and jobs, so the company can enter the jobs
// they've done and have an overview of that year."
//
// So this is DATA ENTRY of money that already changed hands, not a pricing
// surface. AGENTS.md's non-negotiable #5 — the browser never sends money
// amounts — is about a client choosing add-ons and the server repricing from
// its own rows. Here the company is recording what it charged in 2024, and
// there is no row of ours to reprice from; the amount typed IS the fact being
// recorded, the same way POST /api/expenses takes an amount. What the server
// still owns is everything derived from it: the tax (from the company's own
// rate as of the job date), the totals, the numbering, the ledger.
//
// Everything here is pure — no db, no fetch — so scripts/check-past-jobs-
// import.mjs can execute it against hostile input, per AGENTS.md. The two
// routes (app/api/jobs/import, .../preview) supply the company's rows and
// write the result; the write itself lives in lib/jobs/importPastJob.js.
//
// ── The refusals, and why each is a refusal rather than a fix-up ─────────
//
//   paid in the future      a payment that hasn't happened is not a past job
//   paid before it started  the amount here is the FULL amount charged, paid
//                           in full; money in before the first day is a
//                           deposit, which this screen does not model
//   a live-format number    "Q-2026-0043" typed onto a past job is the number
//                           the live allocator reaches next week — see
//                           lib/quotes/quoteNumber.js
//   an unknown service      a stated service that matches nothing on file is
//                           refused, not silently dropped: absence of a
//                           statement is not a statement, and neither is a
//                           statement quietly discarded

import { parseCsvText, parseAmount, normaliseDescription } from "@/lib/expenses/csvImport";
import { round2 } from "@/lib/quotes/totals";
import { looksLikeLiveQuoteNumber } from "@/lib/quotes/quoteNumber";
import { looksLikeLiveInvoiceNumber } from "@/lib/invoices/invoiceNumber";

// One CSV is one year of a small contractor's work. 500 is generous headroom
// for that and small enough that each row's own transaction (see
// importPastJob.js) finishes well inside one request.
export const MAX_PAST_JOB_ROWS = 500;

/**
 * How the money arrived. A subset of the PaymentMethod enum, on purpose:
 * `stripe` means FieldQuo's own Stripe Connect took it, `visit_credit` means a
 * booking fee was credited, and neither can be true of a job done before the
 * company used FieldQuo. `card_elsewhere` exists for exactly this screen.
 */
export const PAST_JOB_PAYMENT_METHODS = Object.freeze([
  "cash",
  "cheque",
  "e_transfer",
  "card_elsewhere",
]);

/**
 * The CSV columns, in template order. `header` is what the file says;
 * `key` is what the rest of this module reads. Documented on the page from
 * this same list, so the page and the parser cannot disagree.
 */
export const PAST_JOB_COLUMNS = Object.freeze([
  { key: "clientName", header: "client_name", required: true, example: "Marie Tremblay" },
  { key: "clientEmail", header: "client_email", required: false, example: "marie@example.com" },
  { key: "clientPhone", header: "client_phone", required: false, example: "613-555-0142" },
  { key: "clientAddress", header: "client_address", required: false, example: "12 Maple St, Ottawa" },
  { key: "service", header: "service", required: false, example: "Interior painting" },
  { key: "description", header: "description", required: true, example: "Repaint living room and hallway" },
  { key: "startDate", header: "job_start", required: true, example: "2024-05-13" },
  { key: "endDate", header: "job_end", required: false, example: "2024-05-15" },
  { key: "amount", header: "amount_before_tax", required: true, example: "2400.00" },
  { key: "taxApplied", header: "tax_applied", required: false, example: "yes" },
  { key: "paidDate", header: "paid_date", required: true, example: "2024-05-20" },
  { key: "paymentMethod", header: "payment_method", required: true, example: "e_transfer" },
  { key: "labourCost", header: "labour_cost", required: false, example: "900" },
  { key: "materialsCost", header: "materials_cost", required: false, example: "310.50" },
  { key: "quoteNumber", header: "quote_number", required: false, example: "" },
  { key: "invoiceNumber", header: "invoice_number", required: false, example: "" },
]);

const MAX_TEXT = 500;
const MAX_NUMBER_LEN = 40;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const text = (v) => (v === null || v === undefined ? "" : String(v).trim());

/**
 * "2024-05-13" → a Date at UTC midnight, or null. ISO only, deliberately: a
 * day-first/month-first guess is the coin flip lib/expenses/csvImport.js
 * refuses to make, and one column format on a template the company downloads
 * from us is a smaller ask than a format-detection screen.
 */
export function parseIsoDay(raw) {
  const m = ISO_DAY.exec(text(raw));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1970 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Date.UTC rolls Feb 30 into March 2 rather than refusing it.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** A Date → "YYYY-MM-DD" in UTC, the only calendar this module speaks. */
export function isoDay(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

/**
 * "yes" / "no" / blank → true / false / null. Null means "the row did not
 * say", and the caller substitutes the company default — never this module,
 * which does not know the company.
 */
export function parseYesNo(raw) {
  const v = text(raw).toLowerCase();
  if (v === "") return null;
  if (["yes", "y", "true", "1", "oui", "sí", "si"].includes(v)) return true;
  if (["no", "n", "false", "0", "non"].includes(v)) return false;
  return undefined; // unrecognised — the caller reports it
}

function parseOptionalCost(raw, field, errors) {
  const s = text(raw);
  if (!s) return null;
  const n = parseAmount(s);
  if (n === null || !Number.isFinite(n)) {
    errors.push({ field, code: "bad_amount" });
    return null;
  }
  if (n < 0) {
    errors.push({ field, code: "negative_amount" });
    return null;
  }
  return round2(n);
}

/**
 * One raw row (an object keyed by PAST_JOB_COLUMNS keys, plus an optional
 * `clientId` from the single-job form) → { ok, errors, value }.
 *
 * `errors` is a list of { field, code } — codes, not sentences, so the page
 * can translate them. `value` is only meaningful when `ok`.
 *
 * @param {object} opts
 * @param {Date}    opts.today             injected so the check can pin it
 * @param {boolean} opts.defaultTaxApplied the company default for a blank
 *                                         tax_applied cell
 * @param {number}  [opts.currentYear]     for the live-number refusal
 */
export function normalisePastJob(raw, { today, defaultTaxApplied, currentYear } = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const errors = [];
  const now = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const year = currentYear ?? now.getUTCFullYear();

  const clientId = text(r.clientId) || null;
  const clientName = text(r.clientName).slice(0, 200);
  if (!clientId && !clientName) errors.push({ field: "clientName", code: "required" });

  const clientEmail = text(r.clientEmail).slice(0, 200) || null;
  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    errors.push({ field: "clientEmail", code: "bad_email" });
  }
  const clientPhone = text(r.clientPhone).slice(0, 40) || null;
  const clientAddress = text(r.clientAddress).slice(0, 300) || null;

  const service = text(r.service).slice(0, 120) || null;

  const description = text(r.description).slice(0, MAX_TEXT);
  if (!description) errors.push({ field: "description", code: "required" });

  const startDate = parseIsoDay(r.startDate);
  if (!text(r.startDate)) errors.push({ field: "startDate", code: "required" });
  else if (!startDate) errors.push({ field: "startDate", code: "bad_date" });

  let endDate = null;
  if (text(r.endDate)) {
    endDate = parseIsoDay(r.endDate);
    if (!endDate) errors.push({ field: "endDate", code: "bad_date" });
    else if (startDate && endDate < startDate) errors.push({ field: "endDate", code: "end_before_start" });
  }

  const amountRaw = text(r.amount);
  const amountParsed = amountRaw ? parseAmount(amountRaw) : null;
  let amount = null;
  if (!amountRaw) errors.push({ field: "amount", code: "required" });
  else if (amountParsed === null || !Number.isFinite(amountParsed)) errors.push({ field: "amount", code: "bad_amount" });
  else if (amountParsed <= 0) errors.push({ field: "amount", code: "not_positive" });
  else amount = round2(amountParsed);

  let taxApplied = parseYesNo(r.taxApplied);
  if (taxApplied === undefined) {
    errors.push({ field: "taxApplied", code: "bad_yes_no" });
    taxApplied = null;
  }
  if (taxApplied === null) taxApplied = Boolean(defaultTaxApplied);

  const paidDate = parseIsoDay(r.paidDate);
  if (!text(r.paidDate)) errors.push({ field: "paidDate", code: "required" });
  else if (!paidDate) errors.push({ field: "paidDate", code: "bad_date" });
  else {
    // Calendar days in UTC, both sides: a payment dated today is a past
    // payment; one dated tomorrow is not.
    const todayKey = isoDay(now);
    if (isoDay(paidDate) > todayKey) errors.push({ field: "paidDate", code: "future" });
    if (startDate && paidDate < startDate) errors.push({ field: "paidDate", code: "before_start" });
  }

  const paymentMethod = text(r.paymentMethod).toLowerCase().replace(/[\s-]+/g, "_");
  if (!paymentMethod) errors.push({ field: "paymentMethod", code: "required" });
  else if (!PAST_JOB_PAYMENT_METHODS.includes(paymentMethod)) {
    errors.push({ field: "paymentMethod", code: "unknown_method" });
  }

  const labourCost = parseOptionalCost(r.labourCost, "labourCost", errors);
  const materialsCost = parseOptionalCost(r.materialsCost, "materialsCost", errors);

  const quoteNumber = text(r.quoteNumber).slice(0, MAX_NUMBER_LEN) || null;
  if (quoteNumber && looksLikeLiveQuoteNumber(quoteNumber, year)) {
    errors.push({ field: "quoteNumber", code: "live_format" });
  }
  const invoiceNumber = text(r.invoiceNumber).slice(0, MAX_NUMBER_LEN) || null;
  if (invoiceNumber && looksLikeLiveInvoiceNumber(invoiceNumber, year)) {
    errors.push({ field: "invoiceNumber", code: "live_format" });
  }

  const value = {
    clientId,
    clientName: clientName || null,
    clientEmail,
    clientPhone,
    clientAddress,
    service,
    description,
    startDate,
    // A job with no stated end is a one-day job. This is the one default in
    // the module, and it is a reading of the row rather than padding: a
    // start with no end on a job that is already finished means it ended
    // when it started, which is what a contractor writes for a day's work.
    endDate: endDate || startDate,
    amount,
    taxApplied,
    paidDate,
    paymentMethod: paymentMethod || null,
    labourCost,
    materialsCost,
    quoteNumber,
    invoiceNumber,
  };

  return { ok: errors.length === 0, errors, value };
}

/**
 * The idempotency key for a row, source-blind the way naturalKey is in
 * lib/expenses/csvImport.js: who, when, how much, paid when. Two rows that
 * agree on all four are the same job typed twice, whatever file or form they
 * came from. Scoped to a company by the caller only ever comparing keys drawn
 * from that company's own historical rows.
 */
export function pastJobNaturalKey({ clientName, startDate, amount, paidDate }) {
  const name = normaliseDescription(clientName);
  const start = isoDay(startDate instanceof Date ? startDate : startDate ? new Date(startDate) : null) || "invalid-date";
  const paid = isoDay(paidDate instanceof Date ? paidDate : paidDate ? new Date(paidDate) : null) || "invalid-date";
  const cents = Number.isFinite(Number(amount)) ? Math.round(Number(amount) * 100) : "invalid-amount";
  return `${name}|${start}|${cents}|${paid}`;
}

/**
 * Resolve a stated service against the categories on file — by id, by key,
 * or by label (case-insensitive, in any translation). Null when the row said
 * nothing; `undefined` when it said something that matches nothing, which the
 * caller reports.
 */
export function matchServiceCategory(stated, categories) {
  const s = text(stated);
  if (!s) return null;
  const needle = normaliseDescription(s);
  for (const c of Array.isArray(categories) ? categories : []) {
    if (!c) continue;
    if (c.id === s) return c;
    if (normaliseDescription(c.key) === needle) return c;
    if (normaliseDescription(c.label) === needle) return c;
    const translations = c.labelTranslations && typeof c.labelTranslations === "object" ? Object.values(c.labelTranslations) : [];
    if (translations.some((l) => normaliseDescription(l) === needle)) return c;
  }
  return undefined;
}

/**
 * Raw rows → the review list. `existing` is what the caller already fetched
 * for THIS company; this function never queries anything.
 *
 * Row statuses:
 *   "ok"        ready to write
 *   "duplicate" already on file (by invoice number or natural key), or a
 *               repeat of an earlier row in the same batch
 *   "error"     refused; `errors` says why, per field
 *
 * @param {object}   p
 * @param {object[]} p.rows                 objects keyed by PAST_JOB_COLUMNS keys
 * @param {Date}     p.today
 * @param {boolean}  p.defaultTaxApplied
 * @param {object[]} p.categories           service categories visible to the company
 * @param {Set}      p.existingKeys         pastJobNaturalKey of every historical job on file
 * @param {Set}      p.existingInvoiceNumbers
 * @param {Set}      p.existingQuoteNumbers
 */
export function buildPastJobsPreview({
  rows,
  today,
  defaultTaxApplied,
  categories = [],
  existingKeys = new Set(),
  existingInvoiceNumbers = new Set(),
  existingQuoteNumbers = new Set(),
  currentYear,
} = {}) {
  const all = Array.isArray(rows) ? rows : [];
  const truncated = all.length > MAX_PAST_JOB_ROWS;
  const working = truncated ? all.slice(0, MAX_PAST_JOB_ROWS) : all;

  const seenKeys = new Set();
  const seenInvoiceNumbers = new Set();
  const seenQuoteNumbers = new Set();

  const out = working.map((raw, index) => {
    const { ok, errors, value } = normalisePastJob(raw, { today, defaultTaxApplied, currentYear });

    let category = null;
    if (value.service) {
      category = matchServiceCategory(value.service, categories);
      if (category === undefined) {
        errors.push({ field: "service", code: "unknown_service" });
        category = null;
      }
    }

    // A hand-typed quote number that is already in use cannot be written —
    // and unlike an invoice number it does not identify THIS row as already
    // imported, because live quotes carry numbers too. Refused, not skipped.
    if (value.quoteNumber && (existingQuoteNumbers.has(value.quoteNumber) || seenQuoteNumbers.has(value.quoteNumber))) {
      errors.push({ field: "quoteNumber", code: "taken" });
    }

    if (errors.length) {
      return { index, raw, status: "error", errors, value, category: null, duplicateOf: null, key: null };
    }

    const key = pastJobNaturalKey(value);
    let duplicateOf = null;
    if (value.invoiceNumber && existingInvoiceNumbers.has(value.invoiceNumber)) duplicateOf = "invoice_number";
    else if (value.invoiceNumber && seenInvoiceNumbers.has(value.invoiceNumber)) duplicateOf = "same_file";
    else if (existingKeys.has(key)) duplicateOf = "on_file";
    else if (seenKeys.has(key)) duplicateOf = "same_file";

    seenKeys.add(key);
    if (value.invoiceNumber) seenInvoiceNumbers.add(value.invoiceNumber);
    if (value.quoteNumber) seenQuoteNumbers.add(value.quoteNumber);

    return {
      index,
      raw,
      status: duplicateOf ? "duplicate" : "ok",
      errors: [],
      value,
      category: category ? { id: category.id, key: category.key, label: category.label } : null,
      duplicateOf,
      key,
    };
  });

  return {
    rows: out,
    summary: {
      totalDataRows: working.length,
      ok: out.filter((r) => r.status === "ok").length,
      duplicates: out.filter((r) => r.status === "duplicate").length,
      errors: out.filter((r) => r.status === "error").length,
      truncated,
    },
  };
}

// ── CSV ────────────────────────────────────────────────────────────────────

const normaliseHeader = (h) => text(h).toLowerCase().replace(/[\s-]+/g, "_");

/**
 * Raw CSV text → { rows, error, missingHeaders, unknownHeaders }. Rows are
 * objects keyed by PAST_JOB_COLUMNS keys. `error` matches parseCsvText's
 * vocabulary ("unparseable" | "empty_file" | "headers_only") plus
 * "missing_columns" when a required header is absent — the three honest
 * messages AGENTS.md asks for, plus the one this format adds.
 */
export function parsePastJobsCsv(csvText) {
  const parsed = parseCsvText(csvText);
  if (parsed.error) return { rows: [], error: parsed.error, missingHeaders: [], unknownHeaders: [] };

  const byHeader = new Map(PAST_JOB_COLUMNS.map((c) => [c.header, c.key]));
  const headerKeys = parsed.headers.map((h) => byHeader.get(normaliseHeader(h)) || null);
  const present = new Set(headerKeys.filter(Boolean));
  const unknownHeaders = parsed.headers.filter((h, i) => !headerKeys[i] && text(h));
  const missingHeaders = PAST_JOB_COLUMNS.filter((c) => c.required && !present.has(c.key)).map((c) => c.header);
  if (missingHeaders.length) {
    return { rows: [], error: "missing_columns", missingHeaders, unknownHeaders };
  }

  const rows = parsed.rows
    .filter((r) => Array.isArray(r) && r.some((cell) => text(cell) !== ""))
    .map((r) => {
      const obj = {};
      headerKeys.forEach((key, i) => {
        if (key) obj[key] = text(r[i]);
      });
      return obj;
    });

  return { rows, error: null, missingHeaders: [], unknownHeaders };
}

function csvEscape(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The template a company downloads: the header row and one example row. */
export function pastJobsCsvTemplate() {
  const header = PAST_JOB_COLUMNS.map((c) => c.header).join(",");
  const example = PAST_JOB_COLUMNS.map((c) => csvEscape(c.example)).join(",");
  return `${header}\n${example}\n`;
}
