// app/api/onboarding-status/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { getOnboardingStatus } from "@/lib/onboarding";
import { taxRegistrationFor } from "@/lib/compliance/taxRegistration";

export async function GET(request) {
  try {
    const member = await getCurrentMember(request);
    if (!member) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          reason: "No active company membership could be resolved",
        },
        { status: 401 },
      );
    }

    const status = await getOnboardingStatus(member.companyId);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[onboarding-status]", error);
    return NextResponse.json(
      {
        error: "Could not load onboarding status",
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * Dismiss an onboarding step.
 *
 * Body: { dismiss: "tax_registration" }
 *
 * Only one step is dismissible today, and the server decides whether it may be
 * — not the browser. `taxRegistrationFor()` is consulted again here rather than
 * trusting a flag that came back from GET: in Canada, the UK and the EU the
 * registration number is what lets the client claim the tax back, and a
 * contractor should not be able to make that ask disappear by posting to an
 * endpoint. Where the jurisdiction genuinely makes it optional (or where a
 * mandatory e-invoicing regime means FieldQuo can't deliver it anyway), the
 * dismissal sticks.
 *
 * Returns the recomputed status so the caller re-renders from the server's
 * view of things instead of guessing what changed.
 */
export async function POST(request) {
  try {
    const member = await getCurrentMember(request);
    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json(
        { error: "Only owners and admins can change setup steps" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body?.dismiss !== "tax_registration") {
      return NextResponse.json(
        { error: "That step can't be dismissed" },
        { status: 400 },
      );
    }

    const company = await db.company.findUnique({
      where: { id: member.companyId },
      select: { country: true, taxIdNumber: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (!taxRegistrationFor(company.country).dismissible) {
      return NextResponse.json(
        {
          error:
            "A registration number is expected on invoices in this country, so this step stays.",
        },
        { status: 409 },
      );
    }

    await db.company.update({
      where: { id: member.companyId },
      data: { taxRegistrationDismissedAt: new Date() },
    });

    return NextResponse.json(await getOnboardingStatus(member.companyId));
  } catch (error) {
    console.error("[onboarding-status] dismiss", error);
    return NextResponse.json(
      {
        error: "Could not update that setup step",
        details:
          process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 },
    );
  }
}
