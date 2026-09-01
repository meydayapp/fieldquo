// app/api/settings/job-photo-tags/[id]/route.js
//
// Rename, recolour, reorder, retire, or reactivate one job-photo tag.
//
// Deliberately no DELETE. Retiring is not deleting — the same rule
// lib/team/workerArchive.js states for a Worker: a tag already applied to 200
// photos must not vanish from them just because a company decides it no
// longer needs that word. `active: false` drops it from the picker offered on
// NEW photos; every existing JobPhotoTagOnPhoto row, and the tag's own name
// and colour, are untouched. Reactivating just flips the flag back — nothing
// is ever recreated, because nothing was ever destroyed.
//
// Next 16: `params` is a Promise and must be awaited before reading `.id`.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { normaliseTagName, isValidTagName, isDuplicateTagName } from "@/lib/gallery/tags";

function requireManage(member) {
  if (!["owner", "admin", "supervisor"].includes(member.role)) {
    const err = new Error("Only owners, admins and supervisors can change job-photo tags.");
    err.status = 403;
    throw err;
  }
}

function permissionErrorResponse(err) {
  return { body: { error: err.message }, status: err.status || 403 };
}

const SELECT = { id: true, name: true, color: true, sortOrder: true, active: true, createdAt: true };

// Scoped by companyId, not just by id — a cuid is unguessable but that isn't
// access control, and this is the only thing standing between one tenant and
// another's tag list.
async function loadOwned(id, companyId) {
  const row = await db.jobPhotoTag.findUnique({ where: { id } });
  if (!row || row.companyId !== companyId) return null;
  return row;
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireManage(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await loadOwned(id, member.companyId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};

  if (body.name !== undefined) {
    const name = normaliseTagName(body.name);
    if (!isValidTagName(name)) {
      return NextResponse.json({ error: "A tag needs a name." }, { status: 400 });
    }
    const siblings = await db.jobPhotoTag.findMany({
      where: { companyId: member.companyId },
      select: { id: true, name: true },
    });
    if (isDuplicateTagName(name, siblings, id)) {
      return NextResponse.json(
        { error: "You already have a tag with that name." },
        { status: 409 },
      );
    }
    data.name = name;
  }

  if (body.color !== undefined) {
    data.color =
      typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : null;
  }

  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "That position isn't a number." }, { status: 400 });
    }
    data.sortOrder = Math.round(n);
  }

  // Retiring / reactivating — see the file header. Never a delete.
  if (body.active !== undefined) data.active = Boolean(body.active);

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const updated = await db.jobPhotoTag.update({ where: { id }, data, select: SELECT });
  return NextResponse.json(updated);
}
