// Validates the demo industry presets against the real ServiceCategory keys in
// prisma/seed.js, without needing a database. A preset naming a trade that
// doesn't exist yields a demo with no services — discovered mid sales call.
import { readFileSync } from "node:fs";
import { INDUSTRIES, INDUSTRY_KEYS, industry, demoAccounts, DEMO_COUNT } from "@/lib/demo/industries";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

const seed = readFileSync(new URL("../prisma/seed.js", import.meta.url), "utf8");
const REAL = new Set([...seed.matchAll(/key:\s*"([a-z_]+)"/g)].map((m) => m[1]));

console.log(`\nCategory keys resolve (${REAL.size} real categories in prisma/seed.js)`);
for (const [key, p] of Object.entries(INDUSTRIES)) {
  const bad = p.categories.filter((c) => !REAL.has(c));
  ok(`${key.padEnd(13)} ${p.categories.length} categories`, bad.length === 0, bad);
}

console.log("\nEvery preset is complete");
for (const [key, p] of Object.entries(INDUSTRIES)) {
  const problems = [];
  if (!p.label) problems.push("label");
  if (!p.company) problems.push("company");
  if (!/^#[0-9A-Fa-f]{6}$/.test(p.brandColor || "")) problems.push("brandColor");
  if (!p.categories?.length) problems.push("categories");
  if (!p.services?.length) problems.push("services");
  if (!p.jobs?.length) problems.push("jobs");
  ok(`${key.padEnd(13)} has every field`, problems.length === 0, problems);
}

console.log("\nServices are priced and plausible");
for (const [key, p] of Object.entries(INDUSTRIES)) {
  const bad = p.services.filter((s) => !s.name || !s.unit || !(s.rate > 0) || s.rate > 20000);
  ok(`${key.padEnd(13)} ${p.services.length} services priced`, bad.length === 0, bad);
}

console.log("\nThe demo accounts themselves");
const accts = demoAccounts();
ok(`${DEMO_COUNT} accounts`, accts.length === 10, accts.length);
ok("slugs are unique", new Set(accts.map((a) => a.slug)).size === accts.length);
ok("emails are unique", new Set(accts.map((a) => a.email)).size === accts.length);
ok("every assigned industry exists", accts.every((a) => industry(a.industry)));
ok("they don't all start on the same trade", new Set(accts.map((a) => a.industry)).size > 1,
  new Set(accts.map((a) => a.industry)).size);
ok("slugs are url-safe", accts.every((a) => /^[a-z0-9-]+$/.test(a.slug)));
ok("a custom count works", demoAccounts(5).length === 5);

console.log("\nReserved-subdomain safety");
// lib/site/subdomain.js treats these as a security boundary — a demo owning
// app.fieldquo.com would be account takeover, since cookies scope to the apex.
const RESERVED = ["app", "www", "api", "admin", "platform", "mail", "book", "quote", "portal"];
ok("no demo slug collides with a reserved subdomain",
  accts.every((a) => !RESERVED.includes(a.slug)), accts.filter((a) => RESERVED.includes(a.slug)));

console.log("\nLookup");
ok("known industry resolves", industry("painting")?.company === "Northside Painting Co.");
ok("unknown returns null, not a default", industry("underwater-basketweaving") === null);
ok("null returns null", industry(null) === null);
ok("INDUSTRY_KEYS matches the table", INDUSTRY_KEYS.length === Object.keys(INDUSTRIES).length);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
