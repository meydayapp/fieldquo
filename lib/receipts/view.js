// lib/receipts/view.js
//
// One receipt as the review screen needs it: what was read, whether it agrees
// with itself, whether it was captured before, where it probably belongs, and
// where this person is ALLOWED to put it.
//
// Suggestions are recomputed on every open rather than stored: they are cheap
// (no model), and a crew member who clocks in after snapping the receipt
// should see the suggestion that clocking-in makes possible, not the one
// frozen at read time.
import { db } from "@/lib/db";
import { validateReceipt } from "./validate";
import { findDuplicates } from "./duplicates";
import { duplicateShape, suggestionReceipt } from "./fields";
import { suggestPlacement } from "./suggest";
import { loadCandidates, linkableJobWhere } from "./candidates";
import { seesAllReceipts } from "./access";
import { DEFAULT_TIMEZONE } from "./time";

/** The company's timezone, or the schema default. */
export async function companyTimezone(companyId, prisma = db) {
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
  return c?.timezone || DEFAULT_TIMEZONE;
}

/** Other receipts this one may duplicate — same company, not void, not itself. */
export async function duplicatesFor(receipt, prisma = db) {
  if (!receipt?.vendorName) return [];
  const or = [];
  if (receipt.receiptNumber) or.push({ receiptNumber: receipt.receiptNumber });
  if (receipt.total !== null && receipt.total !== undefined) or.push({ total: receipt.total });
  if (!or.length) return [];
  const others = await prisma.receipt.findMany({
    where: { companyId: receipt.companyId, id: { not: receipt.id }, status: { not: "void" }, OR: or },
    select: { id: true, vendorName: true, receiptNumber: true, total: true, purchasedDate: true, purchasedAt: true },
    take: 50,
  });
  return findDuplicates(duplicateShape(receipt), others.map(duplicateShape));
}

/** The jobs this member may link to, for the picker. */
export async function linkableJobs({ companyId, full, userId, prisma = db }) {
  const jobs = await prisma.job.findMany({
    where: linkableJobWhere({ companyId, userId, seesAll: seesAllReceipts(full) }),
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, title: true, status: true, siteAddress: true, client: { select: { name: true } } },
  });
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    siteAddress: j.siteAddress,
    clientName: j.client?.name || null,
  }));
}

async function namesFor(userIds, prisma) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  return Object.fromEntries(users.map((u) => [u.id, u.name || u.email || null]));
}

/** The list row — no suggestions, no candidates; cheap enough for 200 rows. */
export function listRow(r, names = {}) {
  const files = Array.isArray(r.files) ? r.files : [];
  return {
    id: r.id,
    status: r.status,
    officeDecides: r.officeDecides,
    source: r.source,
    vendorName: r.vendorName,
    purchasedDate: r.purchasedDate,
    purchasedAt: r.purchasedAt,
    total: r.total === null || r.total === undefined ? null : Number(r.total),
    currency: r.currency,
    paymentMethod: r.paymentMethod,
    cardLast4: r.cardLast4,
    duplicateOfId: r.duplicateOfId,
    createdAt: r.createdAt,
    createdById: r.createdById,
    createdByName: names[r.createdById] || null,
    firstFile: files[0] ? { url: files[0].url, kind: files[0].kind, filename: files[0].filename || null } : null,
    fileCount: files.length,
    links: (r.expenses || []).map((e) => ({
      expenseId: e.id,
      kind: e.projectId ? "job" : e.isOverhead ? "overhead" : "general",
      jobId: e.projectId,
      category: e.category,
      amount: Number(e.amount),
    })),
  };
}

/**
 * Everything the review screen shows for one receipt.
 *
 * @param receipt  a Receipt row with `expenses` included
 * @param full     loadEnforceableMember's row — decides the candidates and the picker
 */
export async function receiptDetail({ receipt, full, userId, prisma = db, now = new Date() }) {
  const timezone = await companyTimezone(receipt.companyId, prisma);
  const seesAll = seesAllReceipts(full);
  const hasRead = Boolean(receipt.extract);
  const validation = hasRead ? validateReceipt(receipt.extract) : null;

  const restrict = seesAll ? null : linkableJobWhere({ companyId: receipt.companyId, userId, seesAll: false });
  const [duplicates, candidates, jobs] = await Promise.all([
    hasRead ? duplicatesFor(receipt, prisma) : Promise.resolve([]),
    hasRead && receipt.status !== "void"
      ? loadCandidates({ companyId: receipt.companyId, receipt, timezone, restrict, prisma, now })
      : Promise.resolve({ jobs: [], people: {} }),
    linkableJobs({ companyId: receipt.companyId, full, userId, prisma }),
  ]);

  const names = await namesFor(
    [receipt.createdById, receipt.confirmedById, ...Object.keys(candidates.people || {})],
    prisma,
  );
  // Worker names first (what the crew are called on timesheets), account
  // names for anyone who has no worker row.
  const people = { ...names, ...(candidates.people || {}) };

  const suggestions =
    hasRead && receipt.status !== "void"
      ? suggestPlacement({
          receipt: suggestionReceipt(receipt),
          jobs: candidates.jobs,
          people,
          timezone,
          now,
        })
      : null;

  const jobTitles = Object.fromEntries(jobs.map((j) => [j.id, j.title]));
  for (const c of candidates.jobs) jobTitles[c.id] = jobTitles[c.id] || c.title;
  const linkedIds = (receipt.expenses || []).map((e) => e.projectId).filter(Boolean);
  const missing = linkedIds.filter((id) => !jobTitles[id]);
  if (missing.length) {
    const extra = await prisma.job.findMany({
      where: { id: { in: missing }, companyId: receipt.companyId },
      select: { id: true, title: true },
    });
    for (const j of extra) jobTitles[j.id] = j.title;
  }

  return {
    receipt: {
      ...listRow(receipt, names),
      files: Array.isArray(receipt.files) ? receipt.files : [],
      vendorAddress: receipt.vendorAddress,
      vendorPhone: receipt.vendorPhone,
      receiptNumber: receipt.receiptNumber,
      subtotal: receipt.subtotal === null ? null : Number(receipt.subtotal),
      tax: receipt.tax === null ? null : Number(receipt.tax),
      taxLines: receipt.taxLines || null,
      extract: receipt.extract || null,
      readError: receipt.readError,
      contextJobId: receipt.contextJobId,
      confirmedAt: receipt.confirmedAt,
      confirmedByName: names[receipt.confirmedById] || null,
      voidedAt: receipt.voidedAt,
      voidReason: receipt.voidReason,
      expenses: (receipt.expenses || []).map((e) => ({
        id: e.id,
        kind: e.projectId ? "job" : e.isOverhead ? "overhead" : "general",
        jobId: e.projectId,
        jobTitle: e.projectId ? jobTitles[e.projectId] || null : null,
        category: e.category,
        amount: Number(e.amount),
        taxAmount: e.taxAmount === null ? null : Number(e.taxAmount),
        taxBreakdown: e.taxBreakdown || null,
        receiptLines: e.receiptLines || null,
      })),
    },
    validation: validation
      ? {
          flags: validation.flags,
          canSplitByLines: validation.canSplitByLines,
          totalCents: validation.totalCents,
          taxCents: validation.taxCents,
          taxSource: validation.taxSource,
          subtotalCents: validation.subtotalCents,
          itemsTotalCents: validation.reconciliation.itemsTotalCents,
          comparedTo: validation.reconciliation.comparedTo,
          discrepancyCents: validation.reconciliation.discrepancyCents,
          lines: validation.reconciliation.lines.map((l) => ({
            index: l.index,
            description: l.description,
            quantityText: l.quantityText,
            unitPriceText: l.unitPriceText,
            lineTotalText: l.lineTotalText,
            lineTotalCents: l.lineTotalCents,
            sku: receipt.extract?.items?.[l.index]?.sku || null,
            kind: receipt.extract?.items?.[l.index]?.kind || "other",
          })),
        }
      : null,
    duplicates,
    suggestions,
    jobs,
    timezone,
    access: {
      seesAll,
      canRelink: seesAll,
      canChooseOverhead: seesAll,
      isOwn: Boolean(userId) && receipt.createdById === userId,
    },
  };
}
