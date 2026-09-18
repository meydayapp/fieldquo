// app/api/time-clock/enrol/route.js
//
// "Set yourself up to clock in": the caller creates THEIR OWN Worker row.
//
// The owner opened /app/clock and was told to ask an admin. They are the
// admin. lib/timeclock/selfEnrol.js holds who may do this (the same
// authority that adds anybody under Team → Workers) and why it costs no seat;
// this route reads the database, hands the verdict function what it found,
// and creates the row through lib/team/ensureWorker.js — the path invite
// acceptance and the members list already use, so a Worker made here is the
// same shape as one made anywhere else: linked by userId, named from the
// user, type "employee", NO pay rate. It also reattaches a hand-entered row
// with the same email rather than making a duplicate person on the payroll.
//
// The subject is always the session's own user. No id is read from the body:
// a route that took one would be the Workers screen's create, which exists
// and has its own gate.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { ensureWorkerForMember } from "@/lib/team/ensureWorker";
import { selfEnrolVerdict } from "@/lib/timeclock/selfEnrol";
import { recordActivity } from "@/lib/activity/log";

const WORKER_SELECT = { id: true, name: true, hourlyRate: true, userId: true, companyId: true };

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Read fresh, never trusted from the screen that offered the button.
  const [existing, linkedAnywhere] = await Promise.all([
    db.worker.findFirst({
      where: { companyId: member.companyId, userId: member.userId },
      select: WORKER_SELECT,
    }),
    db.worker.findUnique({ where: { userId: member.userId }, select: { id: true, companyId: true } }),
  ]);

  const verdict = selfEnrolVerdict({ member, existing, linkedElsewhere: linkedAnywhere });
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  if (verdict.action === "already") {
    return NextResponse.json({ worker: existing, created: false, linked: false });
  }

  const result = await ensureWorkerForMember({ companyId: member.companyId, userId: member.userId });
  // The verdict above already refused a login linked elsewhere, so a
  // conflict here is a race with another request; say so rather than hand
  // back an unlinked row the clock could not use anyway.
  if (!result.worker || result.worker.userId !== member.userId) {
    return NextResponse.json(
      { error: "Couldn't set you up just now — try again, or ask an admin to add you under Team → Workers." },
      { status: 409 },
    );
  }

  await recordActivity(member, {
    action: "timeClock.selfEnrolled",
    entityType: "worker",
    entityId: result.worker.id,
    summary: `${result.worker.name} set themselves up to clock in${result.linked ? " (linked to an existing worker record)" : ""}`,
    metadata: {
      workerId: result.worker.id,
      created: !!result.created,
      linked: !!result.linked,
      // Recorded because the screen promised it: nothing about pay was set.
      hourlyRateSet: false,
    },
  });

  const worker = await db.worker.findUnique({ where: { id: result.worker.id }, select: WORKER_SELECT });
  return NextResponse.json(
    { worker, created: !!result.created, linked: !!result.linked },
    { status: result.created ? 201 : 200 },
  );
}
