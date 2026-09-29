// app/api/platform/errors/like/route.js
//
// "Mark all like this reviewed" on /platform/errors. GET counts the
// unreviewed rows with the same area + code (and, when asked, the same
// detail.attemptId) so the confirm can state the number; PATCH marks them.
// The set, the stamp and the audit row are lib/platform/errorLog.js
// reviewErrorsLike — this route is the gate.
//
// Same permission as the single "Mark reviewed" (company:view: anyone who
// can see that an error is fine may say so, and the row records who).
//
// Refused while the caller holds a live support session ("Sign in as").
// Middleware's read-only gate does not cover /api/platform — it is
// deliberately excluded there so an impersonation cookie can never stand in
// for a platform token — so the refusal is stated here. A bulk write from a
// browser that is, at that moment, inside a customer's account is the kind
// of action a support session exists not to take.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";
import { IMPERSONATION_COOKIE, verifyImpersonationToken } from "@/lib/platform/impersonationToken";
import { countErrorsLike, reviewErrorsLike } from "@/lib/platform/errorLog";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function gate(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { res: bad("Unauthorized", 401) };
  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return { res: bad(err.message, err.status || 403) };
  }
  return { admin };
}

export async function GET(request) {
  const { admin, res } = await gate(request);
  if (!admin) return res;
  const { searchParams } = new URL(request.url);
  const result = await countErrorsLike({
    area: searchParams.get("area"),
    code: searchParams.get("code"),
    attemptId: searchParams.get("attemptId"),
  });
  if (!result.ok) return bad(result.error, result.status || 400);
  return NextResponse.json({ count: result.count, newestAt: result.newestAt, oldestAt: result.oldestAt });
}

export async function PATCH(request) {
  const { admin, res } = await gate(request);
  if (!admin) return res;

  const support = await verifyImpersonationToken(request.cookies.get(IMPERSONATION_COOKIE)?.value);
  if (support) return bad("End the support session (Sign in as) before marking errors reviewed in bulk.", 403);

  const body = await request.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note : "";
  if (containsMarkupCharacters(note)) return bad("The note can't contain < or >");

  const result = await reviewErrorsLike({
    area: body?.area,
    code: body?.code,
    attemptId: typeof body?.attemptId === "string" ? body.attemptId : null,
    before: body?.before,
    note,
    adminId: admin.id,
  });
  if (!result.ok) return bad(result.error, result.status || 400);
  return NextResponse.json({ ok: true, reviewed: true, count: result.count });
}
