// app/api/workers/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  loadEnforceableMember,
  canSeeAllPay,
  redactPay,
} from "@/lib/permissions/enforce";
import { db } from "@/lib/db";
import { validateWorkProfile } from "@/lib/team/workProfile";
import { managementChain } from "@/lib/org/reportingLine";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission, can } from "@/lib/permissions";
// Same normaliser the crew inbox matches with, so a number accepted here is a
// number that will actually be recognised on an inbound text.
import { toE164 } from "@/lib/sms/twilioClient";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── One worker's record is payroll too ──────────────────────────────────
  //
  // GET /api/workers already redacts pay rates for a caller whose payroll
  // level is view_own. This route — the same data, one row at a time — handed
  // back hourlyRate AND the payout history to anyone signed in. A list guard
  // that the detail endpoint doesn't share isn't a guard, it's a speed bump:
  // read the ids from the list, fetch them one by one, get everything.
  const full = await loadEnforceableMember(db, member.id);
  const seesPay = canSeeAllPay(full);

  const worker = await db.worker.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    include: {
      // Timesheets stay for everyone who can reach the record: hours worked
      // are scheduling data, and the rate on them is what's sensitive —
      // redactPay strips that from the nested worker below.
      timeEntries: { orderBy: { clockIn: "desc" }, take: 20 },
      // Payouts are what somebody was actually paid. Not fetched at all rather
      // than fetched and dropped, so there is no shaped-payload mistake to
      // make later.
      ...(seesPay
        ? { payouts: { orderBy: { createdAt: "desc" }, take: 10 } }
        : {}),
    },
  });

  if (!worker)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Your own payslips are yours. redactPay keeps your own rate visible for
  // exactly this reason, and hiding the payments while showing the rate would
  // be an odd half-measure — so the own-record case gets its payouts back,
  // with the second query paid only on that branch.
  if (!seesPay && worker.userId && worker.userId === member.userId) {
    worker.payouts = await db.payout.findMany({
      where: { workerId: worker.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  }

  return NextResponse.json(
    redactPay(full, worker, { ownUserId: member.userId }),
  );
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit workers" },
      { status: 403 },
    );
  }

  const existing = await db.worker.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, email, phone, hourlyRate, active, hiredOn, managerId } = body;

  // Only validated when one of the two was actually sent: a PATCH that only
  // renames somebody must not be made to restate their work profile, and
  // defaulting an absent workType to "field" here would quietly move an office
  // worker onto the tools.
  const touchesProfile =
    body.workType !== undefined || body.scheduledHoursPerWeek !== undefined;
  const profile = touchesProfile ? validateWorkProfile(body) : null;
  if (profile && !profile.ok) {
    return NextResponse.json({ error: profile.error }, { status: 400 });
  }

  // ── Mobile, and why it was missing ──────────────────────────────────────
  //
  // Worker.phone is what the crew inbox matches an inbound text against
  // (lib/crew/inbox.js: exact E.164 comparison against the roster). The crew
  // inbox told people to "add your own mobile to your staff profile" — and no
  // screen and no route could. It was writable exactly once, on the invite
  // form, so an owner whose record predates that field read an instruction with
  // nowhere to carry it out, and their own texts went on landing in the
  // "numbers not on your team" pile for ever.
  //
  // Stored as typed rather than as E.164, matching what the invite form writes;
  // toE164 normalises on both sides of the comparison, so "(514) 555-1234" and
  // "+15145551234" are the same roster entry. An unparseable number is refused
  // rather than saved — a phone that will never match is worse than a blank
  // one, because a blank one still shows the "add your mobile" prompt.
  let phoneValue;
  if (phone !== undefined) {
    if (phone === null || String(phone).trim() === "") {
      phoneValue = null;
    } else if (!toE164(phone)) {
      return NextResponse.json(
        {
          error:
            "That doesn't look like a mobile number. It needs the area code — the crew inbox matches it exactly.",
        },
        { status: 400 },
      );
    } else {
      phoneValue = String(phone).trim();
    }
  }

  // Setting someone's pay is payroll. The Workers tab offered a "Pay rate
  // ($/hour)" field to a Manager and the write landed — QA moved a colleague
  // from $25 to $26 and confirmed it stuck. Refused rather than silently
  // dropped, so nobody types a number and believes it saved.
  const full = await loadEnforceableMember(db, member.id);
  if (hourlyRate !== undefined && !canSeeAllPay(full)) {
    return NextResponse.json(
      { error: "You don't have access to pay rates. Ask an owner or admin." },
      { status: 403 },
    );
  }

  // Empty string clears the hire date back to "unknown", which is a real state:
  // it makes leave accrual grant the full allotment instead of pro-rating. An
  // unparseable date is rejected rather than silently stored as the epoch.
  let hiredOnValue;
  if (hiredOn !== undefined) {
    if (hiredOn === null || hiredOn === "") {
      hiredOnValue = null;
    } else {
      const d = new Date(hiredOn);
      if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1950) {
        return NextResponse.json(
          { error: "That start date isn't a valid date." },
          { status: 400 },
        );
      }
      hiredOnValue = d;
    }
  }

  // Who this person reports to. Setting one is a people-management change, not
  // a profile edit, so it needs the same permission as the rest of the team
  // screen.
  let managerValue;
  if (managerId !== undefined) {
    if (!can(member.role, "user:manage")) {
      return NextResponse.json(
        { error: "Only an owner or admin can change who someone reports to." },
        { status: 403 },
      );
    }
    if (managerId === null || managerId === "") {
      managerValue = null;
    } else if (managerId === _params.id) {
      return NextResponse.json(
        { error: "Someone can't report to themselves." },
        { status: 400 },
      );
    } else {
      // Refused, not stored and worked around later. A cycle makes leave
      // requests unroutable, and the walk in lib/org/reportingLine.js survives
      // one only because it is defensive — that guard is a backstop, not a
      // licence to write bad data.
      const org = await db.worker.findMany({
        where: { companyId: member.companyId },
        select: { id: true, managerId: true },
      });
      const proposed = org.map((w) =>
        w.id === _params.id ? { ...w, managerId } : w,
      );
      const { cycle } = managementChain(
        _params.id,
        new Map(proposed.map((w) => [w.id, w])),
      );
      if (cycle) {
        return NextResponse.json(
          {
            error:
              "That would make two people report to each other. Pick someone who doesn't already report to them.",
          },
          { status: 400 },
        );
      }
      const exists = org.some((w) => w.id === managerId);
      if (!exists) {
        return NextResponse.json(
          { error: "That manager isn't on your team." },
          { status: 400 },
        );
      }
      managerValue = managerId;
    }
  }

  // type is intentionally NOT editable here — flipping contractor<->employee has real
  // legal/tax implications and shouldn't be a casual field update. Treat it as
  // "deactivate this worker record, create a new one" if that's genuinely needed.
  const updated = await db.worker.update({
    where: { id: _params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone: phoneValue }),
      ...(hourlyRate !== undefined && { hourlyRate }),
      ...(profile?.ok && body.workType !== undefined && { workType: profile.workType }),
      ...(profile?.ok &&
        body.scheduledHoursPerWeek !== undefined && {
          scheduledHoursPerWeek: profile.scheduledHoursPerWeek,
        }),
      ...(active !== undefined && { active }),
      ...(hiredOn !== undefined && { hiredOn: hiredOnValue }),
      ...(managerId !== undefined && { managerId: managerValue }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can remove workers" },
      { status: 403 },
    );
  }

  const existing = await db.worker.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    include: { payouts: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.payouts.length > 0) {
    // Same principle as everywhere else in this app: don't let a payment history
    // record disappear. Deactivate instead.
    await db.worker.update({
      where: { id: _params.id },
      data: { active: false },
    });
    return NextResponse.json({ success: true, deactivated: true });
  }

  await db.worker.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true, deleted: true });
}
