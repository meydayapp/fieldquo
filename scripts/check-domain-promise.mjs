// scripts/check-domain-promise.mjs
//
//   npm run check:domain-promise
//
// No shipped copy promises a contractor a custom domain, because FieldQuo does
// not have them.
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// Two seed sales playbooks told a closer to say it out loud — "we build the
// site out of the jobs you've already done, on your own domain" and "Your
// logo, your colour, your name in the from line, your domain" — and a rep now
// reads those on screen mid-call. The same sentence was on a public feature
// page in nine languages, and lib/sales/intel/capabilities.js said it twice
// more, in a description and in a talking point the opportunity engine hands
// to a rep. Four surfaces, one false claim, reaching a call from two
// directions at once.
//
// It is false: there is no customDomain field, siteUrl() only ever builds
// <subdomain>.fieldquo.com, middleware.js resolves tenants through
// subdomainFromHost alone, and docs/ROADMAP.md says "no custom domains —
// deliberately out of scope, subdomains only".
//
// It is the worst possible paragraph to be wrong in. That copy IS the
// white-label pitch, and the URL a homeowner sees says fieldquo.com — so the
// contractor discovers it the first time they look at their own site.
//
// ══ The two claims read alike and only one is false ════════════════════════
//
// The EMAIL sending domain is real: Company.emailDomain, senderFor() in
// lib/email/resend.js, a settings screen with DNS records. "Verify your domain
// once and everything goes out from you" is TRUE and must not be swept up.
//
// So this is a sweep with a small exemption list, and each exemption names the
// shipped mechanism it rests on. The exemptions are asserted to still match
// real copy, so deleting or rewording one fails here rather than silently
// widening what is allowed.
//
// ══ It fails in BOTH directions ════════════════════════════════════════════
//
// If a customDomain field ever appears, this check fails too — and says to come
// back and re-allow the sentence. A rule that only catches the copy would go on
// forbidding a true claim for years after it became true. Same shape as
// CATALOGUE_ONLY in check-language-completeness: a claim held against a fact,
// where either side moving is a finding.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, undefined) : failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);

// ── 1. The fact this whole file rests on ───────────────────────────────────
const schema = read("prisma/schema.prisma");
const hasCustomDomain = /\bcustomDomain\b/.test(schema);
ok(
  "custom domains still do not exist, so the ban below is still right",
  !hasCustomDomain,
  "prisma/schema.prisma now has a customDomain field. If custom domains SHIPPED, " +
    "the sentences this file forbids became true — delete the ban and put the " +
    "copy back. If the field landed without the feature, that is the finding.",
);

// ── 2. Where a promise could be made ───────────────────────────────────────
//
// Copy a contractor or a prospect can read: the sales playbooks a rep reads
// mid-call, the capability talking points the opportunity engine hands them,
// the public feature pages and every translation of them.
const SURFACES = [
  "lib/sales/playbook/defaults.js",
  "lib/sales/intel/capabilities.js",
  "app/data/featurePages.js",
  "app/data/helpArticles.js",
  ...readdirSync(join(ROOT, "app/i18n/featurePages"))
    .filter((f) => f.endsWith(".js") && f !== "index.js")
    .map((f) => `app/i18n/featurePages/${f}`),
];
for (const f of SURFACES) ok(`${f} exists to be scanned`, existsSync(join(ROOT, f)));

// ── 3. The exemptions, each naming the mechanism that makes it true ────────
const EXEMPT = new Map([
  [
    "Verify your domain once and everything goes out from you.",
    "The EMAIL sending domain, which ships: Company.emailDomain / emailDomainStatus, " +
      "senderFor() in lib/email/resend.js, and app/app/settings/email-domain with DNS records.",
  ],
  [
    "Go to Settings → Email Domain and enter your domain.",
    "A help article describing that same shipped email screen, step by step.",
  ],
  [
    "Add the DNS records shown to your domain host (DKIM, SPF, and a sending subdomain).",
    "The DNS half of the email domain setup. 'sending subdomain' is Resend's, not a tenant website.",
  ],
  [
    "If it's YOUR own domain that's unverified, finish the DNS records under Settings → Email Domain.",
    "Troubleshooting for the email domain, and it names the settings screen in the same sentence.",
  ],
]);

// An exemption for copy that no longer exists is an exemption quietly widening
// what is allowed. Every one has to still match something shipped.
const allCopy = SURFACES.map((f) => read(f)).join("\n");
for (const [sentence, why] of EXEMPT) {
  ok(
    `the exemption for "${sentence.slice(0, 46)}…" still matches real copy`,
    allCopy.includes(sentence),
    `exempted because: ${why} — but the sentence is gone, so delete the exemption`,
  );
}

// ── 4. The sweep ───────────────────────────────────────────────────────────
//
// Matched on a whole sentence rather than the word "domain", so the offending
// text is quotable in the failure and a reader can judge it. English only: the
// translations are pinned to the English by check:feature-pages, so a promise
// cannot exist in French without existing in English first — and asserting
// that pinning here would duplicate a rule that already has a home.
const PROMISE = /\b(?:your|their|its|his|her)\s+(?:own\s+)?(?:custom\s+)?domain\b/i;

const offenders = [];
for (const file of SURFACES) {
  const src = read(file);
  for (const raw of src.split(/\n/)) {
    if (!PROMISE.test(raw)) continue;
    const line = raw.trim();
    if ([...EXEMPT.keys()].some((s) => raw.includes(s))) continue;
    // A comment explaining this very rule is not a promise. This file's own
    // header would otherwise fail it, which is the trap check-translations hit
    // for real: prose about a thing matching as the thing.
    if (/^\s*(\/\/|\*|\/\*)/.test(raw)) continue;
    offenders.push(`${file}: ${line.slice(0, 100)}`);
  }
}

ok(
  "the sweep read something, so a clean result means something",
  allCopy.length > 50000,
  `only ${allCopy.length} characters scanned`,
);
ok(
  "…and the pattern still recognises the sentence it exists for",
  PROMISE.test("we build the site on your own domain") &&
    PROMISE.test("Your logo, your colour, your domain.") &&
    !PROMISE.test("a subdomain of fieldquo.com") &&
    !PROMISE.test("the domain name system"),
);
ok(
  "no shipped copy promises a contractor their own website domain",
  offenders.length === 0,
  offenders.slice(0, 6).join("\n      "),
);

if (failures.length) {
  console.error(`check:domain-promise FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check:domain-promise passed — ${SURFACES.length} copy surfaces, ` +
    `${EXEMPT.size} exemptions, ${pass} assertions.`,
);
