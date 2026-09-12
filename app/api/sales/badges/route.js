// app/api/sales/badges/route.js
//
// The numbers the portal's sidebar wears: calls placed today against the
// day's batch, and the three badges (texts, team, voicemail).
//
// ══ One request for the chrome, not four ═════════════════════════════════
//
// SalesShell mounts on every /sales screen. Asking /api/sales/messages,
// /api/staff/rooms and /api/sales/voicemail on each navigation to derive
// three small numbers would cost three list reads per page view for three
// digits of chrome. This route computes the digits server-side from the same
// library functions those screens use — never a second definition of
// "unread" — and returns only counts.
//
// ══ null is "could not count", never 0 ═══════════════════════════════════
//
// Each number is computed inside its own try/catch and a failure yields
// null. The sidebar draws no badge for null. Drawing "0" for a count that
// could not be read is AGENTS.md's fifth failure class: absence of a
// statement rendered as a statement.
//
// ══ What each number IS, exactly ═════════════════════════════════════════
//
//   callsToday  SalesCallAttempt rows dialled by this rep since the start of
//               their local day (the zone the browser sent, the same one the
//               batch claim counts against — lib/sales/queueBatch.js). Every
//               dial counts, answered or not: a rep's "calls today" is what
//               they pressed, not what was picked up.
//   dayCap      QUEUE_DAILY_CLAIM_CAP — the day's ceiling the owner set
//               ("200 calls a day plus room"), so the sidebar's "24 / 250"
//               is the day and not the rolling batch of 25.
//   texts       unread inbound texts across the rep's SMS conversations,
//               from the same read markers /sales/messages uses.
//   team        unread messages across the staff rooms the rep is in.
//   voicemail   voicemails left for this rep since the start of their local
//               day. There is no "heard" marker on a voicemail row, so this
//               is NOT "unheard" — the sidebar's title says "today".
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { QUEUE_DAILY_CLAIM_CAP, startOfLocalDay } from "@/lib/sales/queueBatch";
import { salesConversations } from "@/lib/sales/salesSms";
import { threadReadStates } from "@/lib/sales/messages/readState";
import { roomsFor } from "@/lib/staff/store";
import { staffRoomList } from "@/lib/staff/rooms";
import { voicemailWhere } from "@/lib/sales/calls/voicemail";

async function counted(fn) {
  try {
    const n = await fn();
    return Number.isFinite(n) ? n : null;
  } catch (err) {
    console.error("[sales badges]", err?.message || err);
    return null;
  }
}

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const now = new Date();
  const url = new URL(request.url);
  const timeZone = (url.searchParams.get("timeZone") || "").trim().slice(0, 64) || null;
  const dayStart = startOfLocalDay(timeZone, now) || new Date(now.getTime() - 24 * 3600 * 1000);

  const [callsToday, texts, team, voicemail] = await Promise.all([
    counted(() =>
      db.salesCallAttempt.count({ where: { salesRepId: rep.id, direction: "out", dialledAt: { gte: dayStart } } }),
    ),
    counted(async () => {
      const readStates = await threadReadStates({ salesRepId: rep.id });
      const conversations = await salesConversations({ salesRepId: rep.id, readStates });
      return conversations.reduce((n, c) => n + (Number.isFinite(c.unread) ? c.unread : 0), 0);
    }),
    counted(async () => {
      const viewer = { kind: "rep", id: rep.id, name: rep.name || rep.email, email: rep.email };
      const rooms = staffRoomList(await roomsFor(viewer), viewer);
      return rooms.reduce((n, r) => n + (Number.isFinite(r.unread) ? r.unread : 0), 0);
    }),
    counted(async () => {
      const assigned = await db.platformSmsNumber.findMany({
        where: { assignedRepId: rep.id, active: true },
        select: { e164: true },
      });
      return db.salesCallAttempt.count({
        where: {
          ...voicemailWhere({ salesRepId: rep.id, ourNumbers: assigned.map((n) => n.e164) }),
          dialledAt: { gte: dayStart },
        },
      });
    }),
  ]);

  return NextResponse.json({
    callsToday,
    dayCap: QUEUE_DAILY_CLAIM_CAP,
    dayStartsAt: dayStart.toISOString(),
    texts,
    team,
    voicemail,
    serverNow: now.toISOString(),
  });
}
