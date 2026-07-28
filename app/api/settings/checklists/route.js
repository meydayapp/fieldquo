// app/api/settings/checklists/route.js
//
// Reusable checklists that get copied onto a job visit.
//
// `JobChecklistTemplate` was in the schema with nothing reading or writing it.
// The consumer is JobVisit.checklistItems — a Json array the job detail page
// already renders. Templates are the source those arrays are stamped from, so
// a crew doesn't retype "mask the counters" on every kitchen.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// Items are stored as objects, not bare strings, because a visit's copy needs
// somewhere to record completion. Keeping the shape identical between template
// and visit means stamping one onto the other is a plain clone.
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const label =
        typeof item === "string" ? item : item?.label || item?.text || "";
      return String(label).trim();
    })
    .filter(Boolean)
    .map((label) => ({ label, done: false }));
}

function requireManage(member) {
  if (!["owner", "admin", "supervisor"].includes(member.role)) {
    const err = new Error(
      "Only owners, admins and supervisors can change checklists.",
    );
    err.status = 403;
    throw err;
  }
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await db.jobChecklistTemplate.findMany({
    where: { companyId: member.companyId },
    include: { category: { select: { id: true, label: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(templates);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requireManage(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { name, items, categoryId } = await request.json().catch(() => ({}));

  if (!String(name || "").trim()) {
    return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  }

  const normalized = normalizeItems(items);
  if (normalized.length === 0) {
    return NextResponse.json(
      { error: "Add at least one item — an empty checklist does nothing." },
      { status: 400 },
    );
  }

  // Guard the FK explicitly: a categoryId belonging to another company would
  // otherwise be accepted and leak the association across tenants. System
  // categories (companyId null, isSystem true) are shared and always allowed —
  // the same rule GET /api/settings/service-categories applies.
  if (categoryId) {
    const allowed = await db.serviceCategory.findFirst({
      where: {
        id: categoryId,
        OR: [{ isSystem: true }, { companyId: member.companyId }],
      },
      select: { id: true },
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "That service category isn't available to your company." },
        { status: 400 },
      );
    }
  }

  const created = await db.jobChecklistTemplate.create({
    data: {
      companyId: member.companyId,
      name: String(name).trim(),
      items: normalized,
      categoryId: categoryId || null,
    },
    include: { category: { select: { id: true, label: true } } },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requireManage(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { id, name, items, categoryId } = await request
    .json()
    .catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await db.jobChecklistTemplate.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.jobChecklistTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(items !== undefined && { items: normalizeItems(items) }),
      ...(categoryId !== undefined && { categoryId: categoryId || null }),
    },
    include: { category: { select: { id: true, label: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requireManage(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await db.jobChecklistTemplate.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Visits hold their own copy of the items, so deleting a template never
  // strips work off a job that's already scheduled.
  await db.jobChecklistTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

function permissionErrorResponse(err) {
  return { body: { error: err.message }, status: err.status || 403 };
}
