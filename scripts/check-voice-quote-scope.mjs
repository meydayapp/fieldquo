// scripts/check-voice-quote-scope.mjs
//
//   npm run check:voice-quote-scope
//
// WHICH quotes the assistant rings about, why the ones it skipped were skipped,
// and that widening the scope widened exactly one thing.
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// An owner turned "Call clients back automatically" on, wrote a quote, sent it,
// and never got a call. The card said "It's calling clients — turn off" over
// "No calls waiting". Both true. The gate refused every quote he had ever
// written, because it only ever covered instant estimates, and nothing on the
// screen could say so.
//
// So this asserts three separate things, and the third is the one that would
// have caught it:
//
//   1. The scope is a company CHOICE and its default is the OLD behaviour.
//   2. Widening it changes the scope and nothing else — every compliance gate
//      still refuses on its own.
//   3. Every refusal the gate can return has a sentence, in every language,
//      reachable by the card. A code with no copy is the silent dead end again.
import { readFileSync } from "node:fs";
import {
  QUOTE_CALL_SCOPES,
  QUOTE_CALL_SCOPE_VALUES,
  DEFAULT_QUOTE_CALL_SCOPE,
  normaliseQuoteCallScope,
  CALLBACK_REFUSED,
  callbackReasonKey,
  scopeLabelKey,
  scopeHintKey,
  CALLBACK_REASON_TEXT,
  SCOPE_LABEL_TEXT,
  SCOPE_HINT_TEXT,
} from "@/lib/voice/quoteCallScope";
import { approvedQuoteCallGate } from "@/lib/voice/triggers";
import { summariseQuoteCallbacks, REPORT_ROWS } from "@/lib/voice/quoteCallbackReport";
import { consentVerdict } from "@/lib/voice/outbound";
import { spokenTotal, buildOutboundPrompt } from "@/lib/voice/outboundPrompt";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let pass = 0, fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

/* ───────────────────────── 1. the scope itself ───────────────────────── */

console.log("\nThe scope is a choice, and its default is what already shipped");

ok(
  "default is instant estimates — the narrow rule, not the new wide one",
  DEFAULT_QUOTE_CALL_SCOPE === QUOTE_CALL_SCOPES.INSTANT,
  DEFAULT_QUOTE_CALL_SCOPE,
);
ok("three options, no more", QUOTE_CALL_SCOPE_VALUES.length === 3, QUOTE_CALL_SCOPE_VALUES);
for (const v of QUOTE_CALL_SCOPE_VALUES) ok(`"${v}" round-trips`, normaliseQuoteCallScope(v) === v);
for (const junk of [null, undefined, "", "ALL_QUOTES", "everything", 0, {}, ["all_quotes"]]) {
  ok(
    `${JSON.stringify(junk)} falls back to the narrow default, never the wide one`,
    normaliseQuoteCallScope(junk) === QUOTE_CALL_SCOPES.INSTANT,
    normaliseQuoteCallScope(junk),
  );
}

/* ───────────────────────── 2. the gate ───────────────────────────────── */

console.log("\nA hand-typed quote: refused by default, allowed once widened");

const handTyped = {
  id: "q_hand",
  quoteNumber: "Q-2026-0011",
  status: "sent",
  autoEstimated: false,
  needsReview: false,
  sentAt: new Date("2026-08-20T10:00:00Z"),
  company: { outboundCallsEnabled: true },
  client: { phone: "+16135550123", name: "Sam Rivera" },
};
const withScope = (q, scope) => ({ ...q, company: { ...q.company, outboundQuoteCallScope: scope } });

const defaulted = approvedQuoteCallGate(handTyped);
ok(
  "no scope stored → refused, and the reason is the gate's own code",
  defaulted.allowed === false && defaulted.reason === CALLBACK_REFUSED.NOT_ESTIMATE,
  defaulted,
);
ok(
  "explicit instant_estimates → same refusal (the column agrees with the absence)",
  approvedQuoteCallGate(withScope(handTyped, QUOTE_CALL_SCOPES.INSTANT)).reason ===
    CALLBACK_REFUSED.NOT_ESTIMATE,
);
ok(
  "all_quotes → ALLOWED. This is the thing the owner asked for",
  approvedQuoteCallGate(withScope(handTyped, QUOTE_CALL_SCOPES.ALL)).allowed === true,
  approvedQuoteCallGate(withScope(handTyped, QUOTE_CALL_SCOPES.ALL)),
);
ok(
  "off → refused with its own code, not NOT_ESTIMATE",
  approvedQuoteCallGate(withScope(handTyped, QUOTE_CALL_SCOPES.OFF)).reason ===
    CALLBACK_REFUSED.SCOPE_OFF,
);

console.log("\nAn instant estimate is unaffected by the new setting…");
const instant = { ...handTyped, id: "q_inst", quoteNumber: "Q-2026-0012", autoEstimated: true };
ok("…allowed with no scope stored", approvedQuoteCallGate(instant).allowed === true);
ok("…allowed under instant_estimates", approvedQuoteCallGate(withScope(instant, QUOTE_CALL_SCOPES.INSTANT)).allowed === true);
ok("…allowed under all_quotes", approvedQuoteCallGate(withScope(instant, QUOTE_CALL_SCOPES.ALL)).allowed === true);
ok("…and off means off, even for it", approvedQuoteCallGate(withScope(instant, QUOTE_CALL_SCOPES.OFF)).allowed === false);

console.log("\nWidening the scope widened ONE thing — every other refusal survives");
const stillRefused = [
  ["a quote the client turned down", { ...handTyped, status: "declined" }, CALLBACK_REFUSED.DECLINED],
  ["a draft nobody approved", { ...handTyped, needsReview: true }, CALLBACK_REFUSED.DRAFT],
  ["never emailed", { ...handTyped, sentAt: null }, CALLBACK_REFUSED.NOT_EMAILED],
  ["no phone number", { ...handTyped, client: { name: "Sam" } }, CALLBACK_REFUSED.NO_PHONE],
  ["outbound switched off", { ...handTyped, company: { outboundCallsEnabled: false } }, CALLBACK_REFUSED.OFF],
];
for (const [what, quote, reason] of stillRefused) {
  const v = approvedQuoteCallGate(withScope(quote, QUOTE_CALL_SCOPES.ALL));
  ok(`under all_quotes, still refused — ${what} (${v.reason})`, v.allowed === false && v.reason === reason, v);
}
ok("no quote at all", approvedQuoteCallGate(null).reason === CALLBACK_REFUSED.NO_QUOTE);
ok(
  "the company switch beats the scope — off + all_quotes is still off",
  approvedQuoteCallGate({
    ...handTyped,
    company: { outboundCallsEnabled: false, outboundQuoteCallScope: QUOTE_CALL_SCOPES.ALL },
  }).reason === CALLBACK_REFUSED.OFF,
);
ok(
  "a declined instant estimate is refused too — the anti-badger rule isn't scoped",
  approvedQuoteCallGate({ ...instant, status: "declined" }).reason === CALLBACK_REFUSED.DECLINED,
);

/* ─────────────────── 3. the card can say every refusal ────────────────── */

console.log("\nEvery refusal the gate can return has a sentence, in every language");

const LANGS = ["en", "fr", "es", "uk", "pa", "tl"];
for (const code of Object.values(CALLBACK_REFUSED)) {
  const key = callbackReasonKey(code);
  ok(`${code.padEnd(18)} has an English fallback in quoteCallScope.js`, Boolean(CALLBACK_REASON_TEXT[key]), key);
  const missing = LANGS.filter((l) => !(key in (APP_MESSAGES[l] || {})));
  ok(`${code.padEnd(18)} translated in all ${LANGS.length}`, missing.length === 0, missing);
}
for (const scope of QUOTE_CALL_SCOPE_VALUES) {
  const lk = scopeLabelKey(scope);
  const hk = scopeHintKey(scope);
  ok(`${scope.padEnd(18)} has a name and an explanation`, Boolean(SCOPE_LABEL_TEXT[lk] && SCOPE_HINT_TEXT[hk]));
  const missing = LANGS.filter((l) => !(lk in (APP_MESSAGES[l] || {})) || !(hk in (APP_MESSAGES[l] || {})));
  ok(`${scope.padEnd(18)} translated in all ${LANGS.length}`, missing.length === 0, missing);
}

console.log("\n…and the card can import that table without dragging Prisma into the browser");
const scopeSrc = readFileSync(new URL("../lib/voice/quoteCallScope.js", import.meta.url), "utf8");
ok("lib/voice/quoteCallScope.js has NO imports", !/^import /m.test(scopeSrc));
const pageSrc = readFileSync(
  new URL("../app/app/settings/voice/page.js", import.meta.url),
  "utf8",
);
ok("the settings page reads the codes from it", /from "@\/lib\/voice\/quoteCallScope"/.test(pageSrc));
ok(
  "…and does NOT import the gate module, which reaches the database",
  !/from "@\/lib\/voice\/triggers"/.test(pageSrc),
);
ok(
  "the old dead sentence is gone from the catalogue",
  !/The next approved quote will queue one/.test(
    JSON.stringify(APP_MESSAGES.en) + JSON.stringify(APP_MESSAGES.fr),
  ),
);
// The card used to say the call happens "when you approve their quote". It
// happens on the SEND — onQuoteApproved queues nothing on its own, because
// until the client is holding the document there is no figure the agent may
// read back. Under "every quote I send" there is no approval step at all.
ok(
  "the card describes the moment that actually queues the call: the send",
  /after you send them a quote/.test(APP_MESSAGES.en["app.setVoice.outboundHint"]) &&
    !/when you approve/.test(APP_MESSAGES.en["app.setVoice.outboundHint"]),
  APP_MESSAGES.en["app.setVoice.outboundHint"],
);
ok(
  "…and the trigger really does queue from the send, not the approval",
  /export async function onQuoteEmailed/.test(
    readFileSync(new URL("../lib/voice/triggers.js", import.meta.url), "utf8"),
  ),
);

/* ───────────────────── 4. what the card actually says ─────────────────── */

console.log("\nThe report names the quotes that weren't called, in the gate's words");

const goodConsent = { source: "quote_approved", createdAt: new Date("2026-08-01T00:00:00Z") };
const now = new Date("2026-08-24T15:00:00Z");
const standingOk = { "+16135550123": { optedOut: false, consents: [goodConsent] } };

const threeHandTyped = [0, 1, 2].map((i) => ({
  ...handTyped,
  id: `q${i}`,
  quoteNumber: `Q-2026-001${i}`,
}));

const r1 = summariseQuoteCallbacks({ quotes: threeHandTyped, standing: standingOk, now });
ok("three sent quotes considered", r1.considered === 3, r1);
ok("none queued, none called", r1.queued === 0 && r1.called === 0, r1);
ok("the headline is the gate's code and the real count", r1.headline?.reason === CALLBACK_REFUSED.NOT_ESTIMATE && r1.headline.count === 3, r1.headline);
ok("each row names the quote", r1.refusals.every((x) => x.quoteNumber && x.reason), r1.refusals);
ok(
  "every reason is a code the gate can actually return — no invented wording",
  r1.refusals.every((x) => Object.values(CALLBACK_REFUSED).includes(x.reason)),
  r1.refusals,
);

console.log("\n…and once the scope is widened, those same quotes stop being refusals");
const widened = threeHandTyped.map((q) => withScope(q, QUOTE_CALL_SCOPES.ALL));
const r2 = summariseQuoteCallbacks({ quotes: widened, standing: standingOk, now });
ok("nothing refused any more", r2.refusals.length === 0 && r2.headline === null, r2);

console.log("\nA quote with a task is the feature WORKING, not a refusal");
const r3 = summariseQuoteCallbacks({
  quotes: widened,
  taskByQuote: { q0: "queued", q1: "done" },
  standing: standingOk,
  now,
});
ok("one queued, one called, nothing refused", r3.queued === 1 && r3.called === 1 && r3.refusals.length === 0, r3);

console.log("\nConsent is the NEXT wall, so the card names it rather than promising a call");
const r4 = summariseQuoteCallbacks({ quotes: widened, standing: {}, now });
ok("no consent row → NO_CONSENT, not silence", r4.headline?.reason === CALLBACK_REFUSED.NO_CONSENT, r4);
const r5 = summariseQuoteCallbacks({
  quotes: widened,
  standing: { "+16135550123": { optedOut: true, consents: [goodConsent] } },
  now,
});
ok("a stop-listed number → NO_CONSENT", r5.headline?.reason === CALLBACK_REFUSED.NO_CONSENT, r5);
const r6 = summariseQuoteCallbacks({
  quotes: widened,
  standing: {
    "+16135550123": {
      optedOut: false,
      // quote_approved consent lasts 12 months — this one is two years old.
      consents: [{ source: "quote_approved", createdAt: new Date("2024-06-01T00:00:00Z") }],
    },
  },
  now,
});
ok("an expired consent → NO_CONSENT", r6.headline?.reason === CALLBACK_REFUSED.NO_CONSENT, r6);
ok(
  "a quote with NO phone reports the phone, not the consent — fix the right thing",
  summariseQuoteCallbacks({
    quotes: [withScope({ ...handTyped, client: { name: "Sam" } }, QUOTE_CALL_SCOPES.ALL)],
    standing: {},
    now,
  }).headline?.reason === CALLBACK_REFUSED.NO_PHONE,
);

console.log("\nThe list is capped for the screen; the headline still counts them all");
const many = Array.from({ length: REPORT_ROWS + 3 }, (_, i) => ({
  ...handTyped,
  id: `m${i}`,
  quoteNumber: `Q-M-${i}`,
}));
const r7 = summariseQuoteCallbacks({ quotes: many, standing: standingOk, now });
ok(`lists at most ${REPORT_ROWS}`, r7.refusals.length === REPORT_ROWS, r7.refusals.length);
ok("counts the rest", r7.moreRefusals === 3, r7.moreRefusals);
ok("the headline counts every one", r7.headline.count === REPORT_ROWS + 3, r7.headline);

console.log("\nMixed reasons: the headline is the one that blocks the most");
const mixed = [
  withScope({ ...handTyped, id: "a", quoteNumber: "Q-A", client: { name: "No Phone" } }, QUOTE_CALL_SCOPES.ALL),
  { ...handTyped, id: "b", quoteNumber: "Q-B" },
  { ...handTyped, id: "c", quoteNumber: "Q-C" },
];
const r8 = summariseQuoteCallbacks({ quotes: mixed, standing: standingOk, now });
ok("two not-an-estimate beats one no-phone", r8.headline.reason === CALLBACK_REFUSED.NOT_ESTIMATE && r8.headline.count === 2, r8.headline);
ok("nothing sent recently → nothing claimed", summariseQuoteCallbacks({ quotes: [] }).headline === null);

/* ─────────────── 5. every dial-time gate still refuses alone ──────────── */

console.log("\nWidening the scope did not open a door past any dial-time gate");

const at = (h, tz = "America/Toronto") => {
  const d = new Date(Date.UTC(2026, 6, 15, 12));
  const offset =
    Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hour12: false, timeZone: tz }).format(d)) - 12;
  return new Date(Date.UTC(2026, 6, 15, h - offset));
};
const fresh = [{ source: "quote_approved", createdAt: new Date("2026-07-01T00:00:00Z") }];
const tz = "America/Toronto";

ok("a live consent at 1pm → allowed", consentVerdict({ optedOut: null, consents: fresh, now: at(13), timeZone: tz }).allowed === true);
ok("stop list beats everything", consentVerdict({ optedOut: { optedOutAt: new Date() }, consents: fresh, now: at(13), timeZone: tz }).allowed === false);
ok("no consent row refuses", consentVerdict({ optedOut: null, consents: [], now: at(13), timeZone: tz }).allowed === false);
ok(
  "an expired consent refuses",
  consentVerdict({
    optedOut: null,
    consents: [{ source: "quote_approved", createdAt: new Date("2024-01-01T00:00:00Z") }],
    now: at(13),
    timeZone: tz,
  }).allowed === false,
);
const late = consentVerdict({ optedOut: null, consents: fresh, now: at(22), timeZone: tz });
ok("ten at night refuses, and says try later", late.allowed === false && late.retryLater === true, late);

const placeSrc = readFileSync(new URL("../lib/voice/outboundCall.js", import.meta.url), "utf8");
for (const [what, re] of [
  ["the platform's own feature gate", /featureAllowsSpend\(/],
  ["the contractor's outbound switch, re-read at dial time", /company\.outboundCallsEnabled/],
  ["consent + calling hours", /await mayCall\(/],
  ["credit, priced against the number dialled FROM", /canTakeCall\(task\.companyId, number\.numberType\)/],
  ["the quote, re-read at dial time", /await quoteStateNow\(task\)/],
]) {
  ok(`placeQueuedCall still checks ${what}`, re.test(placeSrc));
}
ok(
  "…and none of them consults the scope — the scope decides QUEUEING, never dialling",
  !/outboundQuoteCallScope/.test(placeSrc),
);
ok(
  "a quote declined between the send and the dial is refused at dial time too",
  /status === "declined"/.test(placeSrc),
);

/* ────────────── 6. the figure only travels while it still matches ─────── */

console.log("\nThe brief carries the figure only while it matches what was emailed");

const emailed = spokenTotal(14410, "CAD");
ok(`the queued figure is one string: ${emailed}`, typeof emailed === "string" && /14,410/.test(emailed));
ok("the same amount formats identically at dial time", spokenTotal(14410, "CAD") === emailed);
ok("cents below the rounding line don't move it", spokenTotal(14410.49, "CAD") === emailed);
ok("cents above it DO — and a moved figure is a dropped figure", spokenTotal(14410.51, "CAD") !== emailed);
ok("an edited total no longer matches", spokenTotal(15200, "CAD") !== emailed);
ok("a zero or nonsense total is never spoken", spokenTotal(0) === null && spokenTotal("abc") === null && spokenTotal(-5) === null);

// quoteStateNow returns { quoteTotal: undefined } — an explicit key, not an
// omission — precisely so this spread ERASES a stale figure. Executed rather
// than read, because "spreading undefined over a value clears it" is the whole
// mechanism and it is easy to break by returning {} instead.
const base = { companyName: "Northside Painting", customerName: "Sam", quoteTotal: emailed, serviceSummary: "interior repaint" };
const stillMatches = { ...base, ...{} };
const moved = { ...base, ...{ quoteTotal: undefined } };
ok("unchanged quote → the figure survives the merge", stillMatches.quoteTotal === emailed);
ok("changed quote → the figure is erased by the merge", moved.quoteTotal === undefined);

const briefWith = buildOutboundPrompt({ purpose: "quote_approved", context: stillMatches });
const briefWithout = buildOutboundPrompt({ purpose: "quote_approved", context: moved });
ok("the agent is told the total…", briefWith.prompt.includes(emailed));
ok("…that they already have it in writing", /already been emailed this quote/i.test(briefWith.prompt));
ok("…and that it may be read back but never changed", /read that figure back/i.test(briefWith.prompt) && /may NOT change it/i.test(briefWith.prompt));
ok("…and the scope of work reaches the brief", /interior repaint/.test(briefWith.prompt));
ok("…and it may not promise a date", /NEVER promise a date or time/i.test(briefWith.prompt));
ok("a moved figure means NO figure in the brief", !/\$\d/.test(briefWithout.prompt), briefWithout.prompt.match(/\$\S+/g));
ok("…and the agent is told not to guess one", /do not have the quote figure|do not guess/i.test(briefWithout.prompt));

const quoteSrc = readFileSync(new URL("../lib/voice/outboundCall.js", import.meta.url), "utf8");
ok("one formatter on both sides of the comparison", /const live = spokenTotal\(/.test(quoteSrc) && /live === queued/.test(quoteSrc));

/* ──────────────── 7. one call per quote, ever ─────────────────────────── */
//
// Executed, not asserted about. "A re-sent quote must not ring twice" is a
// property of a de-dupe QUERY — whether it filters on status — and there is no
// honest way to read that off the source. `@/lib/db` is the scriptable stub
// (see scripts/db-stub-hooks.mjs), so this drives the shipped triggers.

console.log("\nOne call per quote, ever — including a quote sent twice");

const { onQuoteEmailed } = await import("@/lib/voice/triggers");
const { enqueueOutbound } = await import("@/lib/voice/outboundCall");
const { rows, resetDbStub } = await import("./fixtures/dbStub.mjs");

// Postgres fills `status` from the column default; the stub records only what
// the product passed. Applying the default here keeps the de-dupe query being
// tested against the rows it would really see.
const applyDefaults = () => {
  for (const t of rows.voiceCallTask) if (!t.status) t.status = "queued";
};

resetDbStub();
rows.quote = [
  {
    id: "q_hand",
    companyId: "co1",
    clientId: "cl1",
    status: "sent",
    total: 14410,
    lineItems: [{ name: "Interior repaint" }],
    autoEstimated: false,
    needsReview: false,
    sentAt: new Date("2026-08-20T10:00:00Z"),
    company: {
      name: "Northside Painting",
      currency: "CAD",
      outboundCallsEnabled: true,
      outboundQuoteCallScope: QUOTE_CALL_SCOPES.ALL,
    },
    client: { phone: "+16135550123" },
  },
];

await onQuoteEmailed("q_hand");
applyDefaults();
ok("sending a hand-typed quote under all_quotes queues a call", rows.voiceCallTask.length === 1, rows.voiceCallTask.length);
ok(
  "…and the queued task carries the figure the client was emailed",
  rows.voiceCallTask[0]?.context?.quoteTotal === spokenTotal(14410, "CAD"),
  rows.voiceCallTask[0]?.context,
);
ok(
  "…and what the work is",
  rows.voiceCallTask[0]?.context?.serviceSummary === "Interior repaint",
  rows.voiceCallTask[0]?.context,
);

await onQuoteEmailed("q_hand");
applyDefaults();
ok("sending it again while the call is still queued adds nothing", rows.voiceCallTask.length === 1, rows.voiceCallTask.length);

// The call goes out. THIS is where it used to break: the live-only de-dupe saw
// no queued task and a re-send queued a second call to the same customer.
rows.voiceCallTask[0].status = "done";
await onQuoteEmailed("q_hand");
applyDefaults();
ok("re-sending AFTER the call went out still adds nothing", rows.voiceCallTask.length === 1, rows.voiceCallTask.length);

rows.voiceCallTask[0].status = "skipped";
await onQuoteEmailed("q_hand");
applyDefaults();
ok("a skipped task is not a licence to try again either", rows.voiceCallTask.length === 1, rows.voiceCallTask.length);

console.log("\n…and the narrowing is deliberate: without `once`, a done task does not block");
resetDbStub();
await enqueueOutbound({ companyId: "co1", purpose: "appointment_reminder", bookingId: "b1" });
applyDefaults();
rows.voiceCallTask[0].status = "done";
await enqueueOutbound({ companyId: "co1", purpose: "appointment_reminder", bookingId: "b1" });
applyDefaults();
ok(
  "a rescheduled visit can still be reminded a second time",
  rows.voiceCallTask.length === 2,
  rows.voiceCallTask.length,
);

console.log("\nThe scope is still read at queue time, from the company row");
resetDbStub();
rows.quote = [
  {
    id: "q_narrow",
    companyId: "co1",
    clientId: "cl1",
    status: "sent",
    total: 900,
    lineItems: [],
    autoEstimated: false,
    needsReview: false,
    sentAt: new Date("2026-08-20T10:00:00Z"),
    company: { name: "Northside", currency: "CAD", outboundCallsEnabled: true, outboundQuoteCallScope: QUOTE_CALL_SCOPES.INSTANT },
    client: { phone: "+16135550123" },
  },
];
await onQuoteEmailed("q_narrow");
ok("the same quote under the default queues nothing at all", rows.voiceCallTask.length === 0, rows.voiceCallTask.length);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
