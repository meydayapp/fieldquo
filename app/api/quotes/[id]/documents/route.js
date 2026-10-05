// app/api/quotes/[id]/documents/route.js
//
// A quote's own files — drawing sets, scope sheets, permits, site photos —
// uploaded on the quote and carried into the job's Documents when it is
// approved (lib/jobs/documentAutofile.js fileQuoteDocumentsOnJob).
//
// GET   the current revisions, each with its history.
// POST  file one uploaded file (the bytes went to Cloudinary through the
//       shared uploader, purpose "plans"). A revision supersedes; nothing is
//       replaced or deleted — the job store's rule, lib/jobs/documents.js.
//       A file added to a quote whose job already exists is carried onto the
//       job straight away.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasToggle, hasLevel } from "@/lib/permissions/enforce";
import { revisionChains, visibleDocuments, formatBytes } from "@/lib/jobs/documents";
import { validateQuoteDocument, revisionTarget, QUOTE_DOCUMENT_SELECT } from "@/lib/quotes/quoteDocuments";
import { fileQuoteDocumentsOnJob } from "@/lib/jobs/documentAutofile";
// The stored URL is a Cloudinary PDF this account will not deliver; each file
// opens through /api/files/open on a link minted here, after this route's own
// gate (lib/media/fileOpen.js).
import { withOpenUrls } from "@/lib/media/fileOpen";

async function ownQuote(id, companyId) {
  return db.quote.findFirst({ where: { id, companyId }, select: { id: true, companyId: true } });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see this quote's files");
  if (denied) return denied;

  const quote = await ownQuote(id, member.companyId);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.quoteDocument.findMany({
    where: { companyId: member.companyId, quoteId: quote.id },
    orderBy: { uploadedAt: "desc" },
    select: QUOTE_DOCUMENT_SELECT,
  });
  const canSeeMoney = hasToggle(full, "showPricing");
  const { documents, hiddenCount } = visibleDocuments(rows, { canSeeMoney });
  const job = await db.job.findFirst({ where: { companyId: member.companyId, quoteId: quote.id }, select: { id: true } });
  return NextResponse.json({
    chains: revisionChains(withOpenUrls(member, "quote-document", documents)).map((c) => ({ ...c, current: { ...c.current, pages: undefined, size: formatBytes(c.current.sizeBytes) } })),
    hiddenCount,
    canUpload: hasLevel(full, "quotes", "view_create_edit"),
    canSeeMoney,
    jobId: job?.id || null,
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "add files to this quote");
  if (denied) return denied;

  const quote = await ownQuote(id, member.companyId);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const v = validateQuoteDocument(raw, {
    companyId: member.companyId,
    canSeeMoney: hasToggle(full, "showPricing"),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
  if (!v.ok) return NextResponse.json({ error: v.error, code: v.code }, { status: v.status });
  const rev = await revisionTarget(db, { companyId: member.companyId, supersedesId: raw?.supersedesId, where: { quoteId: quote.id }, kind: v.data.kind });
  if (!rev.ok) return NextResponse.json({ error: rev.error, code: rev.code }, { status: rev.status });

  const created = await db.quoteDocument.create({
    data: { companyId: member.companyId, quoteId: quote.id, ...v.data, supersedesId: rev.id, uploadedById: member.userId || null },
    select: QUOTE_DOCUMENT_SELECT,
  });

  // Already a job? Then the crew gets it now, not at the next approval.
  const job = await db.job.findFirst({ where: { companyId: member.companyId, quoteId: quote.id }, select: { id: true } });
  if (job) await fileQuoteDocumentsOnJob({ quoteId: quote.id, jobId: job.id });

  return NextResponse.json({ document: { ...created, pages: undefined, size: formatBytes(created.sizeBytes) }, carriedToJob: Boolean(job) }, { status: 201 });
}
