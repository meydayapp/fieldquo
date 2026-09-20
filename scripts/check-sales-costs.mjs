#!/usr/bin/env node
//
// scripts/check-sales-costs.mjs
//
//   npm run check:sales-costs
//
// The four entries that left the floor board's "does not show" list on
// 2026-09-17, executed: the conversation rule on synthetic transcripts, the
// dialler's statistics, cost composition with unknowns, the daily ledger's
// idempotent upsert, the Twilio number audit, and the test-line exclusion
// through every one of them.
//
// ══ Pure, and judged by exit code ═════════════════════════════════════════
//
// No database. Every function under test takes rows as arguments — the
// discipline lib/sales/calls/reporting.js states — so every branch runs here
// on hostile shapes: a transcript that is a string, a price that is "-0.014",
// a record with no category, a rep who hung up on a ringing phone.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONVERSATION_MIN_CONTRACTOR_WORDS,
  CONVERSATION_MIN_SECONDS,
  PICKUP_MIN_SECONDS,
  connectFigures,
  contractorWords,
  conversationVerdict,
  measuredConversation,
  pickupBand,
  pickupFigures,
  wasConnected,
} from "@/lib/sales/calls/conversation";
import { CONTRACTOR_WORDS_SQL } from "@/lib/sales/calls/contractorWordsSql";
import {
  DIALLER_GAP_BREAK_MS,
  NOT_TRACKED_CALLS,
  diallerStats,
  repCallStats,
} from "@/lib/sales/calls/reporting";
import {
  RECORDING_CENTS_PER_MINUTE,
  aiCostsByAttempt,
  callCost,
  costPerConversation,
  parentSidFor,
  periodCallCosts,
  recordingCostCents,
} from "@/lib/sales/calls/costs";
import {
  TWILIO_TOTAL_CATEGORY,
  TWILIO_USAGE_CATEGORIES,
  applyDailyRows,
  bucketKey,
  normaliseTwilioUsage,
  rowKey,
  summariseTwilio,
  splitTwilioSides,
  TWILIO_SALES_ONLY_CATEGORIES,
} from "@/lib/platform/costs/dailyLedger";
import { salesNumberConfigAudit } from "@/lib/sales/calls/numberConfig";
import { salesVoiceInboundState } from "@/lib/sales/calls/inboundRouting";
import { TEST_JURISDICTION_CODE } from "@/lib/sales/testLines";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const T0 = new Date("2026-09-17T14:00:00Z");
const min = (n) => new Date(T0.getTime() + n * 60_000);
const say = (speaker, words) => ({ speaker, start: 0, end: 1, text: Array.from({ length: words }, (_, i) => `w${i}`).join(" ") });

// ═══════════════════════════════════════════════════════════════════════════
section("1. The conversation rule");

ok("the threshold is stated as a constant, and it is twenty", CONVERSATION_MIN_CONTRACTOR_WORDS === 20);
ok("contractor words count only the contractor's track", contractorWords([say("rep", 50), say("contractor", 7)]) === 7);
ok("a transcript that is not an array is 'no transcript', not zero", contractorWords("hello there") === null && contractorWords(null) === null);
ok("an unattributed single-track transcript counts nothing", contractorWords([say("unknown", 80)]) === 0);
ok("punctuation is not a word", contractorWords([{ speaker: "contractor", text: "Yes — ok, fine! (really) ... " }]) === 4);

const connected = { dialChannel: "browser", answeredAt: T0, providerStatus: "completed", talkSeconds: 40 };
ok("a connected call with 20+ contractor words is a conversation",
  conversationVerdict({ ...connected, transcript: [say("rep", 30), say("contractor", 20)] }) === "conversation");
ok("…with 19 it is not", conversationVerdict({ ...connected, transcript: [say("contractor", 19)] }) === "not_conversation");
ok("…with no transcript yet it is UNKNOWN, never no", conversationVerdict({ ...connected, transcript: null }) === "unknown");
ok("…with a failed transcription it is still unknown", conversationVerdict({ ...connected, transcript: null, transcriptError: "vendor_error: x" }) === "unknown");
ok("a ring-out is not connected", conversationVerdict({ dialChannel: "browser", providerStatus: "no-answer" }) === "not_connected");
ok("a handset dial is unmeasured", conversationVerdict({ dialChannel: "handset", disposition: "reached_interested" }) === "unmeasured");
ok("a bridged call with no terminal signal yet is unmeasured, not a ring-out", wasConnected({ dialChannel: "browser", providerStatus: "ringing" }) === null && wasConnected({ dialChannel: "browser" }) === null);
ok("the browser's end reason counts when the status never arrived", wasConnected({ dialChannel: "browser", endReason: "busy" }) === false);
ok("a precomputed word count on the row is honoured", conversationVerdict({ ...connected, contractorWords: 25 }) === "conversation" && conversationVerdict({ ...connected, contractorWords: 2 }) === "not_conversation");

{
  const rows = [
    { ...connected, transcript: [say("contractor", 25)] },
    { ...connected, transcript: [say("contractor", 25)] },
    { ...connected, transcript: [say("contractor", 3)] },
    { ...connected, transcript: null },
    { dialChannel: "browser", providerStatus: "no-answer" },
    { dialChannel: "handset" },
  ];
  const f = connectFigures(rows);
  ok("connect figures: 5 measured, 4 connected, 2 conversations, 1 not, 1 unknown",
    f.measured === 5 && f.connected === 4 && f.conversations === 2 && f.notConversations === 1 && f.unknown === 1, f);
  ok("the answer rate is over bridged calls", f.answerRate.hit === 4 && f.answerRate.sampleSize === 5);
  ok("an unknown with no recording is 'never recorded', not 'not yet'", f.unrecorded === 1 && f.awaitingTranscript === 0);
  ok("…and a recorded one without a transcript is awaiting the transcriber",
    connectFigures([{ ...connected, transcript: null, recordingSid: "RE1" }]).awaitingTranscript === 1);
  ok("the conversation rate's denominator EXCLUDES the unknown", f.conversationRate.hit === 2 && f.conversationRate.sampleSize === 3);
  ok("every rate carries a label that says what it is", /carrier/.test(f.labels.answerRate) && /transcript/.test(f.labels.conversationRate) && /reported/.test(f.labels.reportedReachRate));
  ok("the label prints the threshold", f.labels.conversationRate.includes(`${CONVERSATION_MIN_CONTRACTOR_WORDS}+`));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The dialler's statistics");

const dials = [
  { id: "a", direction: "out", dialChannel: "browser", dialSource: "autodial", dialledAt: min(0), endedAt: min(2), answeredAt: min(0), providerStatus: "completed", talkSeconds: 100 },
  { id: "b", direction: "out", dialChannel: "browser", dialSource: "autodial", dialledAt: min(3), providerStatus: "no-answer" },
  { id: "c", direction: "out", dialChannel: "browser", dialSource: "manual", dialledAt: min(5), providerStatus: "canceled", hungUpBy: "rep", endReason: "rep_hangup" },
  { id: "d", direction: "out", dialChannel: "browser", dialSource: null, dialledAt: min(50), providerStatus: "ringing" },
  { id: "e", direction: "out", dialChannel: "handset", dialSource: "manual", dialledAt: min(52) },
  { id: "in", direction: "in", dialChannel: "inbound", dialledAt: min(53), answeredAt: min(53), providerStatus: "completed" },
];
{
  const d = diallerStats(dials, { times: { workingMs: 120 * 60_000, pausedMs: 30 * 60_000 } });
  ok("placed counts outbound only, all channels", d.placed === 5 && d.browserPlaced === 4 && d.handsetPlaced === 1, d);
  ok("autodial vs manual vs unrecorded, never folding null into manual", d.source.autodial === 2 && d.source.manual === 2 && d.source.unrecorded === 1, d.source);
  ok("answered / rang out / abandoned / open", d.answered === 1 && d.rangOut === 1 && d.abandoned === 1 && d.open === 1, d);
  ok("abandoned is the rep hanging up before answer", d.abandoned === 1);
  ok("dials per floor hour excludes pauses: 5 dials over 90 min = 3.3", d.perFloorHour === 3.3 && d.floorMs === 90 * 60_000, d);
  ok("the gap is median end-to-next-dial, with the 45-minute break left out",
    d.gap.measuredOf === 3 && d.gap.medianMs === 2 * 60_000 && d.gap.breakMs === DIALLER_GAP_BREAK_MS, d.gap);
  const noTimes = diallerStats(dials, { times: null });
  ok("without presence rows, per-hour is null, not zero", noTimes.perFloorHour === null && noTimes.floorMs === null);
  const little = diallerStats(dials, { times: { workingMs: 5 * 60_000, pausedMs: 0 } });
  ok("under fifteen minutes of floor time, per-hour is withheld", little.perFloorHour === null);
}

{
  const s = repCallStats({ attempts: dials, activity: null, from: min(-60), to: min(60), now: min(60) });
  ok("a rep's stats carry the dialler block and the three rates", s.dialler?.placed === 5 && s.connect?.conversations === 0 && "reportedReachRate" in s);
  const withTest = repCallStats({
    attempts: [...dials, { id: "t", direction: "out", dialChannel: "browser", dialSource: "autodial", dialledAt: min(10), answeredAt: min(10), providerStatus: "completed", jurisdictionCode: TEST_JURISDICTION_CODE, transcript: [say("contractor", 99)] }],
    activity: null, from: min(-60), to: min(60), now: min(60),
  });
  ok("a test-line dial is in none of it: not a dial, not autodial, not a conversation",
    withTest.dialler.placed === 5 && withTest.dialler.source.autodial === 2 && withTest.connect.conversations === 0 && withTest.dials === 5, withTest.dialler);
}

ok("the not-tracked list keeps handset durations and nothing stale",
  NOT_TRACKED_CALLS.length === 1 && NOT_TRACKED_CALLS[0].key === "handsetDurations");
ok("…and the four stale entries are gone", !NOT_TRACKED_CALLS.some((e) => ["abandonRate", "connectRate", "voicemail", "costPerConversation"].includes(e.key)));

// ═══════════════════════════════════════════════════════════════════════════
section("3. Cost composition, with unknowns");

ok("recording is $0.0025 a minute, in cents", RECORDING_CENTS_PER_MINUTE === 0.25 && recordingCostCents(120) === 0.5 && recordingCostCents(0) === 0);
ok("no recording seconds is null, not zero", recordingCostCents(null) === null && recordingCostCents("x") === null);

const priced = { id: "p1", dialChannel: "browser", providerCallSid: "CA1", providerStatus: "completed", endedAt: T0, providerCostCents: "1.4", recordingSid: "RE1", recordingSeconds: 120, transcribedAt: T0 };
const ai = aiCostsByAttempt(
  [
    { ref: "transcript:RE1", costMicros: 12000 },
    { ref: "qa:p1", costMicros: 3000 },
    { ref: "qa:p10:v2", costMicros: 99999 }, // another attempt's — must not land on p1
    { ref: "transcript:RE_other", costMicros: 5 },
  ],
  [priced, { id: "p10", recordingSid: "RE10" }],
);
ok("AI rows are matched by ref: transcript by recordingSid, QA by attempt id prefix",
  ai.get("p1").transcriptionMicros === 12000 && ai.get("p1").qaMicros === 3000 && ai.get("p10").qaMicros === 99999, [...ai.entries()]);
{
  const c = callCost(priced, ai.get("p1"));
  ok("a fully priced call sums four parts: 1.4 + 0.5 + 1.2 + 0.3 = 3.4¢", c.knownCents === 3.4 && c.complete && c.unknown.length === 0, c);
  ok("a Decimal-as-string carrier price is read", c.carrierCents === 1.4);
}
{
  const c = callCost({ ...priced, providerCostCents: null }, ai.get("p1"));
  ok("no carrier price on an ended bridged call is UNKNOWN, and the known parts still sum", c.carrierCents === null && c.unknown.includes("carrier") && c.knownCents === 2 && !c.complete, c);
}
{
  const c = callCost({ id: "h", dialChannel: "handset" }, null);
  ok("a handset call has nothing unknown — nothing was ever expected", c.complete && c.knownCents === 0 && c.carrierCents === null);
}
{
  const c = callCost({ ...priced, transcribedAt: T0 }, { transcriptionMicros: null, transcriptionRows: 0, qaMicros: null, qaRows: 0, qaUnpriced: 0 });
  ok("transcribed with no ledger row is an unknown transcription cost", c.unknown.includes("transcription"));
  const q = callCost(priced, { ...ai.get("p1"), qaMicros: null, qaUnpriced: 1 });
  ok("a QA row with no price is an unknown QA cost", q.unknown.includes("qa"));
  const q2 = callCost({ ...priced }, { ...ai.get("p1"), qaMicros: null, qaRows: 0, qaUnpriced: 0 }, { costMicros: 700 });
  ok("the scorecard row's own figure is the fallback", q2.qaCents === 0.07);
}
{
  const rows = [priced, { ...priced, id: "p2", providerCostCents: null, recordingSid: null, recordingSeconds: null, transcribedAt: null }, { id: "h", dialChannel: "handset" }];
  const p = periodCallCosts(rows, ai);
  ok("a period sums what is known and counts what is not", p.calls === 3 && p.browserCalls === 2 && p.knownCents === 3.4 && p.unknownCalls === 1 && !p.complete, p);
  const carrier = p.parts.find((x) => x.key === "carrier");
  ok("each part carries its count, its unknowns and its source", carrier.of === 1 && carrier.unknown === 1 && /Twilio/.test(carrier.source));
}
{
  const r = costPerConversation({ knownCents: 340, conversations: 4, unknownCalls: 0 });
  ok("cost per conversation divides", r.cents === 85 && !r.isFloor);
  const fl = costPerConversation({ knownCents: 340, conversations: 4, unknownCalls: 2, unknownConversations: 1 });
  ok("…and is a FLOOR, said as one, when a part is unknown", fl.isFloor && /floor/i.test(fl.statement) && /not yet transcribed/.test(fl.statement));
  const none = costPerConversation({ knownCents: 340, conversations: 0 });
  ok("…and is null, with a sentence, when there is nothing to divide by", none.cents === null && /nothing to divide/.test(none.statement));
}
ok("the pricing parent is the rep's browser leg on an outbound bridge and the contractor's leg on an inbound one",
  parentSidFor({ direction: "out", repCallSid: "CAREP", providerCallSid: "CAPSTN" }) === "CAREP" &&
    parentSidFor({ direction: "in", repCallSid: "CAREP", providerCallSid: "CAIN" }) === "CAIN" &&
    parentSidFor({ direction: "out", providerCallSid: "CAPSTN" }) === "CAPSTN");

// ═══════════════════════════════════════════════════════════════════════════
section("4. The daily ledger is idempotent");

const records = [
  { category: "calls-outbound", startDate: new Date("2026-09-16T00:00:00Z"), price: "0.4200", priceUnit: "usd", usage: "30", usageUnit: "minutes", count: "12" },
  { category: "calls-client", startDate: "2026-09-16", price: "0.0800", priceUnit: "USD", usage: "20", usageUnit: "minutes", count: 12 },
  { category: "phonenumbers", startDate: "2026-09-16", price: "1.15", priceUnit: "USD", usage: "1", usageUnit: "numbers", count: 1 },
  { category: "totalprice", startDate: "2026-09-16", price: "1.9", priceUnit: "USD" },
  { category: "", startDate: "2026-09-16", price: "9" },
  { category: "sms-outbound", startDate: "garbage", price: "9" },
  { category: "recordings", startDate: "2026-09-16", price: null },
];
const norm = normaliseTwilioUsage(records, { fetchedAt: T0 });
ok("records become rows in cents with the provider's own keys; garbage is dropped and counted",
  norm.rows.length === 4 && norm.dropped === 3 && norm.rows[0].cents === 42 && norm.rows[0].currency === "USD" && norm.rows[0].category === "calls-outbound", norm);
ok("the day is a YYYY-MM-DD key whether Twilio sent a Date or a string", norm.rows.every((r) => r.day === "2026-09-16"));
{
  const once = applyDailyRows(new Map(), norm.rows);
  const twice = applyDailyRows(applyDailyRows(new Map(), norm.rows), norm.rows);
  const dump = (m) => JSON.stringify([...m.values()].map((r) => ({ ...r, fetchedAt: undefined })));
  ok("applying a pull twice leaves the ledger identical — replace, never add", once.size === 4 && twice.size === 4 && dump(once) === dump(twice));
  const revised = applyDailyRows(twice, normaliseTwilioUsage([{ category: "calls-outbound", startDate: "2026-09-16", price: "0.50" }], { fetchedAt: min(60) }).rows);
  ok("a revised day replaces the earlier figure", revised.get(rowKey({ day: "2026-09-16", provider: "twilio", category: "calls-outbound" })).cents === 50 && revised.size === 4);
}
{
  const s = summariseTwilio(norm.rows);
  ok("the summary lists the categories in the pull's order, with labels", s.lines.map((l) => l.category).join(",") === "calls-outbound,calls-client,phonenumbers" && s.lines.every((l) => l.label));
  ok("the lines sum, the account total is its own figure, and the difference is 'other'", s.linesCents === 165 && s.totalCents === 190 && s.otherCents === 25, s);
  ok("the summary's as-of is the oldest fetch among the rows", s.fetchedAt.getTime() === T0.getTime());
  const noTotal = summariseTwilio(norm.rows.filter((r) => r.category !== TWILIO_TOTAL_CATEGORY));
  ok("without a total, total and other are null — not the sum of the lines", noTotal.totalCents === null && noTotal.otherCents === null);
}
ok("the parent categories are not pulled — they would double the sum", !TWILIO_USAGE_CATEGORIES.includes("calls") && !TWILIO_USAGE_CATEGORIES.includes("sms") && TWILIO_USAGE_CATEGORIES.includes("totalprice"));
ok("buckets: day, ISO-week Monday, month", bucketKey("2026-09-17", "day") === "2026-09-17" && bucketKey("2026-09-17", "week") === "2026-09-14" && bucketKey("2026-09-17", "month") === "2026-09");

// ═══════════════════════════════════════════════════════════════════════════
section("5. The number configuration is read from Twilio, and the floor says one paragraph");

{
  const origin = "https://www.fieldquo.com";
  const audit = salesNumberConfigAudit({
    origin,
    rows: [
      { e164: "+15550000001", purpose: "sales", assignedRepName: "Ana" },
      { e164: "+15550000002", purpose: "sales_voice" },
      { e164: "+15550000003", purpose: "sales_voice" },
      { e164: "+15550000004", purpose: "sales_voice" },
    ],
    twilioNumbers: [
      { phoneNumber: "+15550000001", sid: "PN1", voiceUrl: `${origin}/api/rep-dial/inbound`, statusCallback: `${origin}/api/rep-dial/inbound?stage=status` },
      { phoneNumber: "+15550000002", sid: "PN2", voiceUrl: `${origin}/api/rep-dial/inbound`, statusCallback: "" },
      { phoneNumber: "+15550000003", sid: "PN3", voiceUrl: "https://preview.vercel.app/api/rep-dial/inbound", statusCallback: `${origin}/api/rep-dial/inbound?stage=status` },
    ],
  });
  const st = Object.fromEntries(audit.lines.map((l) => [l.e164, `${l.voiceState}/${l.statusState}`]));
  ok("a ✓ is a ✓ at the carrier: voice URL and status callback both checked", st["+15550000001"] === "ok/ok" && audit.lines[0].ok);
  ok("a missing status callback is named, not instructed around", st["+15550000002"] === "ok/missing" && audit.lines[1].misconfigured);
  ok("a voice URL on another host is wrong", st["+15550000003"] === "wrong_host/ok");
  ok("a number Twilio does not hold is its own state", st["+15550000004"] === "not_held/not_held");
  ok("the counts add up", audit.counts.held === 4 && audit.counts.ok === 1 && audit.counts.misconfigured === 3 && audit.counts.unknown === 0, audit.counts);
  const unasked = salesNumberConfigAudit({ origin, rows: [{ e164: "+1" }], twilioNumbers: null });
  ok("Twilio unreachable is 'not asked' on every line, never a verdict", unasked.lines[0].unknown && !unasked.lines[0].misconfigured && unasked.counts.unknown === 1);
  ok("the audit's owner is the rep, else the admin, else the pool", audit.lines[0].owner === "Ana" && audit.lines[1].owner === null);
}
{
  const s = salesVoiceInboundState({ numbers: ["+1", "+2"], anyLive: true, misconfigured: 0 });
  ok("the floor's paragraph is the true sentence and the count", /rings the number's owner and the last rep who called them, then anyone available; unanswered → held → voicemail\./.test(s.text) && /2 numbers held; all pointed here\./.test(s.text) && s.warning === null, s);
  ok("…with no transfer-number sentence when none is set", !/FIELDQUO_SALES_TRANSFER_TO|transfer/i.test(s.text));
  const bad = salesVoiceInboundState({ numbers: ["+1", "+2"], anyLive: true, misconfigured: 1 });
  ok("a misconfigured number is the ONLY thing that produces a warning line", /1 number is misconfigured/.test(bad.warning) && /1 is not pointed here/.test(bad.text));
  const unk = salesVoiceInboundState({ numbers: ["+1"], anyLive: true, misconfigured: null, configUnknown: true });
  ok("configuration not checked is said, and warns about nothing", /not checked/.test(unk.text) && unk.warning === null);
  const empty = salesVoiceInboundState({ numbers: ["+1"], anyLive: false, misconfigured: 0 });
  ok("an empty floor still says where the call goes", empty.state === "floor_empty" && /voicemail/.test(empty.text));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Wiring — the properties that cannot be executed here");

{
  const panel = decomment(read("app/components/sales/CallPanel.js"));
  ok("the autodialler's press is tagged as one on the wire", /place\("browser", "autodial"\)\.then/.test(panel) && /source,\s*\}\),/.test(panel));
  const route = decomment(read("app/api/sales/calls/route.js"));
  ok("the dial route accepts exactly two source words and stores null otherwise", /body\.source === "autodial" \|\| body\.source === "manual" \? body\.source : null/.test(route) && /dialSource: source/.test(route));
  const store = decomment(read("lib/sales/calls/store.js"));
  ok("recordDial writes dialSource with the same two-word rule", /dialSource: dialSource === "autodial" \|\| dialSource === "manual" \? dialSource : null/.test(store));
  const schema = read("prisma/schema.prisma");
  ok("the schema carries dialSource, providerPriceCheckedAt and PlatformCostDaily", /dialSource String\?/.test(schema) && /providerPriceCheckedAt DateTime\?/.test(schema) && /model PlatformCostDaily/.test(schema) && /@@unique\(\[day, provider, category\]\)/.test(schema));
  const cron = decomment(read("app/api/cron/sales-pipeline/route.js"));
  ok("the every-minute cron reconciles carrier prices and pulls Twilio usage when stale", /reconcileCarrierPrices\(\{/.test(cron) && /pullTwilioUsageIfStale\(\{/.test(cron));
  const board = decomment(read("lib/sales/calls/floorBoard.js"));
  ok("the board reads costs only when asked, and the platform route asks", /withCosts = false/.test(board) && /withCosts: true/.test(decomment(read("app/api/platform/sales/floor/route.js"))));
  ok("…and the agency route does not", !/withCosts/.test(decomment(read("app/api/sales/agency/floor/route.js"))));
  const page = decomment(read("app/platform/sales/floor/page.js"));
  ok("the floor page prints the dialler, the three rates and cost per conversation with its definition", /Today&rsquo;s dialler/.test(page) && /Three answers/.test(page) && /Cost per conversation, today/.test(page) && /data\.cost\.definition/.test(page));
  ok("…and the per-number table is gone from it, replaced by a link", !/Voice webhook host/.test(page) && /Number configuration →/.test(page) && !/Regional tab/.test(page));
  const crew = decomment(read("app/platform/crew-lines/page.js"));
  ok("the table lives on crew-lines under the anchor the link points at", /id="sales-number-configuration"/.test(crew) && /salesNumberConfig/.test(decomment(read("app/api/platform/crew-lines/route.js"))));
  const sidebar = decomment(read("app/components/platform/PlatformSidebar.js"));
  ok("/platform/costs is in the sidebar", /href: "\/platform\/costs"/.test(sidebar));
  const costsRoute = decomment(read("app/api/platform/costs/route.js"));
  ok("the costs API is superadmin-only on GET and POST", (costsRoute.match(/admin\.role !== "superadmin"/g) || []).length >= 1 && /async function gate/.test(costsRoute) && /await gate\(request\)/.test(costsRoute));
  const summary = decomment(read("lib/platform/costs/summary.js"));
  ok("the summary excludes test dials in SQL and counts contractor words in SQL (the shared fragment)", /TEST_DIAL_SQL_EXCLUSION/.test(summary) && /\$\{CONTRACTOR_WORDS_SQL\}/.test(summary) && /seg->>'speaker' = 'contractor'/.test(read("lib/sales/calls/contractorWordsSql.js")));
  ok("every block of the summary carries a source and an as-of", (summary.match(/source: /g) || []).length >= 5 && (summary.match(/asOf: /g) || []).length >= 5);
  const pkg = JSON.parse(read("package.json"));
  ok("the script is registered and in check:all", typeof pkg.scripts["check:sales-costs"] === "string" && /check:sales-costs/.test(pkg.scripts["check:all"]));
}

// ── Sales side, tenant side ────────────────────────────────────────────────
{
  const summary = {
    lines: [
      { category: "calls-outbound", cents: 1000, count: 40 },
      { category: "recordings", cents: 100, count: 40 },
      { category: "sms-outbound", cents: 400, count: 100 },
      { category: "sms-inbound", cents: 50, count: 10 },
      { category: "phonenumbers", cents: 600, count: 6 },
      { category: "lookups", cents: 30, count: 3 },
    ],
    linesCents: 2180,
    totalCents: 2200,
    otherCents: 20,
  };
  const split = splitTwilioSides(summary, { salesSmsOut: 25, salesSmsIn: 10, salesNumbers: 4, tenantNumbers: 2 });
  ok("calls and recordings are the sales floor's entirely", split.sales.lines.find((l) => l.category === "calls-outbound").cents === 1000 && split.tenants.lines.find((l) => l.category === "calls-outbound").cents === 0);
  ok("texts out split by count: 25 of Twilio's 100 are sales", split.sales.lines.find((l) => l.category === "sms-outbound").cents === 100 && split.tenants.lines.find((l) => l.category === "sms-outbound").cents === 300);
  ok("texts in: all ten are sales, so nothing for tenants", split.tenants.lines.find((l) => l.category === "sms-inbound").cents === 0);
  ok("number rent by numbers held: 4 of 6", split.sales.lines.find((l) => l.category === "phonenumbers").cents === 400 && split.tenants.lines.find((l) => l.category === "phonenumbers").cents === 200);
  ok("a category the split does not name, and Twilio's 'other', are not attributed", split.unattributed.lines.map((l) => l.category).sort().join(",") === "lookups,other" && split.unattributed.cents === 50);
  ok("the three sides add up to Twilio's total", Math.round((split.sales.cents + split.tenants.cents + split.unattributed.cents) * 100) / 100 === 2200, [split.sales.cents, split.tenants.cents, split.unattributed.cents]);
  const blind = splitTwilioSides(summary, { salesSmsOut: null, salesSmsIn: 10, salesNumbers: null, tenantNumbers: null });
  ok("with no count to split by, texts and rent are left unattributed rather than guessed", blind.unattributed.lines.some((l) => l.category === "sms-outbound") && blind.unattributed.lines.some((l) => l.category === "phonenumbers"));
  const over = splitTwilioSides({ lines: [{ category: "sms-outbound", cents: 100, count: 10 }], otherCents: null }, { salesSmsOut: 50 });
  ok("more store texts than Twilio counted caps the sales share at all of it", over.sales.cents === 100 && over.tenants.cents === 0);
  ok("the sales-only list has no sms and no phonenumbers in it", !TWILIO_SALES_ONLY_CATEGORIES.some((c) => /sms|phonenumbers/.test(c)));
  ok("the split explains its method in words", /never spread/.test(split.method));

  const { retellRent, RETELL_NUMBER_RENT_CENTS_PER_MONTH } = await import("@/lib/platform/costs/summary");
  ok("Retell's list price is US$2.00 a number a month", RETELL_NUMBER_RENT_CENTS_PER_MONTH === 200);
  const month = retellRent(5, new Date("2026-09-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z"));
  ok("five numbers for thirty days is about US$10 (prorated over an average month)", month.monthlyCents === 1000 && Math.abs(month.cents - 985.6) < 1, month);
  ok("…and the statement names the source and that it is not the invoice", /retellai\.com\/pricing/.test(month.statement) && /not Retell's invoice/.test(month.statement));
  ok("an unknown count is an unknown rent, never zero", retellRent(null, new Date(), new Date()).cents === null);
  const page = read("app/platform/costs/page.js");
  ok("the page prints the rent figure and the two Twilio sides", /data\.retell\.rent\.cents === null \? UNKNOWN : money\(data\.retell\.rent\.cents\)/.test(page) && /data-twilio-sides/.test(page) && /sides\.tenants\.cents/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The carrier's stopwatch — picked up, and reported vs measured");
{
  ok("the thresholds are stated: twenty seconds, a minute", PICKUP_MIN_SECONDS === 20 && CONVERSATION_MIN_SECONDS === 60);
  const leg = (talkSeconds, extra = {}) => ({ dialChannel: "browser", direction: "out", providerStatus: "completed", talkSeconds, answeredAt: T0, ...extra });
  ok("a no-answer leg is 'unanswered'", pickupBand({ dialChannel: "browser", providerStatus: "no-answer", talkSeconds: 0 }) === "unanswered");
  ok("a handset dial is unmeasured — null, never a band", pickupBand({ dialChannel: "handset", disposition: "reached" }) === null);
  ok("a bridge with no final signal is unmeasured too", pickupBand({ dialChannel: "browser" }) === null);
  ok("the bands: 12 s under, 45 s between, 60 s over", pickupBand(leg(12)) === "under20" && pickupBand(leg(45)) === "band20to60" && pickupBand(leg(60)) === "over60" && pickupBand(leg(19)) === "under20" && pickupBand(leg(20)) === "band20to60");
  ok("a 45-second call with no transcript is not a conversation, by the clock", JSON.stringify(measuredConversation(leg(45))) === '{"talked":false,"basis":"duration"}');
  ok("a 90-second call with no transcript is one, by the clock", JSON.stringify(measuredConversation(leg(90))) === '{"talked":true,"basis":"duration"}');
  ok("a 45-second call whose transcript has 20 contractor words IS one — the transcript replaces the clock", JSON.stringify(measuredConversation(leg(45, { transcript: [say("contractor", 20)] }))) === '{"talked":true,"basis":"transcript"}');
  ok("a 90-second call whose contractor said 3 words is NOT one — the clock is the stand-in, not the rule", JSON.stringify(measuredConversation(leg(90, { transcript: [say("contractor", 3)] }))) === '{"talked":false,"basis":"transcript"}');
  ok("…and the SQL-counted words are honoured the same way", measuredConversation(leg(90, { contractorWords: 3 })).talked === false);

  // The owner's hand count, reproduced: 135 legs → 22 / 13 / 72 / 28.
  const hand = [
    ...Array.from({ length: 22 }, () => ({ dialChannel: "browser", direction: "out", providerStatus: "no-answer", talkSeconds: 0, disposition: "no_answer" })),
    ...Array.from({ length: 13 }, () => leg(10, { disposition: "no_answer" })),
    ...Array.from({ length: 72 }, (_, i) => leg(40, { disposition: i < 40 ? "reached_not_interested" : "voicemail" })),
    ...Array.from({ length: 28 }, (_, i) => leg(120, { disposition: i < 19 ? "reached_interested" : "callback" })),
    { dialChannel: "handset", direction: "out", disposition: "reached" },
  ];
  const f = pickupFigures(hand, { reported: { reached: 59, logged: 135 } });
  ok("135 measured legs, the handset dial not among them", f.legs === 135 && f.bands.unanswered === 22 && f.bands.under20 === 13 && f.bands.band20to60 === 72 && f.bands.over60 === 28, f.bands);
  ok("picked up = 100 of 135 = 74.1%", f.pickedUp.hit === 100 && f.pickedUp.sampleSize === 135 && f.pickedUp.value === 74.1, f.pickedUp);
  ok("conversation = 28 of 135 = 20.7%, all from the clock", f.conversation.hit === 28 && f.conversation.value === 20.7 && f.fromDuration === 135 && f.fromTranscript === 0, f.conversation);
  ok("reported = 59 of 135 = 43.7%, and the gap is +23 whole points", f.reported.value === 43.7 && f.overMarkedPoints === 23, { reported: f.reported, gap: f.overMarkedPoints });
  ok("under the floor the gap is null, not zero", pickupFigures(hand.slice(0, 3), { reported: { reached: 1, logged: 3 } }).overMarkedPoints === null);
  ok("no rows is zero legs and null rates", pickupFigures([]).legs === 0 && pickupFigures(null).pickedUp.value === null);

  // repCallStats carries it, over PLACED calls, with the rep's reach over the same rows.
  const stats = repCallStats({ attempts: [...hand.slice(0, 5), { dialChannel: "browser", direction: "in", providerStatus: "completed", talkSeconds: 300, answeredAt: T0, disposition: "reached" }], from: null, to: null });
  ok("repCallStats.pickup is over placed calls only — the inbound conversation is not in it", stats.pickup.legs === 5 && stats.pickup.bands.unanswered === 5, stats.pickup);
  ok("…and its `reported` is the disposition mix of those same MEASURED placed calls", stats.pickup.reported === null || stats.pickup.reported.sampleSize === 5);

  // The word count leaves the database as a number, split on whitespace — not on the letter s.
  ok("the SQL fragment splits words on whitespace", /regexp_split_to_array\(trim\(seg->>'text'\), '\\s\+'\)/.test(CONTRACTOR_WORDS_SQL.strings.join("")) , CONTRACTOR_WORDS_SQL.strings.join("").slice(0, 200));
  ok("…and the costs summary uses it rather than an inline copy", /\$\{CONTRACTOR_WORDS_SQL\} AS "contractorWords"/.test(read("lib/platform/costs/summary.js")) && !/regexp_split_to_array/.test(read("lib/platform/costs/summary.js")));
  ok("the performance loader selects what wasConnected() reads, and attaches the SQL word count", /providerStatus: true,\s*endReason: true,\s*endedAt: true/.test(read("lib/sales/performanceLoad.js")) && /contractorWordCounts\(\{ ids/.test(read("lib/sales/performanceLoad.js")));
  const comp = read("app/components/sales/CallPerformanceSections.js");
  ok("the shared component draws the section, with the bands and the gap", /data-performance-pickup/.test(comp) && /overMarkedPoints/.test(comp) && /bandBetween\(p\.pickupMinSeconds, p\.conversationMinSeconds\)/.test(comp));
  for (const page of ["app/platform/sales/performance/page.js", "app/sales/agency/performance/page.js"]) {
    const src = read(page);
    ok(`${page} hands the component every pickup label`, ["pickupHeading", "pickupIntro", "prospectLegs", "pickedUp", "conversationMeasured", "reportedVsMeasured", "bands", "points", "conversationBasis", "bandUnanswered", "bandUnder", "bandBetween", "bandOver", "pickupLegend"].every((k) => new RegExp(`\\b${k}:`).test(src)));
  }
  ok("the legend says where voicemail sits", /20–60/.test(read("app/platform/sales/performance/page.js")) && /Voicemail pickups sit in the 20–60 second band/.test(read("app/platform/sales/performance/page.js")));
  ok("answering-machine detection is off, and the legend says why", /billed per call/.test(read("app/platform/sales/performance/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
