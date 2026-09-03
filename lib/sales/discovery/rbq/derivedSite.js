// lib/sales/discovery/rbq/derivedSite.js
//
// A website GUESSED from a licence email, and everything that keeps it a guess.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// The RBQ register carries no website column. `routeAfterEnrich` therefore
// sends every RBQ prospect past the crawler, `lib/sales/intel/tradeDetect.js`
// never sees a page, and 54,264 licences bank with `tradeKey: null` and no
// mechanism that can ever make them queue-eligible. The register does carry an
// email on 47,193 of them, and a contractor whose address is
// `info@toituretremblay.com` very often has a website at
// `toituretremblay.com`.
//
// That is a HYPOTHESIS about which website belongs to whom. This file produces
// it, names it as one, and refuses the two ways it could quietly become a
// fact — see "What this must never do" below.
//
// ══ The used-once rule, and why it needs no blocklist to work ══════════════
//
// Measured on the published extract, release 2026-09-03 (927,337 rows →
// 54,264 licences):
//
//   47,199  licences carry an email (87.0%)
//   17,202  distinct email domains
//   15,956  domains used by exactly ONE licence
//   15,924  survive the free-mail belt below — 29.3% of the register, and the
//           number `scripts/rbq-snapshot.mjs` prints when it is run for real
//
// The ten most-shared domains are gmail.com (11,258 licences), hotmail.com
// (8,219), outlook.com (2,397), videotron.ca (1,615), hotmail.ca (795),
// live.ca (665), icloud.com (392), hotmail.fr (376), yahoo.ca (309) and
// yahoo.com (279). Every one of them is a free-mail provider or a Quebec ISP,
// and every one of them is disqualified by ARITHMETIC rather than by anyone
// having written it down: a mailbox provider is shared by definition, so
// "exactly one licence uses this domain" removes the entire class without
// anybody maintaining a list of every ISP in Quebec. That property is the
// design. A hand-kept blocklist would be the thing that rots — failure class 4
// — because it is the artefact nobody looks at until a new ISP appears.
//
// It also removes something a blocklist never would: `fenplast.com` is used by
// 21 licences, `ssss.gouv.qc.ca` by 18. Those are a window manufacturer's
// dealer network and a government health authority — intermediaries, not
// mailbox providers, and no blocklist anybody would think to write contains
// them.
//
// ══ Why there is a small explicit list anyway, and what it measurably buys ═
//
// The used-once rule cannot catch a free-mail domain that is MISSPELLED,
// because a typo is used once BY CONSTRUCTION — that is what makes it a typo.
// Measured on the same file, the used-once set contains eleven exact hits on a
// provider domain:
//
//   gmail.om  agmail.com  homail.com  outlook.ca  yahoo.com.mx  livel.com
//   gmx.com   topmail.com  bell.ca    globetrotter.com  globetrotter.qc.ca
//
// …and twenty-four more that are one character away from one:
//
//   outloo.com  outlooh.com  outlokk.com  outlouk.com  outloook.com
//   oultlook.com  utlook.com  outlook.co  videotro.ca  videoton.ca
//   videotion.ca  icoud.com  illoud.com  egocable.ca  ccrpcable.com
//   tellus.net  blobetrotter.net  globetrotteur.net  yahou.fr  …
//
// Thirty-two of them survive the exact and suffix tests to be caught by the
// near-miss rule, and 15,956 - 15,924 = 32 is the belt's measured effect on a
// real extractor run. Thirty-two out of 15,956 is 0.2%, which sounds ignorable
// and is not: these are the worst thirty-two in the set. `gmail.om` is a live typosquat on
// Oman's TLD. `bell.ca` is Bell Canada. `outlook.ca` is Microsoft. Each is a
// large, fast, well-marked-up site that a crawler reads successfully and a
// detector reads CONFIDENTLY — and the trade it comes back with belongs to
// somebody else entirely. A dead domain costs nothing; a live wrong one costs
// a call.
//
// So the second belt catches the CLASS rather than the instances: exact match,
// any subdomain, or one edit away from an entry of eight characters or more.
// The length floor is measured too — without it, `me.com` pulls in `ge.com`
// and `my.com`, and `live.ca` pulls in `life.ca`, which are not typos of
// anything. At eight, all twenty-four caught domains are visibly misspellings
// and none reads like a contractor's.
//
// Nothing depends on the list being COMPLETE. Its job is the typo, not the
// ISP; the arithmetic removes the ISP.
//
// ══ What this must never do ════════════════════════════════════════════════
//
//   1. Become `Prospect.websiteUrl`. That column means "the source said this
//      is their site". The RBQ said no such thing, and enrichBusiness.js's
//      header sets out the same principle for `hasWebsite: false`: a gap in a
//      directory is not a finding about a business. A derived domain is
//      written as a `ProspectInference`, carrying the address it came from, so
//      a rep reading the screen sees "we guessed this, here is why" rather
//      than a URL the register appears to have published.
//
//   2. Become a route around CASL. lib/sales/contactBasis.js refuses to email
//      an RBQ-sourced address because the Régie published it as a licensing
//      condition and the contractor did not. Deriving `toituretremblay.com`
//      from `info@toituretremblay.com` and then mailing `info@` at the
//      "website" is the same address with a coat of paint on it. This module
//      returns a DOMAIN and never an address, and it never widens what
//      contactBasis permits.
import { normaliseDomain } from "@/lib/sales/suppressionRules";
import { parseRbqEmails } from "./licence";

/** `ProspectInference.kind` this hypothesis owns. One row per prospect. */
export const DERIVED_SITE_INFERENCE_KIND = "derived_site";

/**
 * Why the domain was believed. Stored on the inference so a later reader can
 * tell a guess from a statement without re-deriving anything.
 */
export const DERIVED_SITE_BASIS = "licence_email";

/**
 * Mailbox providers and access ISPs, for the typo case only.
 *
 * Matched on the domain itself OR any subdomain of it, which is what makes one
 * entry cover `sympatico.ca` and `tlb.sympatico.ca` (23 licences) without a
 * second line. Written unaccented and lowercase; `normaliseDomain` has already
 * lowercased whatever is compared against it.
 *
 * NOT the mechanism. See the header: the used-once rule removes this whole
 * class on its own, and every entry here exists because a MISSPELLING of it
 * would otherwise slip through used-once. Adding to it is cheap and removing
 * from it is safe; neither changes what the filter is.
 */
export const FREE_MAIL_DOMAINS = Object.freeze([
  // Global mailbox providers
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.ca",
  "hotmail.fr",
  "hotmail.be",
  "outlook.com",
  "outlook.fr",
  "outlook.ca",
  "live.com",
  "live.ca",
  "live.fr",
  "msn.com",
  "yahoo.com",
  "yahoo.ca",
  "yahoo.fr",
  "yahoo.com.mx",
  "ymail.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "topmail.com",
  "zoho.com",
  "laposte.net",
  "orange.fr",
  "free.fr",
  // Quebec and Canadian access ISPs — the mailbox comes with the connection
  "videotron.ca",
  "videotron.com",
  "sympatico.ca",
  "bell.net",
  "bellnet.ca",
  "bell.ca",
  "telus.net",
  "globetrotter.net",
  "globetrotter.com",
  "globetrotter.qc.ca",
  "cgocable.ca",
  "cgocable.net",
  "sogetel.net",
  "aira.com",
  "ccapcable.com",
  "axion.ca",
  "cooptel.qc.ca",
  "xittel.net",
  "derytele.com",
  "maskatel.net",
  "rogers.com",
  "shaw.ca",
  "cogeco.ca",
  "sasktel.net",
  "eastlink.ca",
]);

const FREE_MAIL_SET = new Set(FREE_MAIL_DOMAINS);

/**
 * Below this length an entry is not checked for near-misses.
 *
 * Measured, not chosen: with no floor, `me.com` catches `ge.com` and `my.com`
 * and `live.ca` catches `life.ca` — none of which is a misspelling of
 * anything, and two of which could be somebody's real domain. At eight, the
 * twenty-four near-misses the rule finds in the real register are every one of
 * them a visible typo. Short domains have too many one-edit neighbours for the
 * distance to mean anything.
 */
const NEAR_MISS_MIN_LENGTH = 8;

const NEAR_MISS_CANDIDATES = FREE_MAIL_DOMAINS.filter((d) => d.length >= NEAR_MISS_MIN_LENGTH);

/**
 * Are these two strings the same but for one character?
 *
 * One substitution, one insertion or one deletion. Written out rather than
 * pulled in, because a full Levenshtein matrix is the wrong tool: the answer
 * needed is a boolean at distance one, and the early exits make this O(n) on
 * strings that differ, which is almost all of them.
 */
export function oneEditApart(a, b) {
  if (a === b) return false; // identical is handled by the exact set
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    let diffs = 0;
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i] && ++diffs > 1) return false;
    }
    return diffs === 1;
  }
  const [shorter, longer] = la < lb ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
    } else if (++skipped > 1) {
      return false;
    } else {
      j++;
    }
  }
  return true;
}

/**
 * Is this domain a mailbox provider's, a subdomain of one, or a typo of one?
 *
 * Three tests, and each catches something the others cannot:
 *
 *   exact       gmail.com
 *   subdomain   tlb.sympatico.ca — 23 licences in the real file, one entry
 *   near-miss   outloook.com, videotro.ca, gmail.om — the class the used-once
 *               arithmetic is blind to, because a typo is unique by definition
 *
 * The suffix test matches on a LABEL boundary, never as a substring:
 * `endsWith("bell.ca")` without the dot swallows `campbell.ca`, and
 * `includes("bell")` swallows `bellaluminium.com` — a real aluminium
 * contractor in this register. That mistake is why this is a function rather
 * than an `includes`.
 */
export function isFreeMailDomain(domain) {
  const d = String(domain ?? "").trim().toLowerCase();
  if (!d) return false;
  if (FREE_MAIL_SET.has(d)) return true;
  for (const entry of FREE_MAIL_SET) {
    if (d.endsWith(`.${entry}`)) return true;
  }
  for (const entry of NEAR_MISS_CANDIDATES) {
    if (oneEditApart(d, entry)) return true;
  }
  return false;
}

/**
 * Every email domain a licence carries, normalised and deduped.
 *
 * Uses the SHIPPED `parseRbqEmails`, so what counts as an address here and
 * what counts as one in `toDiscoveredBusiness` cannot drift into two answers.
 */
export function licenceEmailDomains(licence) {
  const domains = [];
  for (const email of parseRbqEmails(licence?.email)) {
    const domain = normaliseDomain(email);
    if (domain && !domains.includes(domain)) domains.push(domain);
  }
  return domains;
}

/**
 * How many DISTINCT licences use each email domain, across a whole register.
 *
 * ══ It must be counted over the whole file, not over a filtered snapshot ═══
 *
 * This is the trap in the used-once rule and it is silent. `rbq-snapshot.mjs`
 * can be run with `--region Montréal` or `--limit 500`. A domain shared by one
 * Montreal licence and one Laval licence is used TWICE in the register and
 * exactly ONCE inside a Montreal snapshot — so counting after the filter would
 * turn a shared domain into a derivable one precisely in the filtered runs an
 * operator reaches for first. The extractor therefore feeds every row it reads
 * into this counter and applies its filter afterwards.
 *
 * @param licences  anything with `.licence` and `.email`, in any order
 * @returns Map<string, number>
 */
export function countEmailDomains(licences = []) {
  const seen = new Map(); // domain -> Set(licence id)
  for (const licence of licences) {
    const id = String(licence?.licence ?? "").trim();
    if (!id) continue;
    for (const domain of licenceEmailDomains(licence)) {
      if (!seen.has(domain)) seen.set(domain, new Set());
      seen.get(domain).add(id);
    }
  }
  const counts = new Map();
  for (const [domain, ids] of seen) counts.set(domain, ids.size);
  return counts;
}

/**
 * The domain this licence's website is hypothesised to be at, or null.
 *
 * Null is the common answer and it is the honest one: 38,340 of 54,264
 * licences get null here — measured on a real run — because their address is
 * at a mailbox provider or they have no address at all, and "we cannot guess"
 * is a true statement about them. Nothing downstream fills that in.
 *
 * A licence carrying TWO distinct usable domains yields null as well. Two
 * candidates is a choice between them, and array order is not a decision —
 * the rule tradeDetect.js's `contested` branch and trades.js's
 * `primaryCategoryForInstantTrade()` both hold. Measured: zero licences in the
 * published extract are in this state today, so the branch costs nothing and
 * exists so that the day one appears it is not resolved by accident.
 *
 * @param licence  a grouped licence (see licence.js)
 * @param counts   Map<domain, licenceCount> from countEmailDomains, over the
 *                 WHOLE register
 * @returns {{ domain: string, email: string, basis: string }|null}
 */
export function deriveCandidateSite(licence, counts) {
  if (!licence || !(counts instanceof Map)) return null;

  const usable = [];
  for (const email of parseRbqEmails(licence.email)) {
    const domain = normaliseDomain(email);
    if (!domain) continue;
    // Belt one: shared by more than one licence, so it is somebody's mailbox
    // provider or somebody's dealer network, not this business's site.
    if ((counts.get(domain) ?? 0) !== 1) continue;
    // Belt two: the typo case the arithmetic cannot see. See the header.
    if (isFreeMailDomain(domain)) continue;
    if (!usable.some((u) => u.domain === domain)) usable.push({ domain, email });
  }

  if (usable.length !== 1) return null;
  return { domain: usable[0].domain, email: usable[0].email, basis: DERIVED_SITE_BASIS };
}

/**
 * The sentence a rep reads on the prospect screen.
 *
 * It names the address, because "we think this is their website" with no
 * provenance is exactly the unfalsifiable claim ProspectInference exists to
 * prevent — a human has to be able to disagree with it in one glance.
 */
export function derivedSiteEvidence({ domain, email } = {}) {
  if (!domain) return null;
  return (
    `Website not published by the RBQ. ${domain} was derived from the licence email ` +
    `${email || "on this record"} — the register lists that address against this licence and no other, ` +
    `so the domain is this business's rather than a mailbox provider's. It is a guess until the site itself agrees.`
  );
}
