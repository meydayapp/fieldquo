// app/api/daily-sheets/evaluate/route.js
//
// POST { workerId, date, score, note } — the coordinator's end-of-day
// evaluation, and the bonus the company's rule yields for it.
//
// Coordinator only (lib/dailySheets/access.js mayEvaluate): a person cannot
// score their own day. The bonus is computed HERE, from the rule on the
// company row at this moment, and stored on the sheet — so a rule changed
// next month does not re-price last month's days, and the pay run reads a
// figure a person saw on the screen when they wrote the score.
//
// No rule → bonusCents stays null and the response says `noRule: true`.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { mayEvaluate } from "@/lib/dailySheets/access";
import { dateKeyToColumn, columnToDateKey } from "@/lib/dailySheets/day";
import { normaliseScore } from "@/lib/dailySheets/objectives";
import { computeBonus } from "@/lib/dailySheets/bonus";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  if (!mayEvaluate(full)) {
    return NextResponse.json({ error: "Only a coordinator, admin or owner can evaluate a day." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const { workerId, date } = body || {};
  const column = dateKeyToColumn(date);
  const score = normaliseScore(body?.score);
  if (!workerId || !column) return NextResponse.json({ error: "workerId and date (YYYY-MM-DD) are required" }, { status: 400 });
  if (!score) return NextResponse.json({ error: "score must be 1 to 5" }, { status: 400 });
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";

  const worker = await db.worker.findFirst({ where: { id: workerId, companyId: member.companyId }, select: { id: true, name: true } });
  if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  const [existing, company] = await Promise.all([
    db.dailyObjectiveSheet.findUnique({ where: { workerId_date: { workerId, date: column } } }),
    db.company.findUnique({ where: { id: member.companyId }, select: { performancePayRule: true } }),
  ]);
  if (existing?.payRunId) {
    return NextResponse.json({ error: "This day's bonus is already on a pay run; the evaluation is frozen." }, { status: 409 });
  }
  const bonus = computeBonus(company?.performancePayRule, {
    objectives: existing?.objectives || [],
    upsells: existing?.upsells || [],
    evaluationScore: score,
  });
  const data = {
    evaluationScore: score,
    evaluationNote: note || null,
    evaluatedById: member.userId,
    evaluatedAt: new Date(),
    bonusCents: bonus ? bonus.cents : null,
    bonusBreakdown: bonus ? bonus.lines : null,
  };
  const sheet = await db.dailyObjectiveSheet.upsert({
    where: { workerId_date: { workerId, date: column } },
    create: { companyId: member.companyId, workerId, date: column, objectives: [], upsells: [], ...data },
    update: data,
    include: { job: { select: { id: true, title: true } }, evaluatedBy: { select: { name: true } } },
  });
  await recordActivity(member, {
    action: "dailySheet.evaluated",
    entityType: "worker",
    entityId: worker.id,
    summary: `Evaluated ${worker.name}'s ${date}: ${score}/5${bonus ? ` — bonus ${(bonus.cents / 100).toFixed(2)}` : ""}`,
    metadata: { workerId: worker.id, date, score, bonusCents: bonus ? bonus.cents : null },
  });
  return NextResponse.json({ ...sheet, dateKey: columnToDateKey(sheet.date), noRule: !bonus });
}
