// app/api/messaging/review/route.js
//
// The month-end read: which conversations closed the job and which didn't.
//
// All arithmetic lives in lib/messaging/monthlyReview.js — pure, executed by
// scripts/check-messaging.mjs against fixtures including an empty month and a
// month nobody replied in. This route only fetches rows and hands them over,
// deliberately: a number computed in a route handler is a number no check can
// reach.
//
// ══ No AI in this slice ════════════════════════════════════════════════════
//
// The obvious next feature is "summarise what the won conversations did
// differently". It is not here, because it would be a metered model call and
// every one of those in this codebase goes through lib/ai/provider.js with
// checkAiQuota before and recordAiUsage after, and is labelled to the
// contractor as a paid action. Half-doing that — a summary that quietly spends
// somebody's allowance — is worse than not having it. The counts and medians
// below need no model at all.
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
import { demoThreads } from "@/lib/messaging/demoThreads";
import { buildMonthlyReview, monthRange } from "@/lib/messaging/monthlyReview";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = member.id ? await loadEnforceableMember(db, member.id) : member;
  try {
    requireLevel(full, "requests", "view_only", "read the message review");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getUTCFullYear();
  const month = Number(searchParams.get("month")) || now.getUTCMonth() + 1;

  const range = monthRange(year, month);
  if (!range) return NextResponse.json({ error: "Unknown month." }, { status: 400 });

  const connection = await messagingConnection(member.companyId);

  if (connection.mock) {
    const company = await db.company.findUnique({
      where: { id: member.companyId },
      select: { name: true },
    });
    const review = buildMonthlyReview({
      threads: demoThreads(now, company?.name || "Demo"),
      year,
      month,
    });
    return NextResponse.json({ connection, review });
  }

  // Threads that STARTED in the month — createdAt, not lastMessageAt. A
  // conversation that opened in August and ran into September belongs to
  // August's conversion rate; counting it in both would let one enquiry be won
  // twice.
  const threads = await db.messageThread.findMany({
    where: {
      companyId: member.companyId,
      createdAt: { gte: range.start, lt: range.end },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      participantName: true,
      createdAt: true,
      lastMessageAt: true,
      outcome: true,
      channel: { select: { name: true, platform: true } },
      // Direction, time and whether it failed — everything firstResponse()
      // needs and nothing else. The bodies are not fetched: this screen counts
      // conversations, and pulling every message body for a month of traffic
      // to compute two medians is the kind of query that is fine until it
      // isn't.
      messages: {
        orderBy: { sentAt: "asc" },
        select: { direction: true, sentAt: true, failedReason: true },
      },
    },
  });

  const review = buildMonthlyReview({
    threads: threads.map((t) => ({
      ...t,
      platform: t.channel?.platform || null,
      channelName: t.channel?.name || null,
    })),
    year,
    month,
  });

  return NextResponse.json({ connection, review });
}
