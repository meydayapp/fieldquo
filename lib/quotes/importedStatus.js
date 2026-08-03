// lib/quotes/importedStatus.js
//
// The one place that decides what a QuoteImport MEANS, for both sides of the
// cross-company link (see model QuoteImport). Two jobs:
//
//   1. Derive the commit status from the importing (GC's) quote stage. Status
//      is never stored — a stored "confirmed" flag would be free to drift out
//      of step with the quote it describes. Here it is a function of the quote,
//      so it cannot lie.
//
//   2. Project the row differently for each tenant. The importer (GC) may see
//      the cost, the markup and the client price. The source (sub) may see only
//      THAT they were imported and the derived status — never the GC's markup
//      or what the GC charges the homeowner. That asymmetry is the whole
//      white-label promise applied one layer up: a sub must not learn their
//      customer's margin.
//
// Pure. No imports, no I/O — so it can be unit-checked against hostile input,
// which is where the real bugs in this repo get caught.

// Commit status of an imported sub-quote, read off the GC document it hangs on.
//
//   pending   — the GC put it on a quote that is still open (draft/sent). The
//               sub is the chosen bid but nothing is real until the GC's own
//               client approves. "Selected, not hired."
//   confirmed — the GC's quote was accepted, became a job, or is already being
//               invoiced (the project is underway). Green light.
//   cancelled — the GC's quote was declined. The sub was chosen but the job
//               the GC was bidding on didn't happen. Distinct from pending:
//               there is nothing left to wait for.
//
// `hasJob` / `hasInvoice` win over status because a project can be underway
// (invoiced) while the originating quote row still reads "accepted" — the work
// starting is the strongest possible signal and must not be overridden by a
// staler status column.
export function deriveCommitStatus({ targetQuoteStatus, hasJob, hasInvoice } = {}) {
  if (hasInvoice || hasJob) return "confirmed";
  switch (targetQuoteStatus) {
    case "accepted":
      return "confirmed";
    case "declined":
      return "cancelled";
    // draft, sent, or anything we don't recognise → treat as not-yet-real. An
    // unknown status must never read as "confirmed" and tell a sub they're
    // hired.
    default:
      return "pending";
  }
}

// Money math for the client price, in cents-safe form. Kept here so the browser
// never computes (or sends) the figure — the server derives it from the stored
// snapshot and the stored markup, every time it's shown.
//
// Defensive on purpose: a NaN or missing markup collapses to 0% (the cost
// passes through untouched) rather than producing NaN on a client-facing quote,
// and a negative markup is clamped to 0 — the receiver marks costs UP, and a
// stray "-100" must not zero out a line.
export function clientPriceCents(snapshotAmount, markupPercent) {
  const base = Number(snapshotAmount);
  if (!Number.isFinite(base) || base < 0) return 0;
  let pct = Number(markupPercent);
  if (!Number.isFinite(pct) || pct < 0) pct = 0;
  // A percent, not a multiplier: 20 → ×1.20. Rounded to whole cents so the
  // stored line and every re-render agree to the penny.
  return Math.round(base * (1 + pct / 100) * 100);
}

// Convenience: the client price as a decimal number of dollars.
export function clientPrice(snapshotAmount, markupPercent) {
  return clientPriceCents(snapshotAmount, markupPercent) / 100;
}

// What the IMPORTER (the GC) is allowed to see. Everything: their cost, their
// markup, the price their client will see, and a way back to the live original.
export function importerView(imp, { commitStatus, sourceCompanyName } = {}) {
  return {
    id: imp.id,
    sourceCompanyName: sourceCompanyName ?? imp.sourceCompany?.name ?? null,
    sourceQuoteId: imp.sourceQuoteId,
    label: imp.label ?? null,
    costAmount: Number(imp.snapshotAmount), // what the GC pays the sub
    markupPercent: Number(imp.markupPercent),
    clientPrice: clientPrice(imp.snapshotAmount, imp.markupPercent),
    display: imp.display || "blended",
    status: commitStatus ?? null,
  };
}

// What the SOURCE (the sub) is allowed to see. Deliberately NARROW: that a named
// company imported their quote, and the derived status. No markup, no client
// price — the sub must never learn their customer's margin. This is the object
// that gets serialised toward the sub's tenant; nothing else about the GC's
// quote may travel with it.
export function sourceView(imp, { commitStatus, targetCompanyName } = {}) {
  return {
    id: imp.id,
    importedByCompanyName: targetCompanyName ?? imp.targetCompany?.name ?? null,
    status: commitStatus ?? null,
    importedAt: imp.createdAt ?? null,
  };
}
