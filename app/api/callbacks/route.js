// app/api/callbacks/route.js
//
// GET ?weekOf=YYYY-MM-DD — the callback lists a person may see: every list
// in the company for an owner/admin, only the lists whose rule is assigned
// to them for anyone else. With no weekOf, the most recent week that has a
// list. Client rows are the name, city and last job — what the caller
// needs to dial — with the phone included because dialling is the point.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { OUTCOMES } from "@/lib/callbacks/outcomes";
import { listScope } from "@/lib/callbacks/scope";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const weekOfParam = searchParams.get("weekOf");
  const scope = listScope(member);

  let weekOf = null;
  if (weekOfParam && /^\d{4}-\d{2}-\d{2}$/.test(weekOfParam)) {
    const [y, m, d] = weekOfParam.split("-").map(Number);
    weekOf = new Date(Date.UTC(y, m - 1, d));
  } else {
    const latest = await db.callbackList.findFirst({ where: scope, orderBy: { weekOf: "desc" }, select: { weekOf: true } });
    weekOf = latest?.weekOf || null;
  }

  const lists = weekOf
    ? await db.callbackList.findMany({
        where: { ...scope, weekOf },
        include: {
          rule: { select: { id: true, weekday: true, monthsSinceJob: true, minTicket: true, areaKind: true, areaValue: true, weeklyCap: true, assigneeMemberId: true, assignee: { select: { user: { select: { name: true } } } } } },
          entries: {
            orderBy: { lastTicket: "desc" },
            include: { client: { select: { id: true, name: true, phone: true, city: true, postalCode: true } }, outcomeBy: { select: { name: true } } },
          },
        },
      })
    : [];

  const weeks = await db.callbackList.findMany({ where: scope, distinct: ["weekOf"], orderBy: { weekOf: "desc" }, select: { weekOf: true }, take: 12 });

  return NextResponse.json({
    weekOf: weekOf ? weekOf.toISOString().slice(0, 10) : null,
    weeks: weeks.map((w) => w.weekOf.toISOString().slice(0, 10)),
    outcomes: OUTCOMES,
    lists: lists.map((l) => ({
      id: l.id,
      weekOf: l.weekOf.toISOString().slice(0, 10),
      rule: { ...l.rule, minTicket: Number(l.rule.minTicket), assigneeName: l.rule.assignee?.user?.name || null },
      entries: l.entries.map((e) => ({
        id: e.id,
        client: e.client,
        lastJobAt: e.lastJobAt,
        lastJobTitle: e.lastJobTitle,
        lastTicket: e.lastTicket == null ? null : Number(e.lastTicket),
        outcome: e.outcome,
        outcomeNote: e.outcomeNote,
        callBackOn: e.callBackOn ? e.callBackOn.toISOString().slice(0, 10) : null,
        outcomeAt: e.outcomeAt,
        outcomeByName: e.outcomeBy?.name || null,
      })),
    })),
  });
}
