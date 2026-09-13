// app/api/shout-outs/route.js
//
// "Great work on the Dubois kitchen." GET: the company feed (last 20) and
// the ones addressed to the caller. POST { toWorkerId, message ≤ 240 }:
// anyone with a login can send one to anyone on the roster — including a
// colleague with no login, whose shout-out still shows on the feed for the
// crew to see. One push to the recipient, no reactions, no counts.
//
// The roster comes from the caller's company and nothing else; a
// toWorkerId from another tenant is "not on your team", never a row.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { notifyEvent } from "@/lib/notifications/notify";
import { recordActivity } from "@/lib/activity/log";

const SHOUT_OUT_MAX = 240;

const SELECT = {
  id: true,
  message: true,
  createdAt: true,
  fromMember: { select: { id: true, user: { select: { name: true, image: true } } } },
  toWorker: { select: { id: true, name: true, title: true } },
};

const shape = (row) => ({
  id: row.id,
  message: row.message,
  createdAt: row.createdAt,
  from: { memberId: row.fromMember?.id || null, name: row.fromMember?.user?.name || null, image: row.fromMember?.user?.image || null },
  to: { workerId: row.toWorker?.id || null, name: row.toWorker?.name || null, title: row.toWorker?.title || null },
});

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const [feed, worker, workers] = await Promise.all([
    db.shoutOut.findMany({
      where: { companyId: member.companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: SELECT,
    }),
    member.userId
      ? db.worker.findFirst({ where: { companyId: member.companyId, userId: member.userId }, select: { id: true } })
      : null,
    db.worker.findMany({
      where: { companyId: member.companyId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, title: true },
    }),
  ]);
  return NextResponse.json({
    feed: feed.map(shape),
    forMe: worker ? feed.filter((r) => r.toWorker?.id === worker.id).map(shape) : [],
    // Everyone on the roster but the caller, for the "Send a shout-out" picker.
    colleagues: workers.filter((w) => w.id !== worker?.id),
    max: SHOUT_OUT_MAX,
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Say something." }, { status: 400 });
  if (message.length > SHOUT_OUT_MAX) {
    return NextResponse.json({ error: `Keep it under ${SHOUT_OUT_MAX} characters.` }, { status: 400 });
  }
  const toWorkerId = typeof body.toWorkerId === "string" ? body.toWorkerId : "";
  const to = toWorkerId
    ? await db.worker.findFirst({
        where: { id: toWorkerId, companyId: member.companyId, active: true },
        select: { id: true, name: true, userId: true },
      })
    : null;
  if (!to) return NextResponse.json({ error: "That person isn't on your team." }, { status: 404 });
  if (to.userId && to.userId === member.userId) {
    return NextResponse.json({ error: "A shout-out is for a colleague." }, { status: 400 });
  }
  const row = await db.shoutOut.create({
    data: { companyId: member.companyId, fromMemberId: member.id, toWorkerId: to.id, message },
    select: SELECT,
  });
  await recordActivity(member, {
    action: "shoutout.sent",
    entityType: "shoutout",
    entityId: row.id,
    summary: `Shout-out to ${to.name}`,
  });
  if (to.userId) {
    void notifyEvent({
      companyId: member.companyId,
      type: "shoutout.received",
      entityId: row.id,
      actorUserId: member.userId,
      recipientUserIds: [to.userId],
      params: { fromName: row.fromMember?.user?.name || "" },
    });
  }
  return NextResponse.json({ ok: true, shoutOut: shape(row) });
}
