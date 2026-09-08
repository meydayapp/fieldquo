// app/api/messaging/threads/[id]/route.js
//
// One conversation, and the judgement somebody puts on it.
//
// GET   the messages, oldest first, plus what this thread was linked to.
// PATCH the outcome ("did this become a job?"), the status, the client/job it
//       turned out to be, and marking it read.
//
// ══ The PATCH is the feature ═══════════════════════════════════════════════
//
// Everything else here is an inbox; this is the part that makes the month-end
// review worth reading. It is also the part most easily built as a control
// that appears to work: a dropdown that writes a column nothing reads.
// lib/messaging/monthlyReview.js reads every field this route writes, and
// scripts/check-messaging.mjs asserts the round trip.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { messagingConnection } from "@/lib/messaging/channels";
import { demoThreads } from "@/lib/messaging/demoThreads";
import { normaliseOutcome, normaliseStatus } from "@/lib/messaging/outcomes";

/** The member with their grid attached — a scope decided without it widens. */
async function graded(member) {
  const full = member.id ? await loadEnforceableMember(db, member.id) : null;
  return { ...member, permissions: full?.permissions ?? null };
}

export async function GET(request, { params }) {
  // params is a Promise in Next 16.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireLevel(await graded(member), "requests", "view_only", "read messages");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    const company = await db.company.findUnique({
      where: { id: member.companyId },
      select: { name: true },
    });
    const thread = demoThreads(new Date(), company?.name || "Demo").find((t) => t.id === id);
    if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ connection, thread });
  }

  // Company-scoped by findFirst, not findUnique — the id alone would serve
  // another tenant's conversation to anyone who guessed one.
  const thread = await db.messageThread.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      participantName: true,
      participantExternalId: true,
      lastMessageAt: true,
      unread: true,
      status: true,
      outcome: true,
      outcomeSetAt: true,
      clientId: true,
      leadId: true,
      jobId: true,
      quoteId: true,
      createdAt: true,
      channel: { select: { id: true, name: true, platform: true, status: true } },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          direction: true,
          body: true,
          attachments: true,
          sentAt: true,
          deliveredAt: true,
          readAt: true,
          failedReason: true,
          sentByUserId: true,
        },
      },
    },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    connection,
    thread: {
      ...thread,
      platform: thread.channel?.platform || null,
      channelName: thread.channel?.name || null,
    },
  });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Recording what a conversation became is a change to the company's sales
  // record, so it sits at the same rung as editing a request — not at the
  // read rung the list uses.
  try {
    requireLevel(await graded(member), "requests", "view_create_edit", "update a conversation");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const connection = await messagingConnection(member.companyId);
  if (connection.mock) {
    // A demo's threads are computed, not stored, so there is nothing to write.
    // Said plainly rather than answered 200 — a demo that pretends to save is
    // the dead control in its most misleading form, because the next screen
    // shows the old value and nobody knows why.
    return NextResponse.json(
      { error: "This is a sample conversation, so changes to it aren't saved." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));

  const existing = await db.messageThread.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = {};

  if ("outcome" in body) {
    const outcome = normaliseOutcome(body.outcome);
    if (outcome === undefined) {
      return NextResponse.json({ error: "Unknown outcome." }, { status: 400 });
    }
    data.outcome = outcome;
    // Cleared together. An outcomeSetAt left behind on a cleared outcome would
    // let the review believe somebody judged a thread they un-judged.
    data.outcomeSetAt = outcome ? new Date() : null;
    data.outcomeSetById = outcome ? member.userId || null : null;
  }

  if ("status" in body) {
    const status = normaliseStatus(body.status);
    if (status === undefined) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    data.status = status;
  }

  // Marking read. A number, not a boolean, so the badge behaves like a phone's.
  if (body.read === true) data.unread = 0;

  const { clientId, leadId, jobId, quoteId } = body;
  const linking = { clientId, leadId, jobId, quoteId };
  const naming = Object.fromEntries(
    Object.entries(linking).filter(([, v]) => typeof v === "string" && v),
  );
  if (Object.keys(naming).length) {
    // Every one of these is a foreign key written from request data, and each
    // is in OWNED_ID_FIELDS. Without this, a crafted PATCH would attach
    // another tenant's client to a conversation in this one — and the thread
    // payload would then hand that client's name back.
    const bad = await ownedIdsRefusal(NextResponse, db, member.companyId, naming);
    if (bad) return bad;
    Object.assign(data, naming);
  }
  // An explicit null clears a link. Distinguished from "absent" so a PATCH
  // that only sets an outcome does not silently unlink a client.
  for (const key of ["clientId", "leadId", "jobId", "quoteId"]) {
    if (key in body && body[key] === null) data[key] = null;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const thread = await db.messageThread.update({
    where: { id: existing.id },
    data,
    select: {
      id: true,
      outcome: true,
      outcomeSetAt: true,
      status: true,
      unread: true,
      clientId: true,
      leadId: true,
      jobId: true,
      quoteId: true,
    },
  });

  return NextResponse.json({ thread });
}
