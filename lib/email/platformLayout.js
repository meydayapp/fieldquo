// lib/email/platformLayout.js
//
// The ONE envelope for email FieldQuo writes to a contractor about FieldQuo:
// the next-steps letter, the 7/3/1 trial reminders, the two signup nudges,
// and the trial sequence (lib/lifecycle/). The owner, 2026-10-11, after
// reading what Housecall Pro and Jobber send a new trial: "format images etc.
// articles". The norms that study found, and this file's answer to each:
//
//   logo + a small "Help · Your account" header   → header row, both links real
//   a hidden preheader on almost every email       → `preheader`
//   a 600px hero image (1200px for retina)         → `hero`, our own host only
//   short copy and ONE pill button                 → `bodyHtml` + `cta`
//   footer: street address, Unsubscribe AND        → footer, by `kind`
//   "Manage preferences", a transactional /
//   advertising label
//
// NOT white-labelled, for the reason lib/email/billingEmail.js gives: FieldQuo
// is the sender and the contractor is FieldQuo's customer. Client-facing mail
// never comes through here.
//
// ══ `kind` decides the footer, and the footer is enforced ═════════════════
//
//   "transactional"  account mail the recipient needs (the trial ending, the
//                    next-steps letter — see lib/marketing/unsubscribe.js's
//                    split). The label says so; NO unsubscribe link and NO
//                    preferences link, ever: a switch on mail that cannot be
//                    switched off would be a control that appears to work and
//                    doesn't. Passing an unsubscribe URL throws.
//   "tips" | "updates" | "offers" | "commercial"
//                    commercial under CASL. FieldQuo's mailing address
//                    (SALES_MAILING_ADDRESS) and a working unsubscribe URL are
//                    REQUIRED — the builder throws without them, the same
//                    refusal the signup nudges already make, because an email
//                    with a hole in its footer has reached a stranger before
//                    anybody reads the log. "Manage email preferences" is
//                    printed when there is a preferences page for this person
//                    (a contractor USER has one; a signup lead with no account
//                    does not, so its letter carries the do-not-contact link
//                    alone rather than a link to a page that cannot exist).
//
// The RFC 8058 headers (List-Unsubscribe + List-Unsubscribe-Post) come back
// in `headers` for every commercial email given a one-click URL, so a caller
// sends them by passing the result through rather than by remembering a
// second helper.
//
// ══ The text part is the caller's ═════════════════════════════════════════
//
// The four letters that existed before this layout keep their text parts
// byte-for-byte (scripts/check-platform-email-layout.mjs compares the md5 of
// every one against the record taken before the move). New letters build
// their text with platformTextFooter() below, which prints the same footer
// as the HTML in plain words.
//
// ══ Dark mode, measured rather than hoped for ═════════════════════════════
//
// The content card is ALWAYS white, in both schemes. The letters that moved
// here colour their own rows inline (the next-steps letter's numbered circles,
// its green ticks), and a dark card would put #111827 ink on #111827 paper —
// so dark mode darkens only what surrounds the card: the page, the header
// links and the footer, through `@media (prefers-color-scheme: dark)` for the
// clients that honour it (Apple Mail, iOS, Outlook for Mac). Clients that
// invert colours themselves (Gmail's apps) cannot be measured; for them the
// logo is a JPEG with its white ground baked in (public/email/
// fieldquo-logo.jpg), so it is never navy-on-black. Every pair is in
// PLATFORM_LAYOUT_PAIRS and the check recomputes each at 4.5:1.
//
// ══ Images come from FieldQuo's own host ══════════════════════════════════
//
// EMAIL_ASSET_ORIGIN, never the request's origin: a preview deployment or
// localhost is not reachable from somebody's inbox, and the asset must be on
// www.fieldquo.com (public/) or FieldQuo's own Cloudinary. heroSrcAllowed()
// is the gate; a hero that fails it is dropped, never rendered as a broken
// image or a hotlink.

import { escapeHtml, escapeAttr } from "@/lib/email/emailTheme";
import { labelled, lifecycleLanguage, lifecycleT } from "@/lib/i18n/lifecycleEmailCopy";

/** Where public/ is served from in production. Images in email need a stable public host. */
export const EMAIL_ASSET_ORIGIN = "https://www.fieldquo.com";
/** The logo with its white ground baked in (see the header). 400×120, shown at 200×60. */
export const EMAIL_LOGO_PATH = "/email/fieldquo-logo.jpg";

export const COMMERCIAL_KINDS = Object.freeze(["tips", "updates", "offers", "commercial"]);
export const LAYOUT_KINDS = Object.freeze(["transactional", ...COMMERCIAL_KINDS]);

// Light scheme — the billing family's measured palette, reused.
const INK = "#111827";
const MUTED = "#4b5563";
const FAINT = "#595f6b";
const CARD = "#ffffff";
const PAGE = "#f5f5f5";
const RULE = "#e5e7eb";
// Dark scheme — only the surroundings change (see the header).
const DARK_PAGE = "#0b1220";
const DARK_TEXT = "#cbd5e1";
const DARK_LINK = "#e5e7eb";

/** Every text/background pair the layout draws, in both schemes. */
export const PLATFORM_LAYOUT_PAIRS = Object.freeze([
  { name: "body ink on card", fg: INK, bg: CARD },
  { name: "muted text on card", fg: MUTED, bg: CARD },
  { name: "pill button label", fg: "#ffffff", bg: INK },
  { name: "header links on page (light)", fg: MUTED, bg: PAGE },
  { name: "footer on page (light)", fg: FAINT, bg: PAGE },
  { name: "header links on page (dark)", fg: DARK_LINK, bg: DARK_PAGE },
  { name: "footer on page (dark)", fg: DARK_TEXT, bg: DARK_PAGE },
]);

/** Is this image URL one FieldQuo hosts? www.fieldquo.com, or our own Cloudinary cloud. */
export function heroSrcAllowed(src, { cloudName = process.env.CLOUDINARY_CLOUD_NAME } = {}) {
  let u;
  try {
    u = new URL(String(src || ""));
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  if (u.hostname === "www.fieldquo.com" || u.hostname === "fieldquo.com") return true;
  const cloud = String(cloudName || "").trim();
  return Boolean(cloud) && u.hostname === "res.cloudinary.com" && u.pathname.startsWith(`/${cloud}/`);
}

/** A public/ path as the absolute URL an inbox can load. */
export function emailAssetUrl(path) {
  return `${EMAIL_ASSET_ORIGIN}${String(path || "").startsWith("/") ? "" : "/"}${path}`;
}

/** RFC 8058 one-click headers for a commercial email. */
export function listUnsubscribeHeaders(url) {
  if (!url) return {};
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function footerLabel(t, kind) {
  if (kind === "transactional") return t("layout.label.transactional");
  if (kind === "updates") return t("layout.label.updates");
  if (kind === "offers") return t("layout.label.offers");
  // "tips" and the signup nudges' "commercial" both say what the letter is;
  // a signup nudge carries its own identify line (app.signupNudge.identify),
  // so "commercial" adds no second label.
  if (kind === "tips") return t("layout.label.tips");
  return "";
}

/**
 * Validate the footer inputs for `kind` and return them cleaned. Throws on a
 * commercial email with no address or no unsubscribe URL, and on a
 * transactional one that was handed an unsubscribe or preferences URL.
 */
export function layoutFooterInputs({ kind, mailingAddress, unsubscribeUrl, preferencesUrl } = {}) {
  if (!LAYOUT_KINDS.includes(kind)) throw new Error(`platformLayout: unknown kind "${kind}"`);
  const address = String(mailingAddress ?? "").trim();
  if (kind === "transactional") {
    if (unsubscribeUrl || preferencesUrl) {
      throw new Error("platformLayout: a transactional email must not carry an unsubscribe or preferences link — that mail cannot be switched off.");
    }
    return { kind, address, unsubscribeUrl: null, preferencesUrl: null };
  }
  if (!address) {
    throw new Error(
      "FieldQuo's mailing address isn't set, and CASL requires one in every commercial email. " +
        "Set SALES_MAILING_ADDRESS — see docs/SALES-OUTREACH.md.",
    );
  }
  if (!unsubscribeUrl) throw new Error("platformLayout: a commercial email cannot be built without a working unsubscribe URL.");
  return { kind, address, unsubscribeUrl: String(unsubscribeUrl), preferencesUrl: preferencesUrl ? String(preferencesUrl) : null };
}

/**
 * The footer as plain-text lines, for a new letter's text part.
 *
 * @param unsubscribeLabel  the words for the opt-out link — the layout's own
 *                          "Unsubscribe" unless the letter has its own (the
 *                          signup nudges' "Stop hearing from FieldQuo")
 */
export function platformTextFooter({ language = "en", kind, mailingAddress, unsubscribeUrl, preferencesUrl, unsubscribeLabel = null } = {}) {
  const f = layoutFooterInputs({ kind, mailingAddress, unsubscribeUrl, preferencesUrl });
  const t = lifecycleT(language);
  const label = footerLabel(t, kind);
  return [
    "—",
    ...(label ? [label] : []),
    ...(f.address ? [f.address] : []),
    ...(f.unsubscribeUrl ? [labelled(language, unsubscribeLabel || t("layout.unsubscribe"), f.unsubscribeUrl)] : []),
    ...(f.preferencesUrl ? [labelled(language, t("layout.managePreferences"), f.preferencesUrl)] : []),
  ];
}

/**
 * The HTML document.
 *
 * @param language      the chrome's language (any code; nine are carried)
 * @param htmlLang      the <html lang> attribute — defaults to `language`;
 *                      the next-steps letter passes its own resolved code
 * @param kind          see the header
 * @param preheader     the hidden inbox-preview line, or null
 * @param heading       the h1 at the top of the card, or null
 * @param sub           one small line under the heading (the company), or null
 * @param hero          { src, alt, width=600, height } — dropped unless
 *                      heroSrcAllowed(src)
 * @param bodyHtml      the letter's own HTML, already escaped by the caller
 * @param cta           { url, label } — the ONE pill button, or null
 * @param afterCtaHtml  small print under the button (already escaped), or ""
 * @param origin        the app origin the Help / Your account links use
 * @param accountLink   false for a person with no account (a signup lead)
 * @param footerIntroHtml lines the letter itself must print first in the
 *                      footer (the signup nudges' identify line), escaped
 * @param unsubscribeLabel see platformTextFooter
 * @param oneClickUrl   the URL that unsubscribes on a POST (RFC 8058) — the
 *                      List-Unsubscribe header's target; null sends none
 * @returns { html, headers, footer: { kind, address, unsubscribeUrl, preferencesUrl } }
 */
export function renderPlatformEmail({
  language = "en",
  htmlLang = null,
  kind,
  preheader = null,
  heading = null,
  sub = null,
  hero = null,
  bodyHtml = "",
  cta = null,
  afterCtaHtml = "",
  origin,
  accountLink = true,
  mailingAddress = "",
  unsubscribeUrl = null,
  preferencesUrl = null,
  footerIntroHtml = "",
  unsubscribeLabel = null,
  oneClickUrl = null,
} = {}) {
  const f = layoutFooterInputs({ kind, mailingAddress, unsubscribeUrl, preferencesUrl });
  const t = lifecycleT(language);
  const base = String(origin || "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) throw new Error("platformLayout: needs an absolute origin for the header links.");
  const lang = htmlLang || lifecycleLanguage(language);
  const helpUrl = `${base}/help/${lifecycleLanguage(language)}`;
  const accountUrl = `${base}/app`;

  const logo = `<img src="${escapeAttr(emailAssetUrl(EMAIL_LOGO_PATH))}" width="140" height="42" alt="${escapeAttr(t("layout.logoAlt"))}" style="display:block;border:0;outline:none;text-decoration:none;height:42px;width:140px;border-radius:6px;" />`;
  const headLinks = [
    `<a class="fq-head-link" href="${escapeAttr(helpUrl)}" style="color:${MUTED};text-decoration:none;">${escapeHtml(t("layout.help"))}</a>`,
    ...(accountLink ? [`<a class="fq-head-link" href="${escapeAttr(accountUrl)}" style="color:${MUTED};text-decoration:none;">${escapeHtml(t("layout.account"))}</a>`] : []),
  ].join(`<span class="fq-head-link" style="color:${MUTED};"> &middot; </span>`);

  const heroOk = hero && heroSrcAllowed(hero.src);
  const heroW = 600;
  const heroH = heroOk && Number(hero.width) > 0 && Number(hero.height) > 0 ? Math.round((heroW * Number(hero.height)) / Number(hero.width)) : null;
  const heroHtml = heroOk
    ? `<tr><td style="padding:0;background:${CARD};line-height:0;font-size:0;"><img class="fq-hero" src="${escapeAttr(hero.src)}" width="${heroW}"${heroH ? ` height="${heroH}"` : ""} alt="${escapeAttr(hero.alt || "")}" style="display:block;width:100%;max-width:${heroW}px;height:auto;border:0;" /></td></tr>`
    : "";

  const headingHtml = heading
    ? `<h1 style="margin:0 0 ${sub ? "4px" : "16px"} 0;font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${escapeHtml(heading)}</h1>${
        sub ? `<p style="margin:0 0 18px 0;font-size:14px;line-height:1.5;color:${MUTED};">${escapeHtml(sub)}</p>` : ""
      }`
    : "";

  const ctaHtml =
    cta && cta.url && cta.label
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0 auto;"><tr><td align="center" bgcolor="${INK}" style="border-radius:999px;background:${INK};">
          <a href="${escapeAttr(cta.url)}" style="display:inline-block;padding:14px 32px;border-radius:999px;background:${INK};color:#ffffff !important;text-decoration:none;font-weight:700;font-size:15px;line-height:1.2;">${escapeHtml(cta.label)}</a>
        </td></tr></table>`
      : "";

  const label = footerLabel(t, kind);
  const footerLines = [
    footerIntroHtml ? `<div>${footerIntroHtml}</div>` : "",
    label ? `<div>${escapeHtml(label)}</div>` : "",
    f.address ? `<div>${escapeHtml(f.address)}</div>` : "",
    f.unsubscribeUrl || f.preferencesUrl
      ? `<div style="margin-top:10px;">${[
          f.unsubscribeUrl ? `<a class="fq-foot" href="${escapeAttr(f.unsubscribeUrl)}" style="color:${FAINT};text-decoration:underline;">${escapeHtml(unsubscribeLabel || t("layout.unsubscribe"))}</a>` : "",
          f.preferencesUrl ? `<a class="fq-foot" href="${escapeAttr(f.preferencesUrl)}" style="color:${FAINT};text-decoration:underline;">${escapeHtml(t("layout.managePreferences"))}</a>` : "",
        ]
          .filter(Boolean)
          .join(" &nbsp;&middot;&nbsp; ")}</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const pre = preheader
    ? `<div style="display:none;font-size:1px;color:${PAGE};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <style>
      @media (max-width: 620px) {
        .fq-card { padding: 24px 18px !important; }
        .fq-wrap { padding: 0 !important; }
      }
      @media (prefers-color-scheme: dark) {
        .fq-page { background: ${DARK_PAGE} !important; }
        .fq-head-link { color: ${DARK_LINK} !important; }
        .fq-footer, .fq-footer div, .fq-foot { color: ${DARK_TEXT} !important; }
      }
    </style>
  </head>
  <body class="fq-page" style="margin:0;padding:0;background:${PAGE};font-family:Arial,Helvetica,sans-serif;color:${INK};">
    ${pre}
    <table role="presentation" class="fq-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
      <tr><td align="center" class="fq-wrap" style="padding:16px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          <tr><td style="padding:8px 4px 14px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="left" valign="middle">${logo}</td>
              <td align="right" valign="middle" style="font-size:13px;line-height:1.4;">${headLinks}</td>
            </tr></table>
          </td></tr>
          ${heroHtml}
          <tr><td class="fq-card" style="background:${CARD};padding:32px 30px;border-radius:${heroOk ? "0 0 10px 10px" : "10px"};border:1px solid ${RULE};">
            ${headingHtml}
            ${bodyHtml}
            ${ctaHtml}
            ${afterCtaHtml}
          </td></tr>
          <tr><td class="fq-footer" style="text-align:center;padding:20px 12px;color:${FAINT};font-size:12px;line-height:1.6;">
            ${footerLines}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  // The header points at the endpoint that unsubscribes on POST — which is
  // not always the page the visible link opens (a GET must never mutate:
  // mail scanners pre-fetch every link). Without a one-click endpoint the
  // header is omitted rather than pointed at a page a POST cannot reach.
  const headers = oneClickUrl && COMMERCIAL_KINDS.includes(kind) ? listUnsubscribeHeaders(oneClickUrl) : {};
  return { html, headers, footer: f };
}
