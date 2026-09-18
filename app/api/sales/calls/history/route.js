// app/api/sales/calls/history/route.js
//
// GET ?prospectId=… | ?leadId=… — the calls made to one lead, shaped by
// lib/sales/calls/history.js, newest first, with the "last time" line.
//
// Scoped the way every other sales read is: a prospect resolves only through
// the rep's own view of the pool (queueWhere), a lead only when it is the
// rep's. Anything else is an empty answer, not a 403 that confirms a row.
// Attempts by OTHER reps on the same business are included, marked and
// without their notes — history.js says why.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { queueWhere } from "@/lib/sales/prospectView";
import { callStoreState } from "@/lib/sales/calls/store";
import { HISTORY_SELECT, callHistoryRows, lastTime } from "@/lib/sales/calls/history";

const LIMIT = 100;

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();
  const store = callStoreState();
  const url = new URL(request.url);
  const prospectId = (url.searchParams.get("prospectId") || "").trim();
  const leadId = (url.searchParams.get("leadId") || "").trim();
  const timeZone = (url.searchParams.get("timeZone") || "").trim().slice(0, 64) || null;
  if (!store.ready || (!prospectId && !leadId)) {
    return NextResponse.json({ store, history: [], lastTime: null, serverNow: now.toISOString() });
  }

  const or = [];
  const phones = new Set();
  if (prospectId) {
    const p = await db.prospect.findFirst({
      where: { id: prospectId, ...queueWhere(rep.id) },
      select: { id: true, phoneE164: true },
    });
    if (p) {
      or.push({ prospectId: p.id });
      if (p.phoneE164) phones.add(p.phoneE164);
    }
  }
  if (leadId) {
    const l = await db.salesLead.findFirst({
      where: { id: leadId, salesRepId: rep.id },
      select: { id: true, prospectId: true, phone: true },
    });
    if (l) {
      or.push({ leadId: l.id });
      if (l.prospectId && !prospectId) or.push({ prospectId: l.prospectId });
      if (l.phone) phones.add(l.phone);
    }
  }
  if (!or.length) return NextResponse.json({ store, history: [], lastTime: null, serverNow: now.toISOString() });
  // Inbound rows by the CALLER'S NUMBER as well as by record. The inbound
  // route attaches a ring-back to a prospect only when the caller ID matches
  // exactly one — dedupe flags duplicates rather than merging them, so a
  // business held three times matches nobody (inboundMatch.js) and its
  // callback was filed with prospectId null. That is correct for
  // attribution and wrong for THIS screen: the rep looking at the business
  // is the person the call was for. toE164 is always the other party on an
  // inbound row (the schema's own note), so the phone is the join.
  if (phones.size) or.push({ direction: "in", toE164: { in: [...phones] } });

  const rows = await db.salesCallAttempt.findMany({
    where: { OR: or },
    orderBy: { dialledAt: "desc" },
    take: LIMIT,
    select: HISTORY_SELECT,
  });
  const history = callHistoryRows(rows, { repId: rep.id });
  return NextResponse.json({ store, history, lastTime: lastTime(history, { now, timeZone }), serverNow: now.toISOString() });
}
