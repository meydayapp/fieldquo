// lib/jobs/selectionsServer.js
//
// The database half of a job's colours and materials (JobSelection). The rules
// and the words are lib/jobs/selections.js; this reads and writes rows.
//
// Every function takes `db` as its first argument rather than importing
// lib/db: the job routes pass the real client, lib/jobs/createJobFromQuote.js
// passes its own (the injection seam that file already has), and
// scripts/check-job-selections.mjs passes a fake it can inspect. Every query
// carries the companyId as well as the jobId — a job id from a request is
// never enough on its own.
import {
  MAX_SELECTIONS_PER_JOB,
  selectionCandidatesFromGroups,
  templatesForGroups,
} from "./selections.js";

/** The columns a reader is handed. createdById stays on the server. */
export const SELECTION_SELECT = Object.freeze({
  id: true,
  quoteScopeGroupId: true,
  sourceKey: true,
  templateKey: true,
  area: true,
  product: true,
  colourName: true,
  colourCode: true,
  finish: true,
  coats: true,
  notes: true,
  swatchUrl: true,
  sortOrder: true,
});

export const SELECTION_ORDER = Object.freeze([{ sortOrder: "asc" }, { createdAt: "asc" }]);

/** A job's rows, in the order the office put them. */
export async function listJobSelections(db, { jobId, companyId }) {
  if (!jobId || !companyId) return [];
  return db.jobSelection.findMany({
    where: { jobId, companyId },
    orderBy: [...SELECTION_ORDER],
    select: { ...SELECTION_SELECT },
  });
}

const GROUP_SELECT = Object.freeze({
  id: true,
  label: true,
  lineItems: true,
  intakeValues: true,
  selections: true,
  sortOrder: true,
  category: { select: { key: true, label: true } },
});

/**
 * "Door style: slab" in the company's working language — the crew's, not the
 * client's (the same rule lib/checklists/autoAdd.js follows). Read from the
 * work order's own label, which exists in every app language. Lazy: the
 * catalogue is large and only the copy path needs one sentence of it.
 */
async function doorStyleTextFor(language) {
  try {
    const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
    const key = "app.workOrder.fact.doorStyle";
    const tpl = APP_MESSAGES[String(language || "en").toLowerCase()]?.[key] || APP_MESSAGES.en[key] || "Door style: {v}";
    return (v) => tpl.replace("{v}", v);
  } catch {
    return (v) => `Door style: ${v}`;
  }
}

/**
 * The suggestion templates for a job: its quote's services, first first.
 * Empty for a job with no quote — the card then offers every template.
 */
export async function jobTemplates(db, { quoteId, companyId }) {
  if (!quoteId || !companyId) return [];
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId },
    select: { scopeGroups: { orderBy: { sortOrder: "asc" }, select: { category: { select: { key: true } } } } },
  });
  return templatesForGroups(quote?.scopeGroups || []);
}

/**
 * What every selections route answers with, so the card redraws from one
 * shape whichever verb it called: the rows, whether the caller may change
 * them, the templates the job's quote suggests, and whether there is a quote
 * to pull from.
 */
export async function presentSelections(db, { job, companyId, canEdit }) {
  const [selections, templates] = await Promise.all([
    listJobSelections(db, { jobId: job.id, companyId }),
    jobTemplates(db, { quoteId: job.quoteId, companyId }),
  ]);
  return { selections, canEdit: Boolean(canEdit), templates, hasQuote: Boolean(job.quoteId) };
}

/**
 * Copy a quote's colour rows onto its job — on creation, and again whenever
 * somebody presses "Pull from quote".
 *
 * IDEMPOTENT by sourceKey (unique per job): a row already on the job — pulled
 * before, and perhaps edited since — is left exactly as it is, and only the
 * rows the job does not have yet are added, after the ones it has. A row the
 * office REMOVED comes back on the next pull; that is what pressing the button
 * asks for, and nothing else is touched.
 *
 * @returns {{ added, skipped, total, noQuote? }}
 *   total   — rows the quote carries
 *   added   — rows written now
 *   skipped — rows the job already had (or that the per-job cap left out)
 */
export async function pullSelectionsFromQuote(db, { jobId, companyId, quoteId, createdById = null }) {
  if (!jobId || !companyId || !quoteId) return { added: 0, skipped: 0, total: 0, noQuote: true };
  const [quote, company] = await Promise.all([
    db.quote.findFirst({
      where: { id: quoteId, companyId },
      select: { id: true, scopeGroups: { orderBy: { sortOrder: "asc" }, select: { ...GROUP_SELECT } } },
    }),
    db.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } }),
  ]);
  if (!quote) return { added: 0, skipped: 0, total: 0, noQuote: true };

  const doorStyleText = await doorStyleTextFor(company?.defaultLanguage);
  const candidates = selectionCandidatesFromGroups(quote.scopeGroups || [], { doorStyleText });
  if (!candidates.length) return { added: 0, skipped: 0, total: 0 };

  const existing = await db.jobSelection.findMany({
    where: { jobId, companyId },
    select: { sourceKey: true, sortOrder: true },
  });
  const have = new Set(existing.map((r) => r.sourceKey).filter(Boolean));
  const room = Math.max(0, MAX_SELECTIONS_PER_JOB - existing.length);
  const missing = candidates.filter((c) => !have.has(c.sourceKey)).slice(0, room);
  if (!missing.length) return { added: 0, skipped: candidates.length, total: candidates.length };

  const start = existing.reduce((m, r) => Math.max(m, Number(r.sortOrder) || 0), 0) + 1;
  // skipDuplicates: two presses racing each other both see the row missing;
  // the unique (jobId, sourceKey) index lets exactly one of them write it.
  const res = await db.jobSelection.createMany({
    data: missing.map((c, i) => ({
      companyId,
      jobId,
      quoteScopeGroupId: c.quoteScopeGroupId,
      sourceKey: c.sourceKey,
      templateKey: c.templateKey,
      area: c.area,
      product: c.product,
      colourName: c.colourName,
      colourCode: c.colourCode,
      finish: c.finish,
      coats: c.coats,
      notes: c.notes,
      swatchUrl: c.swatchUrl ?? null,
      sortOrder: start + i,
      createdById,
    })),
    skipDuplicates: true,
  });
  const added = Number(res?.count) || 0;
  return { added, skipped: candidates.length - added, total: candidates.length };
}

/**
 * Best-effort copy for the job-creation paths: never throws, never fails the
 * job. A failure here leaves the card empty with its "Pull from quote" button,
 * which is the honest state to recover from.
 */
export async function carrySelectionsIntoJob(db, args) {
  try {
    return await pullSelectionsFromQuote(db, args);
  } catch (err) {
    console.error("[selections] carry from quote:", err?.message);
    return { added: 0, skipped: 0, total: 0, failed: true };
  }
}
