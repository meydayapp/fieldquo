// lib/email/sentEmailHistory.js
//
// The full text of every document email, kept as it was sent — and the
// "History" tab that reads it back (owner, 2026-10-05: "maybe if there is a
// History tab…").
//
// ══ What is kept, and when ═════════════════════════════════════════════════
//
// recordSentEmail() is called by each send path AFTER sendEmail() accepted
// the message, with the very subject / html / text / recipients it handed to
// sendEmail — not a re-render. A document email is built from the document
// at send time (lib/email/quoteEmail.js, invoiceEmail.js) and a later edit to
// the quote, the company's wording or its logo would make a re-render say
// something the client never read. So the copy is the bytes, or nothing.
//
// The send paths, each a caller:
//
//   quote / quote_follow_up    app/api/quotes/[id]/send            (a person)
//   quote_follow_up / reminder app/api/cron/follow-ups              (automatic)
//   / job_follow_up
//   quote_signed_copy          app/api/public/quotes/[token]       (on approval)
//   invoice / deposit          app/api/invoices/[id]/send          (a person)
//   reminder                   app/api/invoices/[id]/request-payment (a person)
//   deposit                    lib/paymentSchedule/run.js           (automatic)
//   invoice / receipt          lib/servicePlans/run.js              (automatic)
//   portal_link                app/api/clients/[id]/portal-link     (a person)
//                              app/api/clients/portal-links (bulk)  (a person)
//
// Never a reason a send fails: recording catches its own error.
//
// ══ Before 2026-10-05 ══════════════════════════════════════════════════════
//
// Nothing was kept. Those sends are known from ActivityLog (quote.sent,
// quote.followed_up, invoice.sent, invoice.chased — who, when, to whom), and
// the History tab lists them with "Sent on … to … — email text wasn't kept
// before 5 Oct 2026" instead of rebuilding a body that might not match.
// A log row written by a send that WAS kept carries metadata.sentEmailId and
// is not listed twice.
//
// ══ Who may read it ════════════════════════════════════════════════════════
//
// Office only: a member scoped to their own jobs (seesOnlyAssignedJobs — the
// crew) gets nothing, the same line the prep-guide card draws. Then per row:
//
//   a quote email     quotes ≥ view_only
//   an invoice email  invoices ≥ view_only (invoice, deposit, reminder, receipt)
//   a job follow-up   jobs ≥ view_only
//   a portal link     clientsProperties ≥ full_view (it carries the link)
//   subject + body    showPricing (canSeeMoney) — every document email names
//                     a figure; below it the row says what was sent, when and
//                     to whom, and that the text is hidden for this role
//   recipients        clientsProperties ≥ full_view (client contact data)
//
// A FieldQuo support session reads, like the platform console reads
// everything; nothing here writes.

/** Every kind a row may carry. "portal_link" is the client's own portal link,
 *  emailed by the office (the client page's single send, or the Clients
 *  page's bulk action — lib/portal/bulkLinks.js); it names no figure. */
export const SENT_EMAIL_KINDS = Object.freeze(["quote", "quote_follow_up", "quote_signed_copy", "invoice", "deposit", "reminder", "receipt", "job_follow_up", "portal_link"]);

const QUOTE_KINDS = new Set(["quote", "quote_follow_up", "quote_signed_copy"]);
const INVOICE_KINDS = new Set(["invoice", "deposit", "reminder", "receipt"]);

/** The day the text began to be kept. Shown in the "wasn't kept before" line. */
export const SENT_EMAIL_HISTORY_SINCE = new Date("2026-10-05T00:00:00.000Z");

/** The ActivityLog actions that say a document email went, before and after. */
export const LEGACY_SEND_ACTIONS = Object.freeze(["quote.sent", "quote.followed_up", "invoice.sent", "invoice.chased"]);

/** Which permission category a kind is read under. */
export function kindCategory(kind) {
  if (QUOTE_KINDS.has(kind)) return "quotes";
  if (INVOICE_KINDS.has(kind)) return "invoices";
  // A portal link is a credential to the client's whole account, not a
  // document: read under the level that may mint and copy one
  // (clientsProperties full_view — app/api/clients/[id]/portal-link).
  if (kind === "portal_link") return "contacts";
  return "jobs";
}

/** The kind an old log row stands for. */
export function legacyKind(action) {
  if (action === "quote.sent") return "quote";
  if (action === "quote.followed_up") return "quote_follow_up";
  if (action === "invoice.chased") return "reminder";
  return "invoice";
}

/** How it left, from sendEmail's answer. */
export function sentVia(result) {
  if (result?.simulated) return "demo";
  if (result?.via === "mailbox") return "mailbox";
  return "resend";
}

const MAX_TEXT = 200_000;
const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
const addressList = (v) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : v == null ? "" : String(v));

/**
 * Keep one sent email. Never throws, never blocks a send; returns the row id
 * or null.
 *
 * @param mail    { to, cc, from, replyTo, subject, html, text, attachments }
 *                — exactly what was handed to sendEmail
 * @param result  sendEmail's answer: nothing is kept for { error } or
 *                { skipped } (it did not go)
 */
export async function recordSentEmail(db, { companyId, kind, clientId = null, jobId = null, quoteId = null, invoiceId = null, mail = {}, result = {}, sentByUserId = null, sentByName = null, language = null, now = new Date() } = {}) {
  try {
    if (!db?.sentEmail?.create || !companyId || !SENT_EMAIL_KINDS.includes(kind)) return null;
    if (!result || result.error || result.skipped) return null;
    const row = await db.sentEmail.create({
      data: {
        companyId,
        clientId: clientId || null,
        jobId: jobId || null,
        quoteId: quoteId || null,
        invoiceId: invoiceId || null,
        kind,
        subject: clip(mail.subject, 1000) || "",
        html: clip(mail.html, MAX_TEXT),
        text: clip(mail.text, MAX_TEXT),
        toAddresses: clip(addressList(mail.to), 4000) || "",
        ccAddresses: mail.cc ? clip(addressList(mail.cc), 4000) : null,
        fromAddress: clip(mail.from, 500),
        replyTo: clip(mail.replyTo, 500),
        attachments: Array.isArray(mail.attachments) && mail.attachments.length ? mail.attachments.map((a) => ({ filename: clip(a?.filename, 300) || "attachment" })) : undefined,
        sentByUserId: sentByUserId || null,
        sentByName: clip(sentByName, 200),
        via: sentVia(result),
        providerId: clip(result.id, 300),
        language: clip(language, 10),
        createdAt: now,
      },
      select: { id: true },
    });
    return row?.id || null;
  } catch (err) {
    console.error("[sentEmail] couldn't keep a copy:", err?.message);
    return null;
  }
}

/** The sender's name as the History tab shows it. Null for nobody. */
export async function actorName(db, userId) {
  if (!userId || !db?.user?.findUnique) return null;
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    return u?.name || u?.email || null;
  } catch {
    return null;
  }
}

// ── Who may read what ───────────────────────────────────────────────────────

/**
 * The answers the History tab needs, from the graded member. Pure.
 *
 * @param fns  { hasLevel, hasToggle, seesOnlyAssignedJobs } from
 *             lib/permissions/enforce.js — passed in so this file stays free
 *             of imports the check scripts would have to stub.
 */
export function historyAccess({ member, full, hasLevel, hasToggle, seesOnlyAssignedJobs }) {
  const support = Boolean(member?.impersonation);
  if (support) return { support, office: true, read: true, quotes: true, invoices: true, jobs: true, money: true, contacts: true };
  const office = !seesOnlyAssignedJobs(full);
  const quotes = Boolean(hasLevel(full, "quotes", "view_only"));
  const invoices = Boolean(hasLevel(full, "invoices", "view_only"));
  const jobs = Boolean(hasLevel(full, "jobs", "view_only"));
  return {
    support,
    office,
    read: office && (quotes || invoices || jobs),
    quotes,
    invoices,
    jobs,
    money: Boolean(hasToggle(full, "showPricing")),
    contacts: Boolean(hasLevel(full, "clientsProperties", "full_view")),
  };
}

/** May this member see this row at all? */
export function mayListKind(access, kind) {
  if (!access?.read) return false;
  return Boolean(access[kindCategory(kind)]);
}

// ── Shaping ─────────────────────────────────────────────────────────────────

/** A kept email as a list row. Redacted by access. Pure. */
export function historyEntry(row, access, numbers = new Map()) {
  // An invoice email is named by its invoice, not by the quote it billed.
  const number = numbers.get(row.invoiceId) || numbers.get(row.quoteId) || null;
  return {
    key: `se:${row.id}`,
    id: row.id,
    kind: row.kind,
    at: row.createdAt,
    number,
    kept: true,
    to: access.contacts ? row.toAddresses || null : null,
    by: row.sentByName || null,
    automatic: !row.sentByUserId && !row.sentByName,
    via: row.via || null,
    // Every document email names a figure: the subject ("Invoice INV-1 —
    // $1,200") and the body are withheld below showPricing, and the row says
    // so rather than going blank.
    subject: access.money ? row.subject || "" : null,
    textHidden: !access.money,
    quoteId: row.quoteId || null,
    invoiceId: row.invoiceId || null,
  };
}

/** An old ActivityLog send as a list row: when, to whom — and that the text is gone. Pure. */
export function legacyEntry(row, access, numbers = new Map()) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    key: `al:${row.id}`,
    id: null,
    kind: legacyKind(row.action),
    at: row.createdAt,
    number: numbers.get(row.entityId) || null,
    kept: false,
    keptSince: SENT_EMAIL_HISTORY_SINCE,
    // Before the feature it simply was not kept; after it, a send whose copy
    // could not be written says that instead of blaming the date.
    beforeKeeping: new Date(row.createdAt).getTime() < SENT_EMAIL_HISTORY_SINCE.getTime(),
    to: access.contacts && typeof meta.to === "string" ? meta.to : null,
    by: row.actorName || null,
    automatic: false,
    subject: null,
    textHidden: false,
    quoteId: row.entityType === "quote" ? row.entityId : null,
    invoiceId: row.entityType === "invoice" ? row.entityId : null,
  };
}

/** Does this log row stand for a send we kept? Then the kept row is the one listed. */
export function loggedKeptSend(row) {
  return Boolean(row?.metadata && typeof row.metadata === "object" && typeof row.metadata.sentEmailId === "string" && row.metadata.sentEmailId);
}

// ── Reads ───────────────────────────────────────────────────────────────────

export const HISTORY_LIMIT = 200;

/**
 * One client's (or one job's) document emails, newest first.
 *
 * @param job  { id, clientId, quoteId } already read under companyId by the
 *             route, or null for the client page
 * @returns {{ entries, truncated, since } | null}
 */
export async function loadEmailHistory(db, { companyId, clientId, job = null, access, limit = HISTORY_LIMIT } = {}) {
  if (!companyId || !clientId || !access?.read) return null;
  const client = await db.client.findFirst({ where: { id: clientId, companyId }, select: { id: true, companyId: true } });
  if (!client || client.companyId !== companyId) return null;
  if (job && job.clientId !== client.id) return null;

  const [quotes, invoices] = await Promise.all([
    db.quote.findMany({ where: { companyId, clientId: client.id }, select: { id: true, quoteNumber: true } }),
    db.invoice.findMany({ where: { companyId, clientId: client.id }, select: { id: true, invoiceNumber: true, jobId: true, quoteId: true } }),
  ]);
  const numbers = new Map([...quotes.map((q) => [q.id, q.quoteNumber]), ...invoices.map((i) => [i.id, i.invoiceNumber])]);

  // A job's emails: filed to it, about its quote, or about an invoice billing it.
  const jobInvoiceIds = job ? invoices.filter((i) => i.jobId === job.id || (job.quoteId && i.quoteId === job.quoteId)).map((i) => i.id) : [];
  const jobOr = job
    ? [{ jobId: job.id }, ...(job.quoteId ? [{ quoteId: job.quoteId }] : []), ...(jobInvoiceIds.length ? [{ invoiceId: { in: jobInvoiceIds } }] : [])]
    : null;

  const kinds = SENT_EMAIL_KINDS.filter((k) => mayListKind(access, k));
  const [kept, logged] = await Promise.all([
    kinds.length
      ? db.sentEmail.findMany({
          where: { companyId, clientId: client.id, kind: { in: kinds }, ...(jobOr ? { OR: jobOr } : {}) },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit + 1,
          select: { id: true, companyId: true, clientId: true, kind: true, subject: true, toAddresses: true, sentByUserId: true, sentByName: true, via: true, quoteId: true, invoiceId: true, jobId: true, createdAt: true },
        })
      : [],
    (() => {
      const docOr = [];
      const qIds = job ? (job.quoteId ? [job.quoteId] : []) : quotes.map((q) => q.id);
      const iIds = job ? jobInvoiceIds : invoices.map((i) => i.id);
      if (access.quotes && qIds.length) docOr.push({ entityType: "quote", entityId: { in: qIds } });
      if (access.invoices && iIds.length) docOr.push({ entityType: "invoice", entityId: { in: iIds } });
      if (!docOr.length) return [];
      return db.activityLog.findMany({
        where: { companyId, action: { in: [...LEGACY_SEND_ACTIONS] }, OR: docOr },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        select: { id: true, companyId: true, action: true, entityType: true, entityId: true, actorName: true, metadata: true, createdAt: true },
      });
    })(),
  ]);

  const entries = [
    ...kept.filter((r) => r.companyId === companyId && r.clientId === client.id && mayListKind(access, r.kind)).map((r) => historyEntry(r, access, numbers)),
    ...logged.filter((r) => r.companyId === companyId && !loggedKeptSend(r)).map((r) => legacyEntry(r, access, numbers)),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || (a.key < b.key ? 1 : -1));

  return {
    entries: entries.slice(0, limit),
    truncated: entries.length > limit || kept.length > limit || logged.length > limit,
    since: SENT_EMAIL_HISTORY_SINCE,
  };
}

/**
 * One kept email, whole — for the viewer. Refuses rather than redacting the
 * body to nothing: a member below showPricing is told the text is hidden.
 *
 * @returns {{ email } | { status, reason }}
 */
export async function loadSentEmail(db, { companyId, id, access } = {}) {
  if (!companyId || !id || !access?.read) return { status: 403, reason: "no_access" };
  const row = await db.sentEmail.findFirst({ where: { id: String(id), companyId } });
  if (!row || row.companyId !== companyId) return { status: 404, reason: "not_found" };
  if (!mayListKind(access, row.kind)) return { status: 404, reason: "not_found" };
  if (!access.money) return { status: 403, reason: "money_hidden" };
  const numbers = new Map();
  if (row.quoteId) {
    const q = await db.quote.findFirst({ where: { id: row.quoteId, companyId }, select: { quoteNumber: true } });
    if (q) numbers.set(row.quoteId, q.quoteNumber);
  }
  if (row.invoiceId) {
    const i = await db.invoice.findFirst({ where: { id: row.invoiceId, companyId }, select: { invoiceNumber: true } });
    if (i) numbers.set(row.invoiceId, i.invoiceNumber);
  }
  return {
    email: {
      ...historyEntry(row, access, numbers),
      cc: access.contacts ? row.ccAddresses || null : null,
      from: row.fromAddress || null,
      replyTo: access.contacts ? row.replyTo || null : null,
      html: row.html || null,
      text: row.text || null,
      attachments: Array.isArray(row.attachments) ? row.attachments.map((a) => ({ filename: String(a?.filename || "") })) : [],
      language: row.language || null,
    },
  };
}
