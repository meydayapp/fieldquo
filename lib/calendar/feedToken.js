// lib/calendar/feedToken.js
//
// The feed token and the four spellings of its URL.
//
// One place for both, because the token's shape is asserted in two files
// that must agree: app/api/calendar/feed/[token]/route.js refuses anything
// that does not look like what mintFeedToken produces, before it queries.

import { randomBytes } from "node:crypto";

/**
 * 24 random bytes as base64url — 32 characters, 192 bits, URL-safe with no
 * padding. Nothing about the member is in it; it is a lookup key, not a
 * signed claim, and rotating it is what revokes the old link.
 */
export function mintFeedToken() {
  return randomBytes(24).toString("base64url");
}

/**
 * The URLs the settings page offers.
 *
 *   https    the plain address — what Outlook's "subscribe from web" wants
 *   webcal   the same with the webcal: scheme, which is what makes a tap on
 *            an iPhone open Calendar's subscribe sheet rather than Safari
 *   google   Google Calendar's "add by URL" deep link; it takes the webcal
 *            spelling in `cid`
 *   outlook  the https address (Outlook has no scheme of its own; the page
 *            copies this one to the clipboard)
 *
 * The path ends in .ics on purpose — see the route header.
 */
export function feedUrls(origin, token) {
  const base = String(origin || "").replace(/\/+$/, "");
  const https = `${base}/api/calendar/feed/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    outlook: https,
  };
}
