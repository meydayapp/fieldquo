// app/api/ai-employee/safety/route.js
//
// GET → the company's safety & escalation switches (merged with the owner's
//       defaults), the team members who can be put on call, and the
//       sentence-by-sentence truth about whether an urgent text would go out
//       right now — and why not.
// PUT { …only the fields to change } → one save, refused by name on a bad
//       value (lib/aiEmployee/companySettings.js planSafetySave).
//
// Owner/admin only, the same rung as the rest of the AI employee's setup.
// Read-only support may LOOK (non-negotiable #3: the console views
// everything and edits nothing); a support session's PUT is refused before
// this route by the impersonation gate, and again here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { balanceFor } from "@/lib/voice/credits";
import { systemSmsNumber } from "@/lib/sms/systemNumber";
import { loadCompanySettings, planSafetySave, SAFETY_FIELDS } from "@/lib/aiEmployee/companySettings";
import { buildLadder, onCallNow, deliveryProblems, alertSmsBody, alertTextCents, ALERT_TEXT_FLOOR_CENTS } from "@/lib/aiEmployee/onCall";
import { companyMembers } from "@/lib/aiEmployee/urgentAlerts";
import { withinBusinessHours } from "@/lib/aiEmployee/decide";
import { URGENT_CATEGORIES } from "@/lib/aiEmployee/triage";
import { VETTED_FIRST_STEPS } from "@/lib/aiEmployee/knowledge/firstSteps";

async function admin(request, { allowSupportToLook = false } = {}) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  if (allowSupportToLook && member.impersonation) return { member };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { response: NextResponse.json({ error: "Only an owner or admin can set up the AI employee." }, { status: 403 }) };
  }
  if (member.impersonation) {
    return { response: NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 }) };
  }
  return { member };
}

/** Everything the screen shows, computed from the same functions the
 *  escalation itself runs — so the screen cannot promise what won't happen. */
async function snapshot(companyId) {
  const [settings, members, company, balanceCents, smsNumber, alerts] = await Promise.all([
    loadCompanySettings(db, companyId),
    companyMembers(db, companyId),
    db.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, phone: true, timezone: true, businessHours: true, defaultLanguage: true } }),
    balanceFor(companyId).catch(() => 0),
    systemSmsNumber().catch(() => null),
    db.urgentAlert.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, tier: true, category: true, status: true, reason: true, createdAt: true, acknowledgedAt: true, threadId: true },
    }),
  ]);
  const { ladder, skipped } = buildLadder(settings, members);
  const onCall = onCallNow({ settings, businessHoursOpen: withinBusinessHours(company), timezone: company?.timezone || "America/Toronto" });
  const sample = alertSmsBody({ companyName: company?.name, tier: "urgent", category: "water", customerName: "Jane D.", summary: "Water is coming through the kitchen ceiling", link: "https://app.fieldquo.com/app/urgent/…", language: company?.defaultLanguage || "en" });
  return {
    settings,
    defaultsOnly: !settings.saved,
    categories: URGENT_CATEGORIES,
    steps: VETTED_FIRST_STEPS.map((s) => ({ id: s.id, category: s.category, text: s.text, source: s.source })),
    members: members.map((m) => ({ id: m.id, name: m.name, hasPhone: Boolean(buildLadder({ onCallMemberIds: [m.id] }, [m]).ladder.length) })),
    ladder: ladder.map((p) => ({ memberId: p.memberId, name: p.name, phoneTail: p.phone.slice(-4) })),
    onCall,
    problems: deliveryProblems({ settings, ladder, skipped, balanceCents, smsNumber: Boolean(smsNumber), onCall }),
    companyPhone: company?.phone || null,
    pricing: { perTextCents: alertTextCents(sample), floorCents: ALERT_TEXT_FLOOR_CENTS, balanceCents },
    recentAlerts: alerts,
  };
}

export async function GET(request) {
  const { member, response } = await admin(request, { allowSupportToLook: true });
  if (response) return response;
  return NextResponse.json(await snapshot(member.companyId));
}

export async function PUT(request) {
  const { member, response } = await admin(request);
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const [current, members] = await Promise.all([loadCompanySettings(db, member.companyId), companyMembers(db, member.companyId)]);
  const plan = planSafetySave({ current, body, memberIds: members.map((m) => m.id) });
  if (!plan.ok) return NextResponse.json({ error: plan.error, reason: plan.reason, field: plan.field || null }, { status: plan.status });

  // Created with the merged current values on the first save, so a single
  // switch never resets the others to the column defaults.
  const base = Object.fromEntries(SAFETY_FIELDS.map((f) => [f, current[f]]));
  await db.aiEmployeeCompanySettings.upsert({
    where: { companyId: member.companyId },
    create: { companyId: member.companyId, ...base, ...plan.data, updatedByUserId: member.userId || null },
    update: { ...plan.data, updatedByUserId: member.userId || null },
  });

  await recordActivity(member, {
    action: "ai_employee.safety_changed",
    entityType: "settings",
    entityId: member.companyId,
    summary: `AI team safety settings changed: ${plan.fields.join(", ")}`,
    summaryKey: "app.activity.event.aiEmployee.safetyChanged",
    summaryParams: { fields: plan.fields.join(", ") },
  }).catch(() => {});

  return NextResponse.json(await snapshot(member.companyId));
}
