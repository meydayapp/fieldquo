// app/api/platform/companies/[id]/lifecycle-emails/route.js
//
// READ-ONLY: every lifecycle email FieldQuo has written to (or decided not to
// write to) one company, and when — for the platform console's company page.
// Non-negotiable 3: the console views everything and edits nothing; there is
// no write method here.
//
// Three sources, each the record its own sender keeps, never reconstructed:
//   - LifecycleEmail rows (the trial sequence, lib/lifecycle/) — sent,
//     skipped with the reason, claimed, failed, or a milestone observed;
//   - the Company stamps of the letters that existed before it: the
//     next-steps letter (nextStepsEmailSentAt / nextStepsEmailSkipped), the
//     7/3/1 trial reminders (trialReminder7At / 3At / 1At), the
//     signup-recovery note (signupNudgeSentAt);
//   - the owner's email preferences as they resolve right now.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { preferencesForUser } from "@/lib/email/preferencesStore";
import { LIFECYCLE_KINDS } from "@/lib/lifecycle/plan";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const company = await db.company.findUnique({
    where: { id },
    select: {
      id: true,
      timezone: true,
      createdAt: true,
      trialEndsAt: true,
      nextStepsEmailSentAt: true,
      nextStepsEmailSkipped: true,
      trialReminder7At: true,
      trialReminder3At: true,
      trialReminder1At: true,
      signupNudgeSentAt: true,
    },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [rows, owner] = await Promise.all([
    db.lifecycleEmail.findMany({
      where: { companyId: id },
      select: { kind: true, observedAt: true, claimedAt: true, sentAt: true, failedAt: true, skipped: true, error: true, toAddress: true, language: true, subject: true, createdAt: true },
    }),
    db.member.findFirst({ where: { companyId: id, role: "owner", active: true }, orderBy: { createdAt: "asc" }, select: { userId: true } }),
  ]);
  const prefs = owner?.userId ? await preferencesForUser(owner.userId).catch(() => null) : null;
  const order = new Map(LIFECYCLE_KINDS.map((k, i) => [k, i]));
  rows.sort((a, b) => (order.get(a.kind) ?? 99) - (order.get(b.kind) ?? 99));

  return NextResponse.json({
    company,
    rows,
    kinds: LIFECYCLE_KINDS,
    ownerPreferences: prefs ? { ...prefs.prefs, changedVia: prefs.row?.changedVia || null, changedAt: prefs.row?.changedAt || null } : null,
  });
}
