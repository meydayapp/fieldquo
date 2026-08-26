// lib/crew/inboundParse.js
//
// Reading a Twilio inbound-message webhook, safely.
//
// Pure on purpose. `/api/crew/inbound` is a PUBLIC write endpoint, so the parts
// of it that decide *which tenant* and *which URLs we will fetch* are the parts
// that have to be executable against hostile input without a database or a
// network. See scripts/check-crew-inbox.mjs.
import { toE164 } from "@/lib/sms/twilioClient";

/**
 * The tenant key: the number that was TEXTED, and nothing else.
 *
 * ══ Why the sender can never be the key ════════════════════════════════════
 *
 * The obvious shortcut — one shared FieldQuo number, resolve the company from
 * the crew member's own phone — was considered and rejected twice over:
 *
 *   1. It isn't decidable. `Worker.phone` carries no unique constraint, not per
 *      company and not globally, and the real world matches the schema: a
 *      subcontractor who works for two painters is on both rosters with one
 *      cell number. Resolving by sender would have to guess between them, and
 *      guessing which company a photo belongs to is the single failure this
 *      whole feature is built to refuse.
 *   2. It isn't authenticated. Twilio's signature proves TWILIO sent us the
 *      webhook. It proves nothing about `From`, which is asserted upstream by
 *      the originating network and is forgeable through international SMS
 *      gateways. Keying the tenant on it turns "an attacker must know this
 *      company's number" into "an attacker must know any one crew member's
 *      number" — a cross-tenant write behind a value we cannot verify.
 *
 * So `To` it is. The shared platform line is still usable, but by LOANING it to
 * one company at a time (CrewInboxNumber.e164 is unique), never by reading the
 * sender. The sender is used only to identify WHO within the already-resolved
 * company — and a sender we don't recognise files nothing.
 *
 * @returns {string|null} E.164, or null when `To` is missing or unparseable.
 */
export function tenantKeyFromInbound(params = {}) {
  return toE164(params?.To) || null;
}

/**
 * Twilio's own media hosts.
 *
 * `api.twilio.com`, the regional `api.<region>.twilio.com`, and the MMS content
 * service `mcs.<region>.twilio.com`. Anchored at both ends so `evil-api.twilio.com`,
 * `apievil.twilio.com` and `api.twilio.com.evil.com` all fail.
 */
const TWILIO_MEDIA_HOST = /^(?:api|mcs)(?:\.[a-z0-9-]+)?\.twilio\.com$/i;

/**
 * Is this a media URL we may fetch WITH OUR CREDENTIALS?
 *
 * ══ This guard is a credential check, not a tidiness check ═════════════════
 *
 * Fetching a Twilio media URL needs Basic auth built from the Twilio account
 * SID and auth token. The re-host step used to send that header to whatever
 * host the payload named — so a `MediaUrl0` pointing anywhere would have posted
 * FieldQuo's Twilio master credentials to it, and a URL pointing inside the
 * deployment's own network would have been a server-side request forgery with
 * an auth header attached. Signature verification makes that hard to reach; it
 * does not make it safe to leave.
 *
 * Rejected: anything not HTTPS, anything carrying userinfo (the
 * `https://api.twilio.com@evil.com/` trick, which parses to host evil.com), and
 * any host outside Twilio's.
 */
export function isTwilioMediaUrl(url) {
  // A string, not something that stringifies into one. Form fields always are;
  // accepting anything with a friendly `toString` is how a guard gets talked
  // out of its own decision by the value it is guarding against.
  if (typeof url !== "string") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  return TWILIO_MEDIA_HOST.test(parsed.hostname);
}

/**
 * Twilio's own per-message ceiling. The loop is bounded by this and not by the
 * number in the payload: `NumMedia: "100000"` is a free hundred-thousand-
 * iteration loop on a public endpoint, and it costs nothing to refuse.
 */
export const MAX_MEDIA = 10;

/**
 * The media on an inbound message: `NumMedia` plus `MediaUrl0..N`.
 *
 * @returns {{ urls: string[], rejected: string[] }}  `rejected` is reported to
 *          the error log rather than dropped silently — a legitimate Twilio
 *          region we haven't listed would show up there as a pattern, and a
 *          probe would show up there as an attack. Both are worth seeing.
 */
export function collectMediaUrls(params = {}) {
  const declared = Number(params?.NumMedia);
  const count = Number.isFinite(declared)
    ? Math.max(0, Math.min(MAX_MEDIA, Math.trunc(declared)))
    : 0;

  const urls = [];
  const rejected = [];
  for (let i = 0; i < count; i++) {
    const raw = params[`MediaUrl${i}`];
    if (!raw) continue;
    if (isTwilioMediaUrl(raw)) urls.push(String(raw));
    else rejected.push(String(raw));
  }
  return { urls, rejected };
}

/**
 * The coordinates on an MMS, when the carrier sent any.
 *
 * Absent far more often than present (WhatsApp strips EXIF, most carriers never
 * send it), which is exactly why attribution never depends on it. Null rather
 * than a zeroed point: 0,0 is a real place in the Atlantic, and a job site
 * that isn't there would still be "nearest".
 */
export function pointFromInbound(params = {}) {
  const lat = Number(params?.Latitude);
  const lng = Number(params?.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
