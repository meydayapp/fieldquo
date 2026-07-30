// scripts/check-voice.mjs
//
//   npm run check:voice
//
// The phone agent's number handling and billing arithmetic, executed.
//
// Two clusters here, and both are about money or a wrong number:
//
// The E.164 sweep exists because a provider webhook looks a number up by an
// EXACT string. A company typing "(833) 552-0182" into settings and the
// provider sending "+18335520182" is a call that arrives and matches nothing —
// the agent answers for no one, or doesn't answer at all.
//
// The billing assertions pin the rounding rules that get stated on the pricing
// screen: a 1-minute minimum, and round up to the whole minute. A rounding rule
// nobody was told about is the same thing as a hidden fee, so if these change,
// the copy has to change with them.
//
// `publicNumberFor` is the one that would embarrass the product: on a forwarded
// setup the company advertises THEIR number, and printing ours on their booking
// page would undo the entire reason they chose forwarding.

import { toE164, formatNumber, forwardingCodes, publicNumberFor, NUMBER_SOURCES, isSharedTestNumber } from "@/lib/voice/numbers";
import { costForSeconds, minutesFor, CENTS_PER_MINUTE, TOPUP_OPTIONS, LOW_BALANCE_CENTS,
         ratePerMinute, monthlyCentsFor, NUMBER_TYPES, normaliseTopup,
         CUSTOM_TOPUP_MIN_CENTS, CUSTOM_TOPUP_MAX_CENTS } from "@/lib/voice/credits";
import { voiceConfigured } from "@/lib/voice/retell";
let fail=0; const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m); if(!c)fail++;};

// ── E.164 normalisation. A webhook looks numbers up by this exact string. ──
const cases = [
  ["+18335520182","+18335520182"], ["8335520182","+18335520182"],
  ["(833) 552-0182","+18335520182"], ["833-552-0182","+18335520182"],
  ["1 833 552 0182","+18335520182"], ["+1 (833) 552-0182","+18335520182"],
  ["819-238-7263","+18192387263"], ["",null], [null,null], ["abc",null], ["123",null],
];
let clean = true;
for (const [input, want] of cases) {
  const got = toE164(input);
  if (got !== want) { clean=false; console.log(`   ✗ ${JSON.stringify(input)} → ${got}, wanted ${want}`); }
}
ok(clean, `${cases.length} number formats all normalise to the same E.164 (or null)`);
ok(formatNumber("+18335520182") === "(833) 552-0182", `formatNumber → ${formatNumber("+18335520182")}`);
ok(formatNumber("+442071234567") === "+442071234567", "a non-NANP number is shown as-is rather than mangled");

// ── Forwarding is the default and says so ─────────────────────────────────
const rec = NUMBER_SOURCES.filter(s=>s.recommended);
ok(rec.length===1 && rec[0].key==="forwarded", "exactly one path is recommended, and it's forwarding");
ok(NUMBER_SOURCES.every(s=>s.blurb && s.caveat), "every path states its downside, not just its pitch");
const port = NUMBER_SOURCES.find(s=>s.key==="ported");
ok(/two to four weeks/i.test(port.caveat), "porting names its real timeline");

const codes = forwardingCodes("+18335520182");
ok(codes.some(c=>c.code==="*61*+18335520182#"), "no-answer forwarding code is built for the target number");
ok(codes.some(c=>c.code==="##002#"), "a turn-it-all-off code is offered — reversibility is the selling point");

// ── The public number is THEIRS when forwarding ───────────────────────────
ok(publicNumberFor({source:"forwarded", e164:"+18335520182", publicNumber:"+18192387263"}) === "+18192387263",
   "a forwarded setup advertises the company's OWN number, not ours");
ok(publicNumberFor({source:"purchased", e164:"+18335520182"}) === "+18335520182",
   "a purchased number advertises itself");
ok(publicNumberFor(null) === null, "no number configured → null, not a crash");

// ── Billing arithmetic ────────────────────────────────────────────────────
ok(costForSeconds(0) === 0, "a call that never connected costs nothing");
ok(costForSeconds(3) === CENTS_PER_MINUTE, "a 3-second wrong number bills the 1-minute minimum");
ok(costForSeconds(60) === CENTS_PER_MINUTE, "exactly 60s is one minute, not two");
ok(costForSeconds(61) === CENTS_PER_MINUTE*2, "61s rounds up to two minutes");
ok(costForSeconds(-99) === 0 && Number.isFinite(costForSeconds("abc")), "negative and non-numeric durations can't bill");
ok(minutesFor(5000) === Math.floor(5000/CENTS_PER_MINUTE), `$50 buys ${minutesFor(5000)} minutes at ${CENTS_PER_MINUTE}¢/min`);
// The rate has to stay inside the band the pricing comment justifies. Drifting
// below cost or above the market is a decision, not something to discover from
// a margin report six months later.
ok(CENTS_PER_MINUTE >= 20 && CENTS_PER_MINUTE <= 45,
   `${CENTS_PER_MINUTE}¢/min sits between cost (~16¢) and the market`);

// ── Toll-free is a different product and must cost more, both ways ────────
ok(ratePerMinute("toll_free") > ratePerMinute("local"),
   `toll-free bills more per minute (${ratePerMinute("toll_free")}¢ vs ${ratePerMinute("local")}¢) — on toll-free WE pay the carrier leg`);
ok(monthlyCentsFor("toll_free") > monthlyCentsFor("local"),
   `toll-free rents for more ($${monthlyCentsFor("toll_free")/100} vs $${monthlyCentsFor("local")/100})`);
ok(ratePerMinute("nonsense") === ratePerMinute("local"),
   "an unknown number type falls back to local rather than billing NaN");
ok(monthlyCentsFor(undefined) === monthlyCentsFor("local"), "no type given → local rental");
ok(costForSeconds(120,"toll_free") > costForSeconds(120,"local"),
   `a 2-min toll-free call costs more (${costForSeconds(120,"toll_free")}¢ vs ${costForSeconds(120,"local")}¢)`);
ok(Object.values(NUMBER_TYPES).every(t=>t.label && t.hint && t.monthlyCents>0),
   `both number types are labelled and priced: ${Object.values(NUMBER_TYPES).map(t=>t.label).join(" / ")}`);

// ── We must stay under Jobber, our nearest comparable ────────────────────
// Jobber bills conversations: $0.79 each after the first 30. At a typical
// 2-minute call that's ~39.5¢/min. If we ever cross it, this fails.
const JOBBER_PER_CONVERSATION = 79;
const ours2min = costForSeconds(120, "local");
ok(ours2min < JOBBER_PER_CONVERSATION,
   `a 2-min call costs ${ours2min}¢ vs Jobber's ${JOBBER_PER_CONVERSATION}¢ overage — ${Math.round((1-ours2min/JOBBER_PER_CONVERSATION)*100)}% cheaper, with no monthly minimum`);

// ── Custom top-ups ────────────────────────────────────────────────────────
ok(normaliseTopup(2000) === 2000, "a $20 custom top-up is accepted");
ok(normaliseTopup(100) === null, `under $${CUSTOM_TOPUP_MIN_CENTS/100} is refused — the card fee would eat it`);
ok(normaliseTopup(1e9) === CUSTOM_TOPUP_MAX_CENTS, "an absurd amount clamps instead of charging it");
ok(normaliseTopup("abc") === null && normaliseTopup(null) === null, "junk amounts are refused, not charged");
ok(minutesFor(-100) === 0, "a negative balance shows 0 minutes, not a negative one");
ok(minutesFor(CENTS_PER_MINUTE - 1) === 0, "never promise a minute they can't actually use");
ok(TOPUP_OPTIONS.every(o=>o.cents>0) && TOPUP_OPTIONS.filter(o=>o.popular).length===1,
   `top-ups: ${TOPUP_OPTIONS.map(o=>o.label).join(", ")}`);
ok(LOW_BALANCE_CENTS === CENTS_PER_MINUTE*10, "the low-balance warning fires with ~10 minutes left");

// ── The shared test number must never reach a tenant ──────────────────────
process.env.RETELL_TEST_NUMBER = "+18335520182";
ok(isSharedTestNumber("+18335520182"), "the shared test number is recognised");
ok(!isSharedTestNumber("+15145551234"), "a company's own number is not");

ok(typeof voiceConfigured() === "boolean", `voiceConfigured() → ${voiceConfigured()} (no key locally, as expected)`);

console.log(`\n${fail===0?"ALL PASS":fail+" FAILED"}`);
process.exit(fail?1:0);
