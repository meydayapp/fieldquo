// app/api/platform/errors/route.js
//
// The failures support needs to see. GET lists unreviewed errors (newest
// first); PATCH marks a batch reviewed — or unmarks it — so the list stays a
// to-do rather than an archive. The single-row form is
// app/api/platform/errors/[id]/route.js; both call the same
// lib/platform/errorLog.js reviewErrors().
//
// Filterable by area and company. `?resolved=1` shows the reviewed archive.
// Every count this route returns is of UNREVIEWED rows (`unresolvedCount`,
// the area chips) except `reviewedCount`, which is the size of the archive
// behind the "Show reviewed" toggle. The owner's complaint was seeing fixed
// errors for ever; a badge that kept counting them would be the same bug.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";
import { reviewErrors } from "@/lib/platform/errorLog";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area");
  const companyId = searchParams.get("companyId");
  const resolved = searchParams.get("resolved") === "1";
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 100));

  const filters = {
    ...(area ? { area } : {}),
    ...(companyId ? { companyId } : {}),
  };
  const where = {
    ...filters,
    ...(resolved ? { NOT: { resolvedAt: null } } : { resolvedAt: null }),
  };

  const [errors, areas, unresolvedCount, reviewedCount] = await Promise.all([
    db.platformErrorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    // Only areas that actually have unreviewed errors — a filter listing areas
    // with nothing in them is noise.
    db.platformErrorLog.groupBy({
      by: ["area"],
      where: { resolvedAt: null },
      _count: true,
    }),
    db.platformErrorLog.count({ where: { resolvedAt: null } }),
    // Under the same area/company filter as the list, so "Show reviewed (N)"
    // is the N the toggle will actually show.
    db.platformErrorLog.count({ where: { ...filters, NOT: { resolvedAt: null } } }),
  ]);

  // Who reviewed each row, as an email. `resolvedBy` holds a PlatformAdmin id
  // (older rows held an email or the literal "platform"); anything that is
  // not a known admin id is shown as written rather than dropped — "reviewed
  // by platform" is still more honest than "reviewed".
  const reviewerIds = [...new Set(errors.map((e) => e.resolvedBy).filter(Boolean))];
  const reviewers = reviewerIds.length
    ? await db.platformAdmin.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, email: true },
      })
    : [];
  const reviewerById = new Map(reviewers.map((a) => [a.id, a.email]));

  // Company names for the rows that have one, resolved in a single query.
  //
  // ── And the owner's email, because two companies share a name ────────────
  //
  // "Precision Painting" is not a rare name, and support reading this list had
  // no way to tell one from the other without opening both. The owner is the
  // Member with role "owner", oldest first — the same definition
  // lib/email/companySender.js's ownerEmailFor() and /platform/signups already
  // use, rather than a sixth answer to "who owns this company". A company with
  // no owner-role member resolves to null and prints nothing: there is no
  // second-best address to fall back to, and inventing one (the first member,
  // say) would put a labourer's inbox beside the company name.
  const companyIds = [...new Set(errors.map((e) => e.companyId).filter(Boolean))];
  const companies = companyIds.length
    ? await db.company.findMany({
        where: { id: { in: companyIds } },
        select: {
          id: true,
          name: true,
          members: {
            where: { role: "owner" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { user: { select: { email: true } } },
          },
        },
      })
    : [];
  const byId = new Map(companies.map((c) => [c.id, c]));

  return NextResponse.json({
    unresolvedCount,
    reviewedCount,
    areas: areas.map((a) => ({ area: a.area, count: a._count })),
    errors: errors.map((e) => {
      const company = e.companyId ? byId.get(e.companyId) : null;
      return {
        ...e,
        resolvedByEmail: e.resolvedBy ? reviewerById.get(e.resolvedBy) || e.resolvedBy : null,
        companyName: company?.name || null,
        // Null means "no owner-role member", not "no email" — the screen says
        // nothing rather than printing a blank beside the name.
        companyOwnerEmail: company?.members?.[0]?.user?.email || null,
      };
    }),
  });
}

// Mark a batch reviewed, or unmark it. `{ ids: [...], reviewed?: true|false,
// note?: string }` — `reviewed` defaults to true so the older `{ ids }` body
// still means what it meant. Gated on company:view, the same permission as
// reading the queue: anyone who can see that an error is fine may say so, and
// the row records who did. The bulk cap and the audit row live in
// reviewErrors().
export async function PATCH(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  const reviewed = body?.reviewed !== false;
  const note = typeof body?.note === "string" ? body.note : "";
  // The note lands on the console and in the audit log; `<`/`>` have no
  // business in it (lib/security/rejectMarkupCharacters.js).
  if (containsMarkupCharacters(note)) {
    return NextResponse.json({ error: "The note can't contain < or >" }, { status: 400 });
  }

  const result = await reviewErrors({ ids, reviewed, note, adminId: admin.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ ok: true, reviewed: result.reviewed, count: result.count });
}
