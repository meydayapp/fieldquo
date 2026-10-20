// app/api/meta/messaging/webhook/route.js
//
// Meta's messaging webhook. GET is the one-time subscribe handshake; POST is
// every Facebook Page and Instagram business message, delivery receipt and
// read receipt.
//
// ══ No session, and that is not an oversight ═══════════════════════════════
//
// Meta has no FieldQuo login. This route deliberately runs outside the
// signed-in member check every /app route uses — declared as such in
// lib/features/registry.js under `page_messaging`'s apiExempt, with the
// reason — for exactly the same argument app/api/crew/inbound/route.js makes:
// the message has already been sent, and refusing it at the door loses a
// homeowner's enquiry permanently rather than protecting anything.
//
// (The two helper names are spelled out nowhere in this file on purpose:
// scripts/check-features.mjs proves an exempt route does not call them by
// scanning the source, and a comment naming them reads as a call.)
//
// What stands in for a session:
//
//   1. an HMAC-SHA256 signature over the raw body, keyed with META_APP_SECRET,
//      compared timing-safely, REFUSED when the secret is unset (fail closed —
//      an unset secret is "we cannot verify", never "skip verification");
//   2. tenant resolution by database lookup of Meta's own Page id, never from
//      anything in the body (lib/messaging/ingest.js);
//   3. a rate limit, so a flood cannot be turned into a write loop.
//
// ══ Why it answers 200 to things it ignores ════════════════════════════════
//
// A webhook that returns an error status gets retried for hours and, if it
// keeps failing, has its subscription disabled by Meta — taking the working
// Pages down with the noisy one. So an unrecognised Page, an unsubscribed
// event type and an empty batch are all "received, nothing to do": 200 with a
// count. Only a FAILED SIGNATURE is refused, because that is the one case
// where answering 200 would be agreeing with a forgery.
//
// ══ Why lead-ad forms arrive here too ══════════════════════════════════════
//
// The App Dashboard holds ONE callback URL per webhook object, and the Page
// object carries both `messages` and `leadgen`. This is the URL the dashboard
// holds for Page (docs/META-DASHBOARD-CURRENT.md), so a homeowner's lead-ad
// form lands here alongside the messages — and is handed to the same import
// the leads route runs (lib/meta/leadsWebhookIngest.js). A retryable lead
// failure is NOT turned into a 500 here, unlike on the leads route: a non-200
// would make Meta redeliver the whole batch, messages included, and the hourly
// app/api/cron/meta-leads re-reads the same window anyway.
export const runtime = "nodejs";

// The AI employee's turn is awaited inside this request (lib/messaging/
// ingest.js): a burst debounce, a routing model call, the main model call,
// tool calls, then a Graph send. On the platform default that is routinely
// cut off, and a turn killed here used to lose the reply for good — Meta
// redelivers, the upsert finds the row, `created` is false, and nobody asks
// the employee again.
//
// Raising the ceiling does not raise the bill: Vercel charges for time
// actually spent, and the only requests that will now run longer are the ones
// that were being killed. The ceiling is the first line of defence; the
// sweeper (/api/cron/messaging-ai, via Message.aiPending) is the second, and
// it is the one that makes the loss recoverable rather than merely rarer.
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  verifyWebhookSignature,
  verifySubscribeChallenge,
} from "@/lib/messaging/webhookSignature";
import { parseMessagingEnvelope } from "@/lib/messaging/envelope";
import { ingestEvents } from "@/lib/messaging/ingest";
import { hasLeadgenChanges, ingestLeadgenChanges } from "@/lib/meta/leadsWebhookIngest";

/**
 * The subscribe handshake, run once when the callback URL is saved in Meta's
 * App Dashboard. Meta sends hub.mode/hub.verify_token/hub.challenge and expects
 * the challenge echoed back as PLAIN TEXT — a JSON-wrapped challenge fails
 * verification with no explanation, which is a well-known way to lose an
 * afternoon.
 */
export async function GET(request) {
  const limited = rateLimit(request, "meta-messaging-verify", {
    limit: 30,
    windowMs: 10 * 60 * 1000,
    message: "Too many verification attempts.",
  });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const result = verifySubscribeChallenge(searchParams, process.env.META_WEBHOOK_VERIFY_TOKEN);
  if (!result.ok) {
    // A bare 403 with no body, deliberately: naming which check failed tells
    // whoever is probing how to pass it next time.
    console.error(`[meta-messaging-webhook] verify refused: ${result.reason}`);
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(result.challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(request) {
  // Generous, because Meta batches and a busy Page is legitimately chatty —
  // but finite, because this endpoint writes rows. Keyed per IP by
  // lib/rateLimit.js; see that file's honest note about what an in-memory
  // window on Vercel does and does not stop.
  const limited = rateLimit(request, "meta-messaging-webhook", {
    limit: 600,
    windowMs: 60 * 1000,
    message: "Too many requests.",
  });
  if (limited) return limited;

  // The RAW body, read once. Re-serialising the parsed JSON changes whitespace
  // and key order, and the signature stops matching — the single most common
  // way a webhook verifier is written wrong.
  const raw = await request.text();

  const verified = verifyWebhookSignature(
    raw,
    request.headers.get("x-hub-signature-256"),
    process.env.META_APP_SECRET,
  );
  if (!verified.ok) {
    console.error(`[meta-messaging-webhook] signature refused: ${verified.reason}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Signed by us, and not JSON. That is a bug at Meta or in this route, not
    // an attack — logged and accepted, because retrying it will not help.
    console.error("[meta-messaging-webhook] signed body was not JSON");
    return NextResponse.json({ received: true, events: 0 }, { status: 200 });
  }

  let leads = 0;
  if (payload?.object === "page" && hasLeadgenChanges(payload)) {
    const { results, retryNeeded } = await ingestLeadgenChanges(payload, {
      log: "meta-messaging-webhook/leadgen",
    });
    leads = results.length;
    if (retryNeeded) {
      console.warn(
        "[meta-messaging-webhook] a lead-ad import failed retryably; the hourly meta-leads cron is the second attempt",
      );
    }
  }

  const { events, dropped } = parseMessagingEnvelope(payload);
  if (!events.length) {
    return NextResponse.json({ received: true, events: 0, dropped, leads }, { status: 200 });
  }

  const summary = await ingestEvents(events);

  // The counts are logged rather than returned in detail: Meta reads only the
  // status, and a body naming which Pages resolved would confirm to anyone who
  // could forge a signature which Page ids FieldQuo holds.
  if (summary.skipped) {
    console.warn(
      `[meta-messaging-webhook] ${summary.skipped} event(s) skipped: ${JSON.stringify(summary.reasons)}`,
    );
  }

  return NextResponse.json(
    { received: true, events: summary.handled, created: summary.created, leads },
    { status: 200 },
  );
}
