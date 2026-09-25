// lib/receipts/candidates.js
//
// The jobs a receipt could belong to, loaded with exactly what
// lib/receipts/suggest.js scores — and the jobs a given person may LINK one to.
//
// ══ "Active that day" ══════════════════════════════════════════════════════
//
// A job is a candidate when something ties it to the receipt's day: a time
// entry or a visit in the window, work in progress, a start within a couple
// of days, a finish just before, or the job page the receipt was snapped
// from. Cancelled jobs never are. The window is built from the printed
// instant when there is one and the printed day otherwise, in the company's
// timezone (lib/receipts/time.js) — and it is widened by a day each side, so
// an overnight shift that started the evening before is still found.
//
// No printed date at all → no time window, and the candidates are only the
// jobs in progress (plus the page it was snapped from). The capture date is
// NOT used as a stand-in: a receipt found in the van a week later would
// otherwise be matched to this week's jobs with a confident-looking reason.
import { db } from "@/lib/db";
import { dayWindow } from "./time";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** At most this many candidates are scored. A 20-person company has fewer
 *  jobs active on one day than this; a runaway query is capped rather than
 *  scored for a minute. */
export const MAX_CANDIDATES = 40;

/** The text of a stored line, whatever shape the builder saved it in. */
function lineText(line) {
  if (!line || typeof line !== "object") return null;
  for (const key of ["description", "name", "label", "title", "item"]) {
    if (typeof line[key] === "string" && line[key].trim()) return line[key].trim().slice(0, 160);
  }
  return null;
}

function quoteWords(quote) {
  if (!quote) return [];
  const out = [];
  const push = (arr) => {
    for (const l of Array.isArray(arr) ? arr : []) {
      const t = lineText(l);
      if (t) out.push(t);
    }
  };
  push(quote.lineItems);
  for (const g of quote.scopeGroups || []) {
    push(g.lineItems);
    if (g.label) out.push(String(g.label));
    // The scope group's trade key ("painting", "flooring") is the trade the
    // job is FOR — exactly what lib/receipts/classify.js's trade families
    // are matched against.
    if (g.category?.key) out.push(String(g.category.key).replace(/_/g, " "));
  }
  return out.slice(0, 200);
}

/** The window the receipt's time names, or null when no date was printed. */
export function receiptWindow(receipt, timezone) {
  if (receipt?.purchasedAt) {
    const at = new Date(receipt.purchasedAt);
    if (Number.isFinite(at.getTime())) return { start: new Date(at - DAY), end: new Date(at.getTime() + DAY) };
  }
  if (receipt?.purchasedDate) {
    const day = dayWindow(receipt.purchasedDate, timezone);
    if (day) return { start: new Date(day.start - DAY), end: new Date(day.end.getTime() + DAY) };
  }
  return null;
}

/**
 * The jobs a person may link a receipt to, as a Prisma `where`.
 *
 * Office (expenses: everyone's) — any job in the company that is not
 * cancelled. Everyone else — "their jobs": a visit assigned to them, or time
 * they clocked on it. That is the owner's rule ("crew can pick among THEIR
 * jobs"), and it is stricter than the job board's own scope on purpose: an
 * estimator who can SEE every job still only files their own receipts
 * against work they were on, and anything else goes to the office.
 */
export function linkableJobWhere({ companyId, userId, seesAll }) {
  const base = { companyId, status: { not: "cancelled" } };
  if (seesAll) return base;
  const me = userId || "__none__";
  return {
    ...base,
    OR: [{ visits: { some: { assignedToId: me } } }, { timeEntries: { some: { worker: { userId: me } } } }],
  };
}

/**
 * Candidates for scoring, in suggest.js's input shape.
 *
 * @param restrict  a linkableJobWhere() fragment for a member who may only
 *                  file against their own jobs — so a crew member is never
 *                  SUGGESTED a job they would then be refused.
 */
export async function loadCandidates({ companyId, receipt, timezone, restrict = null, prisma = db, now = new Date() }) {
  const window = receiptWindow(receipt, timezone);
  const or = [{ status: "in_progress" }];
  if (receipt?.contextJobId) or.push({ id: receipt.contextJobId });
  if (window) {
    or.push(
      { timeEntries: { some: { clockIn: { gte: new Date(window.start - 16 * HOUR), lt: window.end } } } },
      { visits: { some: { scheduledAt: { gte: window.start, lt: window.end } } } },
      { status: "scheduled", startDate: { gte: new Date(window.start - DAY), lt: new Date(window.end.getTime() + DAY) } },
      { status: "completed", completedAt: { gte: new Date(window.start - 2 * DAY), lt: window.end } },
    );
  }

  const where = {
    companyId,
    status: { not: "cancelled" },
    AND: [{ OR: or }, ...(restrict ? [restrict] : [])],
  };

  const entryWindow = window
    ? { clockIn: { gte: new Date(window.start - 16 * HOUR), lt: window.end } }
    : { clockIn: { gte: new Date(now - 2 * DAY) } };
  const visitWindow = window
    ? { scheduledAt: { gte: window.start, lt: window.end } }
    : { scheduledAt: { gte: new Date(now - DAY), lt: new Date(now.getTime() + DAY) } };

  const jobs = await prisma.job.findMany({
    where,
    take: MAX_CANDIDATES,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      siteAddress: true,
      siteCity: true,
      sitePostalCode: true,
      startDate: true,
      completedAt: true,
      client: { select: { name: true } },
      quote: {
        select: {
          lineItems: true,
          scopeGroups: { select: { lineItems: true, label: true, category: { select: { key: true } } } },
        },
      },
      materials: { select: { name: true }, take: 100 },
      timeEntries: {
        where: entryWindow,
        select: { clockIn: true, clockOut: true, worker: { select: { userId: true, name: true } } },
        take: 200,
      },
      visits: { where: visitWindow, select: { scheduledAt: true, assignedToId: true }, take: 50 },
    },
  });

  const people = {};
  const shaped = jobs.map((j) => {
    for (const e of j.timeEntries) {
      if (e.worker?.userId && e.worker?.name) people[e.worker.userId] = e.worker.name;
    }
    return {
      id: j.id,
      title: j.title,
      clientName: j.client?.name || null,
      status: j.status,
      siteAddress: j.siteAddress,
      siteCity: j.siteCity,
      sitePostalCode: j.sitePostalCode,
      startDate: j.startDate,
      completedAt: j.completedAt,
      quoteLineNames: quoteWords(j.quote),
      materialNames: j.materials.map((m) => m.name).filter(Boolean),
      timeEntries: j.timeEntries.map((e) => ({ userId: e.worker?.userId || null, clockIn: e.clockIn, clockOut: e.clockOut })),
      visits: j.visits.map((v) => ({ assignedToId: v.assignedToId, scheduledAt: v.scheduledAt })),
    };
  });

  return { jobs: shaped, people };
}
