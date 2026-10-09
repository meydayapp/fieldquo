// lib/clients/editScope.js
//
// Who a client edit reaches, and the rule that it must be chosen on purpose.
//
// ── The incident (2026-10-09) ───────────────────────────────────────────────
//
// The owner duplicated accepted quote Q-2026-0022 (Maureen Faulkner) into
// draft Q-2026-0023 and, on the copy, "changed the client" to himself. A
// duplicate keeps the clientId — correct, a copy is the same work for the same
// household — and the document builder's only client control on an edit was
// "Edit contact details", which PATCHed the shared Client row in place. The
// accepted, signed quote, its job, its invoice and its appointment all began
// printing the owner's name, email and phone. Nothing on the screen said the
// form reached anything but the quote it was opened from.
//
// Two rules came out of it, and this file holds both halves:
//
//   1. From a document, "a different client" is a REPOINT of that one
//      document (PATCH /api/quotes/[id] { clientId }), never a rewrite of the
//      row other records share.
//   2. Rewriting a client's identity — the fields a reader identifies a
//      household by — when other records carry that client is refused unless
//      the caller says `scope: "everywhere"`. The server refuses rather than
//      trusting the screen, so an old tab still running the previous bundle
//      (whose form sent no scope) is stopped too, and so is any new caller
//      nobody has thought about yet.
//
// What is NOT identity: the language preference, the notes, requiresPo, the
// tax place (city/province/country/postal code). Those are settings about the
// household, filled in far more often than changed, and the tax dialog
// (TaxUnresolvedModal) writes province/country on purpose. `address` IS
// identity — it is what "Prepared for" prints under the name.
//
// Pure apart from loadClientUsage, which takes the db as a parameter so
// scripts/check-client-edit-scope.mjs can execute it against an in-memory one.

export const IDENTITY_FIELDS = Object.freeze(["name", "contactName", "email", "phone", "address"]);

/** The scope value a caller sends to mean "every record that uses this client". */
export const EVERYWHERE = "everywhere";

function norm(field, value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return field === "email" ? s.toLowerCase() : s;
}

/**
 * The identity fields this PATCH body would actually change on `existing`.
 * A key that is absent, or that re-sends what the row already holds (a form
 * echoing its own values, "" over null), is not a change.
 */
export function identityChanges(existing, body) {
  const row = existing || {};
  const b = body && typeof body === "object" ? body : {};
  return IDENTITY_FIELDS.filter((f) => b[f] !== undefined && norm(f, b[f]) !== norm(f, row[f]));
}

/**
 * Every OTHER record that carries this client — what an edit "everywhere"
 * would reach. `except` names the document the edit was opened from, which is
 * not "another" record.
 *
 * @returns {{ quotes, invoices, jobs, appointments, count }}
 */
export async function loadClientUsage(db, { companyId, clientId, exceptQuoteId = null, exceptInvoiceId = null }) {
  const base = { companyId, clientId };
  const [quotes, invoices, jobs, appointments] = await Promise.all([
    db.quote.findMany({
      where: { ...base, ...(exceptQuoteId ? { id: { not: exceptQuoteId } } : {}) },
      select: { id: true, quoteNumber: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    db.invoice.findMany({
      where: { ...base, ...(exceptInvoiceId ? { id: { not: exceptInvoiceId } } : {}) },
      select: { id: true, invoiceNumber: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    db.job.findMany({
      where: base,
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    db.appointment.findMany({
      where: base,
      select: { id: true, scheduledAt: true, status: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);
  const list = (x) => (Array.isArray(x) ? x : []);
  const usage = {
    quotes: list(quotes),
    invoices: list(invoices),
    jobs: list(jobs),
    appointments: list(appointments),
  };
  usage.count = usage.quotes.length + usage.invoices.length + usage.jobs.length + usage.appointments.length;
  return usage;
}

/**
 * The records as short labels, in the order a reader looks for them: the
 * quotes, then what was billed, then the work, then the visits.
 * "Q-2026-0022", "INV-2026-0022", "Job: Kitchen cabinets", "Visit 2026-10-02".
 */
export function usageLabels(usage) {
  return usageItems(usage).map(({ kind, text }) =>
    kind === "job" ? `Job: ${text}` : kind === "visit" ? `Visit ${text}`.trim() : text,
  );
}

/**
 * The same records, structured — `{ kind, text }` — so a screen can put its
 * own translated "Job" / "Visit" in front. The numbers and titles are the
 * records' own and are never translated.
 */
export function usageItems(usage) {
  if (!usage) return [];
  const day = (d) => {
    const t = d ? new Date(d) : null;
    return t && !Number.isNaN(t.getTime()) ? t.toISOString().slice(0, 10) : "";
  };
  return [
    ...(usage.quotes || []).map((q) => ({ kind: "quote", text: q.quoteNumber || "Quote" })),
    ...(usage.invoices || []).map((i) => ({ kind: "invoice", text: i.invoiceNumber || "Invoice" })),
    ...(usage.jobs || []).map((j) => ({ kind: "job", text: j.title || "untitled" })),
    ...(usage.appointments || []).map((a) => ({ kind: "visit", text: day(a.scheduledAt) })),
  ];
}

/** "This client is on 3 other records: Q-2026-0022, INV-2026-0022, Job: …" */
export function usageSentence(usage) {
  const labels = usageLabels(usage);
  if (!labels.length) return "This client is on no other record.";
  const n = labels.length;
  return `This client is on ${n} other record${n === 1 ? "" : "s"}: ${labels.join(", ")}.`;
}

/**
 * The server's decision for PATCH /api/clients/[id]: null to proceed, or the
 * 409 to return. Refused only when ALL hold — an identity field changes, at
 * least one record carries this client, and the caller did not say
 * `scope: "everywhere"`. A client nothing uses yet is edited freely; there is
 * nobody else for the change to reach.
 */
export function editScopeRefusal({ changes, usage, scope }) {
  if (!Array.isArray(changes) || changes.length === 0) return null;
  if (scope === EVERYWHERE) return null;
  if (!usage || !usage.count) return null;
  return {
    status: 409,
    body: {
      error:
        `${usageSentence(usage)} Changing their ${changes.join(", ")} here changes it on every one of them. ` +
        `To put a different person on one quote, choose "Use a different client for this quote" instead; ` +
        `to change this client's details everywhere, confirm that choice.`,
      code: "client_in_use",
      fields: changes,
      count: usage.count,
      records: usageLabels(usage),
    },
  };
}
