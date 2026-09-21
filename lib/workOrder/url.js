// lib/workOrder/url.js
//
// Where a job's work order lives, and the one place that spelling is kept.
//
// ── Inside the app shell, on purpose ────────────────────────────────────────
//
// There is no anonymous crew link anywhere in the product: /visit/[token] is
// the HOMEOWNER's link, and every crew surface — the job page, the visit
// checklist, the crew inbox — sits behind a session and the assigned-jobs
// rule (lib/permissions/enforce.js assignedJobWhere). The work order follows
// the same door rather than opening a new one: a signed-in crew member opens
// it on their phone at /app/jobs/<id>/work-order, and a link copied from the
// quote's Send menu goes to that same address. A tokenised copy for a sub
// without an account is a product decision (who may hold one, how it
// expires) and is deliberately not made here.
//
// No database in this file, so the quote page's Send menu can import it
// without pulling Prisma into a client bundle. Finding the JOB for a quote is
// lib/workOrder/locate.js.
import { getAppOrigin } from "@/lib/appUrl";

export function workOrderPath(jobId) {
  return `/app/jobs/${encodeURIComponent(jobId)}/work-order`;
}

export function workOrderPdfPath(jobId) {
  return `/api/jobs/${encodeURIComponent(jobId)}/work-order/pdf`;
}

export function workOrderPrintPath(jobId) {
  return `/api/jobs/${encodeURIComponent(jobId)}/work-order/print`;
}

/** Absolute, for a link that leaves the browser (a text, an email). */
export function workOrderUrl(request, jobId) {
  return `${getAppOrigin(request)}${workOrderPath(jobId)}`;
}
