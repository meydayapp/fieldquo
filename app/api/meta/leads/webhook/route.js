// app/api/meta/leads/webhook/route.js
//
// Meta's `leadgen` webhook. A homeowner taps "Get a free painting estimate"
// on a contractor's Facebook or Instagram ad, fills in Meta's built-in form,
// and Meta POSTs here within seconds.
//
// Registered in the FieldQuo app's Webhooks product on
// developers.facebook.com against the `page` object, field `leadgen`. Nothing
// in this repo ever fetches it — Meta does.
//
// The Page object takes ONE callback URL in the App Dashboard, and today that
// URL is /api/meta/messaging/webhook — which is why the loop below lives in
// lib/meta/leadsWebhookIngest.js and that route runs it too. This route
// stays for a dashboard that points `leadgen` here instead.
//
// ══ What actually arrives ══════════════════════════════════════════════════
//
//   { object: "page",
//     entry: [{ id: "<pageId>", time: 172…,
//               changes: [{ field: "leadgen",
//                           value: { leadgen_id, page_id, form_id,
//                                    adgroup_id, ad_id, created_time } }] }] }
//
// There is no name in that. No email, no phone, no answers. The payload is a
// RECEIPT, and the lead itself has to be fetched from the Graph API with a
// page token — which is what needs `leads_retrieval`, the permission this app
// does not have yet. See META_LEADS_SCOPE in lib/meta/client.js.
//
// ══ Three refusals, in order ═══════════════════════════════════════════════
//
//   1. The signature. X-Hub-Signature-256 over the RAW body, keyed with
//      META_APP_SECRET, timing-safe, refusing outright when the secret is
//      unset. This route creates rows inside a contractor's tenant; an
//      unverified one is a public endpoint that files leads into any company
//      that has ever registered a Page.
//   2. The tenant. The payload names a page_id and that is used as a LOOKUP
//      KEY into MetaLeadForm rows FieldQuo already stored — the companyId
//      comes off our row, never off the request. See
//      lib/meta/leadsImport.js's resolveCompanyForPage.
//   3. The form. A delivery for a form the company has switched OFF is
//      acknowledged and dropped. A Page can carry forms that are not quote
//      requests — a newsletter sign-up, an event RSVP — and importing one
//      would put a stranger who never asked for a quote on a call list.
//
// ══ Why the failures answer the status they do ═════════════════════════════
//
// Meta retries a non-2xx delivery. So a 200 means "we are done with this,
// never send it again" and a 500 means "send it again". Both are decisions
// about a homeowner's enquiry, not about tidiness: a 200 on a transient Graph
// failure loses the lead for good, and a 500 on something permanently
// unprocessable makes Meta hammer the endpoint for hours. Each branch below
// says which it is choosing and why.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  verifySubscriptionHandshake,
} from "@/lib/meta/leadsWebhookSignature";
import { ingestLeadgenChanges } from "@/lib/meta/leadsWebhookIngest";

/**
 * Meta's subscription handshake. Called once, by hand, when the webhook is
 * created or edited in the App Dashboard — never in normal operation.
 *
 * Echoing hub.challenge without checking hub.verify_token would let anyone who
 * guesses this URL complete a subscription against it, so the token is
 * compared timing-safe and an unset META_WEBHOOK_VERIFY_TOKEN refuses rather
 * than waves through — the same fail-closed rule as the signature below.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const result = verifySubscriptionHandshake(
    {
      mode: url.searchParams.get("hub.mode"),
      token: url.searchParams.get("hub.verify_token"),
      challenge: url.searchParams.get("hub.challenge"),
    },
    process.env.META_WEBHOOK_VERIFY_TOKEN,
  );

  if (!result.ok) {
    console.warn(`[meta/leads/webhook] handshake refused: ${result.reason}`);
    // 403 with no body. Which check failed is a hint, and Meta only needs to
    // know that the handshake did not pass.
    return new NextResponse(null, { status: 403 });
  }

  // Bare text, not JSON — Meta compares the body to the challenge byte for
  // byte, and a JSON-quoted string fails a handshake that is otherwise fine.
  return new NextResponse(result.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request) {
  // ── The raw body, read exactly once ──────────────────────────────────────
  //
  // The HMAC is over the bytes Meta sent. Parsing to an object and
  // re-serialising changes key order and whitespace, so the signature would
  // never match — which is the single most common way to end up with a
  // verifier that verifies nothing. Read as text, verify that text, then
  // parse the same string.
  let raw;
  try {
    raw = await request.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const verified = verifyWebhookSignature(
    raw,
    request.headers.get("x-hub-signature-256"),
    process.env.META_APP_SECRET,
  );
  if (!verified.ok) {
    console.warn(`[meta/leads/webhook] refused delivery: ${verified.reason}`);
    return new NextResponse(null, { status: 403 });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    // Signed by Meta and still not JSON. Permanently unprocessable — a 400 so
    // Meta stops rather than retrying something that cannot ever parse.
    return new NextResponse(null, { status: 400 });
  }

  const { results, retryNeeded } = await ingestLeadgenChanges(body);

  if (retryNeeded) {
    // A 500 asks Meta to deliver again. Chosen only for failures that a later
    // attempt could actually fix — a rate limit, a Graph blip — because the
    // alternative for those is losing a real enquiry. Everything permanent
    // above already answered 200.
    return NextResponse.json({ received: true, retry: true }, { status: 500 });
  }

  // The polling fallback (app/api/cron/meta-leads) re-reads the same window
  // regardless, so even a lead this 200 gave up on gets a second chance from
  // the other direction.
  return NextResponse.json({ received: true, results });
}
