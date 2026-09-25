// lib/mailbox/filingTarget.js
//
// Which of the client's jobs / quotes an email belongs to.
//
// ══ The client's own documents, not a number format ═══════════════════════
//
// Quote numbers are "Q-2026-0014" when FieldQuo minted them and whatever the
// contractor typed when they imported their own ("24-017"). A regex for the
// first shape would miss the second and, worse, match a different company's
// number quoted in a forwarded chain. So the candidates are THIS client's
// quote and invoice numbers, and the question is only "does one of them
// appear in the subject or the body" — as a whole token, so Q-2026-001 does
// not match inside Q-2026-0014.
//
// Order: a number in the SUBJECT beats one in the body (the body quotes old
// mail); a quote number beats an invoice number only by appearing first.
// With no number: the most recently touched OPEN job, else the most recent
// open quote. Nothing open: filed to the client only — never to a closed
// job by default, because "filed to Job #12 (completed 2024)" is a guess
// dressed as a fact. Staff can always re-file (the "change" link).

const OPEN_JOB = new Set(["unscheduled", "scheduled", "in_progress"]);
const OPEN_QUOTE = new Set(["draft", "sent"]);

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Does `number` appear in `text` as a whole token? Case-insensitive. */
export function mentionsNumber(text, number) {
  const n = String(number || "").trim();
  if (n.length < 3) return false; // "12" would match every price and date
  return new RegExp(`(^|[^A-Za-z0-9-])${escapeRe(n)}(?![A-Za-z0-9]|-[A-Za-z0-9])`, "i").test(String(text || ""));
}

/**
 * @param subject, body
 * @param quotes    [{ id, quoteNumber, status, archivedAt, createdAt, updatedAt?, jobId? }]
 * @param invoices  [{ id, invoiceNumber, quoteId, jobId }]
 * @param jobs      [{ id, quoteId, status, createdAt, updatedAt }]
 * @returns { jobId, quoteId, reason: "number_subject"|"number_body"|"open_job"|"open_quote"|"none" }
 */
export function chooseFilingTarget({ subject = "", body = "", quotes = [], invoices = [], jobs = [] } = {}) {
  const jobForQuote = (quoteId) => jobs.find((j) => j.quoteId && j.quoteId === quoteId) || null;

  for (const [where, text] of [["number_subject", subject], ["number_body", body]]) {
    let best = null;
    for (const q of quotes) {
      if (!q?.quoteNumber || !mentionsNumber(text, q.quoteNumber)) continue;
      const at = String(text).toLowerCase().indexOf(String(q.quoteNumber).toLowerCase());
      if (!best || at < best.at) best = { at, quoteId: q.id, jobId: jobForQuote(q.id)?.id || null };
    }
    for (const inv of invoices) {
      if (!inv?.invoiceNumber || !mentionsNumber(text, inv.invoiceNumber)) continue;
      const at = String(text).toLowerCase().indexOf(String(inv.invoiceNumber).toLowerCase());
      if (!best || at < best.at) {
        best = { at, quoteId: inv.quoteId || null, jobId: inv.jobId || (inv.quoteId ? jobForQuote(inv.quoteId)?.id : null) || null };
      }
    }
    if (best) return { jobId: best.jobId, quoteId: best.quoteId, reason: where };
  }

  const recent = (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  const openJob = jobs.filter((j) => OPEN_JOB.has(j.status)).sort(recent)[0];
  if (openJob) return { jobId: openJob.id, quoteId: openJob.quoteId || null, reason: "open_job" };
  const openQuote = quotes.filter((q) => OPEN_QUOTE.has(q.status) && !q.archivedAt).sort(recent)[0];
  if (openQuote) return { jobId: null, quoteId: openQuote.id, reason: "open_quote" };
  return { jobId: null, quoteId: null, reason: "none" };
}
