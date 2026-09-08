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
import { demoThreadSummaries } from "@/lib/messaging/demoThreads";
import { bubbleColours } from "@/lib/messaging/bubbleTheme";

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

  const connection = await messagingConnection(member.companyId);

  // The outbound bubble's colours, MEASURED server-side against the company's
  // brand hex — see lib/messaging/bubbleTheme.js for why they are computed
  // here rather than in the browser.
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { name: true, brandColor: true },
  });
  const bubbles = bubbleColours(company || {});

  // ── The demo company, and nothing else ─────────────────────────────────
  //
  // `mock` is decided inside messagingConnection by reading Company.isDemo
  // from the database. A real company can never take this branch, which is
  // what keeps fabricated conversations out of a real inbox.
  if (connection.mock) {
    const all = demoThreadSummaries(new Date(), company?.name || "Demo");
    const threads = q
      ? all.filter(
          (t) =>
            (t.participantName || "").toLowerCase().includes(q.toLowerCase()) ||
            (t.preview || "").toLowerCase().includes(q.toLowerCase()),
        )
      : all;
    return NextResponse.json({ connection, bubbles, threads });
  }

  const rows = await db.messageThread.findMany({
    where: {
      companyId: member.companyId,
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
      outcome: true,
      channel: { select: { id: true, name: true, platform: true } },
      // The last message only — the list shows one line of preview, and
      // loading whole conversations to render 200 previews is how an inbox
      // becomes slow on the day it finally has traffic.
      messages: {
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
    lastMessageAt: t.lastMessageAt,
    unread: t.unread,
    status: t.status,
    outcome: t.outcome,
    preview: t.messages[0]?.body || "",
    // Surfaced on the list, not only inside the thread: a reply that never
    // reached the homeowner is the thing a contractor most needs to see
    // without opening anything.
    lastFailed: Boolean(t.messages[0]?.failedReason),
  }));

  return NextResponse.json({ connection, bubbles, threads });
}
