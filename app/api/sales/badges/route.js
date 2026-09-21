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
//               (There was a dayCap here — the 250 ceiling — until
//               2026-09-14, when the owner removed the limit; the sidebar
//               now shows the count alone. lib/sales/queueBatch.js.)
//   texts       unread inbound texts across the rep's SMS conversations,
//               from the same read markers /sales/messages uses.
//   team        unread messages across the staff rooms the rep is in.
//   voicemail   voicemails left for this rep since the start of their local
//               day, PLUS missed calls (rang, nobody answered, no message —
//               lib/sales/calls/missed.js) in the same window, because the
//               Voicemail tab shows both. There is no "heard" marker on
//               either row, so this is NOT "unheard" — the sidebar's title
//               says "today".
//   email       unread email conversations — the prospect wrote after the
//               rep last opened the thread (lib/sales/emailInbox.js), not
//               archived. The Conversations tab's badge.
//   drafts      check-in and follow-up drafts waiting for the rep to press
//               Send — lib/sales/checkin/waiting.js's one definition, the
//               same count the Today card and the texts banner show.
//   draftsDemo  how many of those sit on the rep's demo company.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { startOfLocalDay } from "@/lib/sales/queueBatch";
import { salesConversations } from "@/lib/sales/salesSms";
import { threadReadStates } from "@/lib/sales/messages/readState";
import { roomsFor } from "@/lib/staff/store";
import { staffRoomList } from "@/lib/staff/rooms";
import { voicemailWhere } from "@/lib/sales/calls/voicemail";
import { missedWhere } from "@/lib/sales/calls/missed";
import { unloggedWhere } from "@/lib/sales/calls/store";
import { prospectDialsOnly } from "@/lib/sales/testLines";
import { waitingDraftsFor } from "@/lib/sales/checkin/waiting";
import { isUnread } from "@/lib/sales/emailInbox";
import { threadListWhere } from "@/lib/sales/outreach";

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

  // Both digits from one read, or both null: a total that counted and a demo
  // share that could not is a pair the sidebar cannot draw honestly.
  let drafts = null;
  let draftsDemo = null;
  try {
    const waiting = await waitingDraftsFor(rep.id);
    drafts = waiting.count;
    draftsDemo = waiting.demoCount;
  } catch (err) {
    console.error("[sales badges]", err?.message || err);
  }

  const [callsToday, texts, team, voicemail, unlogged, email] = await Promise.all([
    counted(() =>
      // Dials PLACED today, less any to FieldQuo's own test lines
      // (lib/sales/testLines.js) — a test at midnight is not a call made.
      db.salesCallAttempt.count({ where: prospectDialsOnly({ salesRepId: rep.id, direction: "out", dialledAt: { gte: dayStart } }) }),
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
      // Messages AND missed calls, because the Voicemail tab lists both and
      // a badge that counted only one would say "nothing new" over a missed
      // call from the contractor the rep just hung up on.
      const ourNumbers = assigned.map((n) => n.e164);
      const [messages, missed] = await Promise.all([
        db.salesCallAttempt.count({
          where: { ...voicemailWhere({ salesRepId: rep.id, ourNumbers }), dialledAt: { gte: dayStart } },
        }),
        db.salesCallAttempt.count({
          where: { ...missedWhere({ salesRepId: rep.id, ourNumbers }), dialledAt: { gte: dayStart } },
        }),
      ]);
      return messages + missed;
    }),
    // Calls with no outcome — every day's, not today's. The Queue badge
    // and the Today card; the same WHERE the unlogged list reads.
    counted(() => db.salesCallAttempt.count({ where: unloggedWhere(rep.id) })),
    // Unread email conversations in the inbox (not archived): the prospect
    // wrote after the rep last opened the thread — lib/sales/emailInbox.js's
    // isUnread, the same definition the list draws bold from. Counted in JS
    // over two timestamps per thread because Prisma cannot compare two
    // columns in a WHERE; a rep's threads are hundreds, not millions.
    counted(async () => {
      const rows = await db.salesThread.findMany({
        where: { ...threadListWhere(rep.id), archivedAt: null, lastInboundAt: { not: null } },
        select: { lastInboundAt: true, readAt: true },
      });
      return rows.filter(isUnread).length;
    }),
  ]);

  return NextResponse.json({
    callsToday,
    dayStartsAt: dayStart.toISOString(),
    texts,
    team,
    voicemail,
    unlogged,
    email,
    drafts,
    draftsDemo,
    serverNow: now.toISOString(),
  });
}
