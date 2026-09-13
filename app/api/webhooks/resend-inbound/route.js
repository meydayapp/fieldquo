// app/api/webhooks/resend-inbound/route.js
//
// Resend received a prospect's reply at the reply domain and is telling us.
//
// ══ The door that exists because the mailbox cannot ════════════════════════
//
// The generic endpoint next door (inbound-sales-email) waits for the rep's
// mailbox to POST a copy of each reply. The reps' mailboxes are on Namecheap
// Private Email, which cannot POST anywhere, so that endpoint has never been
// called and no reply has ever been filed. This one takes the other route:
// the outbound Reply-To is moved to a domain Resend RECEIVES for
// (SALES_REPLY_DOMAIN — docs/SALES-OUTREACH.md §5b), Resend posts an
// `email.received` event here, and lib/sales/resendInboundDoor.js fetches the
// message, files it through the SAME function as the generic door, and
// forwards a copy to the rep's real mailbox — because with this door, that
// forward is the only way a human sees the reply.
//
// ══ Public, so the signature IS the authentication boundary ════════════════
//
// Same stakes as the cron endpoints and the generic door. The Svix signature
// on the raw body is the whole gate, and lib/sales/resendInbound.js's
// verifyResendWebhook mirrors verifyInboundSecret exactly on the point that
// matters: an unset RESEND_INBOUND_WEBHOOK_SECRET DENIES everything, loudly,
// rather than falling through to a comparison that cannot fail
// (lib/security/cronAuth.js's header is the history). The body is read with
// request.text() and verified BEFORE it is parsed — a re-serialised body is a
// different byte string and a broken signature.
//
// ══ Answers ════════════════════════════════════════════════════════════════
//
//   401  the signature did not verify (or the secret is unset). A 401, not a
//        200, so a misconfigured webhook in the Resend dashboard shows as
//        failing there rather than as working.
//   200  everything else that is not our fault — filed, no_token,
//        unknown_token, own_outbound, duplicate, an event type we ignore. A
//        4xx would make Resend retry a message it has already delivered.
//   500  our own failure (fetching the message, the database). Resend
//        retries, and the receipt ledger lets the retry through.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { getReceivedEmail, listReceivedAttachments } from "@/lib/email/resendReceiving";
import { recordError } from "@/lib/platform/errorLog";
import { verifyResendWebhook } from "@/lib/sales/resendInbound";
import { processReceivedEvent } from "@/lib/sales/resendInboundDoor";
import { replyDomain } from "@/lib/sales/outreachSender";

// The event is metadata only — a few hundred bytes. Anything larger is not
// Resend.
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request) {
  const raw = await request.text();
  // Before the HMAC, so an oversized body is refused without being hashed.
  // 413 rather than 401: it is not a credential failure, and nothing legitimate
  // is this size.
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const verdict = verifyResendWebhook(
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    raw,
    process.env.RESEND_INBOUND_WEBHOOK_SECRET,
  );

  if (!verdict.ok) {
    if (verdict.reason === "unconfigured") {
      console.error(
        "[resend-inbound] RESEND_INBOUND_WEBHOOK_SECRET is not set — refusing " +
          "every received email until it is configured.",
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ ignored: true, reason: "unparseable" }, { status: 200 });
  }

  const { status, body } = await processReceivedEvent(event, {
    db,
    getReceivedEmail,
    listReceivedAttachments,
    sendEmail,
    platformFrom: await getPlatformFrom(),
    replyDomain: replyDomain(),
    recordError,
  });
  return NextResponse.json(body, { status });
}
