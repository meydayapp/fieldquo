// app/api/platform/sales/attribution/[companyId]/route.js
//
// One company's attribution, read-only: who owns it, which other reps touched
// it, and every correction it has been through. The read side of the
// correction screen next door — a superadmin cannot honestly move an
// attribution without first seeing what they are moving.
//
// "company:view" rather than the superadmin-only correction permission,
// because reading is what the platform console does for everything (see
// non-negotiable #3: the console views everything and edits nothing) and this
// is FieldQuo's own bookkeeping, not a contractor's data.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch {
    return bad("Forbidden", 403);
  }

  const { companyId } = await params;
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!company) return bad("Not found", 404);

  const [attribution, touches, audits] = await Promise.all([
    db.salesAttribution.findUnique({
      where: { companyId },
      include: { salesRep: { select: { id: true, name: true, email: true, code: true } } },
    }),
    db.salesAttributionTouch.findMany({
      where: { companyId },
      orderBy: { at: "desc" },
      include: { salesRep: { select: { id: true, name: true, code: true } } },
    }),
    db.salesAttributionAudit.findMany({ where: { companyId }, orderBy: { at: "desc" } }),
  ]);

  return NextResponse.json({
    company,
    // Null is the ANSWER, not a value that failed to load. A company nobody
    // sold has no attribution, permanently — every company that existed before
    // the sales portal is in exactly this state and none of them is a gap to
    // backfill. Nothing reading this may render it as "pending".
    attribution,
    touches,
    audits,
  });
}
