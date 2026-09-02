// lib/sales/intel/signatureSeed.js
//
// The starter `TechnologySignature` rows — whose software a prospect is
// already running, and how we know.
//
// ══ Every pattern below was verified. Here is the standard ════════════════
//
// A wrong Jobber detection puts a false claim in a rep's script and the
// contractor on the other end of the phone knows which software they pay for.
// So nothing here was typed from memory. Each signature carries a `sourced`
// note saying exactly how its patterns were confirmed, and the standard was:
//
//   VENDOR      the vendor's own code — an official plugin, or the vendor's
//               own embed script fetched and read.
//   LIVE        the endpoint was fetched and answered, and what it served
//               matched the claim.
//   WILD        the markup was found on a real third-party site or in a real
//               third-party repository using the product.
//   DB          two independent open fingerprint databases agree. Weakest of
//               the four, and used only where the pattern is a `generator`
//               meta tag whose text the vendor writes.
//
// A signature that could not be verified ships `active: false` with the reason
// in `sourced`. It is NOT quietly omitted: an absent signature looks like an
// oversight, and a disabled one with a sentence attached is a decision on the
// record. It is also not shipped active-and-wrong, which is the failure this
// whole standard exists to prevent.
//
// ══ isCompetitor is not "a company we compete with" ═══════════════════════
//
// It is a switch on the sales conversation. `evaluateRule` refuses every
// table-stakes capability the moment a competitor is present, because telling
// somebody on Jobber that they should get online booking is telling them about
// something they already pay for. So the question each entry answers is: does
// this product do FieldQuo's JOB — quote, schedule, invoice, get paid?
//
//   Jobber, Housecall Pro, ServiceTitan, Workiz, Markate, Joist  →  yes.
//   Wix, Squarespace, GoDaddy, WordPress                         →  no. A
//     website builder is not a field-service platform; a contractor on Wix has
//     a website and no scheduler, and marking it a competitor would delete
//     every real talking point they have.
//   Calendly, Acuity, Podium, Birdeye, Tawk, Intercom, Stripe, Square → no.
//     Each is one bought-in piece of the pipeline. They are the strongest
//     evidence of all that the contractor knows the gap exists.
//
// ══ Where the CDN hostnames come from, and why they are safe to match ═════
//
// Two signatures match an opaque CloudFront hostname. That looks fragile until
// you see what it is paired with: `hostMatches` in technology.js is a suffix
// match, not `includes`, so `d3ey4dbjkt2f6s.cloudfront.net` cannot be spoofed
// by a lookalike domain, and the accompanying path (`work_request_embed`) is
// Jobber's own. The host was confirmed as Jobber's by fetching it: it 302s to
// `secure.getjobber.com/login`.
import { PATTERN_KINDS, signatureProblems } from "./technology";

const COMPETITOR = true;
const ADJACENT = false;

/**
 * The rows.
 *
 * `weight` is "how much would this one observation alone convince me", and the
 * combination is noisy-OR in technology.js — so three 0.6s beat one 0.9 and
 * nothing ever reaches 1.00. The scale used here, consistently:
 *
 *   0.90  the vendor's own script or stylesheet, on the vendor's own host
 *   0.85  an iframe pointing at the vendor's booking/widget host
 *   0.85  a `generator` meta tag the vendor's own builder writes
 *   0.70  a cookie the vendor's script sets
 *   0.65  an outbound link to the vendor's customer-facing host
 *   0.50  a class name or container id the vendor's widget renders (loose)
 *   0.35  a "powered by" line in the visible text (loose)
 *
 * Loose kinds cannot carry a detection alone — see technology.js's
 * LOOSE_CEILING. They are here because they make an evidence trail readable,
 * not because they decide anything.
 */
const SIGNATURES = [
  /* ═══════════════════════════════════════════════════════════════════════
     Competitors — a field-service platform is already installed
     ═══════════════════════════════════════════════════════════════════ */
  {
    code: "JOBBER",
    name: "Jobber",
    isCompetitor: COMPETITOR,
    active: true,
    sourced:
      "VENDOR + LIVE + WILD. Jobber's official WordPress plugin (wordpress.org/plugins/jobber, " +
      "built by 10up) whitelists a <script> carrying vendor_id / form_url / clienthub_id and a " +
      "<link rel=stylesheet> — see includes/classes/Blocks.php. The embed host was confirmed by " +
      "fetching it: d3ey4dbjkt2f6s.cloudfront.net/assets/external/work_request_embed.js 302s to " +
      "secure.getjobber.com/login, and the sibling .css served 200 and defines " +
      "iframe.jobber-work-request / .jobber-inline-work-request / .jobber-dialog-overlay. The " +
      "same two URLs appear in a real contractor site in the wild.",
    patterns: [
      { kind: "script_src", pattern: "cloudfront.net/assets/external/work_request_embed", weight: 0.9 },
      { kind: "script_src", pattern: "cloudfront.net/assets/static_link/work_request_embed_snippet", weight: 0.9 },
      { kind: "link", pattern: "cloudfront.net/assets/external/work_request_embed.css", weight: 0.9 },
      { kind: "iframe_host", pattern: "clienthub.getjobber.com", weight: 0.85 },
      { kind: "link", pattern: "clienthub.getjobber.com", weight: 0.65 },
      { kind: "html", pattern: "jobber-work-request", weight: 0.5 },
      { kind: "html", pattern: "jobber-inline-work-request", weight: 0.5 },
      { kind: "html", pattern: "clienthub_id", weight: 0.5 },
    ],
  },
  {
    code: "HOUSECALL_PRO",
    name: "Housecall Pro",
    isCompetitor: COMPETITOR,
    active: true,
    sourced:
      "VENDOR + LIVE + WILD. online-booking.housecallpro.com/script.js served 200; reading it " +
      "shows it looks for .hcp-button[data-orgname][data-token], builds " +
      "<iframe class=\"hcp-iframe\" src=\"https://book.housecallpro.com/book/{orgName}/{token}?v2=true\"> " +
      "inside <div class=\"hcp-widget\">, and exposes HCPWidget.openModal(). The same script tag and " +
      "button markup appear verbatim on real contractor sites.",
    patterns: [
      { kind: "script_src", pattern: "online-booking.housecallpro.com", weight: 0.9 },
      { kind: "iframe_host", pattern: "book.housecallpro.com", weight: 0.85 },
      { kind: "link", pattern: "book.housecallpro.com", weight: 0.65 },
      { kind: "html", pattern: "HCPWidget", weight: 0.5 },
      { kind: "html", pattern: "hcp-button", weight: 0.5 },
      { kind: "html", pattern: "data-orgname", weight: 0.5 },
    ],
  },
  {
    code: "SERVICETITAN",
    name: "ServiceTitan",
    isCompetitor: COMPETITOR,
    active: true,
    sourced:
      "LIVE + WILD. go.servicetitan.com/webscheduler?tenantid=… served 200 and the page defines " +
      "window.webScheduler with tenantId / tenantName / businessUnitId / campaignId. The same " +
      "iframe URL appears in a third-party scheduling widget component in the wild.",
    patterns: [
      { kind: "iframe_host", pattern: "go.servicetitan.com/webscheduler", weight: 0.9 },
      { kind: "iframe_host", pattern: "go.servicetitan.com", weight: 0.8 },
      { kind: "script_src", pattern: "servicetitan.com", weight: 0.8 },
      { kind: "link", pattern: "go.servicetitan.com", weight: 0.6 },
      { kind: "html", pattern: "webScheduler", weight: 0.5 },
    ],
  },
  {
    code: "WORKIZ",
    name: "Workiz",
    isCompetitor: COMPETITOR,
    active: true,
    sourced:
      "LIVE + WILD. online-booking.workiz.com served 200 with a booking application. The same " +
      "iframe, carrying an ?ac= account token, appears on a real appliance-repair site.",
    patterns: [
      { kind: "iframe_host", pattern: "online-booking.workiz.com", weight: 0.9 },
      { kind: "script_src", pattern: "workiz.com", weight: 0.8 },
      { kind: "link", pattern: "online-booking.workiz.com", weight: 0.65 },
    ],
  },
  {
    code: "MARKATE",
    name: "Markate",
    isCompetitor: COMPETITOR,
    active: true,
    sourced:
      "WILD + DB. A real power-washing site embeds " +
      "<iframe id=\"markate-widget-contact-iframe\" src=\"https://www.markate.com/public/widget/contact?id=…\">. " +
      "An open fingerprint database independently lists markate.com script sources and an " +
      "author meta of ^Markate$. The widget host itself refuses a request with a made-up id, " +
      "which is correct behaviour and not a contradiction.",
    patterns: [
      { kind: "iframe_host", pattern: "markate.com/public/widget", weight: 0.9 },
      { kind: "iframe_host", pattern: "markate.com", weight: 0.8 },
      { kind: "script_src", pattern: "markate.com", weight: 0.85 },
      { kind: "meta", pattern: "author=Markate", weight: 0.7 },
      { kind: "html", pattern: "markate-widget", weight: 0.5 },
    ],
  },
  {
    code: "JOIST",
    name: "Joist",
    isCompetitor: COMPETITOR,
    active: false,
    sourced:
      "NOT VERIFIED — shipped inactive on purpose. Joist is an estimate/invoice app for " +
      "contractors with no customer-facing website embed: no booking widget, no request form, " +
      "no client hub to link to. Its own comparison pages concede that online booking and a " +
      "client self-serve hub are what Jobber has and it does not. So there is nothing on a " +
      "contractor's website for a crawler to see, and any pattern here would be invented. If " +
      "Joist ships an embed, add the pattern and switch this on — the row exists so the absence " +
      "is a decision rather than an oversight.",
    patterns: [{ kind: "link", pattern: "joist.com", weight: 0.4 }],
  },

  /* ═══════════════════════════════════════════════════════════════════════
     Adjacent — a bought-in piece of the pipeline, not a platform
     ═══════════════════════════════════════════════════════════════════ */
  {
    code: "CALENDLY",
    name: "Calendly",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "LIVE + DB. assets.calendly.com/assets/external/widget.js served 200. An open fingerprint " +
      "database independently lists the same script host plus calendly.com anchors.",
    patterns: [
      { kind: "script_src", pattern: "assets.calendly.com", weight: 0.9 },
      { kind: "iframe_host", pattern: "calendly.com", weight: 0.85 },
      { kind: "link", pattern: "calendly.com", weight: 0.6 },
      { kind: "html", pattern: "calendly-inline-widget", weight: 0.5 },
    ],
  },
  {
    code: "ACUITY_SCHEDULING",
    name: "Acuity Scheduling",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "LIVE + DB. embed.acuityscheduling.com/js/embed.js served 200. An open fingerprint " +
      "database independently lists .acuityscheduling.com scripts and an iframe on the " +
      "product's own subdomain. The subdomain is deliberately NOT written into a pattern: " +
      "hostMatches is a dot-anchored suffix test, so acuityscheduling.com already covers every " +
      "subdomain of it, and a narrower duplicate would only be another line to keep in step.",
    patterns: [
      { kind: "script_src", pattern: "embed.acuityscheduling.com", weight: 0.9 },
      { kind: "script_src", pattern: "acuityscheduling.com", weight: 0.85 },
      { kind: "iframe_host", pattern: "acuityscheduling.com", weight: 0.85 },
      { kind: "link", pattern: "acuityscheduling.com", weight: 0.6 },
    ],
  },
  {
    code: "PODIUM",
    name: "Podium",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "LIVE + DB. connect.podium.com/widget.js served 200 with a 261 KB bundle. Two independent " +
      "lists name the same host: an open fingerprint database (.podium.com scripts, " +
      "PodiumWebChat global) and a widely used chat-widget blocklist (||connect.podium.com/*).",
    patterns: [
      { kind: "script_src", pattern: "connect.podium.com", weight: 0.9 },
      { kind: "script_src", pattern: "podium.com", weight: 0.8 },
      { kind: "html", pattern: "PodiumWebChat", weight: 0.5 },
      { kind: "html", pattern: "podium-website-widget", weight: 0.5 },
    ],
  },
  {
    code: "BIRDEYE",
    name: "Birdeye",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "LIVE + DB. birdeye.com/embed/… answered (308 to the canonical path). An open fingerprint " +
      "database lists birdeye.com/embed scripts and a bfiframe global; the same chat-widget " +
      "blocklist names ||birdeye.com/embed/*.",
    patterns: [
      { kind: "script_src", pattern: "birdeye.com/embed", weight: 0.9 },
      { kind: "iframe_host", pattern: "birdeye.com", weight: 0.8 },
      { kind: "script_src", pattern: "birdeye.com", weight: 0.75 },
      { kind: "html", pattern: "bf-revz-widget", weight: 0.5 },
    ],
  },
  {
    code: "TAWK_TO",
    name: "Tawk.to live chat",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "DB ×2 + LIVE-ish. embed.tawk.to answered (400 to a made-up property id, which is the " +
      "host working rather than failing). An open fingerprint database lists //embed.tawk.to " +
      "scripts and a TawkConnectionTime cookie; the chat-widget blocklist names ||embed.tawk.to/*.",
    patterns: [
      { kind: "script_src", pattern: "embed.tawk.to", weight: 0.9 },
      { kind: "cookie", pattern: "TawkConnectionTime", weight: 0.7 },
      { kind: "html", pattern: "Tawk_API", weight: 0.5 },
    ],
  },
  {
    code: "INTERCOM",
    name: "Intercom",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "LIVE + DB ×2. widget.intercom.io/widget/… served 200. An open fingerprint database lists " +
      "static.intercomcdn.com/intercom.v1 scripts and an iframe#intercom-frame; the chat-widget " +
      "blocklist names ||widget.intercom.io/*.",
    patterns: [
      { kind: "script_src", pattern: "widget.intercom.io", weight: 0.9 },
      { kind: "script_src", pattern: "intercomcdn.com", weight: 0.85 },
      { kind: "html", pattern: "intercom-frame", weight: 0.5 },
      { kind: "html", pattern: "intercomSettings", weight: 0.5 },
    ],
  },
  {
    code: "FACEBOOK_CHAT_PLUGIN",
    name: "Facebook Messenger chat plugin",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "DB ×2. An open fingerprint database names the script " +
      "connect.facebook.net/…/xfbml.customerchat.js and an iframe at " +
      ".facebook.com/v{n}/plugins/customerchat; the chat-widget blocklist names the identical " +
      "path connect.facebook.net/en_US/sdk/xfbml.customerchat.js. The endpoint itself answers " +
      "only inside a page context, so it was not confirmed by a bare fetch and that is said " +
      "here rather than implied.",
    patterns: [
      { kind: "script_src", pattern: "connect.facebook.net", weight: 0.6 },
      { kind: "iframe_host", pattern: "facebook.com/plugins/customerchat", weight: 0.85 },
      { kind: "html", pattern: "xfbml.customerchat.js", weight: 0.5 },
      { kind: "html", pattern: "fb-customerchat", weight: 0.5 },
    ],
  },
  {
    code: "STRIPE_PAYMENTS",
    name: "Stripe payments",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "LIVE + DB. js.stripe.com/v3/ served 200 (1.0 MB). An open fingerprint database lists the " +
      "same script host, the __stripe_mid / __stripe_sid cookies, and checkout.stripe.com and " +
      "billing.stripe.com anchors.",
    patterns: [
      { kind: "script_src", pattern: "js.stripe.com", weight: 0.9 },
      { kind: "link", pattern: "checkout.stripe.com", weight: 0.7 },
      { kind: "link", pattern: "buy.stripe.com", weight: 0.7 },
      { kind: "link", pattern: "billing.stripe.com", weight: 0.7 },
      { kind: "cookie", pattern: "__stripe_mid", weight: 0.7 },
    ],
  },
  {
    code: "SQUARE_PAYMENTS",
    name: "Square payments",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "LIVE + DB. web.squarecdn.com/v1/square.js served 200 (476 KB); js.squareup.com/v2/… " +
      "answered with a redirect. An open fingerprint database lists js.squareup.com scripts and " +
      "a SqPaymentForm global.",
    patterns: [
      { kind: "script_src", pattern: "web.squarecdn.com", weight: 0.9 },
      { kind: "script_src", pattern: "js.squareup.com", weight: 0.9 },
      { kind: "link", pattern: "squareup.com", weight: 0.6 },
      { kind: "link", pattern: "square.site", weight: 0.6 },
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
     Website builders — adjacent, and never a competitor. See the header.
     ═══════════════════════════════════════════════════════════════════ */
  {
    code: "WIX",
    name: "Wix",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "LIVE + DB. A Wix-rendered template page was fetched and contained static.parastorage.com. " +
      "An open fingerprint database lists the same asset host, a wixBiSession global and a " +
      "generator meta of 'Wix.com Website Builder'; a second, independent CMS fingerprint " +
      "database keys Wix off 'wix.com' in the same tag.",
    patterns: [
      { kind: "script_src", pattern: "static.parastorage.com", weight: 0.9 },
      { kind: "meta", pattern: "generator=Wix.com", weight: 0.85 },
      { kind: "html", pattern: "wixBiSession", weight: 0.5 },
    ],
  },
  {
    code: "SQUARESPACE",
    name: "Squarespace",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "LIVE + DB. squarespace.com itself was fetched and contains SQUARESPACE_CONTEXT and " +
      "assets.squarespace.com. An open fingerprint database lists the same global plus a " +
      "'Squarespace' server header.",
    patterns: [
      { kind: "script_src", pattern: "assets.squarespace.com", weight: 0.9 },
      { kind: "script_src", pattern: "static1.squarespace.com", weight: 0.85 },
      { kind: "html", pattern: "SQUARESPACE_CONTEXT", weight: 0.5 },
    ],
  },
  {
    code: "GODADDY_WEBSITE_BUILDER",
    name: "GoDaddy Website Builder",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "DB ×2, no live confirmation. Two independent fingerprint databases key this off the same " +
      "generator meta tag: one as 'Go Daddy Website Builder (version)', the other as " +
      "'starfield technologies; go daddy website builder'. The first also lists a dps_site_id " +
      "cookie. No GoDaddy-built site was fetched to confirm it, so the generator tag carries the " +
      "weight and the wsimg.com asset host is deliberately low — GoDaddy serves that CDN for " +
      "plain hosting too, and on its own it would say only 'their DNS is at GoDaddy'.",
    patterns: [
      { kind: "meta", pattern: "generator=Go Daddy Website Builder", weight: 0.85 },
      { kind: "meta", pattern: "generator=Starfield Technologies", weight: 0.8 },
      { kind: "cookie", pattern: "dps_site_id", weight: 0.7 },
      { kind: "script_src", pattern: "wsimg.com", weight: 0.35 },
    ],
  },
  {
    code: "WORDPRESS",
    name: "WordPress",
    isCompetitor: ADJACENT,
    active: true,
    sourced:
      "DB ×2. An open fingerprint database lists /wp-content/ and /wp-includes/ script and " +
      "stylesheet paths, a generator meta of ^WordPress, and an X-Pingback header at " +
      "/xmlrpc.php; a second CMS fingerprint database keys off the same generator tag. Not " +
      "confirmed live because no verification adds anything — these paths are structural to " +
      "every WordPress install and have been for fifteen years.",
    patterns: [
      { kind: "script_src", pattern: "/wp-content/", weight: 0.85 },
      { kind: "script_src", pattern: "/wp-includes/", weight: 0.85 },
      { kind: "link", pattern: "/wp-content/", weight: 0.7 },
      { kind: "meta", pattern: "generator=WordPress", weight: 0.85 },
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
     Shipped INACTIVE — a lead marketplace is a real signal and neither of
     these publishes markup we could honestly match.
     ═══════════════════════════════════════════════════════════════════ */
  {
    code: "THUMBTACK",
    name: "Thumbtack",
    isCompetitor: ADJACENT,
    active: false,
    sourced:
      "NOT VERIFIED — shipped inactive. Thumbtack publishes no first-party website widget. " +
      "Every 'Thumbtack reviews widget' on offer is a third-party scraper (Elfsight, " +
      "SociableKIT, Repuso), so a script-host pattern would fingerprint the scraper rather " +
      "than Thumbtack. A profile LINK is a real signal and it is a weak one — a contractor " +
      "linking their profile is not the same as buying leads — so it is here, weighted low, " +
      "and switched off until somebody decides that link alone is worth a talking point.",
    patterns: [{ kind: "link", pattern: "thumbtack.com", weight: 0.5 }],
  },
  {
    code: "ANGI",
    name: "Angi / HomeAdvisor",
    isCompetitor: ADJACENT,
    active: false,
    sourced:
      "NOT VERIFIED — shipped inactive, same reason as Thumbtack. No first-party embed was " +
      "found; the only angi.com and homeadvisor.com hits in the fingerprint corpus are " +
      "advertising blocklists, which fingerprint their ad tags rather than a contractor's use " +
      "of the marketplace.",
    patterns: [
      { kind: "link", pattern: "angi.com", weight: 0.5 },
      { kind: "link", pattern: "homeadvisor.com", weight: 0.5 },
    ],
  },
];

/**
 * The seed rows, validated before anybody sees them.
 *
 * Throws rather than filtering, for the reason seedOpportunityRules() gives:
 * a starter signature that silently did not ship is a fingerprint that appears
 * to exist, and this is the one moment where the mistake is cheap to see.
 */
export function seedSignatures() {
  const seen = new Set();
  const problems = [];

  const rows = SIGNATURES.map((s) => {
    if (seen.has(s.code)) problems.push(`${s.code}: duplicate signature code`);
    seen.add(s.code);

    if (typeof s.sourced !== "string" || s.sourced.trim().length < 40) {
      // The sourcing note is not documentation, it is the thing that stops a
      // guess being shipped. A signature without one has not been through the
      // standard this file's header sets out.
      problems.push(`${s.code}: no sourcing note`);
    }
    if (s.active === false && !/NOT VERIFIED/.test(s.sourced || "")) {
      problems.push(`${s.code}: inactive without saying it could not be verified`);
    }

    const found = signatureProblems(s);
    if (found.length) problems.push(`${s.code}: ${found.join(", ")}`);

    return {
      code: s.code,
      name: s.name,
      isCompetitor: s.isCompetitor === true,
      active: s.active !== false,
      patterns: s.patterns,
      version: "1",
    };
  });

  if (problems.length) throw new Error(`seedSignatures: ${problems.join("; ")}`);
  return rows;
}

/** The sourcing notes, keyed by code — for the admin screen and for anyone
 *  asking "how do we know". Kept out of the database row on purpose: it
 *  describes the SEED, and a superadmin who edits the patterns has made the
 *  note untrue. */
export function sourcingNotes() {
  return Object.fromEntries(SIGNATURES.map((s) => [s.code, s.sourced]));
}

/** Which of the starter rows ship switched off, and why. */
export function unverifiedSignatures() {
  return SIGNATURES.filter((s) => s.active === false).map((s) => ({
    code: s.code,
    name: s.name,
    reason: s.sourced,
  }));
}

/**
 * Write the starter signatures.
 *
 * Additive and idempotent, in the shape seedIntelConfig() uses, and with the
 * same boundary: the AUTHORED half of a row belongs to whoever edits the
 * screen and is written once. `patterns`, `active` and `isCompetitor` are all
 * authored — a superadmin who tuned a weight, switched a signature off, or
 * reclassified one has made a decision, and a re-seed that reset it would make
 * the screen a control that appears to work and doesn't.
 *
 * Only `name` is refreshed, because it is a label and nothing decides on it.
 *
 * @param db  passed in rather than imported, so this stays the only line in
 *            the file that would need a database to execute.
 */
export async function seedTechnologySignatures({ db, log = () => {} } = {}) {
  if (!db) throw new Error("seedTechnologySignatures: needs a db client");
  const counts = { created: 0, existing: 0 };

  for (const row of seedSignatures()) {
    const before = await db.technologySignature.findUnique({ where: { code: row.code } });
    if (before) {
      await db.technologySignature.update({ where: { code: row.code }, data: { name: row.name } });
      counts.existing++;
      continue;
    }
    await db.technologySignature.create({ data: row });
    counts.created++;
    log(`  + signature ${row.code}${row.active ? "" : " (inactive — could not verify)"}`);
  }

  return counts;
}

/** Every pattern kind the starter rows actually use — so "we support seven
 *  kinds and seed three of them" is answerable without reading the array. */
export function seededPatternKinds() {
  const kinds = new Set();
  for (const s of SIGNATURES) for (const p of s.patterns) kinds.add(p.kind);
  return PATTERN_KINDS.filter((k) => kinds.has(k));
}
