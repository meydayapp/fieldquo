// app/api/platform/manuals/route.js
//
// FieldQuo's shared manual library (lib/aiEmployee/sharedLibrary.js), as
// /platform/manuals manages it.
//
//   GET  → every library manual — live, pending a review, retired,
//          withdrawn — with who shared it and how many companies have their
//          AI team reading the library at all.
//   POST { file: { url, filename, mimeType, bytes }, title, tags } → a PDF
//          FieldQuo uploaded (../upload/sign → Cloudinary → ../upload/verify),
//          read page by page with the same reader a company's reference
//          library uses, deduplicated by SHA-256, live at once.
//
// This is FieldQuo's own table — the manufacturer's document every company
// reads as a read-only default — not a company's record; nothing here reads
// or writes a company's AiEmployeeSource. Every write is on the platform
// audit log.
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission, canPlatform } from "@/lib/platform/permissions";
import { referenceKindFor, isOwnReferenceUrl, readReferenceFile, cleanTags, sha256, REFERENCE_FOLDER } from "@/lib/aiEmployee/reference";
import { fetchOwnPrivateFile } from "@/lib/planRead/ingest";
import { PLAN_DOCUMENT_MAX_BYTES } from "@/lib/media/validate";
import { SHARED_LIBRARY_SCOPE, platformView } from "@/lib/aiEmployee/sharedLibrary";

const LIST_SELECT = {
  id: true, title: true, brand: true, modelPattern: true, category: true, trade: true, origin: true, status: true,
  pageCount: true, pagesRead: true, bytes: true, originalFilename: true, sharedByCompanyId: true, failureReason: true,
  createdAt: true, reviewedAt: true,
};

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.sharedManual.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 500, select: LIST_SELECT });
  const companyIds = [...new Set(rows.map((r) => r.sharedByCompanyId).filter(Boolean))];
  const [companies, readers] = await Promise.all([
    companyIds.length ? db.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : [],
    // Companies that switched the library OFF; everyone else reads it.
    db.aiEmployeeCompanySettings.count({ where: { useSharedManuals: false } }),
  ]);
  const nameOf = new Map(companies.map((c) => [c.id, c.name]));
  return NextResponse.json({
    manuals: rows.map((r) => platformView(r, { companyName: r.sharedByCompanyId ? nameOf.get(r.sharedByCompanyId) || null : null })),
    companiesOptedOut: readers,
    canManage: canPlatform(admin.role, "manual_library:manage"),
  });
}

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "manual_library:manage");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const body = await request.json().catch(() => ({}));
  const file = body?.file && typeof body.file === "object" ? body.file : {};
  const url = typeof file.url === "string" ? file.url : "";
  const filename = typeof file.filename === "string" ? file.filename.slice(0, 200) : null;
  const mimeType = typeof file.mimeType === "string" ? file.mimeType.slice(0, 120) : null;
  // PDFs only: the library is page-cited manuals, and a code spreadsheet is
  // a company's own (it has no pages to cite).
  if (referenceKindFor(mimeType, filename || url) !== "pdf" || !isOwnReferenceUrl(url, { companyId: SHARED_LIBRARY_SCOPE })) {
    return NextResponse.json({ error: "Upload a PDF through the library's own uploader first." }, { status: 400 });
  }
  const tags = cleanTags(body?.tags || {});
  if (!tags.brand) return NextResponse.json({ error: "Tag the brand — an untagged manual can't be matched to anybody's equipment.", field: "brand" }, { status: 400 });
  const title = (String(body?.title || "").trim() || filename || "Manual").slice(0, 200);

  const configured = Boolean(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const fetched = await fetchOwnPrivateFile(url, {
    companyId: SHARED_LIBRARY_SCOPE,
    folder: REFERENCE_FOLDER,
    maxBytes: PLAN_DOCUMENT_MAX_BYTES,
    sign: configured ? (publicId, format, options) => cloudinary.utils.private_download_url(publicId, format, options) : null,
  });
  if (!fetched.ok) return NextResponse.json({ error: "The file couldn't be read back from storage.", reason: fetched.reason }, { status: 502 });

  const fileHash = sha256(fetched.buffer);
  const existing = await db.sharedManual.findUnique({ where: { fileHash }, select: LIST_SELECT });
  if (existing) {
    // Deduplicated: the library already holds this exact file (FieldQuo's,
    // or a company's share). Nothing is stored twice.
    return NextResponse.json({ manual: platformView(existing), duplicate: true }, { status: 200 });
  }

  const read = await readReferenceFile(fetched.buffer, "pdf");
  const base = {
    fileHash,
    title,
    ...tags,
    originalFilename: filename,
    bytes: Math.max(0, Math.min(2_000_000_000, Math.round(Number(file.bytes) || fetched.buffer.length || 0))),
    storageKey: url,
    origin: "platform",
    reviewedAt: new Date(),
    reviewedByAdminId: admin.id,
  };
  let row;
  if (!read.ok) {
    row = await db.sharedManual.create({ data: { ...base, status: "failed", failureReason: read.reason }, select: LIST_SELECT });
  } else {
    const { summary } = read;
    row = await db.$transaction(async (tx) => {
      const created = await tx.sharedManual.create({
        data: {
          ...base,
          // A manual with no readable page is not "live" — there is nothing
          // in it a reply could use. Stored as failed, with the reason.
          status: summary.pagesRead > 0 ? "live" : "failed",
          failureReason: summary.pagesRead > 0 ? null : summary.failureReason || "app.aiEmployee.source.failed.pdfScanned",
          pageCount: summary.pageCount,
          pagesRead: summary.pagesRead,
          unreadPages: summary.unreadPages,
        },
        select: LIST_SELECT,
      });
      await tx.sharedManualPage.createMany({ data: read.pages.map((p) => ({ manualId: created.id, page: p.page, text: p.text, method: p.method })) });
      return created;
    }, { timeout: 60_000 });
  }

  await db.platformAuditLog.create({
    data: { platformAdminId: admin.id, action: "manual_uploaded", details: { manualId: row.id, title: row.title, brand: row.brand, status: row.status } },
  }).catch(() => {});

  return NextResponse.json({ manual: platformView(row) }, { status: 201 });
}
