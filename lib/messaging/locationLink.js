// lib/messaging/locationLink.js
//
// A dropped pin -> a picture of where it is, and a way to walk there.
//
// ══ Which Google key, and why not the server one ═══════════════════════════
//
// GOOGLE_MAPS_SERVER_KEY exists and it is the WRONG key for this. Its own
// callers say why in as many words: app/api/measure/satellite.js's header
// explains that the server key is UNRESTRICTED — it has to be, because a
// server call carries no HTTP referrer for a referrer restriction to match —
// and that it also unlocks Geocoding, Distance Matrix and Solar. Putting it in
// an <img src> would publish it into the DOM, the network tab, the browser
// history and any screenshot of the conversation. That route proxies bytes
// through the server specifically to avoid doing so.
//
// A static map thumbnail on a chat bubble does not justify a byte proxy on a
// serverless function, so this uses the OTHER key — NEXT_PUBLIC_GOOGLE_MAPS_
// API_KEY, the referrer-restricted browser key that app/components/MiniMap.js
// already puts in exactly this kind of <img>. Same key, same API, same
// existing precedent.
//
// ══ What happens when there is no key ══════════════════════════════════════
//
// No thumbnail, and the card still draws: the name, the address, and the link
// out to a real map. A broken <img> where a map should be would read as a pin
// we lost, which is the failure this whole change is about. Absence of a key
// is not a reason to hide the message.
//
// Pure and dependency-free — the bubble is "use client", and the key is passed
// IN rather than read here so this module stays executable in a check script
// with no environment at all.

/**
 * The Static Maps URL for one pin, or null when there is no key to sign it
 * with (or no pin).
 *
 * `scale: 2` for a readable image on a phone's 2x screen — the same choice
 * MiniMap makes. `zoom: 16` rather than MiniMap's 15: a shared pin is usually
 * "this house, this driveway", not "this neighbourhood".
 */
export function staticMapUrl(location, { key, width = 480, height = 200, zoom = 16 } = {}) {
  if (!location || !key) return null;
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const centre = `${latitude},${longitude}`;
  const params = new URLSearchParams({
    center: centre,
    zoom: String(Math.max(1, Math.min(20, Math.round(zoom)))),
    size: `${Math.round(width)}x${Math.round(height)}`,
    scale: "2",
    // A dark neutral marker rather than Google's default red: this sits inside
    // a bubble that may be painted in the company's brand colour, and a fixed
    // red pin on a red bubble is a marker nobody can find. Neutral reads on
    // every wash lib/messaging/bubbleTheme.js can produce.
    markers: `color:0x111827|${centre}`,
    key,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * "Open in maps".
 *
 * google.com/maps/search/?api=1&query=lat,lng — Google's own documented
 * cross-platform URL. On a phone it hands off to the installed maps app; on a
 * desktop it opens the web map. A `geo:` URI would be better on Android and
 * does nothing at all on a laptop, and this screen is read on both.
 *
 * The QUERY is the coordinates and never the address text, even when we have
 * one: the coordinates are what the customer actually pointed at, and a
 * free-text address string round-tripped through a search box is how a pin in
 * a back lane becomes a pin on the wrong street.
 */
export function mapsLinkUrl(location) {
  if (!location) return null;
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/**
 * The address text worth writing into a Client record, or null.
 *
 * ── Why a pin with no address string gives NOTHING ────────────────────────
 *
 * Because Client.address is a postal address a quote gets printed with, and
 * "45.5019,-73.5674" is not one. Reverse-geocoding the pin into a street
 * address is the obvious alternative and was rejected: it is a billable Google
 * call, it needs the server key, and it would put a guessed address on an
 * invoice. When WhatsApp sends an address — it does whenever the customer
 * shared a saved place rather than a raw pin — that is the customer's own
 * words and is worth offering. When it does not, the control is not drawn at
 * all, which is the rule about dead buttons applied to a button that would
 * have written nonsense.
 */
export function addressFromLocation(location) {
  if (!location) return null;
  const address = typeof location.address === "string" ? location.address.trim() : "";
  if (!address) return null;
  // The saved place's NAME prefixed when there is one and it is not already
  // part of the address — "Maple Ridge Dental, 12 King St" is more use on a
  // job sheet than either half.
  const name = typeof location.name === "string" ? location.name.trim() : "";
  if (name && !address.toLowerCase().includes(name.toLowerCase())) {
    return `${name}, ${address}`.slice(0, 300);
  }
  return address.slice(0, 300);
}
