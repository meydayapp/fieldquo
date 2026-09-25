// lib/mailbox/presets.js
//
// The hosts small contractors in the USA and Canada actually use, with the
// settings each provider PUBLISHES — and how to recognise each one from the
// domain's MX records, so typing an address picks the right option.
//
// ══ Only what the provider itself documents ═══════════════════════════════
//
// Every preset names the provider page its host, port and security came from
// (`source`), checked 2026-09-25, and the pages behind its limits, username
// rule or MX routing (`sources`), re-verified against the providers' own help
// pages the same day. A provider whose settings could not be confirmed from
// its own documentation (a search snippet is not documentation) is NOT given
// a host here: the form falls back to "Other — enter the servers" rather than
// guessing, because a guessed host is a password sent to the wrong server.
//
// ══ `route` ═══════════════════════════════════════════════════════════════
//
//   imap         connect with address + password (this file's hosts)
//   google       hosted by Google (Workspace, Gmail, Wix/Squarespace mail):
//                use the Google option — Google refuses plain passwords
//   microsoft    hosted by Microsoft (365, Outlook.com, GoDaddy's 365 mail):
//                use the Microsoft option — Microsoft has switched basic
//                auth off for IMAP
//   unsupported  cannot be connected with a password from a server (Proton:
//                Bridge only; Rogers: app passwords can no longer be made)
//
// ══ Security of a custom host ═════════════════════════════════════════════
//
// A preset's host always wins over anything the browser sent. A custom host
// must be a public DNS name (no IP literal, no localhost, no single-label
// name): the login test opens a socket from our server to it, and an address
// like 10.0.0.5 or metadata.internal would turn that into a probe of our own
// network.

/**
 * @typedef {{
 *   key, label, route,
 *   imapHost?, imapPort?, imapSecurity?, smtpHost?, smtpPort?, smtpSecurity?,
 *   hostPattern?, noteKey?, domains?: string[], mx?: RegExp[],
 *   imapLogin?: "localpart", smtpLogin?: "localpart", imapLoginFallback?: "address",
 *   sendLimit?: { count: number, per: "hour" | "day" }, maxRecipients?: number,
 *   source: string, sources?: string[],
 * }} Preset
 *
 * `source` is the page the hosts came from; `sources` the other provider
 * pages a figure or rule in the preset rests on (limits, MX, username).
 */

/** @type {Preset[]} */
export const PRESETS = Object.freeze([
  // ── Password (IMAP) hosts, each from the provider's own page ─────────────
  {
    key: "namecheap",
    label: "Namecheap Private Email",
    route: "imap",
    // Namecheap documents ONE host for both directions — mail.privateemail.com
    // (there is no smtp.privateemail.com), 993/465 SSL or 143/587 STARTTLS.
    imapHost: "mail.privateemail.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "mail.privateemail.com",
    smtpPort: 465,
    smtpSecurity: "tls",
    // KB 10719: 500 an hour per mailbox on current paid plans, but 20 an hour
    // on a TRIAL, and the legacy Starter/Pro/Ultimate plans count 500/1,000/
    // 1,500 an hour per DOMAIN. Nothing we can read tells a trial from a paid
    // mailbox, so the throttle uses the paid figure and relies on the
    // back-off: Namecheap's own refusal is recorded on the row and the
    // mailbox rests for the window (lib/mailbox/sendThrottle.js) while
    // FieldQuo's sender carries the mail. Using 20/h for everyone would push
    // every paying Namecheap customer's quotes off their own mailbox after
    // sixteen emails for the sake of a trial that ends in weeks.
    sendLimit: { count: 500, per: "hour" },
    maxRecipients: 50,
    noteKey: "app.workEmail.note.namecheap",
    mx: [/(^|\.)privateemail\.com$/i],
    source: "https://www.namecheap.com/support/knowledgebase/article.aspx/1179/2175/general-private-email-configuration-for-mail-clients-and-mobile-devices/",
    sources: ["https://www.namecheap.com/support/knowledgebase/article.aspx/10719/2179/email-sending-and-usage-limits-for-private-email/"],
  },
  {
    key: "godaddy",
    // Professional Email (Titan-powered) is what GoDaddy sells today; the
    // older Workspace Email's help pages now 404 and it uses the same hosts,
    // so it rides on this preset rather than getting one of its own.
    label: "GoDaddy Professional Email (or older Workspace Email)",
    route: "imap",
    imapHost: "imap.secureserver.net",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtpout.secureserver.net",
    smtpPort: 465,
    smtpSecurity: "tls",
    // Help 31970: 500 messages a DAY per mailbox through SMTP, 100
    // recipients a message. A daily window, not an hourly one — an hourly
    // 500 would let one busy morning spend the whole day's allowance.
    sendLimit: { count: 500, per: "day" },
    maxRecipients: 100,
    noteKey: "app.workEmail.note.godaddy",
    mx: [/(^|\.)secureserver\.net$/i],
    source: "https://www.godaddy.com/help/use-imap-settings-to-add-my-professional-email-to-a-client-32204",
    sources: ["https://www.godaddy.com/help/professional-email-account-limitations-31970"],
  },
  {
    key: "titan",
    label: "Titan Email",
    route: "imap",
    imapHost: "imap.titan.email",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.titan.email",
    smtpPort: 465,
    smtpSecurity: "tls",
    // mx1/mx2.titan.email — also what Squarespace's "Essential Email by Titan"
    // publishes. Squarespace sells Titan OR Google Workspace, so a Squarespace
    // domain is decided by this MX (or Google's), never by "Squarespace".
    mx: [/(^|\.)titan\.email$/i],
    source: "https://support.titan.email/hc/en-us/articles/900000215446-Configure-Titan-on-other-apps-using-IMAP-POP",
    sources: [
      "https://support.titan.email/hc/en-us/articles/360036853934-Setup-Titan-for-your-domain",
      "https://support.squarespace.com/hc/en-us/articles/205812268-Custom-email-addresses-and-Squarespace",
    ],
  },
  {
    // Key kept as "zoho" — it is stored on connected rows.
    key: "zoho",
    // Zoho's hosts follow the PLAN, not the address: paid plans use
    // imappro/smtppro, the free plan imap/smtp. A domain's MX cannot tell the
    // two apart, so MX detection suggests the paid pair (a business on its
    // own domain with IMAP is almost always paying) and the note says to try
    // the free pair if the sign-in is refused.
    label: "Zoho Mail — paid plan",
    route: "imap",
    imapHost: "imappro.zoho.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtppro.zoho.com",
    smtpPort: 465,
    smtpSecurity: "tls",
    noteKey: "app.workEmail.note.zoho",
    // zoho.com only (mx/mx2/mx3.zoho.com): an EU/India/Australia/Canada
    // account's hosts end differently and were not confirmed — matching those
    // MX records here would suggest the US hosts and fail the login, so they
    // fall to "Other — enter the servers".
    mx: [/(^|\.)zoho\.com$/i],
    source: "https://www.zoho.com/mail/help/imap-access.html",
  },
  {
    key: "zoho_personal",
    label: "Zoho Mail — free plan",
    route: "imap",
    imapHost: "imap.zoho.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.zoho.com",
    smtpPort: 465,
    smtpSecurity: "tls",
    noteKey: "app.workEmail.note.zoho",
    domains: ["zohomail.com"],
    source: "https://www.zoho.com/mail/help/imap-access.html",
  },
  {
    key: "yahoo",
    label: "Yahoo Mail",
    route: "imap",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecurity: "tls",
    noteKey: "app.workEmail.note.appPassword",
    domains: ["yahoo.com", "yahoo.ca", "ymail.com", "rocketmail.com"],
    // Yahoo-hosted custom domains answer on *.yahoodns.net; a suggestion
    // only — the login test is the proof. (@rogers.com is caught by its own
    // domain first: see the Rogers entry.)
    mx: [/(^|\.)yahoodns\.net$/i],
    source: "https://help.yahoo.com/kb/SLN4075.html",
  },
  {
    key: "aol",
    label: "AOL Mail",
    route: "imap",
    imapHost: "imap.aol.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.aol.com",
    smtpPort: 465,
    smtpSecurity: "tls",
    // Its own note: AOL refuses to issue an app password from a browser that
    // has not signed in to AOL Mail for several days running, and support
    // cannot override it — a contractor told only "make an app password"
    // would assume FieldQuo is broken.
    noteKey: "app.workEmail.note.aol",
    domains: ["aol.com"],
    source: "https://help.aol.com/articles/how-do-i-use-other-email-applications-to-send-and-receive-my-aol-mail",
    sources: ["https://help.aol.com/articles/create-and-manage-app-password"],
  },
  {
    key: "verizon",
    label: "Verizon.net (AOL Mail)",
    route: "imap",
    // Verizon.net mail lives at AOL, but SENDING is Verizon's own host: IMAP
    // imap.aol.com, SMTP smtp.verizon.net — not smtp.aol.com.
    imapHost: "imap.aol.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.verizon.net",
    smtpPort: 465,
    smtpSecurity: "tls",
    noteKey: "app.workEmail.note.aol",
    domains: ["verizon.net"],
    source: "https://help.aol.com/articles/how-do-i-set-up-other-email-applications-to-send-and-receive-my-verizon-net-mail",
    sources: ["https://help.aol.com/articles/create-and-manage-app-password"],
  },
  {
    key: "att",
    label: "AT&T Mail (att.net, sbcglobal.net, bellsouth.net…)",
    route: "imap",
    imapHost: "imap.mail.att.net",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.mail.att.net",
    smtpPort: 465,
    smtpSecurity: "tls",
    noteKey: "app.workEmail.note.att",
    // Every domain AT&T's settings page lists — the old regional ISPs AT&T
    // absorbed. Missing one sends a @pacbell.net contractor to a DNS lookup
    // that finds Yahoo's MX and suggests the wrong servers.
    domains: ["att.net", "ameritech.net", "bellsouth.net", "currently.com", "flash.net", "nvbell.net", "pacbell.net", "prodigy.net", "sbcglobal.net", "snet.net", "swbell.net", "wans.net"],
    source: "https://www.att.com/support/article/email-support/KM1010523/",
  },
  {
    key: "icloud",
    label: "iCloud Mail",
    route: "imap",
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecurity: "starttls",
    // Apple: IMAP signs in with the name BEFORE the @ — though some accounts
    // are refused that and take the full address, so the connect route
    // retries once with the address (imapLoginFallback) and stores whichever
    // worked. SMTP always takes the full address. Same app-specific password.
    imapLogin: "localpart",
    imapLoginFallback: "address",
    noteKey: "app.workEmail.note.icloud",
    domains: ["icloud.com", "me.com", "mac.com"],
    source: "https://support.apple.com/en-us/102525",
  },
  {
    key: "fastmail",
    label: "Fastmail",
    route: "imap",
    imapHost: "imap.fastmail.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.fastmail.com",
    smtpPort: 465,
    smtpSecurity: "tls",
    // Daily limits by plan: Basic 4,000 / Standard 8,000 / Professional
    // 16,000, with an hourly limit of half the daily and a 10-minute limit of
    // half the hourly. The plan is invisible to us, so the lowest (Basic)
    // daily figure is the throttle; a burst past the hourly/10-minute limits
    // is refused by Fastmail, recorded, and backed off from.
    sendLimit: { count: 4000, per: "day" },
    noteKey: "app.workEmail.note.fastmail",
    domains: ["fastmail.com"],
    mx: [/(^|\.)messagingengine\.com$/i],
    source: "https://www.fastmail.help/hc/en-us/articles/1500000278342-Server-names-and-ports",
    sources: ["https://www.fastmail.help/hc/en-us/articles/1500000277382-Account-limits"],
  },
  {
    key: "comcast",
    label: "Xfinity / Comcast (comcast.net)",
    route: "imap",
    imapHost: "imap.comcast.net",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.comcast.net",
    smtpPort: 587,
    smtpSecurity: "starttls",
    // Xfinity refuses every outside program until "Third Party Access
    // Security" is ticked in Xfinity Email's settings — the note says so
    // BEFORE the login test fails with a bare "refused".
    noteKey: "app.workEmail.note.comcast",
    domains: ["comcast.net"],
    source: "https://www.xfinity.com/support/articles/email-client-programs-with-xfinity-email",
    sources: ["https://www.xfinity.com/support/articles/third-party-email-access"],
  },
  // Spectrum's server depends on the address's domain. @rr.com is split
  // between Time Warner and Bright House by region and the address does not
  // say which reliably, so it is a hint (SPECTRUM_RR below), not a guess.
  {
    key: "spectrum_charter",
    label: "Spectrum — charter.net, spectrum.net, bresnan.net",
    route: "imap",
    imapHost: "mobile.charter.net",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "mobile.charter.net",
    smtpPort: 587,
    smtpSecurity: "starttls",
    noteKey: "app.workEmail.note.spectrum",
    domains: ["charter.net", "spectrum.net", "bresnan.net"],
    source: "https://www.spectrum.net/support/internet/spectrum-email-server-settings",
  },
  {
    key: "spectrum_twc",
    label: "Spectrum — twc.com and Time Warner rr.com",
    route: "imap",
    imapHost: "mail.twc.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "mail.twc.com",
    smtpPort: 587,
    smtpSecurity: "starttls",
    noteKey: "app.workEmail.note.spectrum",
    domains: ["twc.com"],
    source: "https://www.spectrum.net/support/internet/spectrum-email-server-settings",
  },
  {
    key: "spectrum_brighthouse",
    label: "Spectrum — brighthouse.com and Bright House rr.com",
    route: "imap",
    imapHost: "mail.brighthouse.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "mail.brighthouse.com",
    smtpPort: 587,
    smtpSecurity: "starttls",
    noteKey: "app.workEmail.note.spectrum",
    domains: ["brighthouse.com"],
    source: "https://www.spectrum.net/support/internet/spectrum-email-server-settings",
  },
  {
    key: "shaw",
    label: "Shaw (shaw.ca)",
    route: "imap",
    imapHost: "imap.shaw.ca",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "mail.shaw.ca",
    smtpPort: 587,
    smtpSecurity: "starttls",
    // Rogers' Shaw page: sign in with the address WITHOUT "@shaw.ca", both ways.
    imapLogin: "localpart",
    smtpLogin: "localpart",
    domains: ["shaw.ca"],
    source: "https://www.rogers.com/support/internet/shaw-email/pop-and-imap-email-server-settings",
  },
  {
    key: "bell",
    label: "Bell (bell.net, sympatico.ca)",
    route: "imap",
    imapHost: "imap.bell.net",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtphm.sympatico.ca",
    smtpPort: 587,
    smtpSecurity: "starttls",
    domains: ["bell.net", "sympatico.ca"],
    source: "https://support.bell.ca/internet/email/how-to-use-bell-mail?step=5",
  },
  {
    key: "cogeco",
    label: "Cogeco — Ontario (cogeco.ca)",
    route: "imap",
    imapHost: "imap.cogeco.ca",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.cogeco.ca",
    smtpPort: 587,
    smtpSecurity: "starttls",
    domains: ["cogeco.ca"],
    source: "https://help.cogeco.ca/article/how-do-i-set-up-my-cogeco-email-1548",
  },
  {
    key: "cogeco_qc",
    label: "Cogeco — Québec (cgocable.ca)",
    route: "imap",
    imapHost: "imap.cgocable.ca",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.cgocable.ca",
    smtpPort: 587,
    smtpSecurity: "starttls",
    domains: ["cgocable.ca"],
    source: "https://help.cogeco.ca/article/how-do-i-set-up-my-cogeco-email-1548",
  },

  // ── Hosted by Google / Microsoft: their own sign-in, never a password ────
  {
    key: "google",
    label: "Google Workspace / Gmail",
    route: "google",
    // telus.net: TELUS moved its customers' mail onto Google ("TELUS email
    // powered by Google", IMAP host imap.gmail.com) — Google refuses a plain
    // password there exactly as it does for Gmail.
    domains: ["gmail.com", "googlemail.com", "telus.net"],
    // smtp.google.com is Workspace's current single MX; aspmx.l.google.com
    // and its alternates (and *.googlemail.com) are the legacy set Google
    // still honours. Wix sells Google Workspace, and Squarespace sells it OR
    // Titan — both land here, or on Titan, by their MX.
    mx: [/(^|\.)google\.com$/i, /(^|\.)googlemail\.com$/i],
    source: "https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace",
    sources: [
      "https://www.telus.com/en/support/article/telus-email-by-google",
      "https://support.squarespace.com/hc/en-us/articles/205812268-Custom-email-addresses-and-Squarespace",
    ],
  },
  {
    key: "microsoft",
    label: "Microsoft 365 / Outlook.com",
    route: "microsoft",
    // Outlook.com/Hotmail consumer mailboxes have IMAP off by default and
    // Microsoft has switched basic auth off — the Microsoft sign-in is the
    // only route that works.
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
    // <token>.mail.protection.outlook.com — Microsoft 365, including
    // GoDaddy's "Microsoft 365 from GoDaddy" — and the DNSSEC-enabled form
    // <token>.<x>-v1.mx.microsoft that Exchange Online now issues. Missing
    // the second sends a DNSSEC tenant to "enter the servers" with a password
    // Microsoft will refuse.
    mx: [/\.mail\.protection\.outlook\.com$/i, /(^|\.)outlook\.com$/i, /\.mx\.microsoft$/i],
    source: "https://learn.microsoft.com/en-us/microsoft-365/enterprise/external-domain-name-system-records",
    sources: [
      "https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/enable-dnssecforverifieddomain?view=exchange-ps",
      "https://www.godaddy.com/help/microsoft-365-email-account-limitations-9003",
    ],
  },

  // ── Cannot be read from a server ─────────────────────────────────────────
  {
    key: "proton",
    label: "Proton Mail",
    route: "unsupported",
    // Reading needs Proton Mail Bridge on a desktop. Paid plans with a custom
    // domain can mint an SMTP token for smtp.protonmail.ch:587 — SENDING only.
    // Not built: a mailbox FieldQuo cannot file from is half the feature, and
    // the note names the token so nobody thinks we missed it.
    noteKey: "app.workEmail.note.proton",
    domains: ["proton.me", "protonmail.com", "pm.me"],
    mx: [/(^|\.)protonmail\.ch$/i],
    source: "https://proton.me/support/smtp-submission",
  },
  {
    key: "rogers",
    label: "Rogers (rogers.com)",
    // Rogers mail is Yahoo-hosted and needs an app password, and Rogers'
    // own FAQ says app password generation is no longer available. So a
    // password sign-in will almost certainly be refused: say that and
    // suggest forwarding, rather than letting the MX check offer Yahoo's
    // servers and a login that cannot succeed. Not a hard block — Yahoo stays
    // in the list for anyone who still holds an old app password.
    route: "unsupported",
    noteKey: "app.workEmail.note.rogers",
    domains: ["rogers.com"],
    source: "https://www.rogers.com/support/internet/rogers-member-centre-faq",
    sources: ["https://www.rogers.com/support/internet/set-up-a-yahoo-account-on-a-device-or-email-program"],
  },
]);

/**
 * Address domains that name a provider without naming its server. @rr.com
 * (and regional subdomains like tampabay.rr.com) is Spectrum, but Spectrum
 * serves it from mail.twc.com OR mail.brighthouse.com depending on which
 * company the account came from — the address cannot settle it, so the form
 * says "Spectrum" and asks, instead of guessing one and failing the login.
 */
const DOMAIN_HINTS = Object.freeze([
  { suffix: "rr.com", label: "Spectrum (Road Runner)", noteKey: "app.workEmail.note.spectrumRr", choices: ["spectrum_twc", "spectrum_brighthouse"] },
]);

// Deliberately NOT here, because their settings could not be confirmed from
// the provider's own page (research 2026-09-25): Hostinger (imap/smtp.
// hostinger.com) and IONOS (imap/smtp.ionos.com) were seen only in search
// snippets, and there is no existing preset with an "enter your host"
// fallback for them to refine; Bluehost, HostGator and SiteGround publish no
// fixed host (usually mail.<your domain>, varying by plan); Zoho's EU / India /
// Australia / Canada data centres. They use "Other — enter the servers", whose
// note says where to find them.

export function presetByKey(key) {
  return PRESETS.find((p) => p.key === key) || null;
}

/** The preset for an address's own domain (gmail.com, icloud.com, shaw.ca…), or null. */
export function presetForDomain(domain) {
  const d = String(domain || "").toLowerCase().trim().replace(/\.$/, "");
  return PRESETS.find((p) => Array.isArray(p.domains) && p.domains.includes(d)) || null;
}

/**
 * An address domain that names the provider but not the server (@rr.com and
 * its regional subdomains → Spectrum, one of two hosts), or null.
 * @returns {{ label, noteKey, choices: string[] } | null}
 */
export function domainHintFor(domain) {
  const d = String(domain || "").toLowerCase().trim().replace(/\.$/, "");
  if (!d) return null;
  return DOMAIN_HINTS.find((h) => d === h.suffix || d.endsWith(`.${h.suffix}`)) || null;
}

/**
 * The second login to try when the first is refused, or null. Only iCloud:
 * Apple documents the name before the @ for IMAP, but some accounts take only
 * the full address. Never when the person typed a login name themselves.
 */
export function loginFallbackFor(conn) {
  if (!conn || conn.loginName) return null;
  const p = presetByKey(conn.preset);
  if (p?.imapLoginFallback !== "address") return null;
  const address = String(conn.address || "");
  return address.includes("@") ? address : null;
}

/** The login a provider expects: the whole address, or (iCloud IMAP, Shaw) the part before @. */
export function loginFor(conn, direction = "imap") {
  if (conn?.loginName) return conn.loginName;
  const p = presetByKey(conn?.preset);
  const rule = direction === "smtp" ? p?.smtpLogin : p?.imapLogin;
  const address = String(conn?.address || "");
  return rule === "localpart" ? address.split("@")[0] : address;
}

/** The first preset whose MX pattern any of these hosts matches, or null. */
export function presetForMx(hosts = []) {
  const list = (Array.isArray(hosts) ? hosts : []).map((h) => String(h || "").toLowerCase().replace(/\.$/, "")).filter(Boolean);
  for (const p of PRESETS) {
    if (!p.mx) continue;
    if (list.some((h) => p.mx.some((re) => re.test(h)))) return p;
  }
  return null;
}

const WINDOW_FOR = { hour: 60 * 60 * 1000, day: 24 * 60 * 60 * 1000 };

/**
 * The provider's published sending figure for a connection and the window it
 * is counted over, or null when the provider publishes none.
 * @returns {{ count: number, windowMs: number, per: "hour" | "day" } | null}
 */
export function sendLimitFor(conn) {
  if (!conn) return null;
  const limit = conn.provider === "google" ? GOOGLE_LIMIT : conn.provider === "microsoft" ? MICROSOFT_LIMIT : presetByKey(conn.preset)?.sendLimit;
  if (!limit || !Number.isFinite(limit.count) || !WINDOW_FOR[limit.per]) return null;
  return { count: limit.count, per: limit.per, windowMs: WINDOW_FOR[limit.per] };
}
// Gmail's published daily limits (500 consumer / 2,000 Workspace) and
// Exchange Online's (10,000 a day, 30 messages a minute — the same figures
// GoDaddy publishes for its Microsoft 365) are daily or per-minute; an hourly
// figure well inside both keeps a busy morning from ever reaching them. The
// provider's own 429 is recorded and backed off from like any refusal.
const GOOGLE_LIMIT = { count: 100, per: "hour" };
const MICROSOFT_LIMIT = { count: 300, per: "hour" };

/** Most recipients (To + Cc + Bcc) the provider accepts on one message, or null. */
export function maxRecipientsFor(conn) {
  if (!conn || conn.provider !== "imap") return null;
  return presetByKey(conn.preset)?.maxRecipients ?? null;
}

const HOST_RE = /^(?=.{4,253}$)(?!-)[a-z0-9-]{1,63}(?:\.(?!-)[a-z0-9-]{1,63})+$/i;

/** Is this a public-looking DNS name (not an IP, not localhost, not internal)? */
export function isPublicHostname(host) {
  const h = String(host || "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST_RE.test(h)) return false;
  if (/^\d+(\.\d+){3}$/.test(h)) return false; // IPv4 literal
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(h)) return false;
  if (!/\.[a-z]{2,}$/.test(h)) return false; // a real TLD
  return true;
}

function port(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : fallback;
}

/**
 * The browser's form → the settings to test and store.
 * @returns { ok: true, imap: { preset, imapHost, imapPort, imapSecurity, smtpHost, smtpPort, smtpSecurity, loginName } }
 *        | { ok: false, code, error }
 */
export function resolveImapSettings({ address, preset, imapHost, imapPort, imapSecurity, smtpHost, smtpPort, smtpSecurity, loginName }) {
  const p = preset && preset !== "custom" ? presetByKey(preset) : null;
  if (preset && preset !== "custom" && !p) return { ok: false, code: "bad_host", error: "Unknown provider preset." };
  if (p && p.route !== "imap") return { ok: false, code: "unsupported_provider", error: `${p.label} is connected with its own option, not a password.` };
  const domain = String(address || "").split("@")[1] || "";
  const fill = (h) => (h ? h.replace("{domain}", domain) : h);

  let out;
  if (p && !p.hostPattern) {
    out = {
      preset: p.key,
      imapHost: p.imapHost,
      imapPort: p.imapPort,
      imapSecurity: p.imapSecurity,
      smtpHost: p.smtpHost || null,
      smtpPort: p.smtpPort || null,
      smtpSecurity: p.smtpSecurity || null,
    };
  } else {
    const secIn = imapSecurity === "starttls" ? "starttls" : imapSecurity === "tls" || imapSecurity === undefined ? "tls" : null;
    if (!secIn) return { ok: false, code: "plain_refused", error: "Unencrypted IMAP is not allowed; choose SSL/TLS or STARTTLS." };
    const host = String(imapHost || (p ? fill(p.imapHost) : "")).trim().toLowerCase();
    if (!isPublicHostname(host)) return { ok: false, code: "bad_host", error: "Enter the incoming server's name, like mail.yourdomain.com." };
    const ip = port(imapPort, null);
    if (!ip) return { ok: false, code: "bad_port", error: "Enter the incoming server's port (usually 993)." };
    let sHost = String(smtpHost || (p ? fill(p.smtpHost) : "") || "").trim().toLowerCase() || null;
    if (sHost && !isPublicHostname(sHost)) return { ok: false, code: "bad_host", error: "Enter the outgoing server's name, like mail.yourdomain.com, or leave it empty." };
    const secOut = smtpSecurity === "starttls" ? "starttls" : "tls";
    out = {
      preset: p ? p.key : "custom",
      imapHost: host,
      imapPort: ip,
      imapSecurity: secIn,
      smtpHost: sHost,
      smtpPort: sHost ? port(smtpPort, secOut === "tls" ? 465 : 587) : null,
      smtpSecurity: sHost ? secOut : null,
    };
  }
  const login = typeof loginName === "string" ? loginName.trim().slice(0, 254) : "";
  out.loginName = login && !/[\r\n]/.test(login) ? login : null;
  return { ok: true, imap: out };
}
