// scripts/check-crew-line-purchase.mjs
//
// A contractor buying their own crew texting number, and FieldQuo buying its.
//
// ══ What went wrong before this existed ════════════════════════════════════
//
// Nothing could buy an SMS number. `CrewInboxNumber.source` documented
// "dedicated — a number bought for this company alone" and no code path could
// ever write it; the only way to stand a line up was for somebody to open the
// Twilio console by hand. Production's own TWILIO_PHONE_NUMBER named
// +17372212163 — a number the account has never owned — so every fallback send
// failed at the carrier with 21606 while `twilioConfigured()` cheerfully
// returned true. Naming a number in configuration is not owning it.
//
// ══ What these assert ══════════════════════════════════════════════════════
//
// The ORDER of a purchase, which is the whole design: money is reserved before
// the provider is called, the webhook is set in the same call that buys, and a
// provider refusal refunds. And the thing that makes a purchase honest rather
// than a trap — that a bought number is billed every month and handed back when
// it stops being paid for. Buying without billing and releasing is the bug that
// already cost this repo a commit on the voice side.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-crew-line-purchase.mjs

import { readFileSync } from "node:fs";
import { priceSpend, rentDecision, claimVerdict, crewLineSetupRef } from "@/lib/voice/spendGate";
import { CREW_LINE_MONTHLY_CENTS, NUMBER_TYPES } from "@/lib/voice/credits";
import { rentShimFor, rentApplies, crewRentRef } from "@/lib/crew/lineRent";
import { crewPanelBlocks } from "@/lib/crew/panelBlocks";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail ? ` — ${detail}` : ""}`);

const read = (p) => readFileSync(p, "utf8");
const LINE = read("lib/crew/line.js");
const RENT = read("lib/crew/lineRent.js");
const CRON = read("app/api/cron/crew-line-rent/route.js");
const ROUTE = read("app/api/crew/line/route.js");
const PLAT = read("lib/crew/platformNumber.js");
const CLIENT = read("lib/sms/twilioClient.js");

console.log("\nPricing — executed, not read");
ok("a crew line has a price", CREW_LINE_MONTHLY_CENTS > 0);
ok(
  "priceSpend prices the setup",
  priceSpend("crew_line_setup") === CREW_LINE_MONTHLY_CENTS,
  String(priceSpend("crew_line_setup")),
);
ok("priceSpend prices the rent", priceSpend("crew_line_rent") === CREW_LINE_MONTHLY_CENTS);
// One commodity, one price. Two prices for the same Twilio local number is the
// pair that drifts, and the drift lands on whichever screen nobody reads.
ok(
  "and it matches a local voice number",
  CREW_LINE_MONTHLY_CENTS === NUMBER_TYPES.local.monthlyCents,
);
// A toll-free crew line does not exist, so numberType must not silently change
// the price and invent one.
ok(
  "numberType cannot change a crew line's price",
  priceSpend("crew_line_setup", "toll_free") === CREW_LINE_MONTHLY_CENTS,
);

console.log("\nWho pays rent");
ok("a bought line does", rentApplies({ source: "dedicated" }) === true);
ok("a loaned line does not", rentApplies({ source: "shared_test" }) === false);
ok("a row with no source does not", rentApplies({}) === false);
ok("null is not a line", rentApplies(null) === false);
ok(
  "the cron asks the database, not the loop",
  /where: \{ source: "dedicated" \}/.test(CRON),
);

console.log("\nThe rent rule is REUSED, not copied");
// A second copy of the grace/warning logic is the thing that would drift, and
// the drift would land on whichever kind of number nobody was watching.
ok("lineRent imports rentDecision", /import \{ rentDecision \} from "@\/lib\/voice\/spendGate"/.test(RENT));
ok(
  "and defines no grace period of its own",
  !/GRACE_DAYS\s*=|WARN_AHEAD|PERIOD_DAYS\s*=/.test(RENT),
);
// Executed: the shim has to satisfy every field rentDecision reads, or the
// verdict is silently "skip" and no crew line is ever billed at all.
const day = 24 * 60 * 60 * 1000;
const line = {
  id: "cl_1",
  companyId: "co_1",
  e164: "+18195812413",
  source: "dedicated",
  rentPaidThroughAt: new Date(Date.now() - day),
  rentGraceUntilAt: null,
  rentWarnedAt: null,
};
const rich = rentDecision({ number: rentShimFor(line), balanceCents: 10_000 });
ok("a funded overdue line is CHARGED", rich.action === "charge", rich.action + "/" + rich.reason);
ok("...for the crew line price", rich.cents === CREW_LINE_MONTHLY_CENTS);

const broke = rentDecision({ number: rentShimFor(line), balanceCents: 0 });
ok("an unfunded one starts GRACE, it does not die", broke.action === "grace_start", broke.action);
ok("...and the line keeps working meanwhile", broke.graceUntil > new Date());

const expired = rentDecision({
  number: rentShimFor({ ...line, rentGraceUntilAt: new Date(Date.now() - day) }),
  balanceCents: 0,
});
ok("grace that has run out RELEASES", expired.action === "release", expired.action);

const future = rentDecision({
  number: rentShimFor({ ...line, rentPaidThroughAt: new Date(Date.now() + 20 * day) }),
  balanceCents: 10_000,
});
ok("a paid-up line is left alone", future.action === "none", future.action);

console.log("\nThe order of a purchase");
const reserveAt = LINE.indexOf('kind: "crew_line_setup"');
const buyAt = LINE.indexOf("twilioRest.incomingPhoneNumbers.create");
// The actual WRITE, not the words "dedicated" — the first version of this
// matched the doc comment above purchaseCrewLine, which describes the field, and
// reported the code out of order. A marker that prose can satisfy is not a
// marker.
const rowAt = LINE.indexOf("db.crewInboxNumber.create");
ok("the money is reserved", reserveAt > 0);
ok("BEFORE the provider is called", reserveAt < buyAt, `${reserveAt} vs ${buyAt}`);
ok("and the row is written after both", buyAt < rowAt);
ok(
  "a provider refusal refunds",
  /catch[\s\S]{0,200}refundReservation\(\{[\s\S]{0,160}crew/i.test(LINE) ||
    (LINE.indexOf("refundReservation") > buyAt && LINE.indexOf("refundReservation") < rowAt),
);
// No window where FieldQuo owns a live number pointing at nothing.
ok(
  "the webhook is set in the same call that buys",
  /incomingPhoneNumbers\.create\(\{[\s\S]{0,200}smsUrl/.test(LINE),
);
ok(
  "the same is true of FieldQuo's own purchase",
  /incomingPhoneNumbers\.create\(\{[\s\S]{0,200}smsUrl/.test(PLAT),
);
// Non-negotiable #5.
ok(
  "the browser posts a number, never an amount",
  !/body\?\.(cents|amount|monthlyCents|price)/.test(ROUTE),
);

console.log("\nGiving it back");
ok(
  "a BOUGHT number goes back to the carrier",
  /source === "dedicated"[\s\S]{0,220}\.remove\(\)/.test(LINE),
);
// Deleting the shared line would destroy the only trial line every tenant uses.
ok(
  "a LOANED number is only un-pointed",
  /smsUrl: ""/.test(LINE) && !/source === "shared_test"[\s\S]{0,120}\.remove\(\)/.test(LINE),
);
ok(
  "FieldQuo cannot release a number a tenant is holding",
  /crewInboxNumber\.findUnique[\s\S]{0,300}status: 409/.test(PLAT),
);

console.log("\nThe first month is not billed twice");
ok(
  "buying stamps rent 30 days out",
  /rentPaidThroughAt: new Date\(Date\.now\(\) \+ RENT_PERIOD_DAYS/.test(LINE),
);
// A claim charges nothing, so billing it the next morning would be a surprise
// invoice for a number nobody said was rented.
ok(
  "and so does claiming, because a claim charges nothing",
  (LINE.match(/rentPaidThroughAt: new Date\(Date\.now\(\) \+ RENT_PERIOD_DAYS/g) || []).length >= 2,
);
ok(
  "rent refs are per line, per period",
  crewRentRef("cl_1", new Date("2026-08-26")) === "crew_line_rent:cl_1:2026-08-26",
  crewRentRef("cl_1", new Date("2026-08-26")),
);

console.log("\nTwo purchases cannot race into two numbers");
const started = new Date(Date.now() - 30_000);
const inFlight = claimVerdict({
  entries: [{ kind: "crew_line_setup", ref: crewLineSetupRef("t1"), createdAt: started }],
  numberRowsCreatedAt: [],
  kind: "crew_line_setup",
});
ok("an unsettled crew reservation is in flight", inFlight.inFlight === true);
// The two guards must be blind to each other, or buying a voice number blocks
// buying a crew line in the same minute.
const voiceBlind = claimVerdict({
  entries: [{ kind: "number_setup", ref: "number_setup:t9", createdAt: started }],
  numberRowsCreatedAt: [],
  kind: "crew_line_setup",
});
ok("a VOICE purchase does not block a crew one", voiceBlind.inFlight === false);
const crewBlind = claimVerdict({
  entries: [{ kind: "crew_line_setup", ref: crewLineSetupRef("t1"), createdAt: started }],
  numberRowsCreatedAt: [],
});
ok("and a crew purchase does not block a voice one", crewBlind.inFlight === false);
ok(
  "the reservation is taken under SERIALIZABLE",
  /isolationLevel: "Serializable"/.test(LINE),
);

console.log("\nA bought number beats a configured one");
// The bug in one line: configuration named a number the account never owned.
ok(
  "sendSms resolves the system number rather than reading the env",
  /await systemSmsNumber\(\)/.test(CLIENT) && !/from \|\| process\.env\.TWILIO_PHONE_NUMBER/.test(CLIENT),
);

console.log("\nIt cannot be sold when it cannot work");
// TWILIO_AUTH_TOKEN is unset in production today, so every inbound message 401s.
// Selling a texting line into that is the dead control AGENTS.md forbids, and no
// amount of retrying fixes it from the contractor's side.
ok(
  "buying is refused when inbound cannot be verified",
  /if \(!crewSignatureConfigured\(\)\)[\s\S]{0,400}status: 503/.test(LINE),
);
ok(
  "...before anything reversible happens",
  LINE.indexOf("crewSignatureConfigured()") < reserveAt,
);

console.log("\nThe buy control is offered only where it works");
// Executed across the state matrix rather than read. A buy button on a
// deployment that answers 503 is the dead control AGENTS.md forbids, and the
// contractor cannot fix it by pressing harder.
const offersBuy = (d) => (crewPanelBlocks(d).actions || []).includes("buy");
ok(
  "offered when configured and they have no line",
  offersBuy({
    capability: { ready: false, reason: "no_line" },
    line: null,
    numbers: [],
    deployment: { available: true },
  }) === true,
);
ok(
  "withheld when the deployment cannot receive",
  offersBuy({
    capability: { ready: false, reason: "not_configured" },
    line: null,
    deployment: { available: false },
  }) === false,
);
// The two halves come from one crewSignatureConfigured() today, so this payload
// cannot arise from the route. It is asserted anyway: the agreement lives in the
// caller, and this is the function that decides whether to offer to spend money.
ok(
  "withheld even if a caller sends the two halves disagreeing",
  offersBuy({
    capability: { ready: false, reason: "not_configured" },
    line: null,
    deployment: { available: true },
  }) === false,
);
ok(
  "withheld when they already hold a line (the purchase would 409)",
  offersBuy({
    capability: { ready: true },
    line: { e164: "+18195812413" },
    deployment: { available: true },
  }) === false,
);
// A cached payload from before `deployment` existed must not read as permission.
ok(
  "withheld on a payload with no deployment at all",
  offersBuy({ capability: { ready: false, reason: "no_line" }, line: null }) === false,
);
ok(
  "and truthiness is not enough",
  offersBuy({
    capability: { ready: false, reason: "no_line" },
    line: null,
    deployment: { available: "yes" },
  }) === false,
);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
