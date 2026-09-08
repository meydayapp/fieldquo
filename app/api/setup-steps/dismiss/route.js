// app/api/setup-steps/dismiss/route.js
//
// POST { key } — hide one row of the "Additional set-up steps" card by hand.
//
// A dismissal is a preference about the dashboard, not a statement about the
// business (contrast lib/onboarding.js, where "I work alone" and "I have no
// tax number" are facts recorded in Settings beside the field they describe).
// That is why this is allowed to be a button on the card: nothing downstream
// reads the answer, so there is no "why" being lost.
//
// Additive: the stored array is re-read and merged inside the write, keys not
// in the catalogue are dropped (lib/setupSteps.js normaliseDismissed), and
// nothing is ever removed here — a step that later measures done disappears
// on its own, and a dismissed key it no longer needs is harmless.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { SETUP_STEP_KEYS, normaliseDismissed } from "@/lib/setupSteps";

export async function POST(request) {
  // Impersonation is refused before this line runs — getCurrentMember rejects
  // every mutating request under a support session (non-negotiable #2).
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can hide set-up steps." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const key = typeof body?.key === "string" ? body.key : "";
  if (!SETUP_STEP_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown set-up step." }, { status: 400 });
  }

  // Read-merge-write inside one transaction so two dismissals in the same
  // second cannot each write an array missing the other's key.
  const dismissed = await db.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: member.companyId },
      select: { setupStepsDismissed: true },
    });
    if (!company) {
      const err = new Error("Company not found");
      err.status = 404;
      throw err;
    }
    const next = normaliseDismissed([...(company.setupStepsDismissed || []), key]);
    await tx.company.update({
      where: { id: member.companyId },
      data: { setupStepsDismissed: next },
    });
    return next;
  }).catch((err) => {
    if (err?.status === 404) return null;
    throw err;
  });

  if (dismissed === null) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, dismissed });
}
