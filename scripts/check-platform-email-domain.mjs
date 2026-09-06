// scripts/check-platform-email-domain.mjs
//
//   npm run check:platform-email-domain
//
// FieldQuo's own email domain is a boundary read from BOTH sides.
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// A QA test POSTed `fieldquo.com` to Settings → Email Domain and the tenant
// adopted it. platformSender.js defines FieldQuo's sender as "a verified Resend
// domain no Company claims" — so the moment a tenant row claimed fieldquo.com,
// every platform email, and every quote and invoice from the 31 companies with
// no domain of their own, fell back to the Resend sandbox, which delivers only
// to the account owner. One bad row; platform mail down for everyone; the
// health page reporting the domain "verified" and "not usable" in one breath.
//
// Guarding the adoption route (the write side) is necessary and not enough:
// a row written before the guard, or by any path that is not that route,
// would take mail down again. So the rule lives in ONE function,
// lib/email/platformDomains.js, and this file holds all four readers to it —
// the adoption guard, the platform sender, the tenant sender, and the health
// page — so the sides cannot drift. The function is executed against hostile
// input; the readers are matched in comment-stripped source.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isPlatformEmailDomain } from "@/lib/email/platformDomains";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) =>
  readFileSync(join(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

let pass = 0;
const failures = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, undefined) : failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);

// ── 1. The function, executed ──────────────────────────────────────────────
for (const [input, want] of [
  ["fieldquo.com", true],
  ["FIELDQUO.COM", true],
  ["send.fieldquo.com", true],
  ["fieldquo.com.", true],
  ["  fieldquo.com  ", true],
  ["fieldquo.com.evil.example", false],
  ["notfieldquo.com", false],
  ["myfieldquo.com", false],
  ["send.mycompany.com", false],
  ["", false],
  [null, false],
  [42, false],
]) {
  ok(`isPlatformEmailDomain(${JSON.stringify(input)}) === ${want}`, isPlatformEmailDomain(input) === want);
}

// ── 2. Every reader consults it ────────────────────────────────────────────
const READERS = [
  ["app/api/settings/email-domain/route.js", "the adoption route refuses a platform domain", /isPlatformEmailDomain\(requested\)/],
  // The two WRITE paths that reach Resend's delete. A tenant row pointing at
  // fieldquo.com (the QA night's adoption) made "remove my domain" one click
  // from deleting the platform sender for everyone; the read side was
  // guarded on 2026-09-06 and these were not, until the rerun found it.
  ["app/api/settings/email-domain/route.js", "DELETE never calls Resend's delete on a platform domain", /company\?\.emailDomainId && !isPlatformEmailDomain\(company\?\.emailDomain\)/],
  ["app/api/settings/email-domain/route.js", "repointing never deletes a platform domain as the 'previous' registration", /previousDomainId !== created\.id && !isPlatformEmailDomain\(company\?\.emailDomain\)/],
  ["lib/email/platformSender.js", "the platform sender treats a platform domain as its own even if a tenant row claims it", /isPlatformEmailDomain\(d\.name\)\s*\|\|\s*!claimedIds\.has\(d\.id\)/],
  ["lib/email/resend.js", "the tenant sender never sends as a platform domain", /!isPlatformEmailDomain\(company\.emailDomain\)/],
  ["app/api/platform/email-health/domains/route.js", "the health page reports a platform domain usable regardless of a claim", /isPlatformEmailDomain\(d\.name\)\s*\|\|\s*!claimedBy\.has\(d\.id\)/],
];
for (const [file, what, re] of READERS) {
  const src = read(file);
  ok(`${file}: ${what}`, re.test(src));
  ok(`${file}: imports the ONE function rather than re-deriving the rule`, /platformDomains/.test(src));
}

// The rule must not be re-implemented anywhere as a bare string compare.
for (const file of ["lib/email/platformSender.js", "lib/email/resend.js", "app/api/platform/email-health/domains/route.js"]) {
  ok(
    `${file}: no bare "fieldquo.com" compare outside the shared function`,
    !/===\s*["']fieldquo\.com["']|endsWith\(["']\.fieldquo\.com["']\)/.test(read(file)),
  );
}

if (failures.length) {
  console.error(`check:platform-email-domain FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check:platform-email-domain passed — ${pass} assertions, ${READERS.length} readers held to one rule.`);
