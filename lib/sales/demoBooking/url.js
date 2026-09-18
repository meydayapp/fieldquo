// lib/sales/demoBooking/url.js
//
// The address of a rep's public demo page. Its own file, pure, because the
// intro email's sender (lib/sales/outreach/introSend.js) mints it and the
// booking module imports that sender's repNumberFor — a URL helper in
// book.js would close a cycle for the sake of one string.

/** The path the page lives under. */
export const REP_DEMO_PATH = "/demo";

/** The absolute URL of a rep's page, with the intro token when there is one. */
export function repDemoUrl(origin, repCode, { token = null, language = null } = {}) {
  const base = `${String(origin || "").replace(/\/+$/, "")}${REP_DEMO_PATH}/${encodeURIComponent(String(repCode || ""))}`;
  const q = new URLSearchParams();
  if (token) q.set("t", token);
  if (language) q.set("lang", language);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
