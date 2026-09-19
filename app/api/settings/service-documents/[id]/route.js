// app/api/settings/service-documents/[id]/route.js
//
//   PATCH   { title?, categoryId?, language?, sortOrder? }
//   DELETE  removes the reference. The file stays where the uploader put it —
//           a guide already sent may still link to it, and a link in a
//           client's inbox that suddenly 404s is worse than an orphan file.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { cleanTitle, cleanLanguage } from "@/lib/prepGuide/serviceDocuments";

async function own(id, companyId) {
  return db.serviceDocument.findFirst({ where: { id, companyId }, select: { id: true, title: true } });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only owners/admins can change settings" }, { status: 403 });
  }
  const row = await own(id, member.companyId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data = {};
  if (body.title !== undefined) {
    const title = cleanTitle(body.title);
    if (!title) return NextResponse.json({ error: "Give the document a title." }, { status: 400 });
    data.title = title;
  }
  if (body.language !== undefined) {
    const language = cleanLanguage(body.language);
    if (language === undefined) return NextResponse.json({ error: "That language isn't supported." }, { status: 400 });
    data.language = language;
  }
  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === "") data.categoryId = null;
    else {
      const category = await db.serviceCategory.findFirst({
        where: { id: String(body.categoryId), OR: [{ isSystem: true }, { companyId: member.companyId }] },
        select: { id: true },
      });
      if (!category) return NextResponse.json({ error: "That service doesn't exist." }, { status: 400 });
      data.categoryId = category.id;
    }
  }
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isInteger(n) || n < 0 || n > 10000) return NextResponse.json({ error: "Bad sort order" }, { status: 400 });
    data.sortOrder = n;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const updated = await db.serviceDocument.update({
    where: { id: row.id },
    data,
    select: { id: true, title: true, url: true, sizeBytes: true, mimeType: true, language: true, sortOrder: true, categoryId: true, category: { select: { label: true, key: true } }, createdAt: true },
  });
  return NextResponse.json({
    ...updated,
    categoryLabel: updated.category?.label || null,
    categoryKey: updated.category?.key || null,
    category: undefined,
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only owners/admins can change settings" }, { status: 403 });
  }
  const row = await own(id, member.companyId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.serviceDocument.delete({ where: { id: row.id } });
  await recordActivity(member, {
    action: "settings.service_document.removed",
    entityType: "company",
    entityId: member.companyId,
    summary: `Technical document "${row.title}" removed from the preparation guide`,
    summaryKey: "app.activity.event.serviceDocumentRemoved",
    summaryParams: { title: row.title },
  });
  return NextResponse.json({ ok: true });
}
