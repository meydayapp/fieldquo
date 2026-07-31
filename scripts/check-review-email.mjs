// Throwaway. Renders the review email against the brand colours contractors actually pick.
import { buildReviewEmail, reviewCopy } from "@/lib/reviews/reviewEmail.js";

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
ok("unknown language falls back to en", buildReviewEmail({ company: co, client: {}, language: "de" }).html.includes("Leave a review"));
ok("both languages have every key", Object.keys(reviewCopy("en")).every((k) => k in reviewCopy("fr")));

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

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
