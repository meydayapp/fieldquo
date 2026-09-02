// app/api/platform/companies/[id]/dispute-evidence/route.js
//
// The evidence FieldQuo can put in front of a card network when a contractor
// charges back their subscription — assembled, never submitted.
//
// Superadmin only. `billing:manage` is in SUPERADMIN_ONLY_PERMISSIONS
// (lib/platform/permissions.js) because it names FieldQuo's billing
// relationship with a customer, and this is that relationship at its sharpest:
// the response is a dated dossier of one company's activity, including who
// signed in and when. "support" and "admin" do not get it.
//
// Read-only. Nothing here writes to a tenant, and nothing here talks to Stripe
// — deciding whether to contest, and typing the evidence into Stripe, is a
// human's job. See lib/billing/disputeEvidence.js for why that line is drawn
// there.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { loadDisputeEvidence } from "@/lib/billing/loadDisputeEvidence";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "billing:manage");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const evidence = await loadDisputeEvidence(id);
  if (!evidence) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(evidence);
}
