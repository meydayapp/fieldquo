// Throwaway. Renders the review email against the brand colours contractors actually pick.
//
// The survey rating row calls getAppOrigin() with no `request` (see
// lib/appUrl.js) — same as scripts/check-consent-mechanisms.mjs's own
// unsubscribeUrl() calls — so it needs NEXT_PUBLIC_APP_URL set before any
// import touches it. Production always has this set; this script does not
// run inside a request, so it has to set it itself.
process.env.NEXT_PUBLIC_APP_URL = "https://app.fieldquo.test";

import { buildReviewEmail, reviewCopy } from "@/lib/reviews/reviewEmail.js";
import { surveyCopy, parseScore, cleanComment, MAX_COMMENT } from "@/lib/reviews/satisfaction.js";
// The offered set, never a literal list: the two assertions below used to
// spell out ["fr","es","uk","pa","tl","de","it"] and ["en","fr"], and the
// survey copy sat two languages behind LANGUAGES with this file green. A
// hand-written list of codes is a check that stops covering the language it
// was not told about.
import { LANGUAGE_CODES } from "@/app/i18n/languages.js";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${got}` : ""}`); } };

// WCAG relative luminance + contrast ratio, independent of the app's own maths
// on purpose — if theme.js and this agree, the number is real.
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const HOSTILE = {
  "school-bus yellow": "#FFDD00",
  "pure white": "#FFFFFF",
  "pure black": "#000000",
  "mid grey": "#808080",
  "safety orange": "#FF6600",
  "lime": "#CCFF00",
  "navy": "#001F3F",
  "the default-ish blue": "#2563EB",
  "pale mint": "#D9F2E6",
  "hot pink": "#FF1493",
};

console.log("\nButton contrast across hostile brand colours (need >= 4.5:1)");
for (const [name, hex] of Object.entries(HOSTILE)) {
  const out = buildReviewEmail({ company: { name: "Acme Painting", brandColor: hex, reviewUrl: "https://g.page/r/x/review" }, client: { name: "Sam" } });
  if (!out) { ok(`${name} — built`, false); continue; }
  const m = out.html.match(/background:(#[0-9a-fA-F]{6});color:(#[0-9a-fA-F]{6})/);
  if (!m) { ok(`${name} — button colours found`, false); continue; }
  const r = ratio(m[1], m[2]);
  ok(`${name.padEnd(20)} ${m[1]} on ${m[2]} = ${r.toFixed(2)}:1`, r >= 4.5, r.toFixed(2));
}

const co = { name: "Acme Painting", brandColor: "#2563EB", reviewUrl: "https://g.page/r/x/review" };

console.log("\nIt refuses to build without a destination");
ok("no reviewUrl -> null", buildReviewEmail({ company: { name: "Acme" }, client: {} }) === null);
ok("javascript: url -> null", buildReviewEmail({ company: { ...co, reviewUrl: "javascript:alert(1)" }, client: {} }) === null);
ok("valid url -> builds", buildReviewEmail({ company: co, client: {} }) !== null);

console.log("\nEscaping");
const xss = buildReviewEmail({
  company: { ...co, name: '<script>alert("x")</script>' },
  client: { name: '"><img src=x onerror=alert(1)>' },
});
ok("company name escaped", !xss.html.includes("<script>"));
// The name lands in TEXT content, so escaping `<` is what matters — the
// literal string "onerror=..." sitting there as visible text is inert.
ok("client name can't open a tag", !xss.html.includes("<img"));
ok("subject carries the raw name (header, not HTML)", xss.subject.includes("<script>"));

console.log("\nLanguage");
const en = buildReviewEmail({ company: co, client: { name: "Sam" }, language: "en" });
const fr = buildReviewEmail({ company: co, client: { name: "Sam" }, language: "fr" });
ok("en asks in English", en.html.includes("Leave a review"));
ok("fr asks in French", fr.html.includes("Laisser un avis"));
ok("fr subject is French", fr.subject.startsWith("Comment"));
// "de" used to be the unknown language here; it is one of the eight now.
ok("unknown language falls back to en", buildReviewEmail({ company: co, client: {}, language: "xx" }).html.includes("Leave a review"));
ok("every document language has every key", LANGUAGE_CODES.filter((l) => l !== "en").every((l) => Object.keys(reviewCopy("en")).every((k) => k in reviewCopy(l))));

console.log("\nWhite-label");
for (const lang of ["en", "fr"]) {
  const h = buildReviewEmail({ company: co, client: { name: "Sam" }, language: lang }).html;
  ok(`${lang}: says nothing about FieldQuo`, !/fieldquo/i.test(h));
  ok(`${lang}: names the contractor`, h.includes("Acme Painting"));
  ok(`${lang}: offers a reply instead of a public complaint`, /reply|répond/i.test(h));
}

console.log("\nMissing data doesn't produce placeholder text");
const bare = buildReviewEmail({ company: { name: "Acme", reviewUrl: "https://x.com/r" }, client: {} });
ok("no client name -> plain greeting, no 'undefined'", !bare.html.includes("undefined"));
ok("no logo -> falls back to the name, not a broken image", !bare.html.includes("<img") && bare.html.includes("Acme"));

// ══ Satisfaction survey rating row ══════════════════════════════════════════
//
// AGENTS.md's "no second mailing system" put the survey's five tap-a-number
// links inside THIS email rather than a new one — see reviewEmail.js's own
// header. Everything below re-runs the exact hostile-brand-colour and
// escaping checks above, but against the rating row specifically, because a
// pairing that clears 4.5:1 on the "Leave a review" button proves nothing
// about a DIFFERENT pairing (neutralPair, not fillPair) rendered a few lines
// below it.
console.log("\nSurvey rating row — optional, and absent by default");
ok("no surveyToken -> no rating row at all", !bare.html.includes("/survey/"));
const withSurvey = buildReviewEmail({ company: co, client: { name: "Sam" }, surveyToken: "abc123" });
ok("surveyToken present -> five score links, 1 through 5", [1, 2, 3, 4, 5].every((n) => withSurvey.html.includes(`/survey/abc123?score=${n}`)));
ok("no sixth link (0 or 6) leaks in", !withSurvey.html.includes("score=0") && !withSurvey.html.includes("score=6"));

console.log("\nRating chip contrast across hostile brand colours (need >= 4.5:1) — a DIFFERENT pair than the button above (neutralPair, not fillPair)");
for (const [name, hex] of Object.entries(HOSTILE)) {
  const out = buildReviewEmail({
    company: { name: "Acme Painting", brandColor: hex, reviewUrl: "https://g.page/r/x/review" },
    client: { name: "Sam" },
    surveyToken: "abc123",
  });
  // Two background:/color: pairs now exist in the HTML (the button, then the
  // five identical chips) — the chip is the SECOND occurrence.
  const pairs = [...out.html.matchAll(/background:(#[0-9a-fA-F]{6});color:(#[0-9a-fA-F]{6})/g)];
  if (pairs.length < 2) { ok(`${name} — chip colours found`, false); continue; }
  const [, chipBg, chipFg] = pairs[1];
  const r = ratio(chipBg, chipFg);
  ok(`${name.padEnd(20)} chip ${chipBg} on ${chipFg} = ${r.toFixed(2)}:1`, r >= 4.5, r.toFixed(2));
}

console.log("\nSurvey rating row — language and escaping");
// Every offered language, not just en/fr. Two things are being asserted at
// once and both failed before: that the survey table HAS a block for the
// language (surveyCopy's per-language English fallback would otherwise hand
// back the English prompt and this would pass on it), and that the email
// actually reaches for it — a prompt that exists but is never rendered is the
// other half of the same bug.
for (const lang of LANGUAGE_CODES) {
  const h = buildReviewEmail({ company: co, client: { name: "Sam" }, language: lang, surveyToken: "abc123" }).html;
  const prompt = surveyCopy(lang).prompt;
  ok(`${lang}: prompt renders in that language`, h.includes(prompt), prompt);
  if (lang !== "en") {
    ok(`${lang}: the prompt is not the English one falling through`, prompt !== surveyCopy("en").prompt, prompt);
  }
}
const surveyXss = buildReviewEmail({
  company: { ...co, name: '<script>alert("x")</script>' },
  client: { name: '"><img src=x onerror=alert(1)>' },
  surveyToken: "abc123",
});
ok("rating row present alongside an XSS attempt, and the name is still escaped",
  surveyXss.html.includes("/survey/abc123") && !surveyXss.html.includes("<script>"));
// safeUrl() on the survey link itself — same gate the review-request link
// gets, since a token is server-minted and therefore trusted, but a caller
// who somehow passes a hostile token must not get an executable href either.
const hostileToken = buildReviewEmail({ company: co, client: {}, surveyToken: 'abc" onmouseover="alert(1)' });
ok("a token containing quote/attribute-breaking characters never opens a new attribute",
  !hostileToken.html.includes('onmouseover="alert'));

// ══ satisfaction.js's own pure functions, against hostile input ═════════════
//
// Nothing executed these before, and two of the assertions below were FAILING
// the moment they were written — surveyCopy("constructor") handed back the
// Object constructor (truthy, so the English fallback never ran) and the
// survey page rendered an undefined question; parseScore([3]) returned 3
// because String([3]) is "3", which its own doc comment says it must not.
// Both were fixed in satisfaction.js; these are what hold the fixes.
console.log("\nSurvey copy and score parsing — hostile input");
ok("a prototype key is not a language",
  ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"].every((k) => surveyCopy(k) === surveyCopy("en")));
ok("so is nothing else that isn't a code", [null, undefined, "", "xx", "EN", "en-CA", 0, true, [], ["en"], {}, () => "en"].every((v) => surveyCopy(v) === surveyCopy("en")));
ok("every block has every English key, and none of them is blank",
  Object.keys(surveyCopy("en")).every((k) => typeof surveyCopy("en")[k] === "string" && surveyCopy("en")[k].trim()));
ok("parseScore takes 1–5 and nothing else", [[1, 1], [5, 5], ["3", 3], ["  4  ", 4], ["+2", 2]].every(([i, o]) => parseScore(i) === o));
ok("parseScore refuses a container, however numeric it stringifies to",
  [[3], [[3]], { valueOf: () => 3 }, { toString: () => "3" }, true, new Date(3)].every((v) => parseScore(v) === null));
ok("parseScore refuses out of range, hex, exponent and fractions", [0, 6, -1, "3.5", "0x3", "1e1", NaN, Infinity, "abc", "", null, undefined].every((v) => parseScore(v) === null));
ok("cleanComment is null or a non-empty string, never ''",
  [null, undefined, 3, {}, [], true, "", "   "].every((v) => cleanComment(v) === null) && cleanComment(" hi ") === "hi");
ok("cleanComment caps the length and keeps the writer's own line breaks",
  cleanComment("x".repeat(MAX_COMMENT + 500)).length === MAX_COMMENT && cleanComment(" a\n\nb ") === "a\n\nb");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
