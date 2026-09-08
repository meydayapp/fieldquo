// app/api/meta/whatsapp/webhook/route.js
//
// WhatsApp Cloud API's webhook. GET is the one-time subscribe handshake; POST
// is every inbound customer message and every delivery / read / failure
// status for a message the company sent.
//
// ══ Why a second route and not a second branch in the messaging webhook ════
//
// Because Meta's App Dashboard subscribes each PRODUCT to its own callback
// URL, and the two products deliver two different envelopes (see
// lib/messaging/whatsappEnvelope.js's header). One URL serving both would mean
// sniffing the body to decide which parser to run — and a sniff that guesses
// wrong on a payload Meta changes later is a webhook that starts writing the
// wrong rows rather than one that starts refusing.
//
// What IS shared is everything that matters: the same signature verifier, the
// same verify token, the same ingest, the same tenant rule. This file is the
// Page messaging webhook with one parser swapped, and deliberately so.
//
// ══ No session, and that is not an oversight ═══════════════════════════════
//
// Meta has no FieldQuo login. This route runs outside the signed-in member
// check every /app route uses — declared as such in lib/features/registry.js
// under `whatsapp_messaging`'s apiExempt, with the reason: the message has
// already been sent by a homeowner, and refusing it at the door loses their
// enquiry permanently rather than protecting anything.
//
// What stands in for a session:
//
//   1. an HMAC-SHA256 signature over the raw body, keyed with META_APP_SECRET,
//      compared timing-safely, REFUSED when the secret is unset (fail closed —
//      an unset secret is "we cannot verify", never "skip verification");
//   2. tenant resolution by database lookup of Meta's own PHONE NUMBER ID,
//      never from anything in the body (lib/messaging/ingest.js);
//   3. a rate limit, so a flood cannot be turned into a write loop.
//
// ══ Why it answers 200 to things it ignores ════════════════════════════════
//
// A webhook that returns an error gets retried for hours and, if it keeps
// failing, has its subscription disabled — taking every working number down
// with the noisy one. So an unrecognised number, an unsubscribed field
// (template status updates, account updates, quality ratings all arrive here)
// and an empty batch are "received, nothing to do": 200 with a count. Only a
// FAILED SIGNATURE is refused, because answering 200 there would be agreeing
// with a forgery.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  verifyWebhookSignature,
  verifySubscribeChallenge,
} from "@/lib/messaging/webhookSignature";
import { parseWhatsAppEnvelope } from "@/lib/messaging/whatsappEnvelope";
import { ingestEvents } from "@/lib/messaging/ingest";

/**
 * The subscribe handshake, run once when the callback URL is saved against the
 * WhatsApp product in Meta's App Dashboard. The challenge is echoed as PLAIN
 * TEXT — a JSON-wrapped challenge fails verification with no explanation.
 *
 * Shares META_WEBHOOK_VERIFY_TOKEN with the Page messaging and lead-ads
 * webhooks: one Meta app, one verify token, one signing secret. Three
 * different tokens for three callbacks of the same app would be three things
 * to get wrong for no security gain — the token proves the caller is the app
 * we configured, and it is the same app.
 */
export async function GET(request) {
  const limited = rateLimit(request, "meta-whatsapp-verify", {
    limit: 30,
    windowMs: 10 * 60 * 1000,
    message: "Too many verification attempts.",
  });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const result = verifySubscribeChallenge(searchParams, process.env.META_WEBHOOK_VERIFY_TOKEN);
  if (!result.ok) {
    // A bare 403 with no body: naming which check failed tells whoever is
    // probing how to pass it next time.
    console.error(`[meta-whatsapp-webhook] verify refused: ${result.reason}`);
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(result.challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(request) {
  // Generous, because WhatsApp batches and a busy number is legitimately
  // chatty — but finite, because this endpoint writes rows.
  const limited = rateLimit(request, "meta-whatsapp-webhook", {
    limit: 600,
    windowMs: 60 * 1000,
    message: "Too many requests.",
  });
  if (limited) return limited;

  // The RAW body, read once. Re-serialising the parsed JSON changes whitespace
  // and key order and the signature stops matching — the single most common
  // way a webhook verifier is written wrong.
  const raw = await request.text();

  const verified = verifyWebhookSignature(
    raw,
    request.headers.get("x-hub-signature-256"),
    process.env.META_APP_SECRET,
  );
  if (!verified.ok) {
    console.error(`[meta-whatsapp-webhook] signature refused: ${verified.reason}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Signed by us, and not JSON. A bug at Meta or in this route, not an
    // attack — logged and accepted, because retrying it will not help.
    console.error("[meta-whatsapp-webhook] signed body was not JSON");
    return NextResponse.json({ received: true, events: 0 }, { status: 200 });
  }

  const { events, dropped } = parseWhatsAppEnvelope(payload);
  if (!events.length) {
    return NextResponse.json({ received: true, events: 0, dropped }, { status: 200 });
  }

  const summary = await ingestEvents(events);

  // Counts are logged rather than returned in detail: Meta reads only the
  // status, and a body naming which numbers resolved would confirm to anyone
  // who could forge a signature which phone number ids FieldQuo holds.
  if (summary.skipped) {
    console.warn(
      `[meta-whatsapp-webhook] ${summary.skipped} event(s) skipped: ${JSON.stringify(summary.reasons)}`,
    );
  }

  return NextResponse.json(
    { received: true, events: summary.handled, created: summary.created },
    { status: 200 },
  );
}
