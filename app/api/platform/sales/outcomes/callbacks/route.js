// app/api/platform/sales/outcomes/callbacks/route.js
//
// Every open callback on the floor — due today, overdue, per rep — from
// lib/sales/calls/callbackAgenda.js. Superadmin, reads only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { listCallbackAgenda, OVERDUE_FLAG_MS } from "@/lib/sales/calls/callbackAgenda";
import { outcomeSettingValues } from "@/lib/sales/calls/outcomeSettingsStore";

export async function GET(request) {
  const { refusal } = await requireSuperadmin(request, "see the callback agenda");
  if (refusal) return refusal;
  const now = new Date();
  const [list, settings] = await Promise.all([listCallbackAgenda({ now }), outcomeSettingValues()]);
  return NextResponse.json({
    ...list,
    graceMinutes: settings["sales.callback.graceMinutes"],
    maxOpenPerRep: settings["sales.callback.maxOpenPerRep"],
    maxDaysAhead: settings["sales.callback.maxDaysAhead"],
    flagAfterHours: OVERDUE_FLAG_MS / 3600000,
    serverNow: now.toISOString(),
  });
}
