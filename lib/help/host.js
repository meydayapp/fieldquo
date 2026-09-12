// lib/help/host.js
//
// Is this request for help.fieldquo.com? Pure, so middleware.js and
// scripts/check-help-centre.mjs execute the same function.
//
// `help` sits in RESERVED_SUBDOMAINS (lib/site/subdomain.js), so
// subdomainFromHost already returns null for it and no tenant can claim it.
// That only stops the takeover; something still has to SERVE the host, and
// this is the test middleware.js runs FIRST — before the tenant rewrite and
// before every session gate — because a contractor reading a help article in
// a driveway has no session and must never be asked for one.
//
// Matched on the exact platform hostnames rather than "starts with help." on
// purpose: help.sunset.fieldquo.com is not a name this file should turn into
// the help centre, and help.localhost is listed so the rewrite is testable
// before DNS exists (Chrome and Safari resolve *.localhost without /etc/hosts,
// the same trick lib/site/subdomain.js relies on).

const HELP_HOSTNAMES = new Set(["help.fieldquo.com", "help.localhost"]);

export function isHelpHost(host) {
  if (!host) return false;
  const hostname = String(host).split(":")[0].toLowerCase().trim();
  return HELP_HOSTNAMES.has(hostname);
}
