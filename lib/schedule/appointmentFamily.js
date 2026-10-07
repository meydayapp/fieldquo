// lib/schedule/appointmentFamily.js
//
// One job, one family of linked records: the quote it was won on, the job,
// and the invoice it is billed on. An appointment booked against any ONE of
// them belongs to all three.
//
// ══ The case ═════════════════════════════════════════════════════════════
//
// TrueFinish, Maureen Faulkner, Oct 10 2 pm: booked from the invoice page, so
// it carried invoiceId and nothing else. The job page and the quote page read
// Appointment.jobId and Appointment.quoteId, found nothing, and the visit was
// invisible everywhere but the calendar and the invoice.
//
// ══ The two halves ═══════════════════════════════════════════════════════
//
//   FILL  — when an appointment is created or edited against a quote, a job
//           or an invoice, the server fills the OTHER links from that
//           record's own links, inside the same company. NULLs only: a link
//           somebody set is never overwritten. clientId is never touched —
//           it is never null, and the appointment's client may differ from
//           the record's on purpose (the husband rang about the wife's job).
//   SHOW  — each record page lists the appointments of the whole family,
//           found by query (quoteId OR jobId OR invoiceId in the family), so
//           a row written before the fill existed shows too.
//
// ══ Ambiguity is left empty ══════════════════════════════════════════════
//
// A quote has one job in practice, but the relation is a list; a job may be
// billed on more than one invoice (progress billing). A link is filled only
// when the family names exactly ONE record of that kind — an invoice family
// (v1, v2…) counts once, by its root. Two candidates is a question the office
// answers, not one this file guesses (AGENTS.md: absence of a statement is
// not a statement).
//
// ══ What it is ABOUT stays what it was booked about ══════════════════════
//
// Appointment.aboutKind records the pick. aboutLabel() names that record, and
// isQuoteMeasure() keeps an appointment booked about a job — which gains the
// quote's id through the fill — from being listed or logged as the
// estimator's measure.

export const FAMILY_KINDS = Object.freeze(["quote", "job", "invoice"]);
const LINK = { quote: "quoteId", job: "jobId", invoice: "invoiceId" };

const str = (v) => (typeof v === "string" && v.trim() ? v : null);

/** The legacy reading of what a row is about: invoice, else job, else quote. */
export function legacyAboutKind(appt) {
  if (!appt || typeof appt !== "object") return null;
  if (str(appt.invoiceId)) return "invoice";
  if (str(appt.jobId)) return "job";
  if (str(appt.quoteId)) return "quote";
  return null;
}

/** What the appointment is about: its recorded pick, else the legacy reading. */
export function aboutKindOf(appt) {
  const k = appt?.aboutKind;
  if (FAMILY_KINDS.includes(k) && str(appt[LINK[k]])) return k;
  return legacyAboutKind(appt);
}

/**
 * Is this the estimator's measure on the quote — the meaning
 * Appointment.quoteId had before the fill? Booked about the quote, or (a row
 * from before aboutKind) carrying the quote and nothing else.
 */
export function isQuoteMeasure(appt) {
  if (!appt || !str(appt.quoteId)) return false;
  if (FAMILY_KINDS.includes(appt.aboutKind)) return appt.aboutKind === "quote";
  return !str(appt.jobId) && !str(appt.invoiceId);
}

/** The Prisma `where` for "a measure", the same rule as isQuoteMeasure. */
export const QUOTE_MEASURE_WHERE = Object.freeze({
  OR: [{ aboutKind: "quote" }, { aboutKind: null, jobId: null, invoiceId: null }],
});

/**
 * The family of ONE record, from rows already loaded — pure.
 *
 * @param kind      "quote" | "job" | "invoice" — what was picked
 * @param id        its id
 * @param companyId the appointment's company; every row of another is dropped
 * @param rows      { quotes, jobs, invoices } candidate rows, each carrying
 *                  companyId and its own links ({ id, companyId, quoteId?,
 *                  jobId?, parentInvoiceId? })
 * @returns {{ quoteId, jobId, invoiceId }} — each the ONE record of that kind
 *          in the family, or null when there is none or more than one
 */
export function familyOf({ kind, id, companyId, rows = {} } = {}) {
  const out = { quoteId: null, jobId: null, invoiceId: null };
  if (!FAMILY_KINDS.includes(kind) || !str(id) || !str(companyId)) return out;
  const own = (list) => (Array.isArray(list) ? list : []).filter((r) => r && r.companyId === companyId && str(r.id));
  const quotes = own(rows.quotes);
  const jobs = own(rows.jobs);
  const invoices = own(rows.invoices);

  const picked = (kind === "quote" ? quotes : kind === "job" ? jobs : invoices).find((r) => r.id === id);
  // The picked record must itself be this company's — otherwise nothing.
  if (!picked) return out;

  const one = (ids) => {
    const set = [...new Set(ids.filter(str))];
    return set.length === 1 ? set[0] : null;
  };
  const rootOf = (inv) => inv.parentInvoiceId || inv.id;
  const known = (list, wanted) => (wanted && list.some((r) => r.id === wanted) ? wanted : null);

  if (kind === "invoice") {
    out.invoiceId = picked.id;
    out.jobId = known(jobs, picked.jobId) || one(jobs.filter((j) => str(picked.quoteId) && j.quoteId === picked.quoteId).map((j) => j.id));
    const job = jobs.find((j) => j.id === out.jobId);
    out.quoteId = known(quotes, picked.quoteId) || known(quotes, job?.quoteId);
  } else if (kind === "job") {
    out.jobId = picked.id;
    out.quoteId = known(quotes, picked.quoteId);
    out.invoiceId = one(
      invoices
        .filter((i) => i.jobId === picked.id || (out.quoteId && i.quoteId === out.quoteId && !i.jobId))
        .map(rootOf),
    );
  } else {
    out.quoteId = picked.id;
    out.jobId = one(jobs.filter((j) => j.quoteId === picked.id).map((j) => j.id));
    out.invoiceId = one(
      invoices.filter((i) => i.quoteId === picked.id || (out.jobId && i.jobId === out.jobId)).map(rootOf),
    );
  }
  return out;
}

/**
 * The writes the fill makes: only links that are NULL now and named by the
 * family, plus aboutKind when it is unset. Never clientId. Pure.
 *
 * @param current  the appointment's links as they are ({ quoteId, jobId, invoiceId, aboutKind })
 * @param family   familyOf()'s answer
 * @param about    the kind the appointment is about (recorded when unset)
 */
export function familyFill(current = {}, family = {}, about = null) {
  const data = {};
  for (const kind of FAMILY_KINDS) {
    const key = LINK[kind];
    if (!str(current?.[key]) && str(family?.[key])) data[key] = family[key];
  }
  if (!FAMILY_KINDS.includes(current?.aboutKind) && FAMILY_KINDS.includes(about)) data.aboutKind = about;
  return data;
}

/**
 * Load the candidate rows for one record's family, company-scoped, and
 * resolve it. Every query carries companyId; familyOf() drops anything else
 * again, so a cross-tenant id resolves to nothing.
 */
export async function resolveFamily(db, companyId, about) {
  const none = { quoteId: null, jobId: null, invoiceId: null };
  if (!about || !FAMILY_KINDS.includes(about.kind) || !str(about.id) || !str(companyId)) return none;
  const qSel = { id: true, companyId: true };
  const jSel = { id: true, companyId: true, quoteId: true };
  const iSel = { id: true, companyId: true, quoteId: true, jobId: true, parentInvoiceId: true };
  let quotes = [];
  let jobs = [];
  let invoices = [];
  if (about.kind === "invoice") {
    const inv = await db.invoice.findFirst({ where: { id: about.id, companyId }, select: iSel });
    if (!inv) return none;
    invoices = [inv];
    jobs = await db.job.findMany({
      where: { companyId, OR: [...(inv.jobId ? [{ id: inv.jobId }] : []), ...(inv.quoteId ? [{ quoteId: inv.quoteId }] : [])] },
      select: jSel,
    });
    const quoteIds = [inv.quoteId, ...jobs.map((j) => j.quoteId)].filter(Boolean);
    quotes = quoteIds.length ? await db.quote.findMany({ where: { companyId, id: { in: quoteIds } }, select: qSel }) : [];
  } else if (about.kind === "job") {
    const job = await db.job.findFirst({ where: { id: about.id, companyId }, select: jSel });
    if (!job) return none;
    jobs = [job];
    quotes = job.quoteId ? await db.quote.findMany({ where: { companyId, id: job.quoteId }, select: qSel }) : [];
    invoices = await db.invoice.findMany({
      where: { companyId, OR: [{ jobId: job.id }, ...(job.quoteId ? [{ quoteId: job.quoteId }] : [])] },
      select: iSel,
    });
  } else {
    const quote = await db.quote.findFirst({ where: { id: about.id, companyId }, select: qSel });
    if (!quote) return none;
    quotes = [quote];
    jobs = await db.job.findMany({ where: { companyId, quoteId: quote.id }, select: jSel });
    invoices = await db.invoice.findMany({
      where: { companyId, OR: [{ quoteId: quote.id }, ...(jobs.length ? [{ jobId: { in: jobs.map((j) => j.id) } }] : [])] },
      select: iSel,
    });
  }
  return familyOf({ kind: about.kind, id: about.id, companyId, rows: { quotes, jobs, invoices } });
}

/**
 * Every id in a record's family, for SHOWING its appointments: all of them,
 * ambiguous or not (two invoices on one job are both the job's), plus every
 * version of each invoice. Company-scoped.
 */
export async function familyIds(db, companyId, { quoteIds = [], jobIds = [], invoiceIds = [] } = {}) {
  const q = new Set(quoteIds.filter(str));
  const j = new Set(jobIds.filter(str));
  const i = new Set(invoiceIds.filter(str));
  if (q.size) {
    for (const r of await db.job.findMany({ where: { companyId, quoteId: { in: [...q] } }, select: { id: true } })) j.add(r.id);
  }
  if (j.size) {
    for (const r of await db.job.findMany({ where: { companyId, id: { in: [...j] } }, select: { quoteId: true } })) if (r.quoteId) q.add(r.quoteId);
  }
  const invs = await db.invoice.findMany({
    where: {
      companyId,
      OR: [
        ...(i.size ? [{ id: { in: [...i] } }, { parentInvoiceId: { in: [...i] } }] : []),
        ...(j.size ? [{ jobId: { in: [...j] } }] : []),
        ...(q.size ? [{ quoteId: { in: [...q] } }] : []),
      ],
    },
    select: { id: true, parentInvoiceId: true, jobId: true, quoteId: true },
  });
  const roots = new Set(invs.map((r) => r.parentInvoiceId || r.id));
  const allVersions = roots.size
    ? await db.invoice.findMany({
        where: { companyId, OR: [{ id: { in: [...roots] } }, { parentInvoiceId: { in: [...roots] } }] },
        select: { id: true },
      })
    : [];
  for (const r of [...invs, ...allVersions]) i.add(r.id);
  return { quoteIds: [...q], jobIds: [...j], invoiceIds: [...i] };
}

/** The `where` that finds a family's appointments. Null when the family is empty. */
export function familyAppointmentWhere(companyId, ids = {}) {
  const or = [
    ...(ids.quoteIds?.length ? [{ quoteId: { in: ids.quoteIds } }] : []),
    ...(ids.jobIds?.length ? [{ jobId: { in: ids.jobIds } }] : []),
    ...(ids.invoiceIds?.length ? [{ invoiceId: { in: ids.invoiceIds } }] : []),
  ];
  return or.length ? { companyId, OR: or } : null;
}

/** The row shape every record page lists: SiteVisitRows plus the family's labels. */
export const FAMILY_APPOINTMENT_SELECT = Object.freeze({
  id: true,
  scheduledAt: true,
  status: true,
  location: true,
  cancelReason: true,
  assignedToId: true,
  aboutKind: true,
  quoteId: true,
  jobId: true,
  invoiceId: true,
  assignedTo: { select: { id: true, name: true } },
  quote: { select: { id: true, quoteNumber: true } },
  job: { select: { id: true, title: true } },
  invoice: { select: { id: true, invoiceNumber: true } },
});

/**
 * A record page's family appointments, oldest first. `see` withholds the
 * label of a record kind this reader may not open (a crew member at
 * invoices:none sees the visit, not the invoice number). Best-effort: a
 * failed read is an empty list, never a failed page.
 */
export async function loadFamilyAppointments(db, companyId, seed, see = {}) {
  try {
    const ids = await familyIds(db, companyId, seed);
    const where = familyAppointmentWhere(companyId, ids);
    if (!where) return [];
    const rows = await db.appointment.findMany({ where, orderBy: { scheduledAt: "asc" }, select: FAMILY_APPOINTMENT_SELECT });
    return rows.map((r) => ({
      ...r,
      quote: see.quotes === false ? null : r.quote,
      invoice: see.invoices === false ? null : r.invoice,
      job: see.jobs === false ? null : r.job,
    }));
  } catch (err) {
    console.error("[appointmentFamily] load:", err?.message);
    return [];
  }
}
