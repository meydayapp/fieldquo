// app/api/me/own-rate/route.js
//
// "Your own rate": the signed-in owner's (or admin's) own hourly pay rate —
// Worker.hourlyRate on THEIR Worker row, creating that row if they never had
// one. The rules and why are lib/team/ownRate.js; the card is
// app/components/team/OwnRateCard.js (Team → Workers, the Team page, and the
// set-up card's "Set your own rate" row lands on it).
//
//   GET → { show, canSave, reason, worker: { id, hourlyRate } | null,
//           suggestion: { rate, source: "labour_cost" | "fieldquo_default" } }
//   PUT { hourlyRate, expected } → 200 { worker } | 409 { error, current }
//
// Gates: payroll:view_all for both (a rate is payroll wherever it is read or
// written — the same rung PATCH /api/workers/[id] refuses below); creating
// the Worker row is the time clock's self-enrol rule (user:manage, never
// under impersonation); impersonation never writes.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, canSeeAllPay } from "@/lib/permissions/enforce";
import { canSelfEnrol, selfEnrolVerdict } from "@/lib/timeclock/selfEnrol";
import { ensureWorkerForMember } from "@/lib/team/ensureWorker";
import { ownRateAccess, ownRateWriteVerdict, parseOwnRate } from "@/lib/team/ownRate";
import { FALLBACK_LABOUR_RATE } from "@/lib/costing/costingDefaults";
import { recordActivity } from "@/lib/activity/log";
import { isOnPayroll } from "@/lib/payroll/ownerPay";

// Whether pay runs pay this person (lib/payroll/ownerPay.js): the explicit
// choice when there is one, else the role's default — an owner is left out.
function payrollState(member, worker) {
  return {
    paidByPayroll: worker.paidByPayroll ?? null,
    onPayroll: isOnPayroll(worker, member.role === "owner" ? [member.userId] : []),
  };
}

const PRIVATE = { "Cache-Control": "private, no-store" };
const num = (v) => (v === null || v === undefined ? null : Number(v));

async function load(member) {
  const [full, worker, own] = await Promise.all([
    loadEnforceableMember(db, member.id),
    db.worker.findFirst({
      where: { companyId: member.companyId, userId: member.userId },
      select: { id: true, hourlyRate: true, active: true, paidByPayroll: true },
    }),
    db.member.findFirst({
      where: { id: member.id, companyId: member.companyId },
      select: { laborCostPerHour: true },
    }),
  ]);
  return { full, worker, laborCost: num(own?.laborCostPerHour) };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, worker, laborCost } = await load(member);
  const access = ownRateAccess({
    member,
    canSetPay: canSeeAllPay(full),
    canSelfEnrol: canSelfEnrol(member),
    worker,
  });
  if (!access.show) return NextResponse.json({ ...access, worker: null, suggestion: null }, { headers: PRIVATE });
  // What the card offers when there is no rate yet: the labour cost typed for
  // this person on the New User form if one exists, else the $35/h FieldQuo
  // already costs unassigned quotes at. Offered, labelled, never stored
  // until Save.
  const suggestion =
    laborCost && laborCost > 0
      ? { rate: laborCost, source: "labour_cost" }
      : { rate: FALLBACK_LABOUR_RATE, source: "fieldquo_default" };
  return NextResponse.json(
    {
      ...access,
      worker: worker ? { id: worker.id, hourlyRate: num(worker.hourlyRate), active: worker.active !== false, ...payrollState(member, worker) } : null,
      suggestion,
    },
    { headers: PRIVATE },
  );
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Impersonation is read-only." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a rate." }, { status: 400 });
  }
  const parsed = parseOwnRate(body?.hourlyRate);
  if (!parsed.ok) {
    return NextResponse.json({ error: "That isn't an hourly rate.", code: parsed.error }, { status: 400 });
  }
  const expected = body?.expected === undefined ? null : body.expected;

  const { full, worker: existing } = await load(member);
  if (!canSeeAllPay(full)) {
    return NextResponse.json({ error: "You don't have access to pay rates. Ask an owner or admin." }, { status: 403 });
  }

  // No Worker row yet: the time clock's self-enrol path, verbatim — it links
  // a hand-entered row with the same email rather than making a second
  // person on the payroll, and refuses a login already linked elsewhere.
  let worker = existing;
  if (!worker) {
    const linkedElsewhere = await db.worker.findUnique({
      where: { userId: member.userId },
      select: { id: true, companyId: true },
    });
    const verdict = selfEnrolVerdict({ member, existing: null, linkedElsewhere });
    if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    const made = await ensureWorkerForMember({ companyId: member.companyId, userId: member.userId });
    if (!made.worker || made.worker.userId !== member.userId) {
      return NextResponse.json(
        { error: "Couldn't add you to Team → Workers just now. Try again." },
        { status: 409 },
      );
    }
    worker = await db.worker.findUnique({
      where: { id: made.worker.id },
      select: { id: true, hourlyRate: true, active: true, paidByPayroll: true },
    });
  }

  // Never overwrite: the write lands only if the row still holds the rate the
  // card showed. A linked hand-entered row that already carried a rate fails
  // here too, and the person is shown that rate instead of losing it.
  const before = ownRateWriteVerdict({ expected, current: num(worker.hourlyRate) });
  if (!before.ok) {
    return NextResponse.json(
      { error: "Your rate changed since this page loaded.", code: "changed", current: before.current },
      { status: 409 },
    );
  }
  const written = await db.worker.updateMany({
    where: { id: worker.id, companyId: member.companyId, hourlyRate: num(worker.hourlyRate) },
    data: { hourlyRate: parsed.value },
  });
  if (written.count !== 1) {
    const now = await db.worker.findUnique({ where: { id: worker.id }, select: { hourlyRate: true } });
    return NextResponse.json(
      { error: "Your rate changed since this page loaded.", code: "changed", current: num(now?.hourlyRate) },
      { status: 409 },
    );
  }

  await recordActivity(member, {
    action: "worker.ownRateSet",
    entityType: "worker",
    entityId: worker.id,
    summary: "Set their own hourly rate",
    metadata: { workerId: worker.id, hadRate: worker.hourlyRate != null },
  });

  return NextResponse.json(
    { worker: { id: worker.id, hourlyRate: parsed.value, active: worker.active !== false, ...payrollState(member, worker) } },
    { headers: PRIVATE },
  );
}

// ── "Pay me through payroll" ─────────────────────────────────────────────────
//
// The explicit choice for the person's OWN row, from the same card and under
// the same gate as the rate (payroll:view_all, never in a support session).
// Only a boolean is accepted: `null` ("back to the default") is not offered
// by the card, so it is not accepted here either.
export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Impersonation is read-only." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (typeof body?.paidByPayroll !== "boolean") {
    return NextResponse.json({ error: "Say whether you're paid through payroll." }, { status: 400 });
  }
  const { full, worker } = await load(member);
  if (!canSeeAllPay(full)) {
    return NextResponse.json({ error: "You don't have access to pay settings. Ask an owner or admin." }, { status: 403 });
  }
  if (!worker) {
    return NextResponse.json({ error: "Set your rate first — that adds you to Team → Workers." }, { status: 409 });
  }
  await db.worker.update({ where: { id: worker.id }, data: { paidByPayroll: body.paidByPayroll } });
  await recordActivity(member, {
    action: "worker.ownPayrollSet",
    entityType: "worker",
    entityId: worker.id,
    summary: body.paidByPayroll ? "Put themselves on payroll" : "Took themselves off payroll",
    metadata: { workerId: worker.id, paidByPayroll: body.paidByPayroll },
  });
  const next = { ...worker, paidByPayroll: body.paidByPayroll };
  return NextResponse.json(
    { worker: { id: worker.id, hourlyRate: num(worker.hourlyRate), active: worker.active !== false, ...payrollState(member, next) } },
    { headers: PRIVATE },
  );
}
