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
import { sendMetaMessage } from "@/lib/messaging/metaSend";
import { channelForExternalId } from "@/lib/messaging/channels";
import { respondToMessage } from "./respond";
import { MODE_AUTO, sendMode } from "./decide";

/**
 * @param companyId  from the CHANNEL row — never from a webhook payload. The
 *                   caller has already resolved it that way; this function
 *                   takes it as a fact and scopes every read with it.
 * @returns { acted, reason } — advisory. The caller ignores it, deliberately:
 *                   the message is already stored and nothing about the
 *                   webhook's response depends on this.
 */
export async function aiEmployeeOnInbound({ companyId, threadId, messageId }) {
  try {
    const employee = await db.aiEmployee.findUnique({
      where: { companyId },
      select: { enabled: true, autoReplyEnabled: true },
    });

    // The cheap door. Most companies have no employee, and the ones that do
    // mostly have it off — reading one small row is the whole cost for them,
    // and no model call, no source read and no reply row happen at all.
    if (!employee?.enabled) return { acted: false, reason: "disabled" };

    const auto = sendMode(employee) === MODE_AUTO;

    const result = await respondToMessage({
      companyId,
      threadId,
      messageId,
      // SUGGEST passes no sender, so respondToMessage cannot send even if the
      // mode were misread — the capability is absent rather than declined,
      // which is the same argument lib/aiEmployee/roles.js makes about tools.
      send: auto ? (text) => deliver({ companyId, threadId, text }) : null,
    });

    return { acted: Boolean(result.replied || result.suggested), reason: result.reason || null };
  } catch (err) {
    console.error("[aiEmployee] inbound hook failed:", err?.message);
    return { acted: false, reason: "error" };
  }
}

/**
 * Send one automatic reply and record it as a Message on the thread.
 *
 * Goes through sendMetaMessage — the messaging feature's own send, with its
 * private-note refusal, its channel checks and its Meta error classification.
 * There is no second send path here and there must never be one.
 */
async function deliver({ companyId, threadId, text }) {
  const thread = await db.messageThread.findFirst({
    where: { id: threadId, companyId },
    select: {
      participantExternalId: true,
      channel: { select: { platform: true, externalId: true } },
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

  const sent = await sendMetaMessage({
    channel,
    recipientExternalId: thread.participantExternalId,
    text,
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
