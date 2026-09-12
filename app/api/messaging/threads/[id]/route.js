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
  hasLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { messagingConnection } from "@/lib/messaging/channels";
import { serviceWindowNotice, needsServiceWindow } from "@/lib/messaging/serviceWindow";
import { publicTemplateShape } from "@/lib/messaging/templates";
import { publicAttachments } from "@/lib/messaging/attachments";
import { demoThreads } from "@/lib/messaging/demoThreads";
import {
  normaliseOutcome,
  normaliseStatus,
  normaliseSnoozeUntil,
  readStatus,
} from "@/lib/messaging/outcomes";
import { writeActivity } from "@/lib/messaging/activity";
import { recordError, errorDetail } from "@/lib/platform/errorLog";

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
    return await readThread({ id, member });
  } catch (err) {
    // An empty 500 is what this route answered for a day while the schema
    // lacked a relation it selected, and nothing named the cause anywhere a
    // person could read it. The message goes to the platform error log
    // (never to the browser — a Prisma message names columns) and the
    // browser gets a sentence it can show.
    console.error(`[messaging/thread] GET ${id} threw: ${err?.message || err}`);
    await recordError({
      area: "messaging",
      code: "thread_read_threw",
      message: `Thread ${id} could not be read: ${err?.message || "unknown"}`,
      companyId: member.companyId,
      detail: errorDetail(err),
    });
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment." }, { status: 500 });
  }
}

async function readThread({ id, member }) {

  // Graded once and kept: the read gate below needs it, and so do the two
  // booleans at the bottom of this response that decide whether a control on a
  // contact card or a dropped pin is drawn at all.
  const full = await graded(member);
  try {
    requireLevel(full, "requests", "view_only", "read messages");
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  // ── Who may act on a contact card or a pin ──────────────────────────────
  //
  // "Add as a client" posts to /api/clients and "save this as the client's
  // address" patches /api/clients/[id]; BOTH of those routes require
  // clientsProperties: full_edit and refuse anyone else. That refusal is the
  // guard. This boolean is what stops a crew member meeting it — a button that
  // 403s is a dead control wearing a permission check, which is the same
  // argument the Retry endpoint's header makes for sitting at the read rung.
  const canEditClients = hasLevel(full, "clientsProperties", "full_edit");

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
      statusChangedAt: true,
      snoozedUntil: true,
      assignedToId: true,
      threadNumber: true,
      waitingSince: true,
      firstInboundAt: true,
      firstReplyAt: true,
      outcome: true,
      outcomeSetAt: true,
      clientId: true,
      leadId: true,
      jobId: true,
      quoteId: true,
      createdAt: true,
      // The 24-hour customer service window's one input, turned into a notice
      // below rather than handed to the browser raw: the DECISION ("may free
      // text be sent right now") is made server-side, once, by the same
      // function the send path uses — a browser that computed it from a
      // timestamp would be a second answer, in a different clock, that could
      // disagree with the refusal it is about to get.
      lastInboundAt: true,
      // The linked client's name, for the one sentence that needs it: "save
      // this pin as Sandra Cole's address". Only ever returned to somebody who
      // may edit clients (see below), so this is not a new disclosure — it is
      // a name that person can already read on the clients screen.
      client: { select: { id: true, name: true } },
      channel: { select: { id: true, name: true, platform: true, status: true } },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          direction: true,
          // The note and the system line, in the same column as the
          // conversation — which is the whole reason they were stored on
          // Message rather than in a sidebar nobody opens.
          private: true,
          activity: true,
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

  // ── "Send our address", and whether there is one to send ────────────────
  //
  // The composer draws that control only when this is non-null. The
  // coordinates deliberately do NOT travel to the browser: the reply route
  // reads them again, itself, at the moment of sending (see
  // whatsAppLocationPayload for why a browser must never name a pin). What
  // goes down is the LABEL — what the contractor is about to send — because a
  // "Send our address" button that does not say which address is a control
  // nobody can check before pressing.
  //
  // Null when the company has never been geocoded, which is the normal state
  // for a company whose address was typed rather than picked from the
  // autocomplete. No control, no dead button, and the reply route refuses the
  // same case with a sentence naming the fix.
  const company = needsServiceWindow(thread.channel?.platform)
    ? await db.company
        .findUnique({
          where: { id: member.companyId },
          select: { name: true, address: true, city: true, latitude: true, longitude: true },
        })
        .catch(() => null)
    : null;
  const companyLocation =
    company && company.latitude != null && company.longitude != null
      ? { label: [company.name, company.address, company.city].filter(Boolean).join(", ") }
      : null;

  return NextResponse.json({
    connection,
    thread: {
      ...thread,
      // Only for somebody who could act on it. A crew member sees the contact
      // card and the pin — those are the message — and not the two buttons
      // that would 403.
      client: canEditClients ? thread.client : null,
      canEditClients,
      companyLocation,
      // ── The attachments, shaped and stripped ─────────────────────────────
      //
      // publicAttachments is the same kind of boundary publicChannelShape is
      // for a token: it drops `sourceUrl` (a signed, expiring Meta CDN link,
      // and for WhatsApp one that only resolves with the company's own access
      // token) and `mediaId` (Meta's handle, which the browser has no use for
      // — the Retry endpoint names an INDEX for exactly that reason). What
      // reaches the screen is the state, the type, and a Cloudinary URL or
      // null.
      messages: thread.messages.map((m) => ({
        ...m,
        attachments: publicAttachments(m.attachments),
      })),
      // Normalised on the way out so a row still carrying the pre-four-state
      // "closed" arrives at the screen as a status the chips actually draw.
      status: readStatus(thread.status),
      platform: thread.channel?.platform || null,
      channelName: thread.channel?.name || null,
      // Null on Facebook and Instagram — they have no window of ours, and a
      // notice object on every thread would make the composer test which
      // platform it was drawing rather than "is there a notice".
      serviceWindow: needsServiceWindow(thread.channel?.platform)
        ? serviceWindowNotice({
            platform: thread.channel.platform,
            lastInboundAt: thread.lastInboundAt,
          })
        : null,
      // The approved templates, and ONLY on a WhatsApp thread. This is what
      // makes the closed-window message something a contractor can act on
      // instead of a dead end — a composer that said "the window has closed"
      // and offered nothing would be honest and useless.
      templates: needsServiceWindow(thread.channel?.platform)
        ? (
            await db.whatsAppTemplate
              .findMany({
                where: { companyId: member.companyId, status: "APPROVED" },
                orderBy: { name: "asc" },
              })
              .catch(() => [])
          ).map(publicTemplateShape)
        : [],
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

  // Every field an activity line might need to say what CHANGED. A "status
  // changed to pending" line written without knowing the status was already
  // pending is a log that fills with events that never happened, and a log
  // full of non-events is one nobody reads.
  const existing = await db.messageThread.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      status: true,
      snoozedUntil: true,
      outcome: true,
      assignedToId: true,
      clientId: true,
      leadId: true,
      jobId: true,
      quoteId: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Who is doing this, by name, for the activity lines. Read through Member so
  // the lookup is company-scoped, and tolerated as null: an activity that
  // cannot name its actor says "Snoozed" rather than "Snoozed by undefined".
  const actorName = member.userId
    ? await db.member
        .findFirst({
          where: { companyId: member.companyId, userId: member.userId },
          select: { user: { select: { name: true } } },
        })
        .then((row) => row?.user?.name || null)
        .catch(() => null)
    : null;

  const data = {};
  // { type, ...fields } for each line to write alongside the update.
  const activities = [];

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
    if (outcome !== existing.outcome) {
      activities.push(
        outcome
          ? { type: "outcome_set", outcome, by: actorName }
          : { type: "outcome_cleared", by: actorName },
      );
    }
  }

  // ── The four states, and the snooze that has to come back ────────────────
  //
  // `snoozedUntil` is handled with the status rather than beside it, because
  // the two cannot be allowed to disagree. A thread snoozed with no deadline
  // is parked forever with nothing to bring it back; a deadline on a thread
  // that is not snoozed is a date nothing reads. Both are the shape of bug
  // AGENTS.md's first rule names, and both are refused here.
  if ("status" in body) {
    const status = normaliseStatus(body.status);
    if (status === undefined) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }

    if (status === "snoozed") {
      const until = normaliseSnoozeUntil(body.snoozedUntil);
      if (until === undefined || until === null) {
        return NextResponse.json(
          {
            error:
              "Choose when this should come back. A snooze with no date is a conversation nobody sees again.",
          },
          { status: 400 },
        );
      }
      data.snoozedUntil = until;
    } else {
      // Leaving a stale deadline on a thread that is no longer snoozed would
      // let /api/cron/messaging-snooze "return" a thread that was never away.
      data.snoozedUntil = null;
    }

    data.status = status;
    if (status !== readStatus(existing.status)) {
      data.statusChangedAt = new Date();
      activities.push(
        status === "snoozed"
          ? { type: "snoozed", by: actorName }
          : { type: "status_changed", to: status, by: actorName },
      );
    }
  }

  // Marking read. A number, not a boolean, so the badge behaves like a phone's.
  if (body.read === true) data.unread = 0;

  const { clientId, leadId, jobId, quoteId, assignedToId } = body;
  // assignedToId rides with the links because it is the same KIND of value: a
  // foreign key written straight from a request body. It is already in
  // OWNED_ID_FIELDS, where it is proved by team membership rather than by
  // owning a row ("that person isn't on your team") — which is why the column
  // is named assignedToId and not assignedToUserId. A differently-named column
  // would be a foreign key the tenant sweep never looks at.
  const linking = { clientId, leadId, jobId, quoteId, assignedToId };
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
  for (const key of ["clientId", "leadId", "jobId", "quoteId", "assignedToId"]) {
    if (key in body && body[key] === null) data[key] = null;
  }

  // ── The lines that make a month-end read a story ─────────────────────────
  //
  // The reply, then the quote going out, then the job — in one column, in
  // order. This is the half of Chatwoot's activity messages that earns its
  // place here: a quote and a job already exist as rows on other screens, and
  // the conversation is where somebody decides whether the reply worked.
  for (const kind of ["client", "lead", "job", "quote"]) {
    const key = `${kind}Id`;
    if (!(key in data)) continue;
    if (data[key] === existing[key]) continue;
    activities.push(
      data[key]
        ? { type: "linked", kind, by: actorName }
        : { type: "unlinked", kind, by: actorName },
    );
  }
  if ("assignedToId" in data && data.assignedToId !== existing.assignedToId) {
    if (data.assignedToId) {
      // The assignee's name, captured now. An activity row is a historical
      // record: whoever this was, they took the thread on this date, and that
      // stays true after they leave the company.
      const assignee = await db.member
        .findFirst({
          where: { companyId: member.companyId, userId: data.assignedToId },
          select: { user: { select: { name: true } } },
        })
        .then((row) => row?.user?.name || null)
        .catch(() => null);
      // No name, no line. "Assigned to" with nothing after it is worse than
      // silence, and ownedIdsRefusal has already proved the person is real.
      if (assignee) activities.push({ type: "assigned", to: assignee, by: actorName });
    } else {
      activities.push({ type: "unassigned", by: actorName });
    }
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  // One transaction. A status that moved with no line saying so is a worse
  // record than no line at all, because the column then looks complete — the
  // same argument lib/migrations/writes.js makes for logging a migration write
  // inside the write's own transaction.
  const thread = await db.$transaction(async (tx) => {
    const updated = await tx.messageThread.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        outcome: true,
        outcomeSetAt: true,
        status: true,
        statusChangedAt: true,
        snoozedUntil: true,
        assignedToId: true,
        unread: true,
        clientId: true,
        leadId: true,
        jobId: true,
        quoteId: true,
      },
    });
    for (const entry of activities) {
      await writeActivity(tx, { threadId: existing.id, ...entry });
    }
    return updated;
  });

  return NextResponse.json({ thread: { ...thread, status: readStatus(thread.status) } });
}
