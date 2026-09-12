// app/api/messaging/threads/route.js
//
// The inbox list, and the connection state that explains an empty one.
//
// ══ Why the connection state ships WITH the list ═══════════════════════════
//
// An empty array means two completely different things — "no Page is
// connected" and "a Page is connected and nobody has written to you" — and a
// screen that cannot tell them apart prints the wrong sentence for one of
// them. Both facts come off the same response so they were read at the same
// instant and cannot disagree, the same reason the crew-line search returns
// its price and balance together.
//
// ══ Who may read it ════════════════════════════════════════════════════════
//
// `requests` at view_only. An inbound Page message IS a request — a stranger
// asking whether the company does this kind of work — and gating it anywhere
// else would mean a member barred from the leads grid reading the same
// enquiries one screen over. Crew sit at `requests: none` and get a 403,
// matching GET /api/leads exactly.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { messagingConnection } from "@/lib/messaging/channels";
import { serviceWindowNotice, needsServiceWindow } from "@/lib/messaging/serviceWindow";
import { demoThreadSummaries } from "@/lib/messaging/demoThreads";
import { noteColours } from "@/lib/messaging/noteTheme";
import { readStatus, THREAD_STATUSES } from "@/lib/messaging/outcomes";
import { isMessagingPlatform } from "@/lib/messaging/platforms";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = member.id ? await loadEnforceableMember(db, member.id) : member;
  try {
    requireLevel(full, "requests", "view_only", "read messages");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  // The filter chips. An unrecognised value is treated as "no filter" rather
  // than as an empty result: a chip that silently hides every conversation
  // reads as "you have no messages", which is the one sentence this inbox must
  // never say when it is untrue.
  const statusFilter = THREAD_STATUSES.includes(searchParams.get("status"))
    ? searchParams.get("status")
    : null;
  // The channel chips (All · Facebook · Instagram · WhatsApp). Same shape as
  // the status filter above and for the same reason: filtered HERE, so a chip
  // means the same thing on row one and row 200 — and an unrecognised value
  // is "no filter", never an empty inbox.
  const platformFilter = isMessagingPlatform(searchParams.get("platform"))
    ? searchParams.get("platform")
    : null;

  const connection = await messagingConnection(member.companyId);

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { name: true },
  });
  // The private note's palette, which takes no company and derives from
  // nothing — see lib/messaging/noteTheme.js for why that is the point. The
  // thread itself is drawn by the shared chat kit in the app's own tokens
  // (no brand-coloured bubbles — the back office is not a client surface),
  // so the note wash is the one measured pair this screen still paints.
  const note = noteColours();

  // ── The demo company, and nothing else ─────────────────────────────────
  //
  // `mock` is decided inside messagingConnection by reading Company.isDemo
  // from the database. A real company can never take this branch, which is
  // what keeps fabricated conversations out of a real inbox.
  if (connection.mock) {
    const all = demoThreadSummaries(new Date(), company?.name || "Demo");
    const matching = q
      ? all.filter(
          (t) =>
            (t.participantName || "").toLowerCase().includes(q.toLowerCase()) ||
            (t.preview || "").toLowerCase().includes(q.toLowerCase()),
        )
      : all;
    // The chips filter the sample inbox too. A demo where the chips are drawn
    // and do nothing is the dead control AGENTS.md's first rule forbids, shown
    // to the one audience that is being asked to buy the thing.
    const byStatus = statusFilter
      ? matching.filter((t) => readStatus(t.status) === statusFilter)
      : matching;
    const threads = platformFilter ? byStatus.filter((t) => t.platform === platformFilter) : byStatus;
    return NextResponse.json({ connection, note, threads });
  }

  const rows = await db.messageThread.findMany({
    where: {
      companyId: member.companyId,
      // "resolved" also matches the legacy "closed" this feature wrote before
      // the four states existed — see lib/messaging/outcomes.js. Without it,
      // every thread anybody ever closed would sit in no chip at all.
      ...(statusFilter
        ? { status: statusFilter === "resolved" ? { in: ["resolved", "closed"] } : statusFilter }
        : {}),
      ...(platformFilter ? { channel: { platform: platformFilter } } : {}),
      ...(q
        ? {
            OR: [
              { participantName: { contains: q, mode: "insensitive" } },
              { messages: { some: { body: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    select: {
      id: true,
      participantName: true,
      lastMessageAt: true,
      unread: true,
      status: true,
      snoozedUntil: true,
      assignedToId: true,
      threadNumber: true,
      // The column, not a scan. This is what lets the row say "waiting 4 h"
      // NOW — see lib/messaging/waiting.js for why measuring it here from the
      // messages would mean the list never said it at all.
      waitingSince: true,
      outcome: true,
      // Hot / warm / cold, from what the homeowner said — the column
      // lib/messaging/rescoreThread.js keeps current. An ANNOTATION on the row,
      // never a filter: nothing in this product may hide a conversation for
      // scoring low. The corpus this scorer was built from contains a man who
      // scored badly for two months and was one revised quote from buying.
      temperature: true,
      score: true,
      // WhatsApp's 24-hour window, on the LIST as well as inside the thread.
      // The same argument waitingSince above makes: "this conversation stops
      // being answerable in 40 minutes" is a thing a contractor has to be able
      // to see without opening anything, and a list that only said it once you
      // were already typing would say it too late.
      lastInboundAt: true,
      channel: { select: { id: true, name: true, platform: true } },
      // The last message only — the list shows one line of preview, and
      // loading whole conversations to render 200 previews is how an inbox
      // becomes slow on the day it finally has traffic.
      //
      // "in" and "out" only. A private note and a system line live in this
      // same table, and a preview reading "" — or worse, reading a colleague's
      // note about the customer — is not what the last thing said was.
      messages: {
        where: { direction: { in: ["in", "out"] } },
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { body: true, direction: true, failedReason: true },
      },
    },
  });

  const threads = rows.map((t) => ({
    id: t.id,
    channelId: t.channel?.id || null,
    channelName: t.channel?.name || null,
    platform: t.channel?.platform || null,
    participantName: t.participantName,
    threadNumber: t.threadNumber ?? null,
    lastMessageAt: t.lastMessageAt,
    unread: t.unread,
    status: readStatus(t.status),
    snoozedUntil: t.snoozedUntil,
    assignedToId: t.assignedToId,
    waitingSince: t.waitingSince,
    outcome: t.outcome,
    // Null means "never scored", and the row renders no chip at all. A default
    // of "cold" here would paint every pre-columns conversation red.
    temperature: t.temperature || null,
    score: Number.isFinite(t.score) ? t.score : null,
    preview: t.messages[0]?.body || "",
    // Whose the preview is. "You: see you Tuesday" and "see you Tuesday" are
    // two different rows on a list, and lib/messaging/rooms.js also reads it
    // to file a pre-columns row (no waitingSince) in the right group.
    lastDirection: t.messages[0]?.direction || null,
    // Surfaced on the list, not only inside the thread: a reply that never
    // reached the homeowner is the thing a contractor most needs to see
    // without opening anything.
    lastFailed: Boolean(t.messages[0]?.failedReason),
    // Null on Facebook and Instagram. Decided here, by the same pure function
    // the send path calls, so the list, the composer and the refusal cannot
    // disagree about whether a window is open.
    serviceWindow: needsServiceWindow(t.channel?.platform)
      ? serviceWindowNotice({ platform: t.channel.platform, lastInboundAt: t.lastInboundAt })
      : null,
  }));

  return NextResponse.json({ connection, note, threads });
}
