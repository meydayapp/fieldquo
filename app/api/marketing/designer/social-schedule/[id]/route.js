// app/api/marketing/designer/social-schedule/[id]/route.js
//
// DELETE — withdraw a SocialPublish row that hasn't fired yet. The calendar
// (app/app/marketing/designer/calendar/page.js) is the only caller: a
// contractor who scheduled the wrong day needs a way back that isn't "wait
// for it to post and then delete it from Instagram by hand."
//
// Cancels, never deletes the row — same reasoning as
// app/api/settings/voice/number/route.js's port-cancel DELETE: the row is
// the only record the request ever existed, and an outward-facing intent
// that got withdrawn is worth keeping in the audit trail, not erasing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  const row = await db.socialPublish.findUnique({ where: { id } });
  if (!row || row.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only a row still waiting can be withdrawn. Anything else already has a
  // real outcome (published, failed, rate-limited) or is mid-flight right
  // now (publishing — the cron has already claimed it and may be talking to
  // Meta this instant; canceling out from under that would race a real
  // network call this route has no way to stop). The atomic
  // status='scheduled' check below is the same claim-guard shape the cron
  // itself uses, for the identical reason: a read here and a write a moment
  // later could otherwise cross the cron's own claim.
  const result = await db.socialPublish.updateMany({
    where: { id, status: "scheduled" },
    data: { status: "canceled", errorMessage: "Canceled by a team member." },
  });

  if (result.count === 0) {
    return NextResponse.json(
      {
        error: "not_cancelable",
        message:
          row.status === "publishing"
            ? "This post is being sent right now and can't be canceled."
            : "This post already has an outcome and can't be canceled.",
        status: row.status,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
