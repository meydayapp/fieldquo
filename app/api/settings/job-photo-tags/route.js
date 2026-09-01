// app/api/settings/job-photo-tags/route.js
//
// A company's own job-photo tags — "sanding", "priming", "top coat", "demo".
// Purely descriptive labels a company defines for itself, layered on top of
// the four built-in stages (lib/gallery/stages.js), which stay the only thing
// that drives before/after pairing and the "issue" privacy boundary. See the
// JobPhotoTag model's own comment in prisma/schema.prisma and
// docs/PHOTO-TAGS.md for the full reasoning.
//
// GET  → every tag this company owns (active AND retired — the settings
//        screen has to show both), plus which starter suggestions it hasn't
//        already taken.
// POST → create one tag, OR accept the starter set ({ action: "adoptStarter" }).
//        Nothing is added unless a person asks for it, same rule
//        prisma/seed-checklists.js states for the checklist library — the
//        starter words here are a code constant rather than a seeded
//        companyId-null row set (see docs/PHOTO-TAGS.md for why: an
//        eight-item list doesn't earn its own shared-library table and seed
//        script, and this repo's migration story is `prisma db push` with no
//        migration files to carry a seed step forward).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  normaliseTagName,
  isValidTagName,
  isDuplicateTagName,
  missingStarterTags,
  sortTags,
} from "@/lib/gallery/tags";

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

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Any member can read the list — tagging a photo in JobPhotoCurator needs
  // it too, and reading a label back isn't the sensitive half of this feature.
  const rows = await db.jobPhotoTag.findMany({
    where: { companyId: member.companyId },
    select: SELECT,
  });
  const tags = sortTags(rows);

  return NextResponse.json({
    tags,
    starterSuggestions: missingStarterTags(tags),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireManage(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));

  // ── Accept the starter set ────────────────────────────────────────────
  if (body.action === "adoptStarter") {
    const existing = await db.jobPhotoTag.findMany({
      where: { companyId: member.companyId },
      select: SELECT,
    });
    const toAdd = missingStarterTags(existing);
    if (!toAdd.length) {
      return NextResponse.json({ added: 0, tags: sortTags(existing) });
    }
    const base = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1);
    await db.jobPhotoTag.createMany({
      data: toAdd.map((s, i) => ({
        companyId: member.companyId,
        name: s.name,
        color: s.color,
        sortOrder: base + 1 + i,
      })),
    });
    const rows = await db.jobPhotoTag.findMany({
      where: { companyId: member.companyId },
      select: SELECT,
    });
    return NextResponse.json({ added: toAdd.length, tags: sortTags(rows) }, { status: 201 });
  }

  // ── Create one tag by hand ─────────────────────────────────────────────
  const name = normaliseTagName(body.name);
  if (!isValidTagName(name)) {
    return NextResponse.json({ error: "Give the tag a name." }, { status: 400 });
  }

  const existing = await db.jobPhotoTag.findMany({
    where: { companyId: member.companyId },
    select: { id: true, name: true, sortOrder: true },
  });
  if (isDuplicateTagName(name, existing)) {
    return NextResponse.json(
      { error: "You already have a tag with that name." },
      { status: 409 },
    );
  }

  const color = typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : null;
  const nextOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1;

  const created = await db.jobPhotoTag.create({
    data: { companyId: member.companyId, name, color, sortOrder: nextOrder },
    select: SELECT,
  });

  return NextResponse.json(created, { status: 201 });
}
