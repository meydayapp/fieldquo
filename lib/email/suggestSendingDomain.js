// lib/email/suggestSendingDomain.js
//
// The sending domain to PROPOSE on Settings › Email domain, from the website
// address the company already gave us at signup (Company.website, 2026-09-24).
// The owner: "there is a place we ask the user to enter their domain? In the
// sign up don't we collect that information?" — we do, so the form should not
// open empty and make them type it a second time.
//
// A suggestion only. The field is prefilled and the owner still presses
// Connect: connecting creates a domain at Resend and asks them to add DNS
// records, which they can only do on a domain they control. Nothing here
// connects anything.
//
// Why "send." and not the bare domain: the page's own advice (connectHint)
// is a subdomain, so the company's existing mail on the root domain (their
// Google Workspace or Outlook MX and SPF) is never touched.
//
// A website on a platform the company does not own — a Facebook page, a Wix
// or Google Sites subdomain, a directory listing — is not a domain they can
// add DNS records to. Proposing send.facebook.com would be a confident wrong
// answer, so those return null and the field stays empty as before. Absence
// of a usable domain is not a statement (AGENTS.md failure class 5).

const HOSTED_PLATFORMS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "youtube.com",
  "linktr.ee",
  "google.com",
  "business.site",
  "g.page",
  "goo.gl",
  "wixsite.com",
  "wix.com",
  "squarespace.com",
  "weebly.com",
  "wordpress.com",
  "godaddysites.com",
  "webflow.io",
  "carrd.co",
  "yelp.com",
  "yelp.ca",
  "houzz.com",
  "angi.com",
  "homeadvisor.com",
  "homestars.com",
  "thumbtack.com",
  "nextdoor.com",
  "fieldquo.com",
];

const isPlatform = (host) =>
  HOSTED_PLATFORMS.some((p) => host === p || host.endsWith(`.${p}`));

/**
 * @param {string|null|undefined} website  Company.website as stored
 * @returns {string|null} e.g. "send.northline.ca", or null when there is no
 *          domain the company can be assumed to control
 */
export function suggestSendingDomain(website) {
  if (typeof website !== "string" || !website.trim()) return null;
  let host;
  try {
    const raw = website.trim();
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  // A bare IP, localhost or a single label has no DNS the company can edit.
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) return null;
  if (!/^[a-z0-9.-]+$/.test(host) || host.split(".").some((l) => !l || l.length > 63)) return null;
  if (isPlatform(host)) return null;
  return `send.${host}`;
}
