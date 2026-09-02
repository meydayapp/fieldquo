// lib/email/demoMail.js
//
// What happens instead of Resend when the company sending is a sales demo.
//
// ══ The hazard, stated plainly ═════════════════════════════════════════════
//
// Nothing in the send paths ever asked whether the sender was real. What kept
// a demo's mail off the internet was that lib/demo/seedDemo.js gives its
// fictional clients @example.com addresses — and that is DATA, not a guard. A
// rep making a walkthrough feel real types a live prospect's actual address
// into a demo quote, presses Send, and a homeowner receives a genuine,
// deliverable, white-labelled quote from "Northline Refinishing" — a company
// that does not exist, cannot be rung back, and will be re-dressed as a
// roofer next week (lib/demo/industries.js). The same shape as the Retell
// number in lib/voice/demoLine.js: an object that outlives the demo and that a
// stranger can act on.
//
// ══ Why this is a SUBSTITUTION and not a refusal ═══════════════════════════
//
// The owner's distinction, verbatim: a demo must not email a homeowner, but
// this must not become "demos can't email", which breaks the thing the demo
// exists to show. A rep needs to watch the quote go out, the status flip to
// "sent", sentAt appear, the follow-up cron pick it up later.
//
// So every one of those still happens. sendEmail() returns the SAME success
// shape a real send returns ({ id }), the route writes its status and its
// timestamp on the same line it always did, and the only thing that changes is
// that graph.resend.com is never called — exactly the seam
// lib/social/mockMetaGraphClient.js occupies for Meta and lib/voice/retell.js
// for Retell. A blanket refusal would have been fewer lines and would have
// demonstrated nothing.
//
// ══ Why the record is an ActivityLog row ═══════════════════════════════════
//
// "The UI can show the rep what would have gone out" needs somewhere durable
// to put it, and a new table was not on offer (the schema is closed). The
// activity trail already renders arbitrary dotted verbs by their `summary`
// (app/app/activity/page.js reads /api/activity, which selects `summary` and
// nothing action-specific), so a row written here is visible to the rep today
// with no UI change at all — and to support through the platform console's
// copy of the same query. `metadata` carries the whole letter, so "show me
// what it would have said" is answerable rather than merely claimed.
//
// The row is written with `action: "email.simulated"` and never
// "quote.sent" — the route writes that one itself, unchanged, immediately
// afterwards. Two rows, because they are two different facts: the quote WAS
// sent as far as the product is concerned, and the letter was NOT put on the
// wire. Collapsing them would make one of the two unrecoverable.
import { db } from "@/lib/db";

/**
 * A message id shaped like Resend's but unmistakable in a log.
 *
 * Deliberately prefixed rather than a bare uuid: this value is handed back to
 * routes as `messageId` and can end up stored (ReferralInvite.providerMessageId
 * takes it directly). A support engineer reading "demo_..." in a provider-id
 * column learns the truth immediately; a plausible-looking uuid would send them
 * to Resend's dashboard to hunt for a message that was never created.
 */
function simulatedMessageId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `demo_${Date.now().toString(36)}${rand}`;
}

/** First `n` characters of the plain-text body, for the log summary. */
function excerpt(text, html, n = 400) {
  const source =
    text ||
    String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return String(source || "").slice(0, n);
}

/**
 * Stand in for one Resend call on behalf of a demo company.
 *
 * Returns the success shape sendEmail() returns for a real send, plus
 * `simulated: true` — which app/api/quotes/[id]/send and
 * app/api/invoices/[id]/send pass on to the browser so the rep is told, rather
 * than being left to infer it from an inbox that never fills.
 *
 * Never throws, and never lets its own failure become a send. If the log write
 * dies the mail still did not go out, which is the property that matters; the
 * failure is put on the console rather than turned into an error the route
 * would report as "the email couldn't be sent", because that is not what
 * happened.
 */
export async function recordSimulatedSend({
  companyId,
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  attachments,
}) {
  const recipients = Array.isArray(to) ? to : [to].filter(Boolean);
  const id = simulatedMessageId();

  try {
    await db.activityLog.create({
      data: {
        companyId,
        // No actor. This is not somebody's action — it is the absence of one,
        // recorded beside the action that DID happen (quote.sent, written by
        // the route with its own real actor a moment later).
        action: "email.simulated",
        entityType: "email",
        summary: `Demo account — this email was NOT sent. To ${recipients.join(", ") || "nobody"}: “${subject || "(no subject)"}”`,
        metadata: {
          to: recipients,
          from: from || null,
          replyTo: replyTo || null,
          subject: subject || null,
          // The letter itself, so the rep can be shown what the client would
          // have read. Stored as the plain-text alternative where there is one
          // — a JSON column full of table markup is not something anybody can
          // read, and every send path in this repo passes `text` alongside
          // `html` for the same reason (spam scoring, see resend.js).
          body: excerpt(text, html, 4000),
          // Names only. A quote PDF is ~200KB of base64 and belongs nowhere
          // near an audit row; what a reader needs to know is that an
          // attachment existed and what it was called.
          attachments: (Array.isArray(attachments) ? attachments : [])
            .map((a) => a?.filename)
            .filter(Boolean),
          messageId: id,
        },
      },
    });
  } catch (err) {
    console.error("[demo mail] couldn't record the simulated send:", err?.message);
  }

  return { id, simulated: true };
}
