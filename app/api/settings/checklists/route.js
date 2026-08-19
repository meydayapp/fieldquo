// app/api/settings/checklists/route.js
//
// Reusable checklists that get copied onto a job visit.
//
// `JobChecklistTemplate` was in the schema with nothing reading or writing it.
// The consumer is JobVisit.checklistItems — a Json array the job detail page
// already renders. Templates are the source those arrays are stamped from, so
// a crew doesn't retype "mask the counters" on every kitchen.
//
// ── System templates ───────────────────────────────────────────────────────
//
// GET also returns the seeded per-trade library (companyId null, `isSystem`
// on the way out) so the job page can OFFER a starter list. They are read
// only through this route: POST/PATCH/DELETE all scope by companyId, so a
// tenant can't edit or delete a row every other tenant sees. Taking one is a
// copy — "Use this" POSTs the items back as the company's own — which is the
// only way an edit to it stays that company's business.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  normalizeChecklistItems,
  normalizePhase,
} from "@/lib/jobs/checklistItems";

// Items are stored as objects, not bare strings, because a visit's copy needs
// somewhere to record completion. Keeping the shape identical between template
// and visit means stamping one onto the other is a plain clone — see
// lib/jobs/checklistItems.js, which owns that shape for every route.
// forcePhase: a template is single-phase, so every item in it takes the
// template's phase — otherwise moving a list from "during" to "post" would
// leave its items claiming the old one.
function normalizeItems(items, phase) {
  return normalizeChecklistItems(items, { phase, forcePhase: true });
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

  const { searchParams } = new URL(request.url);
  // Opt-in, because the settings screen lists what the company owns and the
  // job page wants suggestions too. Defaulting to "include" would put 250-odd
  // seeded rows into the settings list as if the company had written them.
  const includeSystem = searchParams.get("includeSystem") === "1";

  // A free-text search over the WHOLE system library, not just the trades this
  // company switched on.
  //
  // The enabled-trades filter below is right for suggestions — a painter
  // shouldn't scroll past a chimney sweep to find "mask the baseboards". It is
  // wrong for search: a general contractor looking for "rebar" has a real
  // reason to want the concrete list and no reason to have to enable the
  // Concrete trade first to see it exists. Searching is a deliberate act; a
  // suggestion is not.
  const query = String(searchParams.get("q") || "").trim();

  const own = await db.jobChecklistTemplate.findMany({
    where: { companyId: member.companyId },
    include: { category: { select: { id: true, label: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (!includeSystem) return NextResponse.json(own);

  // Only the trades this company actually turned on. The full seeded library
  // is every trade FieldQuo knows about; a painter has no use for scrolling
  // past a chimney sweep's flue-cap check to find "mask the baseboards".
  const enabled = await db.companyServiceCategory.findMany({
    where: { companyId: member.companyId, enabled: true },
    select: { categoryId: true },
  });
  const enabledIds = enabled.map((row) => row.categoryId);

  // With a search term the trade filter is dropped entirely; without one it is
  // the whole point. Two shapes of the same query rather than a conditional
  // spread, so it stays obvious which branch a request took.
  const systemWhere = query
    ? {
        companyId: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { category: { label: { contains: query, mode: "insensitive" } } },
        ],
      }
    : enabledIds.length
      ? { companyId: null, categoryId: { in: enabledIds } }
      : null;

  const system = systemWhere
    ? await db.jobChecklistTemplate.findMany({
        where: systemWhere,
        include: { category: { select: { id: true, label: true } } },
        orderBy: [{ categoryId: "asc" }, { phase: "asc" }],
        // Capped so a one-letter search can't return the entire library and
        // stall a phone rendering 250 rows. The cap is deliberately above the
        // 88-row construction library, so a trade-group search still returns
        // that group whole rather than a truncated slice a user would read as
        // "that's all there is".
        take: query ? 120 : undefined,
      })
    : [];

  return NextResponse.json([
    ...own,
    // Flagged rather than inferred from `companyId === null` at every call
    // site — the flag is what the UI keys "Use this" off, and it should not be
    // possible to forget the null check and offer an Edit button that 404s.
    ...system.map((tpl) => ({ ...tpl, isSystem: true })),
  ]);
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

  const { name, items, categoryId, phase } = await request
    .json()
    .catch(() => ({}));

  if (!String(name || "").trim()) {
    return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  }

  const resolvedPhase = normalizePhase(phase);
  const normalized = normalizeItems(items, resolvedPhase);
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
      phase: resolvedPhase,
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

  const { id, name, items, categoryId, phase } = await request
    .json()
    .catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // companyId in the WHERE is what keeps a system row (companyId null) out of
  // reach — a tenant editing the shared library would rewrite it for everyone.
  const existing = await db.jobChecklistTemplate.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Re-phasing a list re-phases its items, since a visit's copy carries the
  // phase per item. Without this the two disagree the moment someone moves a
  // template from "during" to "post", and the grouping on the job page would
  // show the same list under the wrong heading forever.
  const resolvedPhase =
    phase !== undefined ? normalizePhase(phase) : existing.phase;

  // Rewrite the items whenever EITHER changed — a phase-only edit still has to
  // restamp them, or the stored items keep the old phase and every future
  // visit copies the disagreement forward.
  const rewriteItems = items !== undefined || resolvedPhase !== existing.phase;

  const updated = await db.jobChecklistTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(phase !== undefined && { phase: resolvedPhase }),
      ...(rewriteItems && {
        items: normalizeItems(
          items !== undefined ? items : existing.items,
          resolvedPhase,
        ),
      }),
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
