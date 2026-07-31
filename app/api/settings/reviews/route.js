// app/api/settings/reviews/route.js
//
// The review-request settings, and a count of who's waiting.
//
// The count is the honest part. A screen that says "Automatic review requests:
// On" tells you nothing about whether it's working; "3 customers will be asked
// in the next day" is checkable against reality, and its absence is how you
// find out the delay is set to 30 days by accident.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { validReviewUrl, clampDelay, MAX_DELAY_HOURS } from "@/lib/reviews/request";

const HOUR = 60 * 60 * 1000;

const SELECT = {
  reviewUrl: true,
  reviewDelayHours: true,
  reviewRequestsEnabled: true,
};

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: SELECT,
  });

  // Who is currently in the queue, and who was asked recently. Both counts are
  // derived from the same columns the cron reads, so they can't drift from
  // what will actually happen.
  const [waiting, askedRecently] = await Promise.all([
    db.job.count({
      where: {
        companyId: member.companyId,
        status: "completed",
        reviewRequestedAt: null,
        completedAt: {
          not: null,
          gte: new Date(Date.now() - MAX_DELAY_HOURS * HOUR),
        },
        client: { email: { not: null } },
      },
    }),
    db.job.count({
      where: {
        companyId: member.companyId,
        reviewRequestedAt: { gte: new Date(Date.now() - 30 * 24 * HOUR) },
      },
    }),
  ]);

  return NextResponse.json({ ...company, waiting, askedRecently });
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Same gate every other settings route uses. There is no `settings:edit`
  // permission — `user:manage` is the admin role in this codebase.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can change review settings" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const data = {};

  if (body.reviewUrl !== undefined) {
    const url = typeof body.reviewUrl === "string" ? body.reviewUrl.trim() : "";
    if (url && !validReviewUrl(url)) {
      // Refused with a sentence rather than silently stored. A link that
      // doesn't work is only discovered by the customer who clicks it, weeks
      // later, and by then the ask has been spent.
      return NextResponse.json(
        { error: "That doesn't look like a working link. It should start with https://" },
        { status: 400 },
      );
    }
    data.reviewUrl = url || null;
  }

  if (body.reviewDelayHours !== undefined) {
    data.reviewDelayHours = clampDelay(body.reviewDelayHours);
  }

  if (body.reviewRequestsEnabled !== undefined) {
    const on = Boolean(body.reviewRequestsEnabled);
    // Can't switch it on with nowhere to send people. Checked against what's
    // being saved in THIS request first, then what's already stored — so
    // setting the link and the toggle together works, and flipping the toggle
    // alone on an empty link is refused instead of quietly doing nothing.
    if (on) {
      const url = data.reviewUrl !== undefined
        ? data.reviewUrl
        : (await db.company.findUnique({
            where: { id: member.companyId },
            select: { reviewUrl: true },
          }))?.reviewUrl;
      if (!validReviewUrl(url)) {
        return NextResponse.json(
          { error: "Add the link where customers should leave a review first." },
          { status: 400 },
        );
      }
    }
    data.reviewRequestsEnabled = on;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const company = await db.company.update({
    where: { id: member.companyId },
    data,
    select: SELECT,
  });

  await recordActivity(member, {
    action: "settings.reviews.updated",
    entityType: "company",
    entityId: member.companyId,
    summary: data.reviewRequestsEnabled === false
      ? "Turned off automatic review requests"
      : "Updated review request settings",
    metadata: data,
  });

  return NextResponse.json(company);
}
