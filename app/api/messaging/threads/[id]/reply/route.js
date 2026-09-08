// app/api/messaging/threads/[id]/reply/route.js
//
// Answering a homeowner.
//
// Three platforms, one route. Which API the reply leaves over is decided once,
// in lib/messaging/send.js, from the channel's own platform — this file does
// not know the difference and must not learn it.
//
// ══ The refusal is the point ═══════════════════════════════════════════════
//
// Neither pages_messaging nor whatsapp_business_messaging is approved for this
// app yet (lib/meta/client.js, META_MESSAGING_SCOPE and META_WHATSAPP_SCOPE),
// so today this route ALWAYS takes its refusal branch for a real company. It
// refuses loudly:
//
//   * 409 with the reason in the body, not a 200;
//   * a Message row IS written, direction "out", with `failedReason` set — so
//     the conversation keeps the record that somebody tried to answer and the
//     answer did not go, which is exactly what the month-end review needs to
//     not count it as a reply (lib/messaging/monthlyReview.js ignores failed
//     outbound messages when measuring response time);
//   * the screen disables the composer with the reason ON it, so nobody
//     reaches this in normal use.
//
// On WhatsApp there is a FOURTH refusal that will still fire on a fully
// approved, fully connected number: free text outside the 24-hour customer
// service window. It behaves identically — 409, a named reason
// (`service_window_closed`), a Message row carrying it — and the composer
// offers an approved template instead rather than a dead box.
//
// The alternative — writing a sent-looking message and returning 200 — is the
// exact failure AGENTS.md's first rule names, with a homeowner on the other
// end of it.
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
import { sendOnChannel, sendMockOnChannel } from "@/lib/messaging/send";
import { renderTemplateBody } from "@/lib/messaging/templates";
import { responseStamps } from "@/lib/messaging/waiting";
import { readStatus } from "@/lib/messaging/outcomes";
import { writeActivity } from "@/lib/messaging/activity";
import { rateLimit } from "@/lib/rateLimit";

const MAX_LENGTH = 2000; // Meta's own limit for a text message.

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Sending to a customer is a write against the company's relationship with
  // them, so it sits at the same rung as editing a request — never at the read
  // rung the inbox list uses.
  try {
    requireLevel(
      { ...member, permissions: member.id ? (await loadEnforceableMember(db, member.id))?.permissions ?? null : null },
      "requests",
      "view_create_edit",
      "reply to a message",
    );
  } catch (err) {
    const refusal = permissionErrorResponse(err);
    return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const limited = rateLimit(request, "messaging-reply", {
    limit: 60,
    windowMs: 60 * 1000,
    message: "You're sending replies faster than we can pass them on. Give it a moment.",
  });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";

  // ── Two kinds of send, and only WhatsApp has the second ────────────────
  //
  // "text" is a reply somebody typed. "template" is the ONLY thing WhatsApp
  // accepts once the 24-hour customer service window has closed — a message
  // Meta approved in advance, filled in with values. The browser names the
  // template by id and sends its fill-in values; it never sends a body, so
  // there is no way to put arbitrary words inside an approved template from
  // outside.
  const kind = body.kind === "template" ? "template" : "text";
  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  // NOT `params` — that name belongs to the route's own path parameters, which
  // are a Promise in Next 16 and are awaited at the top of this function.
  const templateParams = Array.isArray(body.params)
    ? body.params.slice(0, 10).map((p) => String(p ?? "").slice(0, 500))
    : [];

  if (kind === "text") {
    if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
    if (text.length > MAX_LENGTH) {
      return NextResponse.json(
        { error: `Messages can be up to ${MAX_LENGTH} characters.` },
        { status: 400 },
      );
    }
  } else if (!templateId) {
    return NextResponse.json({ error: "Pick a template first." }, { status: 400 });
  }

  const connection = await messagingConnection(member.companyId);

  // The demo company. Nothing leaves the building and nothing is stored — its
  // threads are computed — so this says what happened rather than showing a
  // bubble that will be gone on refresh.
  if (connection.mock) {
    const mock = sendMockOnChannel(connection.channels?.[0]?.platform || "facebook");
    return NextResponse.json(
      {
        sent: false,
        mock: true,
        externalId: mock.externalId,
        reason: "demo",
        error: "This is a sample conversation — replies aren't sent, and aren't kept.",
      },
      { status: 409 },
    );
  }

  // Company-scoped: the id alone would let a member reply into another
  // tenant's conversation, which is the worst possible shape of this bug —
  // their customer, our contractor's words.
  const thread = await db.messageThread.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      participantExternalId: true,
      channelId: true,
      channel: true,
      // The response clock, and the state it is in. Both read BEFORE the send
      // so the stamps below are computed against what was true when the
      // contractor pressed the button.
      status: true,
      firstInboundAt: true,
      firstReplyAt: true,
      waitingSince: true,
      // The 24-hour customer service window's one input. Read here, in the
      // same query as everything else, so the window is judged against what
      // was true when the contractor pressed the button — and so the send
      // path is handed a FACT rather than being left to look it up, which
      // would make it a second thing that reads the database.
      lastInboundAt: true,
    },
  });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── The template, resolved from OUR rows and never from the request ─────
  //
  // The browser sends an id. What gets sent to Meta is built from the row that
  // id names, company-scoped — the same rule AGENTS.md's non-negotiable #5
  // states for money: the client names a thing, the server looks it up. A
  // request carrying a template BODY would be a way to send arbitrary text
  // dressed as an approved template, which is the whole rule WhatsApp's
  // template system exists to enforce.
  let template = null;
  if (kind === "template") {
    template = await db.whatsAppTemplate.findFirst({
      where: { id: templateId, companyId: member.companyId },
    });
    if (!template) {
      return NextResponse.json({ error: "That template no longer exists." }, { status: 404 });
    }
  }

  const result = await sendOnChannel({
    channel: thread.channel,
    recipientExternalId: thread.participantExternalId,
    text,
    // The window, and what is being sent into it. Passed rather than looked
    // up: lib/messaging/whatsappSend.js refuses free text outside the window
    // by name (`service_window_closed`) BEFORE calling Meta, and the same
    // reason comes back if Meta refuses it anyway.
    lastInboundAt: thread.lastInboundAt,
    kind,
    template,
    params: templateParams,
    // Stated explicitly, at the one call site that legitimately sends. A reply
    // typed into the composer's Reply side is never private and never anything
    // but outbound — and saying so here means lib/messaging/metaSend.js's
    // refusal is exercised by the real caller rather than only by the check.
    private: false,
    direction: "out",
  });

  // Written either way. A failed send that left no trace would make the
  // conversation read as though nobody ever tried.
  const message = await db.message.create({
    data: {
      threadId: thread.id,
      direction: "out",
      // Never private. A reply is the opposite of a note, and writing the
      // column here rather than leaning on its default keeps the two provably
      // consistent for every row this route creates.
      private: false,
      // A send that never reached Meta has no Meta id, so one is minted here.
      // Still an id, still unique per thread, still what a retry would key on.
      externalId: result.ok ? result.externalId : `local:${crypto.randomUUID()}`,
      // What was actually sent. For a template that is the approved body with
      // the fill-in values substituted — the sentence the homeowner will read
      // — and not the template's name: a thread showing "appointment_reminder"
      // where a message should be is a record of a message nobody can read.
      body: kind === "template" ? renderTemplateBody(template.body, templateParams) : text,
      sentAt: new Date(),
      sentByUserId: member.userId || null,
      failedReason: result.ok ? null : `${result.reason}: ${result.message}`,
    },
    select: {
      id: true,
      direction: true,
      body: true,
      sentAt: true,
      failedReason: true,
      sentByUserId: true,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { sent: false, reason: result.reason, error: result.message, message },
      { status: 409 },
    );
  }

  // ── Only a real send moves the conversation on ───────────────────────────
  //
  // Clearing `unread` on a failed reply would tell the contractor they had
  // dealt with something they had not — which is why every line below is
  // behind the `!result.ok` return above.
  //
  // The status becomes PENDING, not open. That is what pending means: we
  // answered, the ball is theirs. Before the four states existed this line
  // forced "open", which left every answered conversation in the same pile as
  // the ones nobody had touched — the pile a contractor is supposed to be able
  // to clear. A snooze ends here too: replying is the opposite of parking it.
  const wasStatus = readStatus(thread.status);
  const stamps = responseStamps({
    thread,
    message: { direction: "out", private: false, failedReason: null, sentAt: message.sentAt },
  });

  await db.$transaction(async (tx) => {
    await tx.messageThread.update({
      where: { id: thread.id },
      data: {
        unread: 0,
        lastMessageAt: message.sentAt,
        status: "pending",
        snoozedUntil: null,
        ...(wasStatus === "pending" ? {} : { statusChangedAt: message.sentAt }),
        // firstReplyAt and waitingSince, from the ONE function the webhook
        // also calls — see lib/messaging/waiting.js for why this rule is not
        // written twice.
        ...stamps,
      },
    });
    if (wasStatus !== "pending") {
      await writeActivity(tx, {
        threadId: thread.id,
        type: "status_changed",
        to: "pending",
        at: message.sentAt,
      });
    }
  });

  return NextResponse.json({ sent: true, message });
}
