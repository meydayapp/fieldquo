// lib/workOrder/locate.js
//
// The job a quote's work order belongs to. A quote becomes a job when it is
// accepted (Job.quoteId); before that there is no work order — the crew do
// not get a document for work nobody has bought. Returns null in that case
// so a Send menu can grey the row rather than link to a 404.
//
// `companyId` is required: the quote id alone is a foreign key the browser
// chose, and this is the boundary that keeps another tenant's job out.
import { db } from "@/lib/db";
import { workOrderPath, workOrderPdfPath } from "./url";

/**
 * @returns {{ jobId, path, pdfPath } | null}
 */
export async function workOrderForQuote(quoteId, companyId) {
  if (!quoteId || !companyId) return null;
  const job = await db.job.findFirst({
    where: { quoteId, companyId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!job) return null;
  return { jobId: job.id, path: workOrderPath(job.id), pdfPath: workOrderPdfPath(job.id) };
}
