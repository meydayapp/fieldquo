// app/api/daily-sheets/route.js
//
// GET ?date=YYYY-MM-DD  — the day's sheets, narrowed to the caller's scope
//                          (lib/dailySheets/access.js): a coordinator sees
//                          every crew member, a crew member sees themselves.
// PUT { workerId, date, jobId, objectives, upsells }
//                        — write (upsert) one sheet's objectives and upsells.
//                          Evaluation and bonus are NOT writable here; see
//                          ./evaluate.
//
// Clock stamps are read from TimeEntry on every GET and never stored on the
// sheet, so a timesheet correction corrects the sheet.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, assignedJobWhere } from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { sheetScope, mayEditSheet, coordinatesSheets, seesUpsells, withoutUpsells } from "@/lib/dailySheets/access";
import { loadDay, ownWorker, companyTimezone, linkedUpsellsForJob } from "@/lib/dailySheets/load";
import { dateKeyToColumn, todayKey, columnToDateKey } from "@/lib/dailySheets/day";
import { normaliseObjectives, normaliseUpsells } from "@/lib/dailySheets/objectives";
import { computeBonus } from "@/lib/dailySheets/bonus";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  const mine = await ownWorker(member);
  const scope = sheetScope(full, mine?.id || null);
  if (scope === null) {
    return NextResponse.json({ error: "You're not set up as a crew member, so there is no daily sheet for you yet." }, { status: 403 });
  }

  const timezone = await companyTimezone(member.companyId);
  const { searchParams } = new URL(request.url);
  const dateKey = searchParams.get("date") || todayKey(timezone);
  if (!dateKeyToColumn(dateKey)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });

  const loaded = await loadDay({ companyId: member.companyId, dateKey, timezone, scope });
  // Upsell amounts only for someone who sells (owner, 2026-10-04) — see
  // lib/dailySheets/access.js seesUpsells. Stripped, and said so, so the
  // sheet draws no upsell section rather than an empty one.
  const sells = seesUpsells(full);
  const rows = sells || !Array.isArray(loaded)
    ? loaded
    : loaded.map((r) => (r.sheet ? { ...r, sheet: withoutUpsells(r.sheet) } : r));
  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { performancePayRule: true, currency: true } });
  return NextResponse.json({
    date: dateKey,
    today: todayKey(timezone),
    coordinator: coordinatesSheets(full),
    sellsUpsells: sells,
    ownWorkerId: mine?.id || null,
    hasRule: Boolean(company?.performancePayRule),
    currency: company?.currency || null,
    rows,
  });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  const mine = await ownWorker(member);
  const body = await request.json().catch(() => ({}));
  const { workerId, date, jobId } = body || {};

  const column = dateKeyToColumn(date);
  if (!workerId || !column) return NextResponse.json({ error: "workerId and date (YYYY-MM-DD) are required" }, { status: 400 });
  if (!mayEditSheet(full, mine?.id || null, workerId)) {
    return NextResponse.json({ error: "You can only write your own daily sheet." }, { status: 403 });
  }
  const worker = await db.worker.findFirst({ where: { id: workerId, companyId: member.companyId }, select: { id: true } });
  if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { jobId });
  if (notOurs) return notOurs;
  // A crew member's sheet hangs off one of THEIR jobs: the linked upsells
  // below are copied from that job's add-ons and change orders, so an
  // unscoped jobId let them credit themselves with another crew's sales
  // (the 2026-10-03 role-access audit; GET .../upsells has the same scope).
  if (jobId) {
    const reachable = await db.job.findFirst({
      where: { id: jobId, companyId: member.companyId, ...assignedJobWhere(full) },
      select: { id: true },
    });
    if (!reachable) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // ── A non-seller's save: objectives yes, upsells no (owner, 2026-10-04) ──
  //
  // Crew do not sell, so they do not write upsells — and since PUT replaces
  // the list wholesale, their save must keep whatever a coordinator credited
  // rather than wipe it with the empty list their screen no longer sends. A
  // body that does carry upsells is refused, not silently dropped.
  const sells = seesUpsells(full);
  if (!sells && Array.isArray(body.upsells) && body.upsells.length > 0) {
    return NextResponse.json(
      { error: "Upsells are recorded by the people who sell — an estimator, a manager or the owner.", code: "upsells_hidden" },
      { status: 403 },
    );
  }

  const objectives = normaliseObjectives(body.objectives);

  // A sheet already evaluated keeps its score; the bonus is re-derived from
  // the rule because the objectives it was computed on just changed. No
  // rule → null, as ever. A sheet a pay run has already picked up is frozen:
  // the money left with the run.
  const existing = await db.dailyObjectiveSheet.findUnique({ where: { workerId_date: { workerId, date: column } }, select: { id: true, evaluationScore: true, payRunId: true, upsells: true } });
  let upsells;
  if (sells) {
    const { map } = await linkedUpsellsForJob({ companyId: member.companyId, jobId: jobId || null });
    upsells = normaliseUpsells(body.upsells, map);
  } else {
    upsells = Array.isArray(existing?.upsells) ? existing.upsells : [];
  }
  if (existing?.payRunId) {
    return NextResponse.json({ error: "This day's bonus is already on a pay run; the sheet is frozen." }, { status: 409 });
  }
  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { performancePayRule: true } });
  const bonus = existing?.evaluationScore != null || company?.performancePayRule
    ? computeBonus(company?.performancePayRule, { objectives, upsells, evaluationScore: existing?.evaluationScore ?? null })
    : null;

  const data = {
    jobId: jobId || null,
    objectives,
    upsells,
    bonusCents: bonus ? bonus.cents : null,
    bonusBreakdown: bonus ? bonus.lines : null,
  };
  const sheet = await db.dailyObjectiveSheet.upsert({
    where: { workerId_date: { workerId, date: column } },
    create: { companyId: member.companyId, workerId, date: column, ...data },
    update: data,
    include: { job: { select: { id: true, title: true } }, evaluatedBy: { select: { name: true } } },
  });
  const out = { ...sheet, dateKey: columnToDateKey(sheet.date) };
  return NextResponse.json(sells ? out : withoutUpsells(out));
}
