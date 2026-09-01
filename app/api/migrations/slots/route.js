// app/api/migrations/slots/route.js
//
// The bookable times for a migration consultation — the same union-of-hosts
// picker shape lib/demo/slots.js already built for the marketing site's demo
// booking, reused rather than re-invented (see lib/migrations/hosts.js).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { loadMigrationHosts } from "@/lib/migrations/hosts";
import { availableSlotsByDay } from "@/lib/demo/slots";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can book a migration consultation." },
      { status: 403 },
    );
  }

  const hosts = await loadMigrationHosts();
  return NextResponse.json({ days: availableSlotsByDay(hosts) });
}
