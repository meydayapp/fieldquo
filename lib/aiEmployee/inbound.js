// lib/aiEmployee/inbound.js
//
// The one line lib/messaging/ingest.js adds: a homeowner's message has landed,
// should the AI employee answer it?
//
// ══ Why this file exists rather than five lines inside ingest.js ═══════════
//
// ingest.js is the tenant-boundary file of the messaging feature and it is
// under active change. Everything this hook needs — the employee's mode, the
// send, the outbound Message row, the failure recording — lives here, so that
// file gains an import and a call and nothing else.
//
// ══ Best effort, always ════════════════════════════════════════════════════
//
// The caller is a webhook Meta retries. A failure here must never turn a
// stored message into a 500 that Meta reads as a failed delivery, so every
// path returns and nothing throws — the same contract lib/voice/autoDraft.js
// keeps with the call webhook, and for the same reason.
//
// ══ AUTO writes the outbound row itself, and says when it did not send ═════
//
// The reply route writes a Message row with `failedReason` set when a send
// refuses, precisely so the conversation keeps the record that somebody tried
// and it did not go — and so lib/messaging/monthlyReview.js does not count it
// as an answer. An automatic reply has to obey the same rule, which is why the
// row is written from the send's own verdict rather than optimistically.

import { db } from "@/lib/db";
import { sendOnChannel } from "@/lib/messaging/send";
import { channelForExternalId } from "@/lib/messaging/channels";
import { respondToMessage } from "./respond";
import { sendMode } from "./decide";
import { mayActAlone, RISK_REVERSIBLE } from "./permission";
import { autoMessageGate } from "@/lib/clients/autoMessages";
import { humanTookOver } from "./routing";

/**
 * @param companyId  from the CHANNEL row — never from a webhook payload. The
 *                   caller has already resolved it that way; this function
 *                   takes it as a fact and scopes every read with it.
 * @returns { acted, reason } — advisory. The caller ignores it, deliberately:
 *                   the message is already stored and nothing about the
 *                   webhook's response depends on this.
 */
export async function aiEmployeeOnInbound({ companyId, threadId, messageId, platform = null, language = null }) {
  try {
    // "web" and "sms" are channels of their own; Meta's three are one.
    const channel = platform === "web" ? "web" : platform === "sms" ? "sms" : "meta";

    // The cheap door: most companies have no employee, and the ones that do
    // mostly have it off — one small count is the whole cost for them, and
    // no model call, no source read and no reply row happen at all. WHICH
    // employee answers is no longer decided here: lib/aiEmployee/routing.js
    // assigns the thread inside respondToMessage, and the assignee need not
    // be the one whose switch for this channel is on (a closer takes a
    // price question that arrived on the receptionist's web chat).
    const anyOn = await db.aiEmployee.count({ where: { companyId, enabled: true } });
    if (!anyOn) return { acted: false, reason: "disabled" };

    const result = await respondToMessage({
      companyId,
      threadId,
      messageId,
      channel,
      language,
      // The sender re-reads the SENDING employee's mode at the moment of
      // sending, under companyId, and refuses in `ask`. respondToMessage
      // already declines to call it then; this is the second, independent
      // check — the capability is withheld rather than declined, which is
      // the same argument lib/aiEmployee/roles.js makes about tools. Keyed
      // on the employee respond.js names, not the thread's current holder:
      // after a hand-off the thread already belongs to the colleague while
      // the first employee's one-line "they'll take it from here" is going.
      send: (text, { employeeId } = {}) => guardedDeliver({ companyId, threadId, employeeId, text }),
    });

    return {
      acted: Boolean(result.replied || result.suggested),
      replied: Boolean(result.replied),
      handedOff: Boolean(result.handedOff),
      reason: result.reason || null,
    };
  } catch (err) {
    console.error("[aiEmployee] inbound hook failed:", err?.message);
    return { acted: false, reason: "error" };
  }
}


/**
 * Somebody who is not this employee just answered the customer.
 *
 * ══ The hole this closes ═══════════════════════════════════════════════════
 *
 * The employee stands down when a person takes a thread over, and until now it
 * could only SEE that happen in one place: the reply route, which stamps
 * MessageThread.humanTookOverAt (lib/aiEmployee/routing.js). That covers a
 * contractor who answers inside FieldQuo and nothing else — so the contractor
 * who picks up their phone and answers in Messenger, which is most of them,
 * was invisible. The employee carried on replying underneath them.
 *
 * Observed on a real thread: a person answered the customer at 8:18, 8:19 and
 * 8:20 from Messenger; the employee replied over them at 8:18, 8:19 and 8:21;
 * humanTookOverAt stayed null throughout.
 *
 * `respond.js`'s humanRepliedSince() cannot be widened to fix this. It counts
 * outbound messages with a sentByUserId, and an echo has none — widening it to
 * "any outbound" would make the employee read its OWN reply as a human and
 * stop itself on its first turn, which is the trap the comment there warns
 * about.
 *
 * ══ The discriminator, and why it cannot drift ═════════════════════════════
 *
 * Whether the ingest CREATED the row. Every message FieldQuo sends is stored
 * with the mid Meta's Send API returned, so Meta's echo of it upserts onto the
 * row that already exists; an echo of a message FieldQuo did not send has an
 * id nothing holds and creates one. That is the same @@unique([threadId,
 * externalId]) the ingest's idempotency already rests on, so there is no
 * second rule here to fall out of step with the first.
 *
 * ══ What this cannot tell apart, stated plainly ════════════════════════════
 *
 * A person typing and the PAGE'S OWN Meta automation answering look identical
 * in the webhook: both are outbound, both carry no user, and Meta offers
 * nothing that separates them. Both stand the employee down, and that is the
 * safe direction — two bots answering one customer in turn is the failure this
 * whole change exists to stop, and the inbox shows "Let {name} continue" to
 * undo it in one click. The reverse mistake is silent and reaches the customer.
 *
 * @returns { acted, reason } — advisory, like aiEmployeeOnInbound above.
 */
export async function aiEmployeeOnOutboundEcho({ companyId, threadId, body = "", sentAt = null, prisma = db }) {
  try {
    const thread = await prisma.messageThread.findFirst({
      where: { id: threadId, companyId },
      select: { id: true, assignedEmployeeId: true, humanTookOverAt: true },
    });
    // Already theirs. Re-stamping on every later echo would move the moment a
    // person took over to whenever they last typed, and that timestamp is read
    // by the handling timeline.
    if (!thread || thread.humanTookOverAt) return { acted: false, reason: "already" };

    // ── Our own reply, arriving before we had finished recording it ────────
    //
    // The send path writes its Message row AFTER the Send API returns the mid
    // (lib/aiEmployee/inbound.js's guardedDeliver below), so a fast echo can
    // reach the ingest in between and create the row first. Matched on the
    // TEXT rather than on timing: a clock window would be a number to tune for
    // ever, and the text is exact.
    const text = String(body || "").trim();
    if (text) {
      const mine = await prisma.aiEmployeeReply.count({
        where: {
          threadId,
          sentAt: { not: null },
          draftText: text,
        },
      });
      if (mine) return { acted: false, reason: "own_echo" };
    }

    await humanTookOver({
      prisma,
      companyId,
      thread,
      // No userId: whoever typed it did so outside FieldQuo, so there is no
      // member to name. The routing log records the take-over without one
      // rather than inventing an attribution.
      userId: null,
      at: sentAt instanceof Date ? sentAt : new Date(),
    });
    return { acted: true, reason: "echo" };
  } catch (err) {
    // Never throws at the ingest: the message is stored either way, and a
    // webhook that 500s over this would have Meta redeliver it for hours.
    console.error("[aiEmployee] take-over on echo failed:", err?.message);
    return { acted: false, reason: "error" };
  }
}

/** The mode gate at the moment of sending — see the call site above. */
async function guardedDeliver({ companyId, threadId, employeeId, text }) {
  const employee = employeeId
    ? await db.aiEmployee.findFirst({ where: { id: employeeId, companyId }, select: { mode: true, enabled: true } })
    : null;
  if (!employee || employee.enabled !== true) return { ok: false, reason: "no_employee" };
  if (!mayActAlone({ mode: sendMode(employee), risk: RISK_REVERSIBLE, tainted: true })) {
    return { ok: false, reason: "mode_ask" };
  }
  // "No automatic emails or texts" on the client this conversation is filed
  // under (lib/clients/autoMessages.js — the one shared gate). A model
  // writing to a client who asked for messages by hand only is exactly what
  // the switch is for. Refused like mode_ask: respond.js keeps the draft as a
  // suggestion (suppressedReason "send_failed:auto_messages_off") for a
  // person to send or not, and the client page lists it.
  const filed = await db.messageThread.findFirst({ where: { id: threadId, companyId }, select: { clientId: true } });
  if (filed?.clientId) {
    const gate = await autoMessageGate(db, {
      companyId,
      clientId: filed.clientId,
      sender: "ai_employee_reply",
      ref: { type: "thread", id: threadId },
    });
    if (!gate.allowed) return { ok: false, reason: gate.reason };
  }
  return deliver({ companyId, threadId, text });
}

/**
 * Send one automatic reply and record it as a Message on the thread.
 *
 * Goes through sendOnChannel — the messaging feature's own send, with its
 * private-note refusal, its channel checks, its 24-hour window refusal on
 * WhatsApp, its Meta error classification, and its web-chat and SMS branches
 * (lib/messaging/ownSend.js). There is no second send path here and there
 * must never be one; WHICH API the reply leaves over is decided in
 * lib/messaging/send.js from the channel's platform, not here.
 */
async function deliver({ companyId, threadId, text }) {
  const thread = await db.messageThread.findFirst({
    where: { id: threadId, companyId },
    select: {
      participantExternalId: true,
      channel: { select: { platform: true, externalId: true } },
      // The 24-hour customer service window (WhatsApp, Facebook and
      // Instagram — lib/messaging/platforms.js). lib/aiEmployee/decide.js
      // has already refused a reply outside it, so this is the second of two
      // — deliberately, and for the same reason the private-note refusal in
      // metaSend.js sits below the route that already avoids it: the guard
      // that survives somebody wiring a new caller in later.
      lastInboundAt: true,
    },
  });
  if (!thread) return { ok: false, reason: "unknown_thread" };

  // Re-read through the ONE door onto MessagingChannel, so the token is
  // decrypted at the moment of use and never carried around — see
  // lib/messaging/channels.js's header.
  const channel = await channelForExternalId(
    thread.channel?.platform,
    thread.channel?.externalId,
  );

  const sent = await sendOnChannel({
    channel,
    recipientExternalId: thread.participantExternalId,
    text,
    lastInboundAt: thread.lastInboundAt,
    // Free text, never a template. An approved template is a business-INITIATED
    // message with money and a policy behind it, and choosing to send one is a
    // decision for a person — see decide.js's OUTSIDE_SERVICE_WINDOW note.
    kind: "text",
  });

  // Written either way. A send that failed leaves a row carrying WHY, so the
  // conversation shows that an answer was attempted and did not go — never a
  // sent-looking bubble the homeowner never received.
  await db.message
    .create({
      data: {
        threadId,
        direction: "out",
        private: false,
        externalId: sent.ok && sent.externalId ? sent.externalId : `local:${crypto.randomUUID()}`,
        body: text,
        sentAt: new Date(),
        // Null, and that is the fact rather than an omission: the messaging
        // schema says an outbound message written by an automation has no
        // user, and this is the automation it was talking about.
        sentByUserId: null,
        failedReason: sent.ok ? null : `${sent.reason}`,
      },
    })
    .catch((err) => {
      console.error("[aiEmployee] failed to record outbound message:", err?.message);
    });

  return sent;
}
