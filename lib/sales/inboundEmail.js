// lib/sales/inboundEmail.js
//
// One inbound email, from "a provider posted something" to "here is what
// happened to it" — shared by every route that receives a prospect's reply.
//
// ══ Why this was pulled out of the route ═══════════════════════════════════
//
// app/api/webhooks/inbound-sales-email/route.js was the only inbound door, so
// parse → file → record-the-misconfiguration lived inline in its POST. Then a
// second door was needed — Resend Receiving, because the reps' mailboxes are
// on a provider that cannot POST to a webhook at all (docs/SALES-OUTREACH.md
// §5b) — and the choice was a copy or a shared function. The copy is AGENTS.md
// failure class #4: the two doors would drift on which outcomes are logged,
// and the one nobody looked at would be the one that stopped logging.
//
// So the generic route and the Resend adapter both call ingestInboundEmail()
// with a payload in the SAME documented contract (the JSON body in
// docs/SALES-OUTREACH.md §5), and every rule about that payload — the token
// is never read from the sender, an echo of our own message is discarded, a
// duplicate is a duplicate — is applied once, in lib/sales/outreach.js and
// lib/sales/outreachInbound.js, whichever door it came through.
//
// ══ What this does NOT do ══════════════════════════════════════════════════
//
// Authenticate. Each door has its own credential — a shared bearer secret on
// one, a Svix signature on the other — and it is checked in the route, before
// the body is read, because a 401 must be a 401 (a misconfigured forwarder
// that gets a friendly 200 looks like it is working). Everything in here
// happens AFTER a request has proven who sent it.

import { parseInboundEmail } from "./outreach";
import { fileInboundMessage } from "./outreachInbound";
import { recordError as recordPlatformError } from "@/lib/platform/errorLog";
import { appSentence, pushToReps } from "@/lib/notify/push";
import { snippetOf } from "./emailInbox";

/**
 * Parse and file one inbound email.
 *
 * @param db       the Prisma client — a parameter, not an import, for the
 *                 reason lib/sales/outreachInbound.js gives: the check script
 *                 runs the real function against a fake client.
 * @param payload  the documented inbound contract (docs/SALES-OUTREACH.md §5)
 * @param source   which door this came through, for the error log — "forwarder"
 *                 or "resend". Never trusted for anything but the log line.
 * @param recordError  the platform error log, injectable for the same reason
 *                 `db` is: the check script asserts that a misconfiguration
 *                 IS logged, which needs to see the call.
 *
 * @returns { status, body, parsed }
 *   `status` is the HTTP status the route should answer with and `body` the
 *   JSON — the route returns them as-is, so the two doors cannot answer the
 *   same outcome differently. `parsed` is the normalised message, for the
 *   caller that needs to act on the outcome afterwards (the Resend adapter
 *   forwards the mail on to the rep and needs the token and subject).
 *
 * Everything past authentication is a 200 with a reason, never a 4xx — the
 * caller is a mail forwarder, and a 4xx to a forwarder means a retry storm or
 * a bounce back to the prospect. The one exception is a failure that is OURS
 * (the database refused the write), which is a 500 because it is worth a
 * retry.
 */
export async function ingestInboundEmail(
  db,
  payload,
  {
    source = "forwarder",
    recordError = recordPlatformError,
    // The domain Resend receives at (docs/SALES-OUTREACH.md §5b), for the
    // sender fallback's "which of our mailboxes was written to" half.
    // Undefined through the generic door, where the To is the rep's own
    // mailbox and the fallback matches it by exact address instead.
    replyDomain,
    // The push to the rep. Injectable so the check script can assert it is
    // called for a filed reply and NOT for an echo, a duplicate or an opt-out.
    notify = notifyRepOfReply,
  } = {},
) {
  const parsed = parseInboundEmail(payload);

  try {
    const result = await fileInboundMessage(db, parsed, { replyDomain });

    if (result.filed) {
      // Best-effort and after the write: a reply nobody is told about is a
      // reply answered late, but a push that fails must never un-file it.
      await notify(db, { result, parsed }).catch(() => {});
    }

    if (
      !result.filed &&
      (result.reason === "no_token" || result.reason === "unknown_token" || result.reason === "ambiguous_sender")
    ) {
      // The two reasons that mean somebody's setup is wrong rather than a
      // message being an ordinary duplicate. Recorded with the sender REDACTED
      // to its domain: this is a prospect's personal address arriving on a path
      // that could not be matched, and an error log is the wrong place to
      // accumulate those.
      await recordError({
        area: "sales_inbound",
        code: result.reason,
        message:
          result.reason === "no_token"
            ? "An inbound sales email carried no reply token and its sender matched no lead"
            : result.reason === "ambiguous_sender"
              ? "An inbound sales email carried no reply token and its sender matched two leads"
              : "An inbound sales email carried a reply token no thread has",
        detail: {
          source,
          fromDomain: String(parsed.fromAddress || "").split("@").pop() || null,
          subject: parsed.subject,
          token: parsed.token,
        },
      }).catch(() => {});
    }

    return { status: 200, body: result, parsed };
  } catch (err) {
    await recordError({
      area: "sales_inbound",
      code: "file_failed",
      message: `Filing an inbound sales email failed: ${err.message}`,
      detail: { source, token: parsed.token },
    }).catch(() => {});
    // 500 here, deliberately unlike the outcomes above: this one IS worth a
    // retry, because the message is real and the failure was ours.
    return {
      status: 500,
      body: { filed: false, reason: "error", error: "Couldn't file that message." },
      parsed,
    };
  }
}

/**
 * Tell the rep a prospect wrote — a push to their subscribed browsers, in
 * their language, opening the thread. The SMS door does the same for a text
 * (lib/sales/salesSms.js); same shape, same reason: a lock screen is a public
 * place, so the body is the first line, cut short, and never the whole
 * message. Skipped for an opt-out: "unsubscribe" is not news to be excited
 * about, and the thread shows it.
 */
async function notifyRepOfReply(db, { result, parsed }) {
  if (!result?.threadId || result.optOut) return;
  const thread = await db.salesThread.findUnique({
    where: { id: result.threadId },
    select: { salesRepId: true, lead: { select: { businessName: true, contactName: true } } },
  });
  if (!thread?.salesRepId) return;
  const who =
    thread.lead?.contactName || thread.lead?.businessName || parsed.fromAddress || "a prospect";
  await pushToReps({
    salesRepIds: [thread.salesRepId],
    payload: async (language) => ({
      title: await appSentence(language, "app.notify.newEmail.title", { from: who }),
      body: snippetOf(parsed.body, 90),
      tag: `sales-email:${result.threadId}`,
      url: `/sales/threads?open=${encodeURIComponent(result.threadId)}`,
    }),
  });
}
