// app/api/ai-employee/disclosure/route.js
//
// PUT { aiDisclosure: true | false | null } — the company-wide "Tell clients
// it's an AI assistant" switch on Settings › AI employee. null hands the
// choice back to the location default (lib/aiEmployee/disclosure.js), which
// is on only where a law requires the announcement.
//
// Owner/admin only, the same rung as the rest of the AI employee's setup:
// this decides what the first line to every customer says. Not waved through
// for a support session — non-negotiable #3, the console edits nothing. Every
// change writes an activity row naming who made it, because switching the
// announcement off where a law expects it is a decision somebody owns.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { disclosureFor, DISCLOSURE_COMPANY_SELECT } from "@/lib/aiEmployee/disclosure";

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can set up the AI employee." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const value = body?.aiDisclosure;
  if (!(value === true || value === false || value === null)) {
    return NextResponse.json({ error: "Say on, off, or the default.", reason: "bad_value" }, { status: 400 });
  }

  const before = await db.company.findUnique({ where: { id: member.companyId }, select: DISCLOSURE_COMPANY_SELECT });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const saved = await db.company.update({
    where: { id: member.companyId },
    data: { aiDisclosure: value },
    select: DISCLOSURE_COMPANY_SELECT,
  });
  const disclosure = disclosureFor(saved);

  if (disclosureFor(before).on !== disclosure.on || before.aiDisclosure !== value) {
    const state = value === null ? `default (${disclosure.on ? "on" : "off"})` : value ? "on" : "off";
    await recordActivity(member, {
      action: "ai_employee.disclosure_changed",
      entityType: "settings",
      entityId: member.companyId,
      summary: `Telling clients it's an AI: ${state}${disclosure.required && !disclosure.on ? " (the law here expects it on)" : ""}`,
      summaryKey: "app.activity.event.aiEmployee.disclosureChanged",
      summaryParams: { state },
    }).catch(() => {});
  }

  return NextResponse.json({ disclosure });
}
