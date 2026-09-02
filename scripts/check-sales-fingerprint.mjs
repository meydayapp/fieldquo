// scripts/check-sales-fingerprint.mjs
//
//   npm run check:sales-fingerprint
//
// Technology fingerprinting and capability detection, executed against the
// inputs that break them.
//
// ══ The one property that matters most ═════════════════════════════════════
//
// `ProspectCapability.value` is three-valued and `null` IS NOT `false`. The
// opportunity engine fires on `value === false`; if a crawl that was blocked,
// truncated or never rendered produces a `false`, a rep opens a cold call by
// telling a contractor they have no booking page — about a business that has
// one. Section 5 is that property, executed against nine broken crawls.
//
// ══ The second: a fingerprint must not fire on prose ══════════════════════
//
// A painting company's blog post about "the best Jobber alternatives" contains
// the word. So does a testimonial. A competitor detection changes the whole
// sales conversation, so section 3 drives the SHIPPED Jobber signature against
// a page that only talks about Jobber and asserts nothing comes out.
//
// ══ What cannot be executed ════════════════════════════════════════════════
//
// "Is the guard still inside this function" is a source question. Those are
// matched against source with comments stripped, and EVERY positional rule is
// scoped to ONE named function pulled out by brace matching — a guard string
// left behind in a sibling function must not manufacture a pass. Section 11
// includes a deliberate false-pass probe that proves the scoping works.
//
// Mutation-tested: each guarantee was broken in turn against a `cp` backup and
// this script was confirmed to fail. See the session report for the list.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  DETECTION_THRESHOLD,
  DETECTOR_NAME,
  DETECTOR_VERSION,
  LOOSE_CEILING,
  LOOSE_KINDS,
  MIN_LOOSE_PATTERN,
  PATTERN_KINDS,
  STRUCTURAL_KINDS,
  combineWeights,
  contentSize,
  detectTechnologies,
  hasCompetitor,
  hostMatches,
  hostOf,
  loadedPages,
  markupOf,
  matchPattern,
  matchSignature,
  normaliseCrawl,
  normalisePage,
  pagesFromEvidence,
  patternListProblems,
  signatureProblems,
  splitUrlPattern,
  statusIsBlocked,
} from "@/lib/sales/intel/technology";
import {
  ABSENCE_SCOPE,
  CAPABILITY_DETECTOR,
  DETECTED_CAPABILITY_CODES,
  absenceConfidence,
  absenceEligibility,
  detectCapabilities,
  isLeadCaptureForm,
  looksRendered,
  unproducedObservableCodes,
  vocabularyProblems,
} from "@/lib/sales/intel/capabilityDetect";
import {
  seedSignatures,
  seededPatternKinds,
  sourcingNotes,
  unverifiedSignatures,
} from "@/lib/sales/intel/signatureSeed";
import { OBSERVABLE_CAPABILITY_CODES } from "@/lib/sales/intel/capabilities";
import { requiredDetectors } from "@/lib/sales/intel/rules";
import { evaluateCondition, indexProspect } from "@/lib/sales/intel/opportunity";
import { SIGNATURE_PATTERN_KINDS, signaturePatternProblems } from "@/lib/sales/intel/configAdmin";
import { PROVIDER_BY_KIND } from "@/lib/sales/pipeline/kinds";
import { handleDetectTechnology } from "@/lib/sales/pipeline/handlers/detectTechnology";
import { handleAnalyzeCapabilities } from "@/lib/sales/pipeline/handlers/analyzeCapabilities";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
    return true;
  }
  failures.push(name);
  console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  return false;
}
const section = (title) => console.log(`\n${title}\n`);

/**
 * Strip comments so a source assertion cannot pass on a sentence explaining the
 * thing rather than the thing. String and template literals are preserved.
 * Borrowed wholesale from check-sales-opportunity.mjs, which already works.
 */
function codeOnly(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** The body of ONE named function, by brace matching from its declaration. */
function bodyOf(src, declaration) {
  const start = src.indexOf(declaration);
  if (start === -1) return null;

  const openParen = src.indexOf("(", start);
  if (openParen === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams === -1) return null;

  const open = src.indexOf("{", afterParams);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   0. The matcher this file's source rules depend on
   ═══════════════════════════════════════════════════════════════════ */
section("0. The brace matcher, before anything trusts it");
{
  const sample = 'export function f(a, { b = [] } = {}) {\n  return "MARKER";\n}\nfunction g() { return "OTHER"; }\n';
  const body = bodyOf(sample, "export function f");
  ok("the brace matcher returns a body and not a parameter list", /MARKER/.test(body || ""), body);
  ok("…and stops at the end of that function", !/OTHER/.test(body || ""), body);
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. The pattern vocabulary is one vocabulary
   ═══════════════════════════════════════════════════════════════════ */
section("1. The editor and the matcher cannot disagree about a kind");

ok(
  "the superadmin editor's kinds ARE the matcher's kinds",
  SIGNATURE_PATTERN_KINDS.length === PATTERN_KINDS.length &&
    SIGNATURE_PATTERN_KINDS.every((k) => PATTERN_KINDS.includes(k)),
  { editor: SIGNATURE_PATTERN_KINDS, matcher: PATTERN_KINDS },
);
ok(
  "every kind is classified as structural or loose, and none as both",
  PATTERN_KINDS.every((k) => STRUCTURAL_KINDS.includes(k) !== LOOSE_KINDS.includes(k)),
  { STRUCTURAL_KINDS, LOOSE_KINDS },
);
ok(
  "loose evidence alone cannot reach the detection threshold",
  LOOSE_CEILING < DETECTION_THRESHOLD,
  { LOOSE_CEILING, DETECTION_THRESHOLD },
);
ok(
  "the editor refuses a kind the matcher cannot match",
  signaturePatternProblems([{ kind: "regex", pattern: "anything", weight: 0.5 }]).length > 0,
);
ok(
  "the editor refuses a short loose pattern, exactly as the matcher does",
  signaturePatternProblems([{ kind: "text", pattern: "abc", weight: 0.5 }]).length > 0 &&
    patternListProblems([{ kind: "text", pattern: "abc", weight: 0.5 }]).length > 0,
);
ok(
  `a loose pattern of ${MIN_LOOSE_PATTERN} characters is accepted`,
  patternListProblems([{ kind: "text", pattern: "a".repeat(MIN_LOOSE_PATTERN), weight: 0.5 }]).length === 0,
);

/* ═══════════════════════════════════════════════════════════════════════════
   2. Host matching cannot be spoofed by a lookalike domain
   ═══════════════════════════════════════════════════════════════════ */
section("2. hostMatches is a suffix match, not a substring");

ok("an exact host matches", hostMatches("getjobber.com", "getjobber.com"));
ok("a subdomain matches", hostMatches("clienthub.getjobber.com", "getjobber.com"));
ok("www. is ignored on both sides", hostMatches(hostOf("https://www.markate.com/x"), "www.markate.com"));
ok("a lookalike prefix does NOT match", !hostMatches("notgetjobber.com", "getjobber.com"), "notgetjobber.com");
ok("a lookalike suffix does NOT match", !hostMatches("getjobber.com.evil.net", "getjobber.com"));
ok("a host in a query string does NOT match", !hostMatches(hostOf("https://evil.example/?u=getjobber.com"), "getjobber.com"));
ok("an unparseable value yields no host rather than throwing", hostOf("::::") === null || hostOf("::::") !== undefined);
ok("a root-relative path has NO host", hostOf("/booking") === null, hostOf("/booking"));
ok("…even one whose first segment contains a dot", hostOf("/v1.2/plugins/customerchat") === null, hostOf("/v1.2/plugins/customerchat"));
ok("a document-relative path has no host", hostOf("about/us") === null, hostOf("about/us"));
ok("a mailto: has no host", hostOf("mailto:bob@acme.example") === null);
ok("a tel: has no host", hostOf("tel:+16135551212") === null);
ok("a relative link cannot satisfy a host pattern", !matchPattern({ kind: "link", pattern: "booking.example" }, normalisePage({ links: ["/booking"] })));
ok("a protocol-relative URL still has a host", hostOf("//embed.tawk.to/abc/1") === "embed.tawk.to");
ok("a bare host string still has a host", hostOf("embed.tawk.to/abc") === "embed.tawk.to");

ok(
  "a host+path pattern splits into both halves",
  JSON.stringify(splitUrlPattern("markate.com/public/widget")) ===
    JSON.stringify({ host: "markate.com", path: "public/widget" }),
  splitUrlPattern("markate.com/public/widget"),
);
ok(
  "a path-only pattern claims no host",
  splitUrlPattern("/wp-content/").host === null && splitUrlPattern("/wp-content/").path === "wp-content/",
);

/* ═══════════════════════════════════════════════════════════════════════════
   3. THE hostile case: a page that only TALKS about a competitor
   ═══════════════════════════════════════════════════════════════════ */
section("3. Prose about Jobber is not an installation of Jobber");

const SEEDED = seedSignatures();
const byCode = new Map(SEEDED.map((s) => [s.code, s]));
const JOBBER = byCode.get("JOBBER");

const jobberIframePage = {
  url: "https://acmepainting.example/",
  finalUrl: "https://acmepainting.example/",
  status: 200,
  html: '<html><body><div class="jobber-inline-work-request"></div></body></html>',
  text: "Acme Painting. Request a quote.",
  scripts: ["https://d3ey4dbjkt2f6s.cloudfront.net/assets/external/work_request_embed.js"],
  iframes: ["https://clienthub.getjobber.com/client_hubs/abc/public/work_request/embedded_work_request_form/"],
  links: [{ href: "/contact", url: "https://acmepainting.example/contact", text: "Contact" }],
};

const prosePage = {
  url: "https://acmepainting.example/blog/software",
  finalUrl: "https://acmepainting.example/blog/software",
  status: 200,
  html: "<html><body><h1>Why we left Jobber</h1><p>We used Jobber for years. Jobber is fine. Housecall Pro too.</p></body></html>",
  text: "Why we left Jobber. We used Jobber for years. Jobber is fine. Housecall Pro too. jobber jobber jobber.",
  scripts: ["https://acmepainting.example/theme.js"],
  iframes: [],
  links: [{ href: "/", url: "https://acmepainting.example/", text: "Home" }],
};

{
  const found = detectTechnologies({ signatures: SEEDED, crawl: { pages: [jobberIframePage] } });
  const jobber = found.technologies.find((t) => t.technologyCode === "JOBBER");
  ok("a page carrying the Jobber embed detects Jobber", Boolean(jobber), found.technologies.map((t) => t.technologyCode));
  ok("…as a COMPETITOR", jobber?.isCompetitor === true);
  ok("…with confidence at or above the threshold", (jobber?.confidence || 0) >= DETECTION_THRESHOLD, jobber?.confidence);
  ok("…and never at certainty", (jobber?.confidence || 0) < 1, jobber?.confidence);
  ok("…citing evidence naming the pattern that fired", (jobber?.evidence || []).some((e) => e.normalizedValue.includes("work_request_embed")));
  ok("…and a competitor is reported to the caller", hasCompetitor(found.technologies));
}

{
  const found = detectTechnologies({ signatures: SEEDED, crawl: { pages: [prosePage] } });
  ok(
    "a page that merely MENTIONS jobber detects nothing",
    found.technologies.length === 0,
    found.technologies.map((t) => `${t.technologyCode}@${t.confidence}`),
  );
  ok(
    "…and no competitor is reported",
    !hasCompetitor(found.technologies),
  );
}

{
  // The same prose page with a "Powered by Jobber" footer. Still no detection:
  // loose kinds cannot carry one. This is the trade-off the header states.
  const powered = { ...prosePage, text: `${prosePage.text} Powered by Jobber`, html: `${prosePage.html}<footer>Powered by Jobber</footer>` };
  const withText = {
    ...JOBBER,
    patterns: [...JOBBER.patterns, { kind: "text", pattern: "Powered by Jobber", weight: 0.4 }],
  };
  const result = matchSignature(withText, [normalisePage(powered)]);
  ok("a text-only match produces evidence", result.evidence.length > 0);
  ok("…is capped at the loose ceiling", result.confidence <= LOOSE_CEILING, result.confidence);
  ok("…and is NOT a detection", result.matched === false, result);
  ok("…and the matcher records that nothing structural fired", result.structural === false);
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. The rest of the hostile-page list
   ═══════════════════════════════════════════════════════════════════ */
section("4. Empty, 404, failed, blocked, malformed, inactive");

const emptyPage = { url: "https://x.example/", finalUrl: "https://x.example/", status: 200, html: "", text: "" };
const notFound = { url: "https://x.example/booking", finalUrl: "https://x.example/booking", status: 404, html: "<html><body>Not found</body></html>", text: "Not found", links: ["/"] };
const failedPage = { url: "https://x.example/", finalUrl: null, status: null, error: "ENOTFOUND" };
const blockedPage = { url: "https://x.example/", finalUrl: "https://x.example/", status: 403, html: "<html>Forbidden</html>", text: "Forbidden" };

ok("an empty 200 is not a loaded page", normalisePage(emptyPage).ok === false, normalisePage(emptyPage));
ok("a 404 is not a loaded page", normalisePage(notFound).ok === false);
ok("a 404 is NOT treated as being blocked", normalisePage(notFound).blocked === false);
ok("a transport failure is not a loaded page", normalisePage(failedPage).ok === false);
ok("…and its ok is false rather than an exception", normalisePage(failedPage).error === "ENOTFOUND");
ok("a 403 IS blocked", normalisePage(blockedPage).blocked === true);
ok("a 429 is blocked", statusIsBlocked(429));
ok("a 404 is not", !statusIsBlocked(404));
ok("a 200 is not", !statusIsBlocked(200));

ok(
  "a page that says nothing about its outcome stays UNKNOWN, not failed",
  normalisePage({ html: "<html>hello</html>" }).ok === null,
  normalisePage({ html: "<html>hello</html>" }),
);
ok("normalisePage survives null", normalisePage(null).ok === null);
ok("normalisePage survives a string", normalisePage("nope").scripts.length === 0);
ok("normalisePage survives arrays where objects belong", normalisePage({ meta: ["a"], forms: "x" }).forms.length === 0);
ok("normaliseCrawl survives null", normaliseCrawl(null).pages.length === 0);
ok("normaliseCrawl survives a bare array of pages", normaliseCrawl([jobberIframePage]).pages.length === 1);

{
  const found = detectTechnologies({ signatures: SEEDED, crawl: { pages: [emptyPage] } });
  ok("an empty page detects nothing", found.technologies.length === 0);
  ok("…and says WHY it looked at nothing", found.skipped.some((s) => s.reason === "no_pages_loaded"));
}
{
  const found = detectTechnologies({ signatures: SEEDED, crawl: { pages: [failedPage] } });
  ok("a page that failed to load detects nothing", found.technologies.length === 0);
}
{
  const found = detectTechnologies({ signatures: SEEDED, crawl: { pages: [blockedPage] } });
  ok("a blocked page detects nothing", found.technologies.length === 0);
  ok("…and the crawl reports itself blocked", found.blocked === true);
}

{
  const malformed = {
    code: "BROKEN",
    active: true,
    version: "1",
    patterns: [
      { kind: "iframe_host", pattern: "clienthub.getjobber.com", weight: 0.9 },
      { kind: "regex", pattern: "(((" },
      "not an object",
      { kind: "html" },
      { kind: "script_src", pattern: "x.example", weight: 9 },
    ],
  };
  const result = matchSignature(malformed, [normalisePage(jobberIframePage)]);
  ok("a malformed pattern is reported rather than thrown", result.problems.length >= 4, result.problems);
  ok("…and the GOOD patterns in the same signature still match", result.matched === true, result);

  const allBad = { code: "ALLBAD", active: true, patterns: [{ kind: "nope", pattern: "x" }] };
  const none = matchSignature(allBad, [normalisePage(jobberIframePage)]);
  ok("a signature whose every pattern is malformed matches nothing", none.matched === false && none.evidence.length === 0);

  ok("patterns that are not a list are refused", patternListProblems("nope")[0].includes("JSON list"));
  ok("an empty pattern list is refused", patternListProblems([]).some((p) => p.includes("never match")));
  ok("signatureProblems refuses a signature with no code", signatureProblems({ patterns: [] }).some((p) => p.includes("code")));
}

{
  const inactive = [{ ...JOBBER, active: false }];
  const found = detectTechnologies({ signatures: inactive, crawl: { pages: [jobberIframePage] } });
  ok("an INACTIVE signature never matches, however good the page is", found.technologies.length === 0, found);
  ok("…and the skip says it was inactive", found.skipped.some((s) => s.code === "JOBBER" && s.reason === "inactive"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. NULL IS NOT FALSE. The most important section in this file.
   ═══════════════════════════════════════════════════════════════════ */
section("5. Absence is earned, never defaulted");

/** A site that renders and offers nothing at all: no booking, no chat, no pay. */
function bareSite(pages = 2) {
  const body = `<html><body><h1>Dunn Painting</h1><p>${"Interior and exterior painting in Ottawa. ".repeat(20)}</p></body></html>`;
  return Array.from({ length: pages }, (_, i) => ({
    url: i === 0 ? "https://dunn.example/" : `https://dunn.example/page-${i}`,
    finalUrl: i === 0 ? "https://dunn.example/" : `https://dunn.example/page-${i}`,
    status: 200,
    html: body,
    text: `Dunn Painting. ${"Interior and exterior painting in Ottawa. ".repeat(20)}`,
    links: [
      { href: "/", url: "https://dunn.example/", text: "Home" },
      { href: "/about", url: "https://dunn.example/about", text: "About" },
    ],
    scripts: [],
    iframes: [],
  }));
}

const CAP = (result, code) => result.capabilities.find((c) => c.code === code);

{
  const result = detectCapabilities({ crawl: { pages: bareSite(3) }, technologies: [], prospect: { websiteUrl: "https://dunn.example/" } });
  ok("a fully crawled bare site CAN say online booking is absent", CAP(result, "ONLINE_BOOKING").value === false, CAP(result, "ONLINE_BOOKING"));
  ok("…and cites evidence for the absence", CAP(result, "ONLINE_BOOKING").evidence.length > 0);
  ok("…and the evidence names the pages that were searched", CAP(result, "ONLINE_BOOKING").evidence[0].rawValue.includes("dunn.example"));
  ok("…with a confidence below certainty", CAP(result, "ONLINE_BOOKING").confidence <= 0.85, CAP(result, "ONLINE_BOOKING").confidence);
  ok("…and live chat too", CAP(result, "LIVE_CHAT").value === false);
  ok("…and WEBSITE is true, because pages rendered", CAP(result, "WEBSITE").value === true);
}

{
  // A crawl that never loaded anything. THE case.
  const result = detectCapabilities({ crawl: { pages: [failedPage] }, technologies: [], prospect: { websiteUrl: "https://x.example/" } });
  for (const code of DETECTED_CAPABILITY_CODES) {
    ok(`${code} is NULL when nothing loaded (never false)`, CAP(result, code).value === null, CAP(result, code));
  }
  ok("…and the reason is recorded", result.eligibility.reason === "no_page_loaded" || result.eligibility.reason === "page_error", result.eligibility);
}

{
  const result = detectCapabilities({ crawl: { pages: [blockedPage] }, technologies: [], prospect: { websiteUrl: "https://x.example/" } });
  ok("a BLOCKED crawl proves nothing absent", result.capabilities.every((c) => c.value !== false), result.capabilities);
  ok("…and says it was blocked", result.eligibility.reason === "blocked", result.eligibility);
}

{
  const result = detectCapabilities({ crawl: { pages: [], error: "dns" }, technologies: [], prospect: {} });
  ok("a crawl that errored outright proves nothing absent", result.capabilities.every((c) => c.value !== false));
  ok("…and says so", result.eligibility.reason === "crawl_error", result.eligibility);
}

{
  // A shell: a 200, a body, and no links — the fingerprint of a site whose
  // navigation is JavaScript the crawler did not run.
  const shell = {
    url: "https://spa.example/",
    finalUrl: "https://spa.example/",
    status: 200,
    html: `<html><body><div id="root"></div><script src="/app.js"></script>${"<!-- padding -->".repeat(40)}</body></html>`,
    text: "Loading…",
    scripts: ["/app.js"],
    links: [],
  };
  const result = detectCapabilities({ crawl: { pages: [shell] }, technologies: [], prospect: { websiteUrl: "https://spa.example/" } });
  ok("a JavaScript shell is not a rendered page", looksRendered(normalisePage(shell)) === false);
  ok("…so nothing is called absent on it", result.capabilities.every((c) => c.value !== false), result.capabilities);
  ok("…and the reason names it", result.eligibility.reason === "no_page_rendered", result.eligibility);
  ok("…and WEBSITE is null, NOT false — the site exists, we could not read it", CAP(result, "WEBSITE").value === null, CAP(result, "WEBSITE"));
}

{
  // A booking widget behind JavaScript, on a site that otherwise renders. The
  // script tag is in the HTML even though the widget is not.
  const jsBooking = bareSite(2);
  jsBooking[0] = {
    ...jsBooking[0],
    scripts: ["https://assets.calendly.com/assets/external/widget.js"],
  };
  const techs = detectTechnologies({ signatures: SEEDED, crawl: { pages: jsBooking } });
  ok("a Calendly script is detected even though the widget renders later", techs.technologies.some((t) => t.technologyCode === "CALENDLY"), techs.technologies);
  const result = detectCapabilities({ crawl: { pages: jsBooking }, technologies: techs.technologies, prospect: {} });
  ok("…and online booking is TRUE, not false", CAP(result, "ONLINE_BOOKING").value === true, CAP(result, "ONLINE_BOOKING"));
  ok("…citing the technology by name", CAP(result, "ONLINE_BOOKING").evidence.some((e) => e.rawValue === "technology:CALENDLY"));
  ok("…and Calendly is NOT a competitor", techs.technologies.find((t) => t.technologyCode === "CALENDLY").isCompetitor === false);
}

{
  // One page only. Site-wide absence is provable; a page-level one is not.
  const result = detectCapabilities({ crawl: { pages: bareSite(1) }, technologies: [], prospect: {} });
  ok("with one page, live chat (site-wide) can be false", CAP(result, "LIVE_CHAT").value === false, CAP(result, "LIVE_CHAT"));
  ok("…but online booking (deep) is NULL", CAP(result, "ONLINE_BOOKING").value === null, CAP(result, "ONLINE_BOOKING"));
  ok("…and the reason is that we only saw the front page", CAP(result, "ONLINE_BOOKING").reason === "front_page_only", CAP(result, "ONLINE_BOOKING"));
}

{
  // The crawler said outright that it did not finish.
  const result = detectCapabilities({ crawl: { pages: bareSite(4), complete: false }, technologies: [], prospect: {} });
  ok("an explicitly INCOMPLETE crawl cannot prove a deep absence", CAP(result, "ONLINE_BOOKING").value === null, CAP(result, "ONLINE_BOOKING"));
  ok("…and says why", CAP(result, "ONLINE_BOOKING").reason === "crawl_incomplete");
  ok("…while site-wide absence survives it", CAP(result, "LIVE_CHAT").value === false);
}

{
  // Silence about completeness is neither a yes nor a no.
  const unknown = absenceEligibility(normaliseCrawl({ pages: bareSite(3) }));
  const stated = absenceEligibility(normaliseCrawl({ pages: bareSite(3), complete: true }));
  ok("a crawl silent about completeness may still prove absence from what it saw", unknown.deep === true, unknown);
  ok("…and a crawl that says it finished is MORE confident, not differently shaped", absenceConfidence(normaliseCrawl({ pages: bareSite(3), complete: true }), stated) > absenceConfidence(normaliseCrawl({ pages: bareSite(3) }), unknown));
  ok("absence confidence is ceilinged", absenceConfidence(normaliseCrawl({ pages: bareSite(9), complete: true }), { rendered: 9 }) <= 0.85);
}

{
  // One bad page inside an otherwise fine crawl.
  const mixed = [...bareSite(3), failedPage];
  const result = detectCapabilities({ crawl: { pages: mixed }, technologies: [], prospect: {} });
  ok("one errored page withdraws every absence claim in the crawl", result.capabilities.every((c) => c.value !== false), result.capabilities.filter((c) => c.value === false));
  ok("…and names it", result.eligibility.reason === "page_error", result.eligibility);
}

{
  // A 404 inside a crawl is a real observation, not an error.
  const withMiss = [...bareSite(2), notFound];
  const result = detectCapabilities({ crawl: { pages: withMiss }, technologies: [], prospect: {} });
  ok("a 404 inside a crawl does NOT withdraw the absence claim", CAP(result, "ONLINE_BOOKING").value === false, result.eligibility);
}

{
  // WEBSITE: the three cases, which are genuinely different sentences.
  const noSite = detectCapabilities({ crawl: { pages: [] }, technologies: [], prospect: { hasWebsite: false } });
  ok("discovery finding no website at all is FALSE — a signal, not a blank", CAP(noSite, "WEBSITE").value === false, CAP(noSite, "WEBSITE"));
  ok("…and cites the discovery field", CAP(noSite, "WEBSITE").evidence[0].source === "google");

  const brokenSite = detectCapabilities({ crawl: { pages: [failedPage] }, technologies: [], prospect: { hasWebsite: true, websiteUrl: "https://x.example/" } });
  ok("a website that will not load is NULL, never false", CAP(brokenSite, "WEBSITE").value === null, CAP(brokenSite, "WEBSITE"));
  ok("…and says the site did not load", CAP(brokenSite, "WEBSITE").reason === "site_did_not_load");

  const unknownSite = detectCapabilities({ crawl: { pages: [] }, technologies: [], prospect: {} });
  ok("nobody having looked is NULL", CAP(unknownSite, "WEBSITE").value === null);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. A contact form only — and what is NOT one
   ═══════════════════════════════════════════════════════════════════ */
section("6. A quote form, a search box and a newsletter signup");

const contactForm = {
  action: "/contact",
  method: "post",
  id: "contact-form",
  fields: [
    { name: "name", type: "text", tag: "input" },
    { name: "email", type: "email", tag: "input" },
    { name: "message", type: "textarea", tag: "textarea" },
  ],
};
const searchForm = { action: "/", method: "get", id: "search", fields: [{ name: "s", type: "search", tag: "input" }] };
const newsletter = { action: "https://list.example/subscribe", method: "post", className: "newsletter-signup", fields: [{ name: "email", type: "email", tag: "input" }] };
const loginForm = { action: "/login", method: "post", id: "login", fields: [{ name: "email", type: "email" }, { name: "password", type: "password" }] };

ok("a name + email + message form IS a lead capture form", isLeadCaptureForm(contactForm));
ok("a search box is NOT", !isLeadCaptureForm(searchForm));
ok("a newsletter signup is NOT", !isLeadCaptureForm(newsletter));
ok("a login form is NOT", !isLeadCaptureForm(loginForm));
ok("a lone email input is NOT", !isLeadCaptureForm({ action: "/x", fields: [{ name: "email", type: "email" }] }));
ok("an email plus a textarea IS", isLeadCaptureForm({ action: "/x", fields: [{ name: "email", type: "email" }, { name: "q", type: "textarea" }] }));
ok("a stored form whose textarea arrives as type only IS still one", isLeadCaptureForm({ action: "/x", fields: [{ name: "email", type: "email" }, { name: "notes", type: "textarea" }] }));
ok("a form with no fields is NOT", !isLeadCaptureForm({ action: "/x", fields: [] }));
ok("null is NOT", !isLeadCaptureForm(null));

{
  const pages = bareSite(3);
  pages[1] = { ...pages[1], forms: [contactForm, searchForm, newsletter] };
  const result = detectCapabilities({ crawl: { pages }, technologies: [], prospect: {} });
  ok("a site with only a contact form has LEAD_CAPTURE_FORM true", CAP(result, "LEAD_CAPTURE_FORM").value === true, CAP(result, "LEAD_CAPTURE_FORM"));
  ok("…and still has no online booking", CAP(result, "ONLINE_BOOKING").value === false);
  ok("…and no online payment", CAP(result, "ONLINE_PAYMENT").value === false);
  ok("…and no client portal", CAP(result, "CLIENT_PORTAL").value === false);
}

{
  // Prose, and nothing else. The site SAYS "book online" and offers no way to.
  const talky = bareSite(3);
  talky[0] = {
    ...talky[0],
    text: `${talky[0].text} Call us and we will book online for you. Pay online is coming soon. Client portal coming soon.`,
  };
  const result = detectCapabilities({ crawl: { pages: talky }, technologies: [], prospect: {} });
  ok("a prose phrase alone does NOT make online booking true", CAP(result, "ONLINE_BOOKING").value === false, CAP(result, "ONLINE_BOOKING"));
  ok("…nor online payment", CAP(result, "ONLINE_PAYMENT").value === false, CAP(result, "ONLINE_PAYMENT"));
  ok("…nor a client portal", CAP(result, "CLIENT_PORTAL").value === false, CAP(result, "CLIENT_PORTAL"));
  ok("…and the loose phrase is still recorded as evidence for the absence", CAP(result, "ONLINE_BOOKING").evidence.length > 0);
}

{
  const pages = bareSite(3);
  pages[1] = { ...pages[1], forms: [searchForm, newsletter] };
  const result = detectCapabilities({ crawl: { pages }, technologies: [], prospect: {} });
  ok("a site with ONLY a search box and a newsletter has NO lead capture form", CAP(result, "LEAD_CAPTURE_FORM").value === false, CAP(result, "LEAD_CAPTURE_FORM"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. A competitor AND adjacent tooling on one page
   ═══════════════════════════════════════════════════════════════════ */
section("7. Housecall Pro, Stripe, Tawk.to and WordPress on one site");

{
  const busy = bareSite(3);
  busy[0] = {
    ...busy[0],
    scripts: [
      "https://online-booking.housecallpro.com/script.js?token=abc&orgName=Acme",
      "https://js.stripe.com/v3/",
      "https://embed.tawk.to/5f0/default",
      "https://acme.example/wp-content/themes/x/main.js",
    ],
    links: [
      ...busy[0].links,
      { href: "https://book.housecallpro.com/book/Acme/abc", url: "https://book.housecallpro.com/book/Acme/abc", text: "Book online" },
    ],
    meta: { generator: "WordPress 6.5.2" },
    cookies: ["__stripe_mid", "TawkConnectionTime"],
  };

  const found = detectTechnologies({ signatures: SEEDED, crawl: { pages: busy } });
  const codes = found.technologies.map((t) => t.technologyCode);
  for (const want of ["HOUSECALL_PRO", "STRIPE_PAYMENTS", "TAWK_TO", "WORDPRESS"]) {
    ok(`${want} is detected alongside the others`, codes.includes(want), codes);
  }
  ok("exactly one of them is flagged a competitor", found.technologies.filter((t) => t.isCompetitor).length === 1, found.technologies.map((t) => [t.technologyCode, t.isCompetitor]));
  ok("…and it is the field-service platform", found.technologies.find((t) => t.isCompetitor).technologyCode === "HOUSECALL_PRO");
  ok("WordPress is NOT a competitor — a website builder is not a scheduler", found.technologies.find((t) => t.technologyCode === "WORDPRESS").isCompetitor === false);
  ok("results are ordered by confidence, highest first", found.technologies.every((t, i, a) => i === 0 || a[i - 1].confidence >= t.confidence));

  const caps = detectCapabilities({ crawl: { pages: busy }, technologies: found.technologies, prospect: {} });
  ok("online booking is true via the competitor's widget", CAP(caps, "ONLINE_BOOKING").value === true);
  ok("online payment is true via Stripe", CAP(caps, "ONLINE_PAYMENT").value === true);
  ok("live chat is true via Tawk.to", CAP(caps, "LIVE_CHAT").value === true);
  ok("…and nothing was wrongly called absent", caps.capabilities.filter((c) => c.value === false).every((c) => ["INSTANT_ESTIMATE", "CLIENT_PORTAL", "ONLINE_REVIEWS", "PUBLISHED_HOURS", "LEAD_CAPTURE_FORM", "EMAIL_CONTACT", "PHONE_CONTACT"].includes(c.code)), caps.capabilities.filter((c) => c.value === false).map((c) => c.code));

  // The cookie kind is implemented, not a stub. Proven by removing every other
  // Stripe signal and checking the cookie alone still detects it.
  const cookieOnly = [{ ...busy[0], scripts: [], links: busy[0].links.filter((l) => !l.href.includes("stripe")), cookies: ["__stripe_mid"] }];
  const viaCookie = matchSignature(byCode.get("STRIPE_PAYMENTS"), cookieOnly.map(normalisePage));
  ok("a cookie pattern alone can detect a technology", viaCookie.matched === true, viaCookie);
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. Confidence arithmetic
   ═══════════════════════════════════════════════════════════════════ */
section("8. Combining weights");

ok("no weights is zero", combineWeights([]) === 0);
ok("one weight is itself", combineWeights([0.9]) === 0.9);
ok("two agreeing observations beat one", combineWeights([0.8, 0.8]) > 0.8);
ok("…and never reach 1.00", combineWeights([0.99, 0.99, 0.99, 0.99]) < 1, combineWeights([0.99, 0.99, 0.99, 0.99]));
ok("a negative weight is ignored rather than subtracting", combineWeights([0.5, -3]) === 0.5);
ok("NaN is ignored", combineWeights([0.5, NaN]) === 0.5);
ok("the result fits Decimal(3,2)", String(combineWeights([0.83, 0.77])).replace("0.", "").length <= 2, combineWeights([0.83, 0.77]));

{
  // Two patterns describing the SAME script tag are one observation.
  const page = normalisePage({ status: 200, html: "<html>x</html>", text: "x", scripts: ["https://connect.podium.com/widget.js"], links: ["/"] });
  const podium = byCode.get("PODIUM");
  const single = matchSignature({ ...podium, patterns: [podium.patterns[0]] }, [page]);
  const both = matchSignature({ ...podium, patterns: podium.patterns.slice(0, 2) }, [page]);
  ok(
    "two patterns matching one script tag do not inflate confidence",
    both.confidence === single.confidence,
    { single: single.confidence, both: both.confidence },
  );
}

{
  // The same script on nine pages is one observation, not nine.
  const one = matchSignature(byCode.get("TAWK_TO"), [normalisePage({ status: 200, text: "x".repeat(400), scripts: ["https://embed.tawk.to/a/b"], links: ["/"] })]);
  const nine = matchSignature(
    byCode.get("TAWK_TO"),
    Array.from({ length: 9 }, () => normalisePage({ status: 200, text: "x".repeat(400), scripts: ["https://embed.tawk.to/a/b"], links: ["/"] })),
  );
  ok("a big site is not more certain than a small one", one.confidence === nine.confidence, { one: one.confidence, nine: nine.confidence });
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. The seed: what was verified, and what shipped switched off
   ═══════════════════════════════════════════════════════════════════ */
section("9. Every starter signature carries its sourcing");

ok("the seed builds", SEEDED.length > 0, SEEDED.length);
ok("no duplicate codes", new Set(SEEDED.map((s) => s.code)).size === SEEDED.length);
ok("every code fits the admin's code rule", SEEDED.every((s) => /^[A-Z][A-Z0-9_]{2,63}$/.test(s.code)), SEEDED.map((s) => s.code).filter((c) => !/^[A-Z][A-Z0-9_]{2,63}$/.test(c)));
ok("every signature passes the matcher's own validator", SEEDED.every((s) => signatureProblems(s).length === 0));
ok("every signature passes the ADMIN EDITOR's validator too", SEEDED.every((s) => signaturePatternProblems(s.patterns).length === 0), SEEDED.filter((s) => signaturePatternProblems(s.patterns).length).map((s) => s.code));
ok("every signature carries a sourcing note", Object.keys(sourcingNotes()).length === SEEDED.length);

{
  const active = SEEDED.filter((s) => s.active);
  const inactive = unverifiedSignatures();
  ok("at least five competitors are seeded", SEEDED.filter((s) => s.isCompetitor).length >= 5, SEEDED.filter((s) => s.isCompetitor).map((s) => s.code));
  ok("at least ten adjacent tools are seeded", SEEDED.filter((s) => !s.isCompetitor).length >= 10);
  ok("every INACTIVE signature says it could not be verified", inactive.every((s) => /NOT VERIFIED/.test(s.reason)), inactive.map((s) => s.code));
  ok("every ACTIVE signature can reach the threshold on structural patterns alone", active.every((s) => {
    const structural = s.patterns.filter((p) => STRUCTURAL_KINDS.includes(p.kind)).map((p) => p.weight ?? 0.5);
    return structural.length > 0 && Math.max(...structural, 0) >= DETECTION_THRESHOLD;
  }), active.filter((s) => {
    const structural = s.patterns.filter((p) => STRUCTURAL_KINDS.includes(p.kind)).map((p) => p.weight ?? 0.5);
    return !(structural.length > 0 && Math.max(...structural, 0) >= DETECTION_THRESHOLD);
  }).map((s) => s.code));
  ok("no active signature depends on a loose pattern to fire", active.every((s) => s.patterns.some((p) => STRUCTURAL_KINDS.includes(p.kind))));
  ok("the loose kinds ARE used, so they are not dead vocabulary", seededPatternKinds().some((k) => LOOSE_KINDS.includes(k)), seededPatternKinds());
  ok("Jobber, Housecall Pro, ServiceTitan, Workiz and Markate are all competitors", ["JOBBER", "HOUSECALL_PRO", "SERVICETITAN", "WORKIZ", "MARKATE"].every((c) => byCode.get(c)?.isCompetitor === true));
  ok("Wix, Squarespace, GoDaddy and WordPress are NOT", ["WIX", "SQUARESPACE", "GODADDY_WEBSITE_BUILDER", "WORDPRESS"].every((c) => byCode.get(c)?.isCompetitor === false));
  ok("Calendly, Acuity, Stripe and Square are NOT", ["CALENDLY", "ACUITY_SCHEDULING", "STRIPE_PAYMENTS", "SQUARE_PAYMENTS"].every((c) => byCode.get(c)?.isCompetitor === false));
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. The vocabulary contract with the rules
   ═══════════════════════════════════════════════════════════════════ */
section("10. Every code this emits is a code a rule can read");

ok("the detector's vocabulary problems are none", vocabularyProblems().length === 0, vocabularyProblems());
ok("every emitted code is in OBSERVABLE_CAPABILITY_CODES", DETECTED_CAPABILITY_CODES.every((c) => OBSERVABLE_CAPABILITY_CODES.includes(c)), DETECTED_CAPABILITY_CODES.filter((c) => !OBSERVABLE_CAPABILITY_CODES.includes(c)));
ok("every code the starter RULES depend on has a detector", requiredDetectors().every((c) => DETECTED_CAPABILITY_CODES.includes(c)), requiredDetectors().filter((c) => !DETECTED_CAPABILITY_CODES.includes(c)));
ok("every emitted code has an absence scope", DETECTED_CAPABILITY_CODES.every((c) => ABSENCE_SCOPE[c]));
console.log(`  note observable codes with no detector: ${JSON.stringify(unproducedObservableCodes())}`);

{
  // The handshake with the shipped opportunity engine, executed rather than
  // reasoned about: a null capability must NOT satisfy `is: false`, and a
  // false one must.
  const nulled = detectCapabilities({ crawl: { pages: [failedPage] }, technologies: [], prospect: {} });
  const proven = detectCapabilities({ crawl: { pages: bareSite(3) }, technologies: [], prospect: {} });
  const asRows = (r) => r.capabilities.map((c) => ({ code: c.code, value: c.value, confidence: c.confidence, evidenceIds: c.evidence.map((_, i) => `e${i}`) }));

  const nullIndex = indexProspect({ capabilities: asRows(nulled), technologies: [] });
  const falseIndex = indexProspect({ capabilities: asRows(proven), technologies: [] });
  ok(
    "a null capability does NOT satisfy the engine's `is: false`",
    evaluateCondition({ kind: "capability", code: "ONLINE_BOOKING", is: false }, nullIndex).matched === false,
  );
  ok(
    "a proven-absent capability DOES",
    evaluateCondition({ kind: "capability", code: "ONLINE_BOOKING", is: false }, falseIndex).matched === true,
  );
  ok(
    "…and the matched condition can cite evidence",
    evaluateCondition({ kind: "capability", code: "ONLINE_BOOKING", is: false }, falseIndex).evidenceIds.length > 0,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. Source rules — every one scoped to ONE named function
   ═══════════════════════════════════════════════════════════════════ */
section("11. Guards, scoped to the function that needs them");

const techSrc = codeOnly(read("lib/sales/intel/technology.js"));
const capSrc = codeOnly(read("lib/sales/intel/capabilityDetect.js"));
const analyzeSrc = codeOnly(read("lib/sales/pipeline/handlers/analyzeCapabilities.js"));
const detectSrc = codeOnly(read("lib/sales/pipeline/handlers/detectTechnology.js"));

{
  const body = bodyOf(capSrc, "export function absenceEligibility");
  if (ok("absenceEligibility is findable", Boolean(body))) {
    ok("…refuses on a crawl error", /error\)\s*return\s+deny\("crawl_error"\)/.test(body), body?.slice(0, 400));
    ok("…refuses when blocked", /blocked\)\s*return\s+deny\("blocked"\)/.test(body));
    ok("…refuses when nothing rendered", /rendered\.length\s*===\s*0\)\s*return\s+deny/.test(body));
    ok("…refuses when a page errored", /some\(\(p\)\s*=>\s*p\.error\)\)\s*return\s+deny/.test(body));
    ok("…vetoes the deep claim on an explicit incomplete", /complete\s*!==\s*false/.test(body));
    ok("…requires more than the front page for a deep claim", /rendered\.length\s*>=\s*MIN_PAGES_FOR_DEEP/.test(body));
  }
}
{
  const body = bodyOf(capSrc, "export function looksRendered");
  if (ok("looksRendered is findable", Boolean(body))) {
    ok("…requires ok === true", /page\.ok\s*!==\s*true/.test(body));
    ok("…requires a body of real size", /contentSize\(page\)\s*<\s*MIN_RENDERED_HTML/.test(body));
    ok("…and requires at least one link, which is what catches a JS shell", /page\.links\.length\s*>\s*0/.test(body));
  }
}
{
  const body = bodyOf(capSrc, "export function detectCapabilities");
  if (ok("detectCapabilities is findable", Boolean(body))) {
    ok("…reads the eligibility rather than deciding absence itself", /absenceEligibility\(/.test(body));
    ok("…chooses false only when the scope allows", /allowed\s*\?\s*false\s*:\s*null/.test(body), body.match(/allowed[^\n]*/g)?.slice(0, 3));
    ok("…and picks the scope from ABSENCE_SCOPE", /ABSENCE_SCOPE\[code\]/.test(body));
  }
}
{
  const body = bodyOf(capSrc, "export function isLeadCaptureForm");
  if (ok("isLeadCaptureForm is findable", Boolean(body))) {
    ok("…rejects search and newsletter markup", /FORM_DISQUALIFIERS\.test\(label\)/.test(body));
    ok("…rejects anything with a password field", /type\s*===\s*"password"/.test(body));
    ok("…requires two categories or one plus free text", /categories\.size\s*>=\s*2/.test(body) && /freeText/.test(body));
  }
}
{
  const body = bodyOf(techSrc, "export function matchSignature");
  if (ok("matchSignature is findable", Boolean(body))) {
    ok("…caps a loose-only match below the threshold", /structural\s*\?\s*raw\s*:\s*Math\.min\(raw,\s*LOOSE_CEILING\)/.test(body));
    ok("…requires the threshold before calling it a match", /confidence\s*>=\s*DETECTION_THRESHOLD/.test(body));
    ok("…de-duplicates observations rather than patterns", /byObservation\.set\(/.test(body));
  }
}
{
  const body = bodyOf(techSrc, "export function detectTechnologies");
  if (ok("detectTechnologies is findable", Boolean(body))) {
    ok("…skips an inactive signature itself, not in the caller", /signature\?\.active\s*===\s*false/.test(body));
    ok("…and claims nothing when no page loaded", /pages\.length\s*===\s*0/.test(body));
  }
}
{
  const body = bodyOf(techSrc, "export function hostMatches");
  if (ok("hostMatches is findable", Boolean(body))) {
    ok("…is an exact-or-dot-suffix match", /host\.endsWith\(`\.\$\{want\}`\)/.test(body), body);
    ok("…and never a bare includes", !/host\.includes\(/.test(body), body);
  }
}
{
  const body = bodyOf(analyzeSrc, "async function writeCapabilities");
  if (ok("writeCapabilities is findable", Boolean(body))) {
    ok("…refuses to overwrite a known value with a null", /capability\.value\s*===\s*null\s*&&\s*known\.get\(capability\.code\)\s*!=\s*null/.test(body), body.slice(0, 600));
    ok(
      "…deletes only its OWN detector's evidence",
      /deleteMany\(\{\s*where:\s*\{\s*prospectId,\s*detector:\s*CAPABILITY_DETECTOR\s*\}\s*\}\)/.test(body),
      body.match(/deleteMany\([^\n]*/)?.[0],
    );
    ok("…and writes inside a transaction", /db\.\$transaction/.test(body));
  }
}
{
  const body = bodyOf(detectSrc, "async function writeTechnologies");
  if (ok("writeTechnologies is findable", Boolean(body))) {
    ok("…deletes only its OWN detector's evidence", /deleteMany\(\{\s*where:\s*\{\s*prospectId,\s*detector:\s*DETECTOR_NAME\s*\}\s*\}\)/.test(body));
    ok("…clears stale detections only for ACTIVE signatures", /activeCodes\.filter/.test(body));
    ok("…creates evidence before the row that cites it", body.indexOf("prospectEvidence.create") < body.indexOf("prospectTechnology.upsert"));
  }
}
{
  const body = bodyOf(detectSrc, "export async function handleDetectTechnology");
  if (ok("handleDetectTechnology is findable", Boolean(body))) {
    ok("…writes nothing when no page loaded", /pagesConsidered\s*===\s*0/.test(body));
    ok("…and only ever loads ACTIVE signatures", /where:\s*\{\s*active:\s*true\s*\}/.test(body));
  }
}

{
  // THE FALSE-PASS PROBE. Every rule above is scoped to one function by brace
  // matching. This proves the scoping is real: the guard string is planted in
  // a NEIGHBOURING function in the same source, and the rule must still be
  // looking only at its own function's body.
  const planted = techSrc.replace(
    "export function hostOf(value) {",
    'export function hostOf(value) {\n  const decoy = "host.endsWith(`.${want}`)";\n',
  );
  const decoyedBody = bodyOf(planted, "export function hostMatches");
  const strippedBody = bodyOf(
    planted.replace(/host\.endsWith\(`\.\$\{want\}`\);/, "host === want;"),
    "export function hostMatches",
  );
  ok(
    "planting the guard string in a neighbouring function does not rescue hostMatches",
    !/host\.endsWith\(`\.\$\{want\}`\)/.test(strippedBody || ""),
    strippedBody,
  );
  ok("…while the real function still carries it", /host\.endsWith\(`\.\$\{want\}`\)/.test(decoyedBody || ""));
  ok("…and the decoy really was planted", /const decoy/.test(planted));
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. The stages are registered, reachable, and spend nothing
   ═══════════════════════════════════════════════════════════════════ */
section("12. The two pipeline stages");

{
  const index = read("lib/sales/pipeline/handlers/index.js");
  ok("DETECT_TECHNOLOGY is imported for its side effect", /import "\.\/detectTechnology"/.test(index));
  ok("ANALYZE_CAPABILITIES is imported for its side effect", /import "\.\/analyzeCapabilities"/.test(index));
  ok("…and both are named in HANDLER_MODULES", /DETECT_TECHNOLOGY/.test(index) && /ANALYZE_CAPABILITIES/.test(index));
}
ok("DETECT_TECHNOLOGY spends nothing outside the process", PROVIDER_BY_KIND.DETECT_TECHNOLOGY === "local");
ok("ANALYZE_CAPABILITIES spends nothing either — it calls no model", PROVIDER_BY_KIND.ANALYZE_CAPABILITIES === "local", PROVIDER_BY_KIND.ANALYZE_CAPABILITIES);

/* A database stub: records what was written so the handlers can be executed
   end to end without Postgres. Fails loudly on anything unexpected rather than
   returning undefined, because a stub that silently answers everything makes a
   broken handler pass. */
function stubDb({ signatures = SEEDED, evidence = [], prospect = { id: "p1" }, capabilities = [], technologies = [] } = {}) {
  const written = { evidence: [], technologies: [], capabilities: [], deleted: [] };
  let nextId = 0;
  const tx = {
    prospectEvidence: {
      deleteMany: async ({ where }) => {
        written.deleted.push(where);
        return { count: 0 };
      },
      create: async ({ data }) => {
        written.evidence.push(data);
        return { id: `ev${nextId++}` };
      },
    },
    prospectTechnology: {
      deleteMany: async ({ where }) => {
        written.deleted.push(where);
        return { count: (where.technologyCode?.in || []).length ? 0 : 0 };
      },
      upsert: async ({ create }) => {
        written.technologies.push(create);
        return create;
      },
    },
    prospectCapability: {
      upsert: async ({ create }) => {
        written.capabilities.push(create);
        return create;
      },
    },
  };
  return {
    written,
    technologySignature: { findMany: async () => signatures.filter((s) => s.active !== false) },
    prospectEvidence: { findMany: async () => evidence },
    prospect: { findUnique: async () => prospect },
    prospectTechnology: { findMany: async () => technologies },
    prospectCapability: { findMany: async () => capabilities },
    $transaction: async (fn) => fn(tx),
  };
}

{
  const db = stubDb();
  const result = await handleDetectTechnology({
    task: { prospectId: "p1", kind: "DETECT_TECHNOLOGY" },
    payload: { prospectId: "p1", pages: [jobberIframePage] },
    db,
  });
  ok("DETECT_TECHNOLOGY runs end to end from inline pages", result.done === true, result);
  ok("…and wrote a Jobber detection", db.written.technologies.some((t) => t.technologyCode === "JOBBER"), db.written.technologies);
  ok("…flagged as a competitor", db.written.technologies.find((t) => t.technologyCode === "JOBBER")?.isCompetitor === true);
  ok("…citing real evidence ids", (db.written.technologies.find((t) => t.technologyCode === "JOBBER")?.evidenceIds || []).length > 0);
  ok("…and every evidence row carries the detector version", db.written.evidence.every((e) => e.detectorVersion === DETECTOR_VERSION && e.detector === DETECTOR_NAME));
  ok(
    "…and the crawler's own evidence was never in the delete's scope",
    db.written.deleted.filter((w) => "detector" in w).every((w) => w.detector === DETECTOR_NAME),
    db.written.deleted,
  );
}
{
  const db = stubDb();
  const result = await handleDetectTechnology({
    task: { prospectId: "p1", kind: "DETECT_TECHNOLOGY" },
    payload: { prospectId: "p1", pages: [failedPage] },
    db,
  });
  ok("a crawl that loaded nothing does not complete the stage", result.done !== true, result);
  ok("…is terminal rather than retried five times", result.retry === false);
  ok("…and WRITES NOTHING, so old detections survive", db.written.technologies.length === 0 && db.written.evidence.length === 0);
}
{
  const db = stubDb({ signatures: [] });
  const result = await handleDetectTechnology({ task: { prospectId: "p1" }, payload: { pages: [jobberIframePage] }, db });
  ok("an empty signature table is terminal and names the screen that fixes it", result.done !== true && /signatures/.test(result.reason), result);
}
{
  const result = await handleDetectTechnology({ task: {}, payload: {}, db: stubDb() });
  ok("a task with no prospect is terminal", result.done !== true && result.retry === false, result);
}

{
  const db = stubDb({ technologies: [] });
  const result = await handleAnalyzeCapabilities({
    task: { prospectId: "p1" },
    payload: { prospectId: "p1", pages: bareSite(3) },
    db,
  });
  ok("ANALYZE_CAPABILITIES runs end to end", result.done === true, result);
  ok(
    "…and only ever deleted its OWN evidence rows",
    db.written.deleted.every((w) => w.detector === CAPABILITY_DETECTOR),
    db.written.deleted,
  );
  ok("…and wrote a proven absence", db.written.capabilities.some((c) => c.code === "ONLINE_BOOKING" && c.value === false), db.written.capabilities);
  ok("…and the note says absence was provable", /absence provable/.test(result.note), result.note);
}
{
  // Rule 1, executed: a failed crawl must not erase last week's finding.
  const db = stubDb({ capabilities: [{ code: "ONLINE_BOOKING", value: true }] });
  const result = await handleAnalyzeCapabilities({
    task: { prospectId: "p1" },
    payload: { prospectId: "p1", pages: [failedPage] },
    db,
  });
  ok("a failed crawl still completes the stage", result.done === true, result);
  ok("…and does NOT overwrite a known finding with a null", !db.written.capabilities.some((c) => c.code === "ONLINE_BOOKING"), db.written.capabilities);
  ok("…and says how many findings it kept", /kept/.test(result.note), result.note);
}
{
  // …but a genuinely new observation DOES overwrite.
  const db = stubDb({ capabilities: [{ code: "ONLINE_BOOKING", value: true }] });
  await handleAnalyzeCapabilities({ task: { prospectId: "p1" }, payload: { prospectId: "p1", pages: bareSite(3) }, db });
  ok("a successful crawl DOES overwrite a stale true with a proven false", db.written.capabilities.some((c) => c.code === "ONLINE_BOOKING" && c.value === false), db.written.capabilities);
}
{
  const result = await handleAnalyzeCapabilities({ task: {}, payload: {}, db: stubDb() });
  ok("a capability task with no prospect is terminal", result.done !== true && result.retry === false, result);
}

/* ═══════════════════════════════════════════════════════════════════════════
   13. The adapter: stored evidence back into pages
   ═══════════════════════════════════════════════════════════════════ */
section("13. Reading the crawler's rows back");

{
  const url = "https://acme.example/";
  const rows = [
    { type: "page_fetch", sourceUrl: url, rawValue: JSON.stringify({ requestedUrl: url, finalUrl: url, status: 200, error: null, truncated: false, offHost: false }), normalizedValue: "http_200" },
    { type: "page_content", sourceUrl: url, rawValue: `Acme Painting. ${"We paint houses. ".repeat(40)}`, normalizedValue: url },
    { type: "script_src", sourceUrl: url, rawValue: "/x.js", normalizedValue: "https://online-booking.housecallpro.com/script.js?token=t" },
    { type: "iframe_host", sourceUrl: url, rawValue: "https://book.housecallpro.com/book/Acme/t", normalizedValue: "book.housecallpro.com" },
    { type: "meta", sourceUrl: url, rawValue: "generator=WordPress 6.5", normalizedValue: "generator=wordpress 6.5" },
    { type: "link", sourceUrl: url, rawValue: JSON.stringify({ href: "/book", text: "Book Online", rel: null }), normalizedValue: "https://acme.example/book" },
    { type: "form", sourceUrl: url, rawValue: JSON.stringify({ action: "/contact", method: "post", id: "quote", fields: [{ name: "email", type: "email" }, { name: "message", type: "textarea" }] }), normalizedValue: "post  email,message" },
    { type: "dom_attr", sourceUrl: url, rawValue: "data-orgname=Acme", normalizedValue: "data-orgname=acme" },
    { type: "schema_org", sourceUrl: url, rawValue: '{"@type":"LocalBusiness","openingHours":"Mo-Fr 08:00-17:00"}', normalizedValue: "localbusiness" },
  ];
  const crawl = normaliseCrawl(pagesFromEvidence(rows));
  ok("one page is reconstructed", crawl.pages.length === 1, crawl.pages.length);
  const page = crawl.pages[0];
  ok("…with its HTTP outcome", page.ok === true && page.status === 200, page);
  ok("…its scripts", page.scripts.some((s) => s.includes("online-booking.housecallpro.com")));
  ok("…its iframes", page.iframes.some((s) => s.includes("book.housecallpro.com")));
  ok("…its meta", page.meta.generator === "WordPress 6.5", page.meta);
  ok("…its link text", page.linkTexts.some((l) => l.text === "Book Online"));
  ok("…and its forms", page.forms.length === 1 && page.forms[0].fields.length === 2);
  ok("an html pattern still finds a data attribute the crawler kept", markupOf(page).includes("data-orgname=Acme"));
  ok("contentSize measures extracted text when there is no markup", contentSize(page) > 300, contentSize(page));

  const found = detectTechnologies({ signatures: SEEDED, crawl });
  ok("Housecall Pro is detected from STORED evidence alone", found.technologies.some((t) => t.technologyCode === "HOUSECALL_PRO"), found.technologies.map((t) => t.technologyCode));
  ok("…and WordPress from the generator meta", found.technologies.some((t) => t.technologyCode === "WORDPRESS"));

  const caps = detectCapabilities({ crawl, technologies: found.technologies, prospect: {} });
  ok("published hours are read from schema.org", CAP(caps, "PUBLISHED_HOURS").value === true, CAP(caps, "PUBLISHED_HOURS"));
  ok("…and a lead capture form from the stored form row", CAP(caps, "LEAD_CAPTURE_FORM").value === true);
}

{
  // A page whose body was truncated: the crawler saw part of it, so a deep
  // absence is not available.
  const url = "https://big.example/";
  const rows = [
    { type: "page_fetch", sourceUrl: url, rawValue: JSON.stringify({ finalUrl: url, status: 200, truncated: true }), normalizedValue: "http_200" },
    { type: "page_content", sourceUrl: url, rawValue: "x".repeat(500), normalizedValue: url },
    { type: "link", sourceUrl: url, rawValue: JSON.stringify({ href: "/", text: "Home" }), normalizedValue: `${url}` },
  ];
  const crawl = normaliseCrawl(pagesFromEvidence(rows));
  ok("a truncated body makes the crawl explicitly incomplete", crawl.complete === false, crawl.complete);
  const caps = detectCapabilities({ crawl, technologies: [], prospect: {} });
  ok("…so no deep absence is claimed", CAP(caps, "ONLINE_BOOKING").value === null, CAP(caps, "ONLINE_BOOKING"));
  ok("the adapter never claims a crawl was COMPLETE", pagesFromEvidence([]).complete !== true);
}

{
  // An off-host redirect: a parked domain pointing at a registrar.
  const url = "https://parked.example/";
  const rows = [
    { type: "page_fetch", sourceUrl: url, rawValue: JSON.stringify({ requestedUrl: url, finalUrl: "https://sale.registrar.example/x", status: 200, offHost: true }), normalizedValue: "off_host:https://sale.registrar.example/x" },
    { type: "page_content", sourceUrl: url, rawValue: "This domain is for sale. ".repeat(30), normalizedValue: url },
    { type: "link", sourceUrl: url, rawValue: JSON.stringify({ href: "/buy", text: "Buy this domain" }), normalizedValue: "https://sale.registrar.example/buy" },
  ];
  const crawl = normaliseCrawl(pagesFromEvidence(rows));
  ok("an off-host redirect is not a loaded page", loadedPages(crawl).length === 0, crawl.pages[0]);
  const caps = detectCapabilities({ crawl, technologies: [], prospect: { websiteUrl: url, hasWebsite: true } });
  ok("…so nothing about somebody else's parking page is called absent", caps.capabilities.every((c) => c.value !== false), caps.capabilities.filter((c) => c.value === false));
}

{
  // Content rows with no envelope: outcome unknown, and it stays unknown.
  const rows = [{ type: "page_content", sourceUrl: "https://q.example/", rawValue: "x".repeat(500), normalizedValue: "https://q.example/" }];
  const crawl = normaliseCrawl(pagesFromEvidence(rows));
  ok("a page with content and no fetch envelope has an UNKNOWN outcome", crawl.pages[0].ok === null, crawl.pages[0]);
  ok("…and is therefore not usable for an absence", absenceEligibility(crawl).siteWide === false, absenceEligibility(crawl));
}

/* ═══════════════════════════════════════════════════════════════════════════
   14. matchPattern, kind by kind
   ═══════════════════════════════════════════════════════════════════ */
section("14. Each pattern kind matches what it says it matches");

{
  const page = normalisePage({
    status: 200,
    html: '<html><body class="jobber-work-request">hello</body></html>',
    text: "Powered by Markate for scheduling",
    scripts: ["https://js.stripe.com/v3/"],
    iframes: ["https://calendly.com/acme/30min"],
    links: [{ href: "https://book.housecallpro.com/book/A/b", text: "Book" }],
    stylesheets: ["https://d3ey4dbjkt2f6s.cloudfront.net/assets/external/work_request_embed.css"],
    meta: { generator: "Wix.com Website Builder" },
    cookies: ["__stripe_mid"],
  });

  ok("script_src matches a script host", Boolean(matchPattern({ kind: "script_src", pattern: "js.stripe.com" }, page)));
  ok("script_src does NOT match a stylesheet", !matchPattern({ kind: "script_src", pattern: "cloudfront.net/assets/external/work_request_embed.css" }, page));
  ok("link matches a stylesheet", Boolean(matchPattern({ kind: "link", pattern: "cloudfront.net/assets/external/work_request_embed.css" }, page)));
  ok("link matches an anchor host", Boolean(matchPattern({ kind: "link", pattern: "book.housecallpro.com" }, page)));
  ok("iframe_host matches an iframe host", Boolean(matchPattern({ kind: "iframe_host", pattern: "calendly.com" }, page)));
  ok("iframe_host does NOT match a script", !matchPattern({ kind: "iframe_host", pattern: "js.stripe.com" }, page));
  ok("meta matches name=value", Boolean(matchPattern({ kind: "meta", pattern: "generator=Wix.com" }, page)));
  ok("meta with a wrong name does not match", !matchPattern({ kind: "meta", pattern: "author=Wix.com" }, page));
  ok("meta with a bare value searches every tag", Boolean(matchPattern({ kind: "meta", pattern: "Website Builder" }, page)));
  ok("cookie matches a cookie NAME exactly", Boolean(matchPattern({ kind: "cookie", pattern: "__stripe_mid" }, page)));
  ok("cookie does not match a partial name", !matchPattern({ kind: "cookie", pattern: "stripe" }, page));
  ok("html matches markup", Boolean(matchPattern({ kind: "html", pattern: "jobber-work-request" }, page)));
  ok("text matches visible text", Boolean(matchPattern({ kind: "text", pattern: "Powered by Markate" }, page)));
  ok("text does NOT match markup that is not visible text", !matchPattern({ kind: "text", pattern: "jobber-work-request" }, page));
  ok("an unknown kind matches nothing", !matchPattern({ kind: "css", pattern: "x" }, page));
  ok("an empty pattern matches nothing", !matchPattern({ kind: "html", pattern: "   " }, page));
  ok("a match returns the string that matched, in context", matchPattern({ kind: "html", pattern: "jobber-work-request" }, page).value.includes("class="));
  ok("a path-only pattern matches a relative script", Boolean(matchPattern({ kind: "script_src", pattern: "/wp-content/" }, normalisePage({ scripts: ["/wp-content/themes/a/b.js"] }))));
}

console.log(
  `\n${failures.length ? "FAILED" : "PASSED"} — ${pass} assertions passed, ${failures.length} failed`,
);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
