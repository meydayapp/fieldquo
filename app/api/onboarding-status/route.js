// app/api/onboarding-status/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { getOnboardingStatus } from "@/lib/onboarding";

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
