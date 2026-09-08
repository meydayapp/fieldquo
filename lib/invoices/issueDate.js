// lib/invoices/issueDate.js
//
// When was this invoice issued? One answer, three readers.
//
// There is no issue-date column on Invoice (lib/export/accountingExport.js's
// header explains why), so three reports each derived one: sentAt when the
// email went out, else createdAt for a legacy row that was never stamped.
// Three private copies of that rule, in lib/accounting/statements.js,
// lib/analytics/receivables.js and the accounting export — and the day a
// fourth case appeared, all three were wrong the same way:
//
// A past job entered after the fact (POST /api/jobs/import) has no sentAt
// and a createdAt of THE DAY IT WAS TYPED IN. A 2024 invoice back-filled in
// September 2026 would have been "issued" in September 2026: the year-end
// the company back-filled to see would be missing it, and this year's
// accrual statement would carry 2024's revenue. For those rows the honest
// issue date is the job's last day (Invoice.endDate, written by the import
// from the dates the company typed), then the day it was paid.
//
// Pure. Takes the row that OWNS the date — the family root, by every
// caller's own rule — and returns the Date plus the column it came from, so
// the report can say which.

const asDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * @param {object} row  an Invoice row: { sentAt, createdAt, historicalImportedAt, endDate, paidDate }
 * @returns {{ date: Date|null, from: "sentAt"|"endDate"|"paidDate"|"createdAt"|null }}
 */
export function invoiceIssueDate(row) {
  if (!row) return { date: null, from: null };

  if (row.historicalImportedAt) {
    const ended = asDate(row.endDate);
    if (ended) return { date: ended, from: "endDate" };
    const paid = asDate(row.paidDate);
    if (paid) return { date: paid, from: "paidDate" };
    // A historical row with neither is malformed (the import writes both).
    // Falling through to createdAt would be the bug this file exists to
    // stop, so it is dated by nothing instead.
    return { date: null, from: null };
  }

  const sent = asDate(row.sentAt);
  if (sent) return { date: sent, from: "sentAt" };
  const created = asDate(row.createdAt);
  if (created) return { date: created, from: "createdAt" };
  return { date: null, from: null };
}
