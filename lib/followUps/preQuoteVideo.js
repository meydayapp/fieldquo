// lib/followUps/preQuoteVideo.js
//
// The company's PRE-QUOTE video: what a homeowner watches before the
// estimator turns up.
//
// ── Why this is a second video field and not storyVideoUrl ─────────────────
//
// Company.storyVideoUrl already exists and is NOT this. That one is the
// "About us" film on the client proposal and the marketing site
// (lib/proposal/sections.js) — made for a homeowner who is already reading a
// quote, and about who the company is. This one is made for a homeowner who
// has enquired and not been visited yet, and is about what the visit will be
// like. A contractor who has filmed one and not the other must not have it
// appear in both places: reusing the column would have put "meet our team,
// twenty years in business" in front of somebody asking what to expect on
// Thursday, and — worse — would have put the pre-quote film into every quote
// proposal the moment it was set.
//
// ── Why the follow-ups LINK to it rather than frame it ─────────────────────
//
// The decision was between sending the homeowner straight to the url the
// company typed and hosting a small white-label page that embeds it. The link
// wins, and not on effort:
//
//   1. We store what they typed and nothing else. Turning a YouTube, Vimeo,
//      Loom, Drive or Wistia watch url into an embeddable one is a different
//      guess per host, and the guess is what rots — a company switching from
//      an unlisted YouTube link to a Loom one would get a blank rectangle
//      under their own brand with no error anywhere.
//   2. Hosts refuse to be framed. X-Frame-Options / frame-ancestors on Drive,
//      on some Vimeo privacy settings and on anything self-hosted means a
//      framed page cannot know in advance whether it will show a video or a
//      grey box, and a client-facing page that MIGHT be empty is the control
//      that appears to work and doesn't.
//   3. A frame page would leak less branding, not more. The homeowner's
//      player chrome says YouTube either way; wrapping it in a FieldQuo-
//      served page adds a FieldQuo origin to the address bar of a journey
//      that currently has none — the opposite of what white-label means
//      here.
//
// So the follow-ups put the company's own url in front of the client, and the
// company sees exactly what they typed with an "open it and check it plays"
// link beside the field. If a framed page is ever wanted it is an additive
// change on top of this column, not a different column.
//
// Pure — no database, no environment. Executed by
// scripts/check-follow-up-sms.mjs against the kinds of things people paste.

/**
 * What a company may store as their pre-quote video.
 *
 * @returns {{ ok: boolean, url: string|null, reason: string }}
 *          `ok` with a null url means "cleared" — an empty field is a legal
 *          save (the follow-ups then mention no video at all), which is why
 *          this does not report an empty string as an error.
 */
export function normalisePreQuoteVideoUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true, url: null, reason: "cleared" };

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    // Includes the single most common paste: "youtu.be/abc123" with no
    // scheme. Refused rather than repaired — prefixing https:// for them
    // would be this function guessing at an address a client will be sent
    // to, and the field is one keystroke from correct.
    return { ok: false, url: null, reason: "not_a_url" };
  }

  // https only. A homeowner opening an http page from a text on a phone gets
  // a browser warning over the contractor's video, and "javascript:" /
  // "data:" would be a stored script in a link the company's own clients are
  // sent — the protocol is a whitelist for both reasons at once.
  if (parsed.protocol !== "https:") return { ok: false, url: null, reason: "not_https" };
  // A URL object happily parses "https://" with no host.
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { ok: false, url: null, reason: "no_host" };
  }

  // Stored as typed, not as re-serialised: parsed.href normalises the path
  // and can reorder nothing but still drops a trailing nuance somebody
  // pasted deliberately. The company's own string is what the company sees
  // on the field and what the client opens.
  return { ok: true, url: raw, reason: "ok" };
}

/**
 * The video to put in a follow-up, or null.
 *
 * Read through this rather than off the row so a company that has never set
 * one, a column a caller forgot to select, and a stored value that somehow
 * stopped being a valid https url all come out the same way: no video, and
 * therefore no sentence about one. The alternative — a follow-up carrying a
 * half-typed address — is a dead link in a homeowner's inbox under the
 * contractor's name.
 */
export function preQuoteVideoFor(company) {
  const check = normalisePreQuoteVideoUrl(company?.preQuoteVideoUrl);
  return check.ok ? check.url : null;
}
