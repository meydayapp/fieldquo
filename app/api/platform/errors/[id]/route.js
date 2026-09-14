// app/api/platform/errors/[id]/route.js
//
// PATCH — one error row: `{ reviewed: true|false, note?: string }`. The
// per-row "Mark reviewed" / "Unmark" buttons on /platform/errors call this;
// the checkbox batch calls the collection route. Same gate, same helper
// (lib/platform/errorLog.js reviewErrors), same audit row — this exists so a
// single click does not have to be phrased as a one-element batch.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";
import { reviewErrors } from "@/lib/platform/errorLog";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function PATCH(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return bad(err.message, err.status || 403);
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reviewed = body?.reviewed !== false;
  const note = typeof body?.note === "string" ? body.note : "";
  if (containsMarkupCharacters(note)) return bad("The note can't contain < or >");

  const result = await reviewErrors({ ids: [id], reviewed, note, adminId: admin.id });
  if (!result.ok) return bad(result.error, result.status || 400);
  if (result.count === 0) return bad("Not found", 404);
  return NextResponse.json({ ok: true, reviewed: result.reviewed });
}
