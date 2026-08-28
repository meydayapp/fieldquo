// lib/export/accountingExport.js
//
// A date range of invoices, payments and expenses, as CSV files a bookkeeper
// can open and an accountant can import.
//
// ══ Why this exists, and why it is not a QuickBooks integration ════════════
//
// "Do you work with QuickBooks" is the most-cited reason a contractor picks a
// competitor, and the answer today is no. A real QuickBooks Online sync is an
// Intuit developer account, an OAuth2 app, a security assessment before the
// production keys unblock, per-tenant refresh tokens that die after roughly
// three months of disuse, and a mapping layer between two tax models that do
// not agree (docs/INTEGRATIONS-ASSESSMENT.md sets out the whole bill).
//
// This is the part of that answer which is true regardless: whatever else
// happens, the numbers have to be able to LEAVE. Every accountant on earth
// imports a CSV. It costs no OAuth, no third-party approval and no ongoing
// maintenance against somebody else's API version, and it makes the
// positioning line ("run the business here, hand your accountant the year")
// a statement of fact rather than a deflection.
//
// ══ What this file refuses to invent ═══════════════════════════════════════
//
// Three things are genuinely missing from the schema, and the honest move is
// to say so in the file rather than to pad them (AGENTS.md failure class 5):
//
//   • There is no invoice ISSUE DATE column. `createdAt` is when the row was
//     made and `sentAt` is when Resend accepted the email; neither is "the
//     date on the invoice", because there isn't one. So every invoice row
//     carries the date AND the column it came from, and the reader decides.
//
//   • Invoice.tax is ONE amount. A Quebec company charging GST and QST has
//     two rates and one number. There is no per-line tax and no tax code, so
//     this export cannot produce a sales-tax filing, and the summary says so
//     instead of implying it can.
//
//   • Expense has no tax field and no vendor. Input tax credits / recoverable
//     VAT cannot be exported because they were never recorded. There is
//     deliberately no blank "Tax" column on the expenses file — a column that
//     is always empty reads as "we charge no tax", which is a statement.
//
// And one thing that is missing on purpose: there is no refund or credit-note
// object anywhere in the product (POST /api/payments refuses a non-positive
// amount, and refuses an overpayment rather than banking a credit). A negative
// payment therefore cannot arise from the app — if one is ever passed in, it
// is emitted verbatim and warned about, never quietly summed away.
//
// ══ The amended-invoice trap ═══════════════════════════════════════════════
//
// Editing a SENT invoice does not update it. app/api/invoices/[id]/route.js
// writes a NEW Invoice row with the SAME invoiceNumber, `parentInvoiceId`
// pointing at the root and `version` incremented; the old row stays as
// history and lib/invoices/lifecycle.js banners it as superseded.
//
// A naive `invoice.findMany({ where: { createdAt: { gte, lte } } })` therefore
// returns invoice 1042 twice, at two different totals, and the year's revenue
// is overstated by every amendment the company ever made. This module groups
// by family and emits ONE row per family, at the LATEST version's money, with
// the ROOT's date — the invoice was issued when v1 went out, not when someone
// corrected a line item in March.
//
// ══ CSV injection is not theoretical here ══════════════════════════════════
//
// A client named `=cmd|' /C calc'!A0` executes when the bookkeeper opens the
// file in Excel. Client names, expense categories and payment notes are all
// free text a contractor (or a homeowner filling in a self-quote form) typed.
// Same rule as app/api/payroll/runs/[id]/export/route.js — prefix a tab.
//
// One deliberate divergence from that route: there, money goes through
// `Number(x).toFixed(2)` and lands in the same string guard, so a negative
// figure would come out as "\t-5.00" and import as text. Here money is emitted
// through `money()` and marked safe, because we generated it; only STRINGS,
// which are the only untrusted values, carry the guard. A number cannot be a
// formula.
//
// Pure functions, no db import, no route, no React. Everything is passed in.

import { invoiceMoney, PAID_EPSILON } from "@/lib/invoices/lifecycle";

// ── Cells ──────────────────────────────────────────────────────────────────

/** A value the caller generated and we vouch for — skips the formula guard. */
class Safe {
  constructor(text) {
    this.text = text;
  }
}

/**
 * Money, as a plain decimal string with no grouping and no symbol.
 *
 * Deliberately not lib/format/money.js: that formats for a HUMAN in a locale
 * ("2 100,00 $"), and a French locale's comma decimal separator inside a
 * comma-separated file is a corrupted import. A spreadsheet wants a number.
 *
 * Returns Safe, so a negative amount stays "-5.00" instead of being tabbed
 * into text by the formula guard.
 */
export function money(value) {
  const n = Number(value);
  return new Safe(Number.isFinite(n) ? n.toFixed(2) : "");
}

/**
 * RFC 4180 escaping, plus the formula guard on untrusted strings.
 *
 * The guard runs BEFORE the quoting so the tab ends up inside the quotes,
 * which is where a reader needs it: `"\t=1+1"` opens as text, `\t"=1+1"`
 * does not parse as a field at all.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return "";
  let s;
  let guarded = false;
  if (value instanceof Safe) {
    s = value.text;
  } else if (typeof value === "number") {
    // We produced it. Numbers cannot be formulas.
    s = Number.isFinite(value) ? String(value) : "";
  } else {
    s = String(value);
    // =, +, -, @ start a formula in Excel and Sheets; a leading tab or CR can
    // smuggle one past a naive check on the first character.
    if (/^[=+\-@\t\r]/.test(s)) {
      s = `\t${s}`;
      guarded = true;
    }
  }
  // A guarded cell is always quoted, even when nothing in it needs escaping.
  // A bare tab is legal CSV, but Excel's import sniffs delimiters in some
  // locales and a tab is the other one it looks for — an unquoted `\t=cmd`
  // can split into two fields and hand back the formula it was neutralising.
  if (guarded || /[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CRLF, like the payroll export: what Excel expects, harmless elsewhere. */
export function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ── Dates ──────────────────────────────────────────────────────────────────

/**
 * The UTC calendar day of a value, as YYYY-MM-DD, or null.
 *
 * Range membership is decided on calendar days and not on instants, because
 * "January" is a calendar question. Doing it in UTC rather than the company's
 * timezone is a real, stated limitation: an invoice created at 20:00 on 31
 * January in Vancouver lands in February here. The alternative — reading
 * Company.timezone — is the right eventual fix, and guessing a zone in a pure
 * module with no company row would be worse than a documented rule.
 */
export function dayKey(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Inclusive at both ends — a bookkeeper's "1 Jan to 31 Jan" includes both. */
function inRange(key, from, to) {
  return key !== null && key >= from && key <= to;
}

// ── Invoice families ───────────────────────────────────────────────────────

/**
 * Group invoice rows into families, one per document.
 *
 * `latest` is the row with the highest `version` PRESENT IN THE INPUT, not
 * necessarily the true latest — a caller who filtered by date may hand us a
 * v2 without its v1, or a v1 whose v2 is out of range. Both are reported
 * rather than silently assumed away.
 *
 * `root` is the row with parentInvoiceId == null, or null if it wasn't
 * supplied. The root carries the issue date: amending an invoice in March
 * does not re-issue a January document.
 */
export function invoiceFamilies(invoices = []) {
  const byRoot = new Map();
  for (const inv of invoices) {
    if (!inv) continue;
    const rootId = inv.parentInvoiceId || inv.id;
    if (!byRoot.has(rootId)) byRoot.set(rootId, []);
    byRoot.get(rootId).push(inv);
  }
  return [...byRoot.entries()].map(([rootId, members]) => {
    const versionOf = (r) => {
      const n = Number(r?.version);
      return Number.isFinite(n) ? n : 1;
    };
    const sorted = [...members].sort((a, b) => versionOf(a) - versionOf(b));
    return {
      rootId,
      members: sorted,
      root: sorted.find((r) => !r.parentInvoiceId) || null,
      latest: sorted[sorted.length - 1],
      // How many rows exist in the whole family, per the rows themselves. The
      // latest version number is a better count than members.length, which
      // only counts what was handed in.
      versionCount: versionOf(sorted[sorted.length - 1]),
    };
  });
}

// ── The export ─────────────────────────────────────────────────────────────

const LIMITATIONS = [
  "This is an export, not a filing. Nothing here has been remitted to any tax authority.",
  "Invoice tax is a single amount per invoice. FieldQuo does not record tax codes or per-line tax, so this file cannot produce a sales-tax return.",
  "Expenses carry no tax and no vendor. Input tax credits / recoverable VAT are not tracked and cannot be exported.",
  "FieldQuo records no refunds and no credit notes. If money went back to a client, it is not in this file.",
  "There is no invoice issue-date field. Each invoice states which column its date came from.",
  "Dates are grouped by UTC calendar day, not by the company's local timezone.",
];

/**
 * Build the bookkeeping export.
 *
 * @param {object} p
 * @param {string|Date} p.from          first day of the range, inclusive
 * @param {string|Date} p.to            last day of the range, inclusive
 * @param {object[]} [p.invoices]       Invoice rows, `client` included, any version
 * @param {object[]} [p.payments]       Payment rows
 * @param {object[]} [p.expenses]       Expense rows
 * @param {string}   p.currency         the company's billing currency. REQUIRED.
 * @param {string}   [p.companyName]
 * @param {Date}     [p.generatedAt]
 * @returns {{range, currency, files, totals, warnings}}
 */
export function buildAccountingExport({
  from,
  to,
  invoices = [],
  payments = [],
  expenses = [],
  currency,
  companyName = "",
  generatedAt = new Date(),
} = {}) {
  const fromKey = dayKey(from);
  const toKey = dayKey(to);
  if (!fromKey || !toKey) {
    throw new Error("buildAccountingExport needs a valid `from` and `to` date.");
  }
  // An inverted range is a caller bug. Returning three empty files would look
  // identical to a quiet month, and a bookkeeper would file it.
  if (fromKey > toKey) {
    throw new Error(
      `buildAccountingExport: range runs backwards (${fromKey} to ${toKey}).`,
    );
  }
  // Never defaulted. Invoice has no currency column and Company.currency is
  // nullable — falling back to CAD here would print "CAD" on an American
  // contractor's year-end. Absence of a currency is not a currency.
  if (!currency || typeof currency !== "string") {
    throw new Error(
      "buildAccountingExport needs the company's billing currency; it is never assumed.",
    );
  }

  const warnings = [];
  const warn = (code, message, extra = {}) =>
    warnings.push({ code, message, ...extra });

  // Per-currency, always. A single grand total across mixed currencies is a
  // number that means nothing, and this module will not produce one.
  const totals = new Map();
  const bucket = (code) => {
    if (!totals.has(code)) {
      totals.set(code, { invoiced: 0, tax: 0, paid: 0, expensed: 0 });
    }
    return totals.get(code);
  };
  const currencyOf = (row) => {
    const own = row?.currency;
    if (own && own !== currency) {
      warn(
        "currency_mismatch",
        `A row carries currency ${own} but the export was asked for ${currency}. Totals are reported per currency and never combined.`,
        { rowCurrency: own },
      );
      return own;
    }
    return currency;
  };

  // ── Invoices ────────────────────────────────────────────────────────────
  //
  // Payments are indexed by the invoice row they were recorded against, and
  // then rolled up to the FAMILY: a payment taken before an amendment hangs
  // off the superseded row, and dropping it would understate what was paid.
  const paymentsByInvoiceId = new Map();
  for (const p of payments) {
    if (!p?.invoiceId) continue;
    if (!paymentsByInvoiceId.has(p.invoiceId)) {
      paymentsByInvoiceId.set(p.invoiceId, []);
    }
    paymentsByInvoiceId.get(p.invoiceId).push(p);
  }

  const families = invoiceFamilies(invoices);

  const invoiceHeader = [
    "Invoice number",
    "Issued",
    "Date taken from",
    "Due",
    "Client",
    "Status",
    "Version",
    "Currency",
    "Subtotal",
    "Discount",
    "Tax",
    "Tax applied",
    "Total",
    "Paid to date",
    "Received in range",
    "Balance",
  ];
  const invoiceRows = [invoiceHeader];
  const invoiceIdToNumber = new Map();

  for (const family of families) {
    const { root, latest, versionCount, members } = family;
    for (const m of members) invoiceIdToNumber.set(m.id, m.invoiceNumber);

    // The document's date belongs to the root. If the root wasn't supplied we
    // fall back to the earliest row we did get and say so — an invented date
    // on an accounting record is worse than a named substitute.
    const dateSource = root || members[0];
    let issued = dayKey(dateSource?.sentAt);
    let issuedFrom = "sentAt (emailed)";
    if (!issued) {
      issued = dayKey(dateSource?.createdAt);
      issuedFrom = "createdAt (raised)";
    }
    if (!issued) {
      issuedFrom = "unknown";
      warn(
        "no_issue_date",
        `Invoice ${latest?.invoiceNumber ?? family.rootId} has neither sentAt nor createdAt; it is listed with no date.`,
        { invoiceNumber: latest?.invoiceNumber ?? null },
      );
    }
    if (!root) {
      warn(
        "missing_root_version",
        `Invoice ${latest?.invoiceNumber ?? family.rootId} was amended and its original version is not in this range. Its date comes from version ${Number(members[0]?.version) || 1}, not from the original.`,
        { invoiceNumber: latest?.invoiceNumber ?? null },
      );
    }
    if (!inRange(issued, fromKey, toKey)) continue;

    const code = currencyOf(latest);
    const m = invoiceMoney(latest);

    // Every payment in the family, then the subset inside the range. Two
    // different questions — "what does this invoice still owe" and "what
    // money arrived in January" — and one column cannot answer both.
    const familyPayments = members.flatMap(
      (row) => paymentsByInvoiceId.get(row.id) || [],
    );
    const receivedInRange = familyPayments
      .filter((p) => inRange(dayKey(p.date), fromKey, toKey))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    if (Number(latest?.total) < 0) {
      warn(
        "negative_total",
        `Invoice ${latest?.invoiceNumber} has a negative total. FieldQuo has no credit-note object, so this did not come from the app.`,
        { invoiceNumber: latest?.invoiceNumber ?? null },
      );
    }

    const b = bucket(code);
    b.invoiced += m.total;
    b.tax += Number(latest?.tax) || 0;

    invoiceRows.push([
      latest?.invoiceNumber ?? "",
      issued ?? "",
      issuedFrom,
      dayKey(latest?.dueDate) ?? "",
      latest?.client?.name ?? "",
      latest?.status ?? "",
      // "3 of 3" rather than a bare number: it tells the reader at a glance
      // that this document was amended twice and that they are looking at the
      // version that stands.
      new Safe(`${Number(latest?.version) || 1} of ${versionCount}`),
      code,
      money(latest?.subtotal),
      money(latest?.discount),
      money(latest?.tax),
      // taxEnabled false with tax 0 is "no tax was charged on this job".
      // taxEnabled true with tax 0 is a hole somebody should look at. The
      // whole reason Invoice.taxEnabled exists is that `tax: 0` cannot say
      // which, and collapsing them here would throw that away again.
      latest?.taxEnabled === false ? "no" : "yes",
      money(m.total),
      money(m.paid),
      money(receivedInRange),
      money(m.due),
    ]);
  }

  // ── Payments ────────────────────────────────────────────────────────────
  //
  // Filtered on the PAYMENT's own date, not the invoice's: a December invoice
  // settled in January is January's cash. That is the whole difference between
  // a cash-basis and an accrual-basis view, and the two files give the reader
  // both rather than picking one on their behalf.
  const paymentHeader = [
    "Date",
    "Invoice number",
    "Client",
    "Method",
    "Currency",
    "Amount",
    "Reference",
    "Notes",
  ];
  const paymentRows = [paymentHeader];

  for (const p of payments) {
    const key = dayKey(p?.date);
    if (!inRange(key, fromKey, toKey)) continue;

    const number =
      p?.invoice?.invoiceNumber ?? invoiceIdToNumber.get(p?.invoiceId);
    if (!number) {
      warn(
        "orphan_payment",
        `A payment of ${Number(p?.amount) || 0} on ${key} names invoice ${p?.invoiceId ?? "(none)"}, which is not in this range. It is listed with the invoice id instead of a number.`,
        { invoiceId: p?.invoiceId ?? null },
      );
    }
    const amount = Number(p?.amount) || 0;
    if (amount < 0) {
      warn(
        "negative_payment",
        `A payment of ${amount} appears on ${key}. FieldQuo refuses non-positive payments and has no refund object, so this did not come from the app. It is listed as-is and NOT netted off the total.`,
        { invoiceId: p?.invoiceId ?? null },
      );
    }

    const code = currencyOf(p);
    bucket(code).paid += amount;

    paymentRows.push([
      key ?? "",
      number ?? p?.invoiceId ?? "",
      p?.invoice?.client?.name ?? p?.client?.name ?? "",
      p?.method ?? "",
      code,
      money(amount),
      p?.stripePaymentIntentId ?? "",
      p?.notes ?? "",
    ]);
  }

  // ── Expenses ────────────────────────────────────────────────────────────
  //
  // No Tax column, on purpose — see the header. No Vendor column either:
  // Expense has no vendor field, and an always-blank column invites the reader
  // to think the data exists and wasn't filled in.
  const expenseHeader = [
    "Date",
    "Category",
    "Currency",
    "Amount",
    "Overhead",
    "Recurring",
    "Frequency",
    "Job",
    "Notes",
  ];
  const expenseRows = [expenseHeader];

  for (const e of expenses) {
    const key = dayKey(e?.date);
    if (!inRange(key, fromKey, toKey)) continue;

    const amount = Number(e?.amount) || 0;
    if (amount < 0) {
      warn(
        "negative_expense",
        `An expense of ${amount} appears on ${key} under "${e?.category ?? ""}". Listed as-is; a credit from a supplier is not something FieldQuo models.`,
      );
    }

    const code = currencyOf(e);
    bucket(code).expensed += amount;

    expenseRows.push([
      key ?? "",
      e?.category ?? "",
      code,
      money(amount),
      e?.isOverhead ? "yes" : "no",
      e?.recurring ? "yes" : "no",
      e?.frequency ?? "",
      e?.projectId ?? "",
      e?.notes ?? "",
    ]);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  //
  // A cover sheet, because these three files land in an inbox with no context
  // and the reader's first question is "what am I looking at and what is
  // missing from it".
  const summaryRows = [
    ["FieldQuo bookkeeping export"],
    ["Company", companyName || ""],
    ["Range", new Safe(`${fromKey} to ${toKey}`)],
    ["Generated", dayKey(generatedAt) ?? ""],
    ["Billing currency", currency],
    [],
    ["Currency", "Invoiced", "of which tax", "Payments received", "Expenses"],
  ];
  const currencyCodes = [...totals.keys()].sort();
  for (const code of currencyCodes) {
    const t = totals.get(code);
    summaryRows.push([
      code,
      money(t.invoiced),
      money(t.tax),
      money(t.paid),
      money(t.expensed),
    ]);
  }
  if (currencyCodes.length > 1) {
    // Stated, not summed. The alternative is a grand total that silently adds
    // euros to dollars — the exact class of error lib/marketing/competitors.js
    // refuses to make with a conversion rate it doesn't have.
    summaryRows.push([]);
    summaryRows.push([
      `This range contains ${currencyCodes.length} currencies (${currencyCodes.join(", ")}). They are reported separately and deliberately not combined into one total.`,
    ]);
  }
  summaryRows.push([]);
  summaryRows.push(["What this file does not contain"]);
  for (const line of LIMITATIONS) summaryRows.push([line]);
  if (warnings.length) {
    summaryRows.push([]);
    summaryRows.push([`Notes on this range (${warnings.length})`]);
    for (const w of warnings) summaryRows.push([w.message]);
  }

  const stamp = `${fromKey}-to-${toKey}`;
  const files = [
    { kind: "summary", name: `summary-${stamp}.csv`, csv: toCsv(summaryRows), rowCount: 0 },
    {
      kind: "invoices",
      name: `invoices-${stamp}.csv`,
      csv: toCsv(invoiceRows),
      rowCount: invoiceRows.length - 1,
    },
    {
      kind: "payments",
      name: `payments-${stamp}.csv`,
      csv: toCsv(paymentRows),
      rowCount: paymentRows.length - 1,
    },
    {
      kind: "expenses",
      name: `expenses-${stamp}.csv`,
      csv: toCsv(expenseRows),
      rowCount: expenseRows.length - 1,
    },
  ];

  return {
    range: { from: fromKey, to: toKey },
    currency,
    files,
    totals: Object.fromEntries(totals),
    warnings,
    limitations: LIMITATIONS,
    // Exposed so a caller can say "your ledger is out by 3 cents" rather than
    // making the reader eyeball two columns. Half a cent, the same tolerance
    // every balance recompute in this codebase uses.
    epsilon: PAID_EPSILON,
  };
}
