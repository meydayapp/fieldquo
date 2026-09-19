// app/api/settings/service-documents/route.js
//
// The technical documents a company attaches to its preparation guides —
// "Renner Italia technical data sheet", the flooring maker's care card.
//
//   GET   [{ id, title, url, categoryId, categoryLabel, language, sizeBytes, sortOrder }]
//   POST  { title, url, publicId?, sizeBytes?, mimeType?, categoryId?, language? }
//
// The file itself goes through the signed uploader (/api/upload) first; this
// route stores the reference and refuses any url that is not on this
// deployment's own cloud (isUploadedUrl — the same rule as a job document,
// for the same reason: it is a link the company signs and a client opens).
// categoryId null = every guide this company sends; set = only guides for
// jobs that include that trade. language null = every language.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isUploadedUrl, normaliseSizeBytes } from "@/lib/jobs/documents";
import { recordActivity } from "@/lib/activity/log";
import { cleanTitle, cleanLanguage } from "@/lib/prepGuide/serviceDocuments";

const SELECT = {
  id: true,
  title: true,
  url: true,
  publicId: true,
  sizeBytes: true,
  mimeType: true,
  language: true,
  sortOrder: true,
  categoryId: true,
  category: { select: { label: true, key: true } },
  createdAt: true,
};

const shape = (row) => ({
  id: row.id,
  title: row.title,
  url: row.url,
  sizeBytes: row.sizeBytes,
  mimeType: row.mimeType,
  language: row.language,
  sortOrder: row.sortOrder,
  categoryId: row.categoryId,
  categoryLabel: row.category?.label || null,
  categoryKey: row.category?.key || null,
  createdAt: row.createdAt,
});

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const rows = await db.serviceDocument.findMany({
    where: { companyId: member.companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: SELECT,
  });
  return NextResponse.json(rows.map(shape));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only owners/admins can change settings" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const title = cleanTitle(body?.title);
  if (!title) return NextResponse.json({ error: "Give the document a title." }, { status: 400 });

  if (!isUploadedUrl(body?.url, { cloudName: process.env.CLOUDINARY_CLOUD_NAME })) {
    return NextResponse.json(
      { error: "Upload the file first; only files uploaded through FieldQuo can be attached." },
      { status: 400 },
    );
  }

  const language = cleanLanguage(body?.language);
  if (language === undefined) return NextResponse.json({ error: "That language isn't supported." }, { status: 400 });

  let categoryId = null;
  if (body?.categoryId) {
    const category = await db.serviceCategory.findFirst({
      where: { id: String(body.categoryId), OR: [{ isSystem: true }, { companyId: member.companyId }] },
      select: { id: true },
    });
    if (!category) return NextResponse.json({ error: "That service doesn't exist." }, { status: 400 });
    categoryId = category.id;
  }

  const last = await db.serviceDocument.findFirst({
    where: { companyId: member.companyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const row = await db.serviceDocument.create({
    data: {
      companyId: member.companyId,
      categoryId,
      title,
      url: body.url,
      publicId: typeof body.publicId === "string" && body.publicId ? body.publicId.slice(0, 300) : null,
      sizeBytes: normaliseSizeBytes(body.sizeBytes),
      mimeType: typeof body.mimeType === "string" && body.mimeType ? body.mimeType.slice(0, 100) : "application/pdf",
      language,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    select: SELECT,
  });

  await recordActivity(member, {
    action: "settings.service_document.added",
    entityType: "company",
    entityId: member.companyId,
    summary: `Technical document "${title}" attached to the preparation guide`,
    summaryKey: "app.activity.event.serviceDocumentAdded",
    summaryParams: { title },
  });

  return NextResponse.json(shape(row), { status: 201 });
}
