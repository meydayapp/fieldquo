// app/api/platform/sales/attribution/[companyId]/correct/route.js
//
// Capture path #3: a superadmin moves a company's attribution to a different
// rep. The only path in the product that touches an attribution that already
// exists.
//
// Gated on "sales_attribution:correct" — superadmin only, because this is the
// one door that can move money from one person to another. The read side of
// the same screen (what it is now, who else touched it, every correction it
// has had) is the sibling GET one level up.
//
// The write itself — new attribution, losing rep preserved as a touch, and the
// audit row — happens in ONE transaction inside lib/sales/attribution.js, on
// rows re-read there rather than the ones this handler read a moment ago. That
// is the discipline lib/migrations/writes.js established for the only other
// place FieldQuo staff write into tenant-adjacent data, and the reason is the
// same: a permission check here is a cheap first refusal, and the check that
// actually matters is the one that cannot be raced.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { correctSalesAttribution } from "@/lib/sales/attribution";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

const REFUSALS = {
  no_reason: "A correction needs a reason — it's the half of the audit row worth keeping.",
  unknown_rep: "No sales rep matches that.",
  inactive_rep: "That rep is deactivated or has left — reactivate them first.",
  unknown_company: "No such company.",
  self_dealing:
    "A rep can't be attributed to their own company. Their email matches the " +
    "company's, or they're a member of it.",
  already_attributed: "That company is already attributed to that rep — nothing to correct.",
};

export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(admin.role, "sales_attribution:correct");
  } catch {
    return bad("Only a superadmin can correct a company's attribution.", 403);
  }

  const { companyId } = await params;
  const body = await request.json().catch(() => ({}));
  const salesRepId = String(body?.salesRepId || "").trim();
  const reason = String(body?.reason || "");
  if (!salesRepId) return bad("salesRepId is required");

  const result = await correctSalesAttribution({
    companyId,
    salesRepId,
    actorAdminId: admin.id,
    reason,
  });

  if (result.outcome !== "correct") {
    return bad(REFUSALS[result.outcome] || "Couldn't correct that attribution.", 409);
  }

  return NextResponse.json({
    outcome: "correct",
    attribution: result.attribution,
    audit: result.audit,
    // The losing rep's involvement, kept rather than discarded — whichever
    // split/first-touch/last-touch policy the owner picks later needs it.
    touch: result.touch,
  });
}
