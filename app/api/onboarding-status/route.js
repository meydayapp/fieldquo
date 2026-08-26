// app/api/onboarding-status/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { holdsCapability } from "@/lib/permissions/settingsAccess";
import { getOnboardingStatus } from "@/lib/onboarding";
import { taxRegistrationFor } from "@/lib/compliance/taxRegistration";

export async function GET(request) {
  try {
    // Through memberOrRefusal, not getCurrentMember, because of the catch
    // below: it turns anything thrown into a 500, and the three gates inside
    // getCurrentMember throw on purpose. A locked-for-non-payment company
    // asking for its setup checklist got "Could not load onboarding status"
    // with a 500, when the honest answer is 402 and a link to the billing
    // screen.
    const { member, response } = await memberOrRefusal(request);
    if (response) return response;

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
    const { member, response } = await memberOrRefusal(request);
    if (response) return response;

    // The message was true and the gate was not. `user:manage` reaches
    // SUPERVISORS — it means "may run a crew" — so a Dispatcher could dismiss
    // this while being told, in the same file, that only owners and admins
    // could. Of the two, the message is the one worth keeping: the only
    // dismissible step is tax_registration, and "this company has no tax
    // number" is a statement about its legal registration, not a rostering
    // decision. Same set as the activity log and leave policies, through the
    // capability that was named for exactly this and nothing else.
    if (!holdsCapability(member.role, "owner-admin")) {
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
