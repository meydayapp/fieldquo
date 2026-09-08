// app/api/setup-steps/route.js
//
// GET — the dashboard's "Additional set-up steps", measured fresh on every
// read. See lib/setupSteps.js for what each step is and how "done" is decided,
// and lib/setupStepsSnapshot.js for the reads.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { loadSetupSnapshot } from "@/lib/setupStepsSnapshot";
import { stepsFor } from "@/lib/setupSteps";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Owner/admin only — the same `user:manage` gate the settings screens
  // these rows link to enforce on their own PATCH routes (payment schedule,
  // quote email, AI credit, event types). A crew member shown "Enter your
  // overhead" would click through to a NoAccessPanel, which is a control
  // that appears to work and doesn't. Impersonation (read-only, role
  // "viewer") may LOOK, exactly as GET /api/settings/ai/credit allows.
  //
  // Deliberately OUTSIDE the try below: a refusal answered by a catch that
  // returns 500 tells the caller the server broke when it did not, and
  // scripts/check-refusal-shape.mjs refuses that shape everywhere.
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json(
        { error: "Only an owner or admin can see set-up steps." },
        { status: 403 },
      );
    }
  }

  try {
    const snapshot = await loadSetupSnapshot(member.companyId);
    return NextResponse.json({ steps: stepsFor(snapshot) });
  } catch (error) {
    console.error("[setup-steps]", error);
    // A typed refusal keeps its own status; only an unexplained failure is a
    // 500. Nothing here throws a permission error today (the gate is above,
    // outside this try) — this is the shape that keeps it true if a snapshot
    // read ever grows one.
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      {
        error: status === 500 ? "Could not load set-up steps" : error?.message,
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status },
    );
  }
}
