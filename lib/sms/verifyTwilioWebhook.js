// lib/sms/verifyTwilioWebhook.js
//
// Twilio inbound-SMS webhooks (app/api/crew/inbound and app/api/sms/inbound)
// are public with no session — the signature IS the access control. Both
// routes verified this the same way independently before this file existed;
// factored out once they were two rather than one, so a fix to how the URL is
// reconstructed (the `x-forwarded-proto`/host dance below) lands on both
// instead of whichever one someone remembered to edit.
//
// Note the AUTH TOKEN specifically, not an API key — lib/sms/twilioClient.js's
// twilioConfigured() accepts either, but validateRequest's HMAC is keyed on
// the account's auth token and an API key cannot stand in. A deployment with
// keys and no token can send SMS and manage numbers while being unable to
// verify a single inbound one — see lib/crew/capability.js for the longer
// version of this note.
import twilio from "twilio";

/**
 * Reconstruct the exact URL Twilio signed, and check the signature against
 * it and the parsed form body.
 *
 * @param request  the incoming Request. Body is read here (request.text()),
 *                 so callers must not have consumed it already.
 * @returns { ok, params }  `params` is the parsed x-www-form-urlencoded body
 *          as a plain object, Twilio's field names as-is (To/From/Body/...).
 *          Returned even when `ok` is false so a caller that wants to log
 *          what was rejected can, without re-reading the (already-consumed)
 *          request body.
 */
export async function verifyTwilioWebhook(request) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const raw = await request.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  const signature = request.headers.get("x-twilio-signature");
  // ── The QUERY STRING is part of what Twilio signed ──────────────────────
  //
  // This rebuilt the URL from `pathname` alone and dropped it, which was
  // invisible while every Twilio webhook here was a bare path — and became a
  // silent 403 the moment one carried state in its URL. Twilio's signature is
  // an HMAC over the full URL it fetched, concatenated with the sorted POST
  // parameters, so `?stage=after-dial&attemptId=…` changes the digest.
  //
  // What it cost: /api/rep-dial/inbound's second leg is exactly that URL, so
  // behind any proxy that sets x-forwarded-proto — which is every Vercel
  // deployment — a call nobody answered was refused here and the contractor
  // heard Twilio's own "an application error has occurred" instead of the
  // sentence the route had written for them. The whole transfer and queue
  // machinery is addressed the same way, which is how it was found.
  //
  // `search` is empty for a bare path, so adding it cannot change the answer
  // for the SMS routes this verifier was written for.
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host");
  const url = forwardedProto && host
    ? (() => {
        const parsed = new URL(request.url);
        return `${forwardedProto}://${host}${parsed.pathname}${parsed.search}`;
      })()
    : request.url;

  const ok = Boolean(token && signature && twilio.validateRequest(token, signature, url, params));
  return { ok, params };
}
