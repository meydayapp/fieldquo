// app/api/onboarding-status/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { getOnboardingStatus } from "@/lib/onboarding";

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

// ── There is no POST here, and that is the fix ──────────────────────────────
//
// This file used to export one: `{ dismiss: "tax_registration" }`, re-checking
// the jurisdiction server-side and stamping taxRegistrationDismissedAt. It was
// correct code with no way in. Its only caller was a button in
// OnboardingProgress.js gated on `step.dismissible`, and lib/onboarding.js sets
// that to false on the only step that ever carried the flag — a leftover from
// the design its own comment describes rejecting, where a dismiss button on the
// card lost the "why" that a checkbox in Settings records.
//
// The live path is the checkbox on Settings > Company, saved through PATCH
// /api/settings/business-info, which writes the same column with the same
// permission and an activity-log entry the dismiss endpoint never made. The
// "it's just me — no crew" answer works the same way, from Settings > Team.
// Both steps disappear from `steps` entirely rather than being dismissed, so
// nothing left in the product needs a dismiss endpoint.
