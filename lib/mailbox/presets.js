// lib/mailbox/presets.js
//
// The hosts small contractors in the USA and Canada actually use, with the
// settings each provider PUBLISHES — and how to recognise each one from the
// domain's MX records, so typing an address picks the right option.
//
// ══ Only what the provider itself documents ═══════════════════════════════
//
// Every preset names the provider page its host, port and security came from
// (`source`), checked 2026-09-25. A provider whose settings could not be
// confirmed from its own documentation is NOT given a host here: the form
// falls back to "Other — enter the servers" rather than guessing, because a
// guessed host is a password sent to the wrong server.
//
// ══ `route` ═══════════════════════════════════════════════════════════════
//
//   imap         connect with address + password (this file's hosts)
//   google       hosted by Google (Workspace, Gmail, Wix/Squarespace mail):
//                use the Google option — Google refuses plain passwords
//   microsoft    hosted by Microsoft (365, Outlook.com, GoDaddy's 365 mail):
//                use the Microsoft option — Microsoft has switched basic
//                auth off for IMAP
//   unsupported  cannot be read from a server at all (Proton: Bridge only)
//
// ══ Security of a custom host ═════════════════════════════════════════════
//
// A preset's host always wins over anything the browser sent. A custom host
// must be a public DNS name (no IP literal, no localhost, no single-label
// name): the login test opens a socket from our server to it, and an address
// like 10.0.0.5 or metadata.internal would turn that into a probe of our own
// network.

/** @typedef {{ key, label, route, imapHost?, imapPort?, imapSecurity?, smtpHost?, smtpPort?, smtpSecurity?, hostPattern?, noteKey?, hourlyLimit?, mx?: RegExp[], source }} Preset */

/** @type {Preset[]} */
export const PRESETS = Object.freeze([
  // ── Password (IMAP) hosts, each from the provider's own page ─────────────
  {
    key: "namecheap",
    label: "Namecheap Private Email",
    route: "imap",
    // Namecheap documents ONE host for both directions — mail.privateemail.com
    // (not smtp.privateemail.com), and "only encrypted connections".
    imapHost: "mail.privateemail.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "mail.privateemail.com",
    smtpPort: 465,
    smtpSecurity: "tls",
    // "500/hour/mailbox" on the Launch/Expand/Scale plans (20/hour on a trial,
    // 50 recipients a message): namecheap.com KB 10719.
    hourlyLimit: 500,
    noteKey: "app.workEmail.note.namecheap",
    mx: [/(^|\.)privateemail\.com$/i],
    source: "https://www.namecheap.com/support/knowledgebase/article.aspx/1179/2175/general-private-email-configuration-for-mail-clients-and-mobile-devices/",
  },
  {
    key: "godaddy",
    label: "GoDaddy Workspace / Professional Email",
    route: "imap",
    imapHost: "imap.secureserver.net",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtpout.secureserver.net",
    smtpPort: 465,
    smtpSecurity: "tls",
    // GoDaddy publishes a DAILY SMTP figure (500 a mailbox, help 31970), not
    // an hourly one; its own refusal past that falls back like any other.
    hourlyLimit: null,
    noteKey: "app.workEmail.note.godaddy",
    mx: [/(^|\.)secureserver\.net$/i],
    source: "https://www.godaddy.com/help/use-imap-settings-to-add-my-professional-email-to-a-client-32204",
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
    source: "https://support.titan.email/hc/en-us/articles/900000215446-Configure-Titan-on-other-apps-using-IMAP-POP",
  },
  {
    key: "zoho",
    label: "Zoho Mail (your own domain)",
    route: "imap",
    imapHost: "imappro.zoho.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtppro.zoho.com",
    smtpPort: 465,
    smtpSecurity: "tls",
    noteKey: "app.workEmail.note.zoho",
    // zoho.com only: an EU/India/Australia/Canada account has other hosts,
    // which Zoho shows inside the account rather than publishing — matching
    // those MX records here would suggest the US hosts and fail the login.
    mx: [/(^|\.)zoho\.com$/i],
    source: "https://www.zoho.com/mail/help/imap-access.html",
  },
  {
    key: "zoho_personal",
    label: "Zoho Mail (@zohomail.com)",
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
    // Yahoo-hosted domains (Rogers' @rogers.com among them) answer on
    // *.yahoodns.net; a suggestion only — the login test is the proof.
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
    noteKey: "app.workEmail.note.appPassword",
    domains: ["aol.com"],
    source: "https://help.aol.com/articles/how-do-i-use-other-email-applications-to-send-and-receive-my-aol-mail",
  },
  {
    key: "verizon",
    label: "Verizon.net (AOL Mail)",
    route: "imap",
    imapHost: "imap.aol.com",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "smtp.verizon.net",
    smtpPort: 465,
    smtpSecurity: "tls",
    noteKey: "app.workEmail.note.appPassword",
    domains: ["verizon.net"],
    source: "https://help.aol.com/articles/how-do-i-set-up-other-email-applications-to-send-and-receive-my-verizon-net-mail",
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
    domains: ["att.net", "sbcglobal.net", "bellsouth.net"],
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
    // Apple: IMAP signs in with the name BEFORE the @, SMTP with the full
    // address — both with the same app-specific password.
    imapLogin: "localpart",
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
    noteKey: "app.workEmail.note.fastmail",
    domains: ["fastmail.com"],
    mx: [/(^|\.)messagingengine\.com$/i],
    source: "https://www.fastmail.help/hc/en-us/articles/1500000278342-Server-names-and-ports",
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
    domains: ["gmail.com", "googlemail.com"],
    // smtp.google.com is Workspace's current MX; aspmx.l.google.com and its
    // alternates are the legacy set Google still honours. Wix and Squarespace
    // sell Google Workspace, so their mail lands here by its MX.
    mx: [/(^|\.)google\.com$/i, /(^|\.)googlemail\.com$/i],
    source: "https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace",
  },
  {
    key: "microsoft",
    label: "Microsoft 365 / Outlook.com",
    route: "microsoft",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
    // <token>.mail.protection.outlook.com — Microsoft 365, including
    // GoDaddy's Microsoft-hosted "Microsoft 365 from GoDaddy".
    mx: [/\.mail\.protection\.outlook\.com$/i, /(^|\.)outlook\.com$/i],
    source: "https://learn.microsoft.com/en-us/microsoft-365/enterprise/external-domain-name-system-records",
  },

  // ── Cannot be read from a server ─────────────────────────────────────────
  {
    key: "proton",
    label: "Proton Mail",
    route: "unsupported",
    noteKey: "app.workEmail.note.proton",
    domains: ["proton.me", "protonmail.com", "pm.me"],
    mx: [/(^|\.)protonmail\.ch$/i],
    source: "https://proton.me/support/smtp-submission",
  },
]);

// Deliberately NOT here, because their settings could not be confirmed from
// the provider's own page (2026-09-25): Comcast/Xfinity (its page refused the
// fetch), Spectrum/Charter, TELUS (whose mail now runs on Google — the MX
// check routes it), Rogers (Yahoo-hosted — the MX check suggests Yahoo), and
// the web hosts (Bluehost, HostGator, SiteGround, Hostinger, IONOS), where the
// server is usually mail.<your domain> but varies by plan. They use "Other —
// enter the servers", whose note says where to find them.

export function presetByKey(key) {
  return PRESETS.find((p) => p.key === key) || null;
}

/** The preset for an address's own domain (gmail.com, icloud.com, shaw.ca…), or null. */
export function presetForDomain(domain) {
  const d = String(domain || "").toLowerCase().trim();
  return PRESETS.find((p) => Array.isArray(p.domains) && p.domains.includes(d)) || null;
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

/** The provider's published hourly sending figure for a connection, or null. */
export function hourlySendLimit(conn) {
  if (!conn) return null;
  if (conn.provider === "google") return GOOGLE_HOURLY;
  if (conn.provider === "microsoft") return MICROSOFT_HOURLY;
  const p = presetByKey(conn.preset);
  return p?.hourlyLimit ?? null;
}
// Gmail's published daily limits (500 consumer / 2,000 Workspace) and
// Exchange Online's (10,000 recipients a day, 30 messages a minute) are daily
// or per-minute; an hourly figure well inside both keeps a busy morning from
// ever reaching them. The provider's own 429 is handled as a failure too.
const GOOGLE_HOURLY = 100;
const MICROSOFT_HOURLY = 300;

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
