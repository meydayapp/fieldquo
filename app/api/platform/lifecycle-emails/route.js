// app/api/platform/lifecycle-emails/route.js
//
// The trial sequence's two platform-owned inputs (lib/lifecycle/settings.js):
// who the personal day-3 note is from, and the customer stories the day-5
// letter may show. Read by every platform admin; written by a superadmin,
// audit-logged with before and after — the floor-settings route's split, for
// the same reason: the name goes on an email to every new customer.
//
// The GET says plainly whether the personal note is going out at all
// (`personalReady`), and how many of each lifecycle letter have been sent,
// counted off the LifecycleEmail rows the cron writes — never estimated.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { loadLifecycleSettings, savePersonalSender, saveStories } from "@/lib/lifecycle/settingsStore";
import { personalSenderReady, STORY_TRADES, STORIES_MAX, validatePersonalSender, validateStories } from "@/lib/lifecycle/settings";
import { LIFECYCLE_KINDS } from "@/lib/lifecycle/plan";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function payload() {
  const settings = await loadLifecycleSettings();
  let sentByKind = null;
  try {
    const grouped = await db.lifecycleEmail.groupBy({ by: ["kind"], where: { sentAt: { not: null } }, _count: { _all: true } });
    sentByKind = Object.fromEntries(LIFECYCLE_KINDS.map((k) => [k, grouped.find((g) => g.kind === k)?._count?._all || 0]));
  } catch {
    // Unknown, not zero.
    sentByKind = null;
  }
  return {
    personalSender: settings.personalSender,
    personalReady: personalSenderReady(settings.personalSender),
    stories: settings.stories,
    storyTrades: STORY_TRADES,
    storiesMax: STORIES_MAX,
    sentByKind,
  };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  return NextResponse.json(await payload());
}

export async function PUT(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Expected an object.");
  if (body.personalSender === undefined && body.stories === undefined) return bad("Nothing to change.");

  const before = await loadLifecycleSettings();
  if (body.personalSender !== undefined) {
    const checked = validatePersonalSender(body.personalSender);
    if (!checked.ok) return bad(checked.error);
    await savePersonalSender(checked.value);
  }
  if (body.stories !== undefined) {
    const checked = validateStories({ stories: body.stories });
    if (!checked.ok) return bad(checked.error);
    await saveStories(checked.value);
  }
  const after = await loadLifecycleSettings();
  await db.platformAuditLog.create({
    data: { platformAdminId: admin.id, action: "lifecycle_email_settings_updated", details: { before, after } },
  });
  return NextResponse.json(await payload());
}
