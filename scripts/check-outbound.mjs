// scripts/check-outbound.mjs
//
//   npm run check:outbound
//
// Who the phone agent is allowed to ring, and when.
//
// These are compliance assertions, not style ones. TCPA is up to $1,500 PER
// CALL and CASL up to $10M for an organisation, and the defence is always the
// same: show that the person asked to be contacted, and when.
//
// The list of things that are NOT consent sources is the important half.
// "purchased_list", "trade_show", "realtor", "imported", "scraped" — a
// contractor who pastes in a bought list gets numbers with no consent rows, and
// every one is refused. That's the difference between discouraging cold calling
// and making it not work.
//
// The disclosure assertions exist because the form must RENDER the same string
// the consent row STORES. Two copies drift, and the one that drifts is the one
// in the evidence.

import { withinCallingHours, CONSENT_SOURCES, CALL_WINDOW } from "@/lib/voice/outbound";
import { DISCLOSURE } from "@/lib/voice/disclosure";
let fail=0; const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m); if(!c)fail++;};

// ── Calling hours, in the CLIENT's zone ─────────────────────────────────
const at = (h, tz="America/Toronto") => {
  // Build a UTC instant that lands on hour `h` in that zone.
  const d = new Date(Date.UTC(2026, 6, 15, 12));
  const offset = Number(new Intl.DateTimeFormat("en-CA",{hour:"numeric",hour12:false,timeZone:tz}).format(d)) - 12;
  return new Date(Date.UTC(2026, 6, 15, h - offset));
};
for (const [h, want] of [[8,false],[9,true],[13,true],[19,true],[20,false],[22,false],[3,false]]) {
  ok(withinCallingHours(at(h), "America/Toronto") === want,
     `${String(h).padStart(2,"0")}:00 local → ${want ? "may call" : "will NOT call"}`);
}
ok(withinCallingHours(new Date(), "Not/AZone") === false,
   "an unknown timezone refuses — 'probably fine' isn't good enough to ring a stranger's phone");
ok(CALL_WINDOW.startHour >= 8 && CALL_WINDOW.endHour <= 21,
   `${CALL_WINDOW.startHour}:00–${CALL_WINDOW.endHour}:00 sits inside the 8–9 telemarketing window with margin`);

// ── Consent sources ─────────────────────────────────────────────────────
ok(Object.values(CONSENT_SOURCES).every(s => s.label && s.months > 0),
   `${Object.keys(CONSENT_SOURCES).length} sources, all labelled and time-limited`);
ok(CONSENT_SOURCES.job_completed.months < CONSENT_SOURCES.self_quote.months,
   `a review request expires sooner (${CONSENT_SOURCES.job_completed.months}mo) than a quote request (${CONSENT_SOURCES.self_quote.months}mo) — "how did we do" is welcome for weeks, not a year`);
for (const cold of ["purchased_list","trade_show","realtor","imported","scraped"])
  ok(!CONSENT_SOURCES[cold], `"${cold}" is NOT a consent source`);

// ── The disclosure is one string, used and stored ───────────────────────
ok(/call you shortly/i.test(DISCLOSURE.self_quote), `self-quote wording: "${DISCLOSURE.self_quote}"`);
ok(/assistant/i.test(DISCLOSURE.self_quote),
   "…and it says an assistant may call — disclosed up front, not on request");
ok(Object.values(DISCLOSURE).every(d => d.length > 20), "every disclosure is a real sentence");


// ── The strings must stay importable WITHOUT the database ────────────────
//
// A form renders them. When they lived in outbound.js the client bundle pulled
// in Prisma, then pg, then node's `dns`, and the build failed outright. This
// asserts the split holds.
import { readFileSync } from "node:fs";
const disc = readFileSync("lib/voice/disclosure.js", "utf8");
ok(!/^import /m.test(disc),
   "lib/voice/disclosure.js has NO imports — a client component can render it");

// The form must show the same string the consent row stores.
const form = readFileSync("app/quote/[companySlug]/kitchen/KitchenSelfQuote.js", "utf8");
const api = readFileSync("app/api/self-quote/kitchen/route.js", "utf8");
ok(/DISCLOSURE\.self_quote/.test(form), "the self-quote form RENDERS the disclosure");
ok(/disclosure: DISCLOSURE\.self_quote/.test(api), "…and the API stores that same constant");
ok(!/Someone will call you shortly/.test(form),
   "the wording is not hardcoded a second time in the form — one copy, no drift");

console.log(`\n${fail===0?"ALL PASS":fail+" FAILED"}`);
process.exit(fail?1:0);
