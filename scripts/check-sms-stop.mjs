// scripts/check-sms-stop.mjs
//
//   npm run check:sms-stop
//
// "Reply STOP to opt out" is on every reminder. This proves a STOP arrives
// somewhere.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// app/api/sms/inbound resolved the company by matching Twilio's `To` against
// Company.smsFromNumber — a column nothing in the product writes. Every
// company texts from FieldQuo's shared system number, so every STOP came back
// to a number no company owned, matched no sales number either, and was
// dropped with a 200. The route was correct; it had no reachable case.
//
// ══ What this drives ═══════════════════════════════════════════════════════
//
// The REAL resolver in lib/sms/clientLine.js — tenantsForInbound (pure) and
// nationalDigits — against the two cases the route has: a company's own
// number, and the shared line with the sender's phone on some client
// records. Then the route's source, to confirm it asks that resolver and
// records one opt-out per tenant it names. Nothing here opens a connection.

import { readFileSync } from "node:fs";
import { tenantsForInbound, nationalDigits, clientSmsFrom } from "@/lib/sms/clientLine";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SYSTEM = "+15145550100";
const north = { id: "cmp_north", name: "Northline" };
const south = { id: "cmp_south", name: "Southside" };

console.log("\n1. A STOP to a company's own number reaches that company and nobody else\n");
{
  const r = tenantsForInbound({ dedicatedCompany: north, to: "+16135550199", systemNumber: SYSTEM, holders: [south] });
  ok("the dedicated owner is the one tenant", r.kind === "dedicated" && r.companies.length === 1 && r.companies[0].id === "cmp_north", r);
  ok("…even if another company holds the sender's phone", !r.companies.some((c) => c.id === "cmp_south"));
}

console.log("\n2. A STOP to the shared system number reaches every company holding the phone\n");
{
  const r = tenantsForInbound({ dedicatedCompany: null, to: SYSTEM, systemNumber: SYSTEM, holders: [north, south, north] });
  ok("the shared line resolves by the SENDER's client records", r.kind === "shared", r);
  ok("both holders are named, once each", r.companies.map((c) => c.id).sort().join(",") === "cmp_north,cmp_south", r.companies);
  const none = tenantsForInbound({ dedicatedCompany: null, to: SYSTEM, systemNumber: SYSTEM, holders: [] });
  ok("no holder → nobody, honestly", none.kind === "shared" && none.companies.length === 0, none);
  const formatted = tenantsForInbound({ dedicatedCompany: null, to: "(514) 555-0100", systemNumber: SYSTEM, holders: [north] });
  ok("the system number matches however Twilio spells it", formatted.kind === "shared" && formatted.companies.length === 1, formatted);
}

console.log("\n3. A number that is neither is nobody's (the sales branch decides)\n");
{
  const r = tenantsForInbound({ dedicatedCompany: null, to: "+19995550000", systemNumber: SYSTEM, holders: [north] });
  ok("an unknown number names no tenant", r.kind === "none" && r.companies.length === 0, r);
  const noSystem = tenantsForInbound({ dedicatedCompany: null, to: SYSTEM, systemNumber: null, holders: [north] });
  ok("with no system number at all, the shared case cannot fire", noSystem.kind === "none", noSystem);
}

console.log("\n4. The phone is matched on its national digits, however it was typed\n");
for (const [typed, want] of [
  ["+15550199123", "5550199123"],
  ["(555) 019-9123", "5550199123"],
  ["555.019.9123", "5550199123"],
  ["1 555 019 9123", "5550199123"],
  ["", null],
  ["12345", null],
  [null, null],
]) {
  ok(`${JSON.stringify(typed)} → ${JSON.stringify(want)}`, nationalDigits(typed) === want, nationalDigits(typed));
}

console.log("\n5. The From a company texts on is the number the STOP resolves\n");
ok("a company with its own number sends from it", clientSmsFrom({ smsFromNumber: "+16135550199" }) === "+16135550199");
ok("a company without one sends from the shared line (undefined → sendSms's system number)", clientSmsFrom({ smsFromNumber: null }) === undefined && clientSmsFrom({}) === undefined);
ok("whitespace is not a number", clientSmsFrom({ smsFromNumber: "  " }) === undefined);

console.log("\n6. The routes actually ask\n");
{
  const inbound = code(read("app/api/sms/inbound/route.js"));
  ok("the inbound route resolves through resolveInboundTenants", /resolveInboundTenants\(\{ to, from \}\)/.test(inbound));
  ok("…and records one opt-out per tenant it names", /for \(const tenant of tenants\.companies\)/.test(inbound) && /recordSmsOptOut\(\{ companyId: tenant\.id/.test(inbound));
  ok("…and one opt-in per tenant", /recordSmsOptIn\(\{ companyId: tenant\.id/.test(inbound));
  ok("…and never looks a company up by the body", !/where:\s*\{\s*smsFromNumber/.test(inbound));

  const onMyWay = code(read("app/api/jobs/[id]/visits/[visitId]/route.js"));
  const cron = code(read("app/api/cron/appointment-reminders/route.js"));
  ok("the on-my-way text sends from clientSmsFrom(company)", /from: clientSmsFrom\(/.test(onMyWay));
  ok("the reminder cron sends from clientSmsFrom(company)", /from: clientSmsFrom\(/.test(cron));
  ok("neither sender reads smsFromNumber directly any more", !/\.smsFromNumber \|\|/.test(onMyWay + cron));

  const line = code(read("lib/sms/clientLine.js"));
  ok("the shared-line lookup strips formatting in SQL, keyed on the national digits", /regexp_replace\(c\.phone/.test(line) && /nationalDigits\(phone\)/.test(line));
  ok("…and never interpolates the raw phone into SQL", !/\$\{phone\}|\$\{from\}/.test(line));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
