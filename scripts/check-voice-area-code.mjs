// scripts/check-voice-area-code.mjs
//
//   npm run check:voice-area-code
//
// The number a contractor is shown is the number a contractor gets.
//
// ══ What was actually broken ═══════════════════════════════════════════════
//
// The buy route forwarded an `areaCode` to Retell and had done for months. No
// screen ever sent one — `app/app/settings/voice/page.js` contained the string
// nowhere at all — so the parameter was a hole in the API that nothing filled.
//
// And filling it would not have worked. Retell documents the field as:
//
//     "Area code of the number to obtain. Format is a 3 digit integer.
//      Currently only supports US area code."
//
// This product sells into Quebec. So the one lever that existed was inert for
// most of the customer base, while NUMBER_TYPES.local advertised "A number in
// your own area code" on the same screen. A contractor in Gatineau asked for
// nothing, received whatever the pool held, and printed it on a van.
//
// ══ What these assertions are for ══════════════════════════════════════════
//
// Every dangerous property of the replacement is a property about MONEY or
// about a number somebody advertises, so they are executed rather than read
// wherever a function exists to execute:
//
//   * an area code derived from a Quebec number is 819, not a default;
//   * a company with no location data yields NO default, because a plausible
//     wrong default here gets bought and printed;
//   * a toll-free order never carries an area code, in either direction;
//   * the number displayed after a purchase is the provider's, never the
//     request's;
//   * the picker is not rendered when the provider cannot honour a choice.
//
// The last two have no single pure function to call — they are the shape of a
// route handler and of a JSX branch — so those read source, deliberately and
// narrowly. Everything else runs.
//
// ── Run it with node, via the alias loader ─────────────────────────────────
//
//   node --import ./scripts/alias-loader.mjs scripts/check-voice-area-code.mjs

import { readFileSync } from "node:fs";

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

let fail = 0;
const ok = (c, m, detail) => {
  console.log((c ? "✓ " : "✗ ") + m);
  if (!c) {
    fail++;
    if (detail) console.log(`    ${detail}`);
  }
};

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** Source with comments stripped — so a claim in prose can't satisfy a check. */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const {
  areaCodeOf,
  isUsableAreaCode,
  defaultAreaCode,
  searchLocalNumbers,
  isStillAvailable,
} = await import("@/lib/voice/numberSearch");
const { buyNumber } = await import("@/lib/voice/retell");

const ROUTE = "app/api/settings/voice/number/route.js";
const SEARCH_ROUTE = "app/api/settings/voice/numbers/search/route.js";
const PAGE = "app/app/settings/voice/page.js";
const routeSrc = code(src(ROUTE));
const pageSrc = src(PAGE);

/* ═══════════════════════════════════════════════════════════════════════════
   1. A Quebec number yields 819 — and junk yields nothing
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Deriving the area code ──");

ok(areaCodeOf("+18198033422") === "819",
   "the owner's Drummondville number derives 819");
ok(areaCodeOf("819 803 3422") === "819" &&
   areaCodeOf("(819) 803-3422") === "819" &&
   areaCodeOf("8198033422") === "819" &&
   areaCodeOf("1-819-803-3422") === "819",
   "…however the contractor typed it");
ok(areaCodeOf("+15145550142") === "514" && areaCodeOf("+14165550142") === "416",
   "514 and 416 derive themselves, not a fixed default");

// The whole point of the exercise: the answer must come from THEIR digits.
// A function that returned the same code for two different companies would be
// a default wearing a derivation's clothes.
ok(areaCodeOf("+18198033422") !== areaCodeOf("+14165550142"),
   "two companies in different provinces do not derive the same area code");

ok(areaCodeOf("8033422") === null,
   "a seven-digit local number has NO area code in it — reading its first three digits would invent one");
ok(areaCodeOf("") === null && areaCodeOf(null) === null && areaCodeOf(undefined) === null,
   "empty, null and undefined derive nothing");
ok(areaCodeOf("+441632960541") === null,
   "a non-NANP number derives nothing rather than a plausible-looking three digits");
ok(areaCodeOf("+11198033422") === null,
   "a 119 area code is impossible (NANP starts 2-9) and is refused rather than passed on");
ok(areaCodeOf("+19118033422") === null,
   "911 is a service code, never assigned to a subscriber — a number appearing to carry one is a parse error, not a location");
ok(areaCodeOf("not a phone number") === null && areaCodeOf({}) === null,
   "junk derives nothing");

/* ═══════════════════════════════════════════════════════════════════════════
   2. No location data → NO invented default
   ═══════════════════════════════════════════════════════════════════════════

   AGENTS.md recurring failure class #5: padding absent data with defaults.
   Absence of a statement is not a statement. This is the sharpest instance of
   it in the codebase, because the padded value does not sit in a column — it
   gets BOUGHT, and then painted on a vehicle. */

console.log("\n── Absence stays absent ──");

const quebecCo = { phone: "+18198033422", city: "Gatineau", province: "QC", country: "CA" };
const derived = defaultAreaCode(quebecCo);
ok(derived.areaCode === "819" && derived.from === "phone",
   "a company with a Quebec phone opens the picker on 819, and says the phone is where that came from");

const noData = defaultAreaCode({ phone: null, city: null, province: null, country: "CA" });
ok(noData.areaCode === null && noData.from === null,
   "a company with NO location data yields no default at all");

// The tempting wrong answers, named individually so a future edit that adds a
// city table trips this rather than shipping.
const cityOnly = defaultAreaCode({ phone: null, city: "Gatineau", province: "QC" });
ok(cityOnly.areaCode === null,
   "a CITY does not name an area code — Gatineau is served by 819 AND 873, and picking one would be a coin toss somebody buys");
const provinceOnly = defaultAreaCode({ phone: null, province: "QC" });
ok(provinceOnly.areaCode === null,
   "a PROVINCE names one even less — Quebec runs 418/438/450/514/579/581/819/873");
ok(defaultAreaCode({}).areaCode === null && defaultAreaCode(null).areaCode === null,
   "an empty company, and no company at all, yield nothing");
ok(defaultAreaCode({ phone: "8033422" }).areaCode === null,
   "an unparseable phone yields nothing rather than its first three digits");

// And the file must not grow a lookup table later.
const searchSrc = code(src("lib/voice/numberSearch.js"));
ok(!/["']Gatineau["']\s*:/.test(searchSrc) && !/\b(?:CITY|AREA_CODES?)_(?:TO|BY)_\w+\s*=/.test(searchSrc),
   "no city-to-area-code table has appeared in lib/voice/numberSearch.js");

console.log("\n── What counts as a typed area code ──");
ok(isUsableAreaCode("819") && isUsableAreaCode(819),
   "819 is usable, as a string or a number");
ok(!isUsableAreaCode("81") && !isUsableAreaCode("8199") && !isUsableAreaCode(""),
   "two digits, four digits and empty are not");
ok(!isUsableAreaCode("119") && !isUsableAreaCode("019"),
   "an area code does not start with 0 or 1");
ok(!isUsableAreaCode("911") && !isUsableAreaCode("411"),
   "N11 service codes are not area codes");

/* ═══════════════════════════════════════════════════════════════════════════
   3. Toll-free never carries an area code — from either end
   ═══════════════════════════════════════════════════════════════════════════

   A toll-free number comes from the 800/833 pools and has no area to be in.
   Sending an area code beside it asks the provider for two contradictory
   things, and whichever it honours the other is a surprise on the invoice —
   the same class of bug that once billed the toll-free rate for a local line. */

console.log("\n── Toll-free carries no area, and no chosen number ──");

// buyNumber is executed against a stubbed fetch so the BODY can be inspected.
// The alternative — asserting about its source — would pass on a function that
// builds the right-looking object and posts a different one.
const sent = [];
const realFetch = globalThis.fetch;
process.env.RETELL_API_KEY = process.env.RETELL_API_KEY || "test-key-not-a-real-one";
globalThis.fetch = async (_url, init) => {
  sent.push(JSON.parse(init.body));
  return new Response(JSON.stringify({ phone_number: "+18195815390" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const body = async (args) => {
  sent.length = 0;
  await buyNumber(args);
  return sent[0];
};

const tollFreeBody = await body({ tollFree: true, country: "CA", areaCode: "819" });
ok(tollFreeBody.toll_free === true && !("area_code" in tollFreeBody),
   "a toll-free order carries NO area_code even when one is handed to buyNumber");
const localHint = await body({ tollFree: false, country: "CA", areaCode: "819" });
ok(localHint.area_code === 819 && localHint.toll_free === false,
   "a local order with no chosen number still sends the area_code hint");

const namedBody = await body({ tollFree: false, country: "CA", phoneNumber: "+18195815390", areaCode: "819" });
ok(namedBody.phone_number === "+18195815390",
   "a chosen number is sent to the provider as phone_number");
ok(!("area_code" in namedBody),
   "…and the area code it came from is NOT sent alongside it — one request, one meaning");
ok(namedBody.number_provider === "twilio",
   "…and the provider is stated, because the number was found in Twilio's inventory and Telnyx has never heard of it");

const junkNamed = await body({ tollFree: false, country: "CA", phoneNumber: "(819) 581-5390", areaCode: "819" });
ok(!("phone_number" in junkNamed) && junkNamed.area_code === 819,
   "a display string is not an E.164 — it falls back to the hint rather than posting a number the provider will reject");

globalThis.fetch = realFetch;

// The route's own suppression, both halves.
ok(/const chosenE164 = tollFree \? null : toE164\(body\.phoneNumber\)/.test(routeSrc),
   "the route discards a chosen number on a toll-free order");
ok(/areaCode: tollFree \|\| chosenE164 \? undefined : body\.areaCode/.test(routeSrc),
   "…and sends no area code when it is toll-free OR when a specific number was chosen");

/* ═══════════════════════════════════════════════════════════════════════════
   4. The number shown is the number bought
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── What was bought, not what was asked for ──");

ok(/const e164 = toE164\(bought\?\.phone_number\)/.test(routeSrc),
   "the stored number is read off the PROVIDER's response");
ok(/requestedE164: chosenE164 && chosenE164 !== e164 \? chosenE164 : null/.test(routeSrc),
   "a substitution is reported to the browser, and only when the two genuinely differ");
ok(/e164 !== chosenE164/.test(routeSrc) && /recordError/.test(routeSrc),
   "…and logged for us as well as shown to them");
ok(!/e164:\s*chosenE164\b/.test(routeSrc) && !/e164:\s*body\.phoneNumber/.test(routeSrc),
   "the response never echoes the REQUESTED number as though it were the one they got");

// The page has to act on it, or the route's honesty dies in transit.
ok(/result\.requestedE164/.test(pageSrc),
   "the settings screen reads requestedE164");
ok(/tone: "warn"/.test(pageSrc) && /notice\.tone === "warn"/.test(pageSrc),
   "…and renders it as a WARNING, with a branch that actually exists in the notice styling");
ok(/app\.setVoice\.pick\.substituted/.test(pageSrc),
   "…in a sentence that names both numbers");

/* ═══════════════════════════════════════════════════════════════════════════
   5. Money moves in the right order, and a taken number costs nothing
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Reserve, then buy, then refund ──");

// The CALL, not the import line at the top of the file — an import sorts above
// everything and would make this ordering check pass no matter what.
const availIdx = routeSrc.indexOf("isStillAvailable(chosenE164");
const reserveIdx = routeSrc.indexOf("reserveSpend({");
const buyIdx = routeSrc.indexOf("buyNumber({");
ok(availIdx > -1 && reserveIdx > -1 && buyIdx > -1 && availIdx < reserveIdx && reserveIdx < buyIdx,
   "availability is re-checked BEFORE the money is reserved, and the money before the provider is called");
ok(/refundReservation/.test(routeSrc),
   "…and a provider failure still refunds");
ok(/stillFree === false/.test(routeSrc),
   "only a definite 'taken' refuses — a Twilio outage returns null and must not take the feature offline");
ok(/heldNumber\(member\.companyId\)/.test(routeSrc),
   "the one-number-per-company guard is untouched and still runs first");
ok(routeSrc.indexOf("heldNumber(member.companyId)") < availIdx,
   "…and it runs BEFORE any of this, so no path around it has been created");

/* ═══════════════════════════════════════════════════════════════════════════
   6. No picker where the provider cannot honour a choice
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── The picker is not rendered when it would be a lie ──");

ok(/if \(!choice\?\.canChoose\)/.test(pageSrc),
   "the picker returns early when the deployment cannot offer a real choice");
const guardIdx = pageSrc.indexOf("if (!choice?.canChoose)");
const inputIdx = pageSrc.indexOf('id="voice-area-code"');
ok(guardIdx > -1 && inputIdx > -1 && guardIdx < inputIdx,
   "…and that early return sits ABOVE the area-code input, so the box cannot render behind it");
ok(/app\.setVoice\.pick\.unavailable/.test(pageSrc),
   "…and says so, falling back to 'the closest we can' rather than a control that ignores the choice");
ok(/canChoose: numberChoiceAvailable\(\)/.test(code(src("app/api/settings/voice/route.js"))),
   "canChoose is the SERVER's answer, decided from real credentials");

const { numberChoiceAvailable } = await import("@/lib/voice/numberSearch");
const savedSid = process.env.TWILIO_ACCOUNT_SID;
const savedTok = process.env.TWILIO_AUTH_TOKEN;
const savedKey = process.env.TWILIO_API_KEY_SID;
const savedSec = process.env.TWILIO_API_KEY_SECRET;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_API_KEY_SID;
delete process.env.TWILIO_API_KEY_SECRET;
ok(numberChoiceAvailable() === false,
   "with no Twilio credentials there is no choice to offer");
const dark = await searchLocalNumbers({ country: "CA", areaCode: "819" });
ok(dark.configured === false && dark.numbers.length === 0,
   "…and the search says 'not configured' rather than returning an empty list that looks like 'none free'");
ok((await isStillAvailable("+18195815390")) === null,
   "…and availability is UNKNOWN rather than false, so an unconfigured deployment doesn't refuse every purchase");
if (savedSid) process.env.TWILIO_ACCOUNT_SID = savedSid;
if (savedTok) process.env.TWILIO_AUTH_TOKEN = savedTok;
if (savedKey) process.env.TWILIO_API_KEY_SID = savedKey;
if (savedSec) process.env.TWILIO_API_KEY_SECRET = savedSec;

// Nothing to search WITH is a third state again, distinct from both.
process.env.TWILIO_ACCOUNT_SID = savedSid || "ACtest";
process.env.TWILIO_AUTH_TOKEN = savedTok || "test-token";
const nothingToSearch = await searchLocalNumbers({ country: "CA" });
ok(nothingToSearch.configured === true && nothingToSearch.searched === null,
   "a company with no area code, no city and no province is 'nothing to look with', not 'nothing free'");
if (!savedSid) delete process.env.TWILIO_ACCOUNT_SID;
if (!savedTok) delete process.env.TWILIO_AUTH_TOKEN;

/* ═══════════════════════════════════════════════════════════════════════════
   7. Empty is an answer, not an error
   ═══════════════════════════════════════════════════════════════════════════

   Checked live against Twilio while this was written: areaCode 416 and 514
   both return ZERO available local numbers. Toronto and Montreal inventory is
   routinely exhausted. Rendering that as a failure sends a contractor chasing a
   problem that is not theirs. */

console.log("\n── An exhausted area code reads as exhausted ──");

ok(/results\?\.length === 0/.test(pageSrc),
   "the screen has a branch for 'we looked and found nothing'");
ok(/app\.setVoice\.pick\.noneInAreaCode/.test(pageSrc) &&
   /app\.setVoice\.pick\.searchFailed/.test(pageSrc),
   "…and a DIFFERENT sentence for 'we could not look at all'");
const searchRouteSrc = code(src(SEARCH_ROUTE));
ok(/status: 502/.test(searchRouteSrc) && /catch/.test(searchRouteSrc),
   "a thrown search is a 502, so it cannot arrive looking like an empty list");
ok(/status: 400/.test(searchRouteSrc) && /isUsableAreaCode/.test(searchRouteSrc),
   "a typed area code that isn't one is refused, not silently swapped for a city search");

/* ═══════════════════════════════════════════════════════════════════════════
   8. Every new string exists in every language
   ═══════════════════════════════════════════════════════════════════════════ */

console.log("\n── Copy ──");

const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
const pickKeys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.setVoice.pick."));
ok(pickKeys.length >= 18, `${pickKeys.length} picker strings defined in English`);
for (const lang of ["fr", "es", "uk", "pa", "tl"]) {
  const missing = pickKeys.filter((k) => !APP_MESSAGES[lang]?.[k]);
  ok(missing.length === 0, `${lang} carries every picker string`, missing.join(", "));
}
// A translation that is still the English sentence is a missing translation
// wearing a present one's clothes.
const untranslated = pickKeys.filter((k) => APP_MESSAGES.fr[k] === APP_MESSAGES.en[k]);
ok(untranslated.length <= 1,
   "the French strings are actually French",
   untranslated.join(", "));

console.log(fail === 0 ? "\nALL PASS\n" : `\n${fail} FAILED\n`);
process.exit(fail ? 1 : 0);
