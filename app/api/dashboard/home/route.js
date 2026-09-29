// app/api/dashboard/home/route.js
//
// The home screen's work panel and "Your focus" section, in one read — see
// lib/dashboard/homeData.js for what is fetched and why each read is gated,
// and lib/dashboard/workPanel.js / focus.js for the rules.
//
// Every member may call it: what comes back is shaped to the caller's grid.
// A tab they may not see is `{ allowed: false }`, never an empty list, and a
// focus fact they may not see is null, never 0. A support session reads what
// the owner reads (non-negotiable #3) and is told `readOnly`, so the screen
// disables the one write this panel offers (the inline chase) — which
// middleware.js and the chase route refuse regardless.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { loadSetupSnapshot } from "@/lib/setupStepsSnapshot";
import { stepsFor } from "@/lib/setupSteps";
import { loadHomeData } from "@/lib/dashboard/homeData";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);

  // The set-up states the focus cards read ("deposits are on", "no website
  // yet") — the same snapshot and the same step rules GET /api/setup-steps
  // serves, so a card and the checklist can never disagree about "done".
  const setup = async () => {
    const snapshot = await loadSetupSnapshot(member.companyId, { readOnly: member.impersonationMode === "read_only" });
    const out = {};
    for (const s of stepsFor(snapshot)) out[s.key] = { done: s.done, applies: s.applies };
    return out;
  };

  const data = await loadHomeData(db, { member, full, now: new Date(), setup });
  return NextResponse.json(data);
}
