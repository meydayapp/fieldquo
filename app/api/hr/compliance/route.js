// app/api/hr/compliance/route.js — the HR & compliance overview, and the
// roster's "Onboarding 3/7" chips (the team page reads the same payload
// and keys it by userId). Managers only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { loadCompliance } from "@/lib/hr/compliance";

export async function GET(request) {
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const includeInactive = new URL(request.url).searchParams.get("inactive") === "1";
  const rows = await loadCompliance(db, member.companyId, { includeInactive });
  return NextResponse.json({ rows, asOf: new Date().toISOString() });
}
