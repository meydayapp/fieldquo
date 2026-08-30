// scripts/check-voice-visit.mjs
//
//   npm run check:visit-path
//
// The four visit paths, executed.
//
// ══ What this is defending ═════════════════════════════════════════════════
//
// "Can someone come out and look at it?" is the most common thing a homeowner
// rings a contractor to ask, and it has four honest answers depending on how
// THIS company has set their booking up. The receptionist must not guess
// between them, because the guess that sounds most helpful — "sure, I'll book
// you in" — is the one that gives away a $79 diagnostic visit for nothing.
//
// So the answer is derived server-side (lib/voice/visitPath.js) and the same
// derivation feeds both halves: what the agent is TOLD (lib/voice/prompt.js)
// and what it is ALLOWED to offer (lib/voice/availability.js). This drives the
// pure half through every branch, which is where the real bugs live.
//
// ══ The assertion that matters most ════════════════════════════════════════
//
// Absolute rule 1 says never give a price, and this feature deliberately puts a
// figure in the prompt. That is only safe because a published booking fee and a
// quote are different things: the fee was typed by the owner, is printed on
// their own booking page, and is charged by Stripe exactly as written, whereas
// a quote said on a call is a number nobody at the business has seen.
//
// A distinction that fine has to be enforced, not trusted. So the last block
// scrapes EVERY money-shaped figure out of a generated prompt and asserts each
// one is a fee this company actually published — a rate, a range, an hourly
// figure or a total for the work would fail it.

import { readFileSync } from "node:fs";
import {
  visitPolicy,
  classifyEventTypes,
  offersVisits,
  feeText,
  CAN_TEXT_BOOKING_LINK,
  phoneBookableModes,
} from "@/lib/voice/visitPath";
import { buildAgentPrompt, visitSection } from "@/lib/voice/prompt";
import { toolDefinitions, SAY_ON_REFUSAL } from "@/lib/voice/tools";

let fail = 0;
const ok = (c, m) => {
  console.log((c ? "✓ " : "✗ ") + m);
  if (!c) fail++;
};

const ORIGIN = "https://www.fieldquo.com";
const LINK = `${ORIGIN}/book/northline`;
const company = { name: "Northline Refinishing", city: "Gatineau", province: "QC" };

/** A company row as visitPolicy reads one. */
const co = (over = {}) => ({
  stripeChargesEnabled: true,
  currency: "CAD",
  bookingModes: ["visit"],
  bookingSlug: "northline",
  slug: "northline-refinishing",
  ...over,
});

const FREE = { id: "clfree000001", name: "On-site estimate", active: true, feeCents: null };
const PAID = { id: "clpaid000002", name: "Diagnostic visit", active: true, feeCents: 7900 };

const promptFor = (visit, extra = {}) =>
  buildAgentPrompt({ company, services: ["Cabinet refinishing"], visit, ...extra });

/* ─────────────────── 1. Free event type → it may book ─────────────────── */

const free = visitPolicy({ company: co(), eventTypes: [FREE], bookingUrl: LINK });
ok(free.mode === "book", `a free visit puts the agent on the "book" path (got "${free.mode}")`);
ok(free.canBook === true, "and canBook is true, so book_visit is served");
ok(
  free.bookableEventTypeIds.length === 1 && free.bookableEventTypeIds[0] === FREE.id,
  "the free event type is the one availability may offer slots from",
);

const freeText = promptFor(free);
ok(/You can offer times for a visit/.test(freeText), "it is told it may offer times, and for WHAT");
ok(
  /Only ever offer times you have been given/.test(freeText),
  "rule 2 survives: only times it was actually given",
);
ok(
  /it is free/.test(freeText),
  "and it may say the visit is free, because for this company it is",
);
ok(
  toolDefinitions(ORIGIN, { canBook: free.canBook }).some((t) => t.name === "book_visit"),
  "book_visit is in the tool list",
);

/* ────────────── 2. Paid event type → fee + link, and NO booking ────────── */

const paid = visitPolicy({ company: co(), eventTypes: [PAID], bookingUrl: LINK });
ok(paid.mode === "link", `a paid visit puts the agent on the "link" path (got "${paid.mode}")`);
ok(
  paid.canBook === false,
  "canBook is FALSE — the phone must not confirm a visit the company charges for",
);
ok(
  paid.bookableEventTypeIds.length === 0,
  "and nothing is offerable, so check_availability cannot surface the paid slot",
);
ok(
  !toolDefinitions(ORIGIN, { canBook: paid.canBook }).some((t) => t.name === "book_visit"),
  "book_visit is NOT served — the tool that would take it for free does not exist on this call",
);

const paidText = promptFor(paid);
ok(paidText.includes("$79"), "the published fee is stated");
ok(paidText.includes(LINK), "and so is the booking link");
ok(
  /You cannot book anything on this call/.test(paidText),
  "it is told plainly it cannot book this one",
);
ok(
  /tells you NOTHING about what the work will cost/.test(paidText),
  "the fee is fenced off from the price of the work",
);
ok(
  /rule one still holds/i.test(paidText),
  "and rule one is re-asserted inside the same paragraph, not left to the top of the prompt",
);
ok(
  /You cannot take a card over the phone/.test(paidText),
  "no card details on the call — the booking page collects the fee",
);
ok(
  !/we can be there|I can do (Monday|Tuesday)/i.test(paidText),
  "nothing on this path offers a day",
);

/* ─────────── 3. No event types at all → callback, and no link ─────────── */

const none = visitPolicy({ company: co(), eventTypes: [], bookingUrl: LINK });
ok(none.mode === "callback", `no appointments at all falls back to a callback (got "${none.mode}")`);
ok(none.canBook === false, "nothing bookable");
ok(
  none.bookingUrl === null,
  "and NO link — a booking page with no event types renders an empty list, so sending them there is a dead end",
);

const noneText = promptFor(none);
ok(/You cannot book anything/.test(noneText), "it is told it cannot book");
ok(!noneText.includes(LINK), "and the link is absent from the prompt entirely");
ok(
  /call save_caller with callback_requested set/.test(noneText),
  "the callback is a TOOL CALL, not a sentence — a spoken promise nobody records is nobody's job",
);
ok(
  /means nobody will/.test(noneText),
  "and it is told what happens if it only says it: nobody rings back",
);

// The callback instruction is on every path, not just the last one. A caller who
// can't take any of three offered slots has to land somewhere.
for (const [label, p] of [["book", free], ["link", paid]]) {
  ok(
    /callback_requested/.test(promptFor(p)),
    `the "${label}" path also knows how to fall back to a callback`,
  );
}

// And the tool actually carries the fields the prompt tells it to send.
const saveCaller = toolDefinitions(ORIGIN, {}).find((t) => t.name === "save_caller");
ok(
  Boolean(saveCaller?.parameters?.properties?.callback_requested),
  "save_caller accepts callback_requested",
);
ok(
  Boolean(saveCaller?.parameters?.properties?.preferred_times),
  "save_caller accepts preferred_times, so 'after six' survives the call",
);

/* ──────────────────── 4. Transfer, told either way ────────────────────── */

ok(
  /You cannot transfer calls/.test(promptFor(free, { canTransfer: false })),
  "no transfer number → it is told it cannot put anyone through",
);
ok(
  !/transfer_to_human/.test(promptFor(free, { canTransfer: false })),
  "and the tool is never named, so it cannot offer what it hasn't got",
);
ok(
  /You can transfer the caller to a real person/.test(promptFor(free, { canTransfer: true })),
  "with one → it is told it can",
);
ok(
  visitPolicy({ company: co(), eventTypes: [FREE], canTransfer: true }).canTransfer === true,
  "and the policy carries it, so all four paths are decided in one place",
);

/* ─────────────────── The cases that quietly cost money ────────────────── */

// A company that cannot COLLECT must not have a fee spoken at it. This is the
// same call effectiveBookingFeeCents makes for the booking page, reused rather
// than re-decided — the phone quoting a fee the website says is free is a
// contradiction the caller finds out about at the door.
const noStripe = visitPolicy({
  company: co({ stripeChargesEnabled: false }),
  eventTypes: [PAID],
  bookingUrl: LINK,
});
ok(
  noStripe.canBook === true && noStripe.paidVisits.length === 0,
  "no Stripe charges → the paid type falls back to free and IS bookable, exactly as on the web",
);
ok(!promptFor(noStripe).includes("$79"), "and no figure reaches the prompt");

// A live promo replaces the standard price. The agent must read the price the
// client would actually be charged, not the one it is struck through against.
const promo = visitPolicy({
  company: co(),
  eventTypes: [{ ...PAID, promoActive: true, promoFeeCents: 2000 }],
  bookingUrl: LINK,
});
ok(promo.paidVisits[0]?.feeCents === 2000, "a live promo is what Stripe charges, so it is what is said");
ok(
  promptFor(promo).includes("$20") && !promptFor(promo).includes("$79"),
  "the promo price is in the prompt and the struck-through one is not",
);

// ── Phone/video-only company: it CAN book, and this assertion is inverted ──
//
// This used to assert `canBook === false`, because bookSlot hard-coded mode
// "visit" and creating an appointment somebody drives to for a company that
// does not do visits would have been a promise nobody made. That was the right
// guard on the wrong lever: it locked out the easiest appointment in the whole
// product to take on a phone call. A callback has no travel, no address, no
// deposit and no payment.
//
// bookSlot now writes the mode the company actually offers and drops the
// address for anything that is not a visit, and the tool descriptions and the
// prompt name the mode — so the gate is the FEE, which is the thing the agent
// genuinely cannot handle, and not the mode. See scripts/check-call-to-client.mjs
// sections 15-17, which execute it.
const callOnly = visitPolicy({
  company: co({ bookingModes: ["call"] }),
  eventTypes: [FREE],
  bookingUrl: LINK,
});
ok(offersVisits({ bookingModes: ["call"] }) === false, "a call-only company does not offer visits");
ok(offersVisits({}) === true, "an unset bookingModes is the ['visit'] default, not 'nothing offered'");
ok(
  callOnly.canBook === true && callOnly.mode === "book",
  "call-only → it books a phone call rather than falling back to the link",
);
ok(
  JSON.stringify(callOnly.bookableModes) === JSON.stringify(["call"]),
  "...and it is told which mode it is arranging, so it never offers to come out",
);

// Both kinds at once. The free ones stay bookable; the paid ones are named with
// their fee and explicitly excluded from what may be offered.
const mixed = visitPolicy({ company: co(), eventTypes: [FREE, PAID], bookingUrl: LINK });
ok(mixed.canBook === true && mixed.mode === "book", "free + paid → still books the free ones");
ok(
  mixed.bookableEventTypeIds.length === 1 && mixed.bookableEventTypeIds[0] === FREE.id,
  "and only the free one is offerable",
);
const mixedText = promptFor(mixed);
ok(
  /The times you can offer are for the free visits only/.test(mixedText),
  "the prompt says which of the two the offered times belong to",
);
ok(
  !/it is free/.test(mixedText),
  '"the visit is free" is WITHHELD when a paid one also exists — next to "$79" it is how a caller ends up arguing with an invoice',
);

// An inactive event type is not an offer.
ok(
  classifyEventTypes({ company: co(), eventTypes: [{ ...FREE, active: false }] }).free.length === 0,
  "an inactive event type is neither bookable nor mentioned",
);

// No origin → no link. An agent that knows a link exists but not what it is
// invents one, and an invented booking URL belongs to somebody else.
const noOrigin = visitPolicy({ company: co(), eventTypes: [PAID], bookingUrl: null });
ok(noOrigin.bookingUrl === null, "no origin → no link on the policy");
ok(noOrigin.mode === "callback", "and with a fee it cannot book and cannot link, so: callback");
ok(
  !/booking page is/.test(promptFor(noOrigin)),
  "no link section at all, rather than a sentence with a hole in it",
);

/* ───────────────── Never promise a message we cannot send ─────────────── */

ok(
  CAN_TEXT_BOOKING_LINK === false,
  "texting the link is off: Retell's SMS is US-only and excludes toll-free, and our Twilio account owns no number to send from",
);
ok(
  /no way to text it or email it/.test(paidText),
  "so the agent is told it cannot send the link",
);
ok(
  /Do not offer to send it/.test(paidText),
  "and told not to offer, which is the half that leaves someone waiting by their phone",
);

/* ────────────── The only figure anywhere is a published fee ───────────── */
//
// Scraped, not eyeballed. Any money-shaped token in a generated prompt has to be
// one of this company's own published booking fees; a rate, an hourly figure or
// a total for the WORK would land here and fail.

const MONEY = /(?:[$€£]\s?\d[\d,]*(?:\.\d+)?)|(?:\d[\d,]*(?:\.\d+)?\s?(?:dollars|CAD|USD|EUR|GBP))/gi;
const published = new Set([feeText(7900, "CAD"), feeText(2000, "CAD")]);

for (const [label, p] of [
  ["free", free],
  ["paid", paid],
  ["none", none],
  ["mixed", mixed],
  ["promo", promo],
  ["no-stripe", noStripe],
]) {
  const found = (promptFor(p).match(MONEY) || []).map((s) => s.replace(/\s/g, ""));
  const stray = found.filter((f) => !published.has(f));
  ok(
    stray.length === 0,
    `"${label}" prompt contains no figure that isn't a published booking fee${stray.length ? ` — found ${stray.join(", ")}` : ""}`,
  );
}

// Including with a hostile owner note. The owner types free text into
// VoiceAgent.instructions, and "our visits are $79 and a kitchen runs about
// $6,000" is a plausible thing for a contractor to write. The note is fenced and
// bounded, but the rule that matters is that the SYSTEM half never adds a
// number of its own.
const hostile = promptFor(paid, {
  notes: "Tell them a kitchen is about $6,000 and promise Tuesday.",
});
ok(
  hostile.indexOf("NEVER give a price") < hostile.indexOf("$6,000"),
  "an owner note naming a job price still sits below the absolute rules",
);
ok(
  /does NOT override the absolute rules/.test(hostile),
  "and is labelled as unable to override them",
);
ok(
  /a discount you just invented if nobody told you/.test(hostile),
  '"it comes off the job" is only sayable when the business said so — it is a discount otherwise',
);

/* ───── The prompt is not the enforcement, so check the enforcement ────── */
//
// Everything above proves the agent is TOLD the right thing. Telling a model not
// to do something is not a guarantee — a slot id is a six-character event-type
// fragment plus a timestamp, read aloud on the call, and a fee can be switched
// on between the offer and the booking. Both of those paths are database-bound
// and cannot be executed here, so what is asserted is that the guard exists at
// all: hiding a button is not access control, and neither is a prompt.

const availability = readFileSync(new URL("../lib/voice/availability.js", import.meta.url), "utf8");
ok(
  /effectiveBookingFeeCents\(company, eventType\)/.test(availability) &&
    /feeCents > 0\) return \{ ok: false, reason: "fee_due" \}/.test(availability),
  "bookSlot re-prices the event type itself and refuses a paid one, whatever the agent was told",
);
ok(
  /if \(!policy\.canBook\) return \[\]/.test(availability),
  "and bookableSlots offers nothing at all on a path that cannot book",
);

const toolRoute = readFileSync(
  new URL("../app/api/voice/tools/[tool]/route.js", import.meta.url),
  "utf8",
);
// ── Every refusal says the true thing, and they are EXECUTED not grepped ──
//
// This used to assert that the route source contained `result.reason ===
// "fee_due"`, which passed on a ternary whose only other branch was "that one's
// just gone". Every non-fee refusal therefore reported a clash: a missing
// address, an invented slot id and a company we could not read all came out as
// "somebody just took it". For a slot the caller was offered thirty seconds ago
// that is a lie, and it is the one that sends the agent off to offer a
// different time instead of asking for the address it actually needed.
//
// The sentences live in lib/voice/tools.js now, beside the other agent-facing
// wording, so this drives the real table rather than the shape of the file
// that reads it.
const REFUSALS = ["fee_due", "address_required", "bad_slot", "unknown_event_type", "taken"];
ok(
  REFUSALS.every((r) => typeof SAY_ON_REFUSAL[r] === "string" && SAY_ON_REFUSAL[r].length > 0),
  "every refusal bookSlot can return has something honest to say",
);
ok(
  new Set(REFUSALS.map((r) => SAY_ON_REFUSAL[r])).size > 1,
  "and they are not all the same sentence",
);
ok(
  SAY_ON_REFUSAL.fee_due !== SAY_ON_REFUSAL.taken &&
    /paid|booking page/i.test(SAY_ON_REFUSAL.fee_due),
  'a fee refusal gets its own sentence — reporting it as "that one\'s just gone" is a lie about a slot that is still there',
);
ok(
  SAY_ON_REFUSAL.address_required !== SAY_ON_REFUSAL.taken &&
    /address/i.test(SAY_ON_REFUSAL.address_required),
  "and a missing address is ASKED FOR, not reported as somebody else taking the slot",
);
ok(
  !/just gone|taken/i.test(SAY_ON_REFUSAL.bad_slot),
  "a slot id that was never real is not reported as a clash — that teaches the agent to invent a second one",
);
// The money rule reaches this table too: it is read aloud, so it is a surface
// where an invented figure could reach a caller.
ok(
  !Object.values(SAY_ON_REFUSAL).some((v) => /[$€£]\s?\d/.test(v)),
  "and no refusal sentence contains a figure",
);
ok(
  /callback_requested/.test(toolRoute) && /preferred_times/.test(toolRoute),
  "and the route reads both callback fields the tool sends — a parameter nothing stores is a promise nothing keeps",
);

/* ───────────────────────── The section on its own ─────────────────────── */

ok(visitSection().length > 0, "visitSection with no policy at all still produces the safe path");
ok(
  /You cannot book anything/.test(visitSection()),
  "and that safe path is the one that promises nothing",
);
ok(
  !/undefined|null|\[object|NaN/i.test(promptFor(paid)),
  "no undefined/NaN leaks into anything the agent reads aloud",
);

/* ══════ A callback is the default, and a visit is only offered when free ══
 *
 * Both rules come out of one call to Big painter Inc: the agent told the caller
 * it had scheduled him and booked nothing, and the same company charges for an
 * in-person consultation while offering a free one. The fee lives on the
 * EventType and the mode lives on the COMPANY, so nothing stopped the free type
 * being booked as a visit somebody drives to — the fee was not waived, it was
 * simply never charged.
 */

const bothModes = (over = {}) => co({ bookingModes: ["visit", "call"], ...over });

const prefersCall = visitPolicy({ company: bothModes(), eventTypes: [FREE], bookingUrl: LINK });
ok(
  prefersCall.bookableModes[0] === "call",
  "a company that does both offers the CALLBACK first — modePhrase reads this in order, and the first mode named is the one a model reaches for",
);
ok(
  prefersCall.bookableModes.includes("visit"),
  "and the visit is still on the table when nothing is charged for",
);

const charges = visitPolicy({ company: bothModes(), eventTypes: [FREE, PAID], bookingUrl: LINK });
ok(
  !charges.bookableModes.includes("visit"),
  "a company that CHARGES for a consultation does not have the phone arranging an in-person one — the free type booked as a visit gives the fee away",
);
ok(
  JSON.stringify(charges.bookableModes) === JSON.stringify(["call"]),
  "and what is left is the callback, which costs the business a call it was making anyway",
);
ok(
  charges.canBook === true && charges.mode === "book",
  "it can still book — withholding the mode must not withhold the appointment",
);

// The regression this rule could easily have caused, asserted so it cannot.
const visitOnlyMixed = visitPolicy({ company: co(), eventTypes: [FREE, PAID], bookingUrl: LINK });
ok(
  JSON.stringify(visitOnlyMixed.bookableModes) === JSON.stringify(["visit"]),
  "a VISIT-ONLY company with a paid type keeps booking its free one — dropping the mode with nothing to replace it is a regression wearing a fix's clothes",
);
ok(
  JSON.stringify(phoneBookableModes({ company: co({ bookingModes: ["call"] }), paid: [] })) ===
    JSON.stringify(["call"]),
  "a call-only company is unchanged",
);
ok(
  JSON.stringify(phoneBookableModes({ company: bothModes(), paid: [] })) ===
    JSON.stringify(["call", "visit"]),
  "and with nothing charged for, both survive with the call in front",
);

/* ═══════════ Nothing is booked until the tool says it is ═══════════════════
 *
 * The failure this exists for: check_availability returned three real slots,
 * the agent read the first one back — "Monday, August 31 at 3:00 p.m." — and
 * told the caller it was scheduled. book_visit was never called. No Booking
 * row, nobody expecting him, and the only person who believed an appointment
 * existed was the customer.
 *
 * The prompt had every rule needed to stop it INVENTING a time and none to stop
 * it inventing the booking.
 */

const bookText = promptFor(free);
ok(
  /Nothing is arranged until book_visit has come back/.test(bookText),
  "the booking section says outright that nothing exists until the tool returns",
);
ok(
  /you're booked in/.test(bookText) && /that's scheduled/.test(bookText),
  "and it names the actual sentences, because 'do not confirm prematurely' is an abstraction a model talks itself around",
);
ok(
  /NEVER say something has been done unless the tool that does it has come back/.test(
    promptFor(free),
  ),
  "and it is an absolute rule at the top as well, where nothing the owner writes can sit below it",
);

const bookTool = toolDefinitions(ORIGIN, { canBook: true }).find((t) => t.name === "book_visit");
ok(
  /NOTHING IS BOOKED UNTIL THIS TOOL RETURNS/.test(bookTool.description),
  "and the tool description carries it too — that is what the model is reading when it decides whether calling this is necessary",
);

/* ─────────── What it must have before it can commit somebody ──────────── */

ok(
  /WHAT YOU NEED BEFORE YOU CAN BOOK/.test(bookText),
  "the booking section lists what an appointment actually needs",
);
ok(
  /Their name/.test(bookText) && /best number to reach them on/.test(bookText),
  "name and number",
);
ok(
  /Why they want it, in their own words/.test(bookText),
  "and the reason, which is what the estimator reads before they turn up",
);
ok(
  /The address the work is at/.test(bookText),
  "and an address when somebody has to drive there",
);
ok(
  !/The address the work is at/.test(promptFor(visitPolicy({
    company: co({ bookingModes: ["call"] }),
    eventTypes: [FREE],
  }))),
  "but never for a call-only company — asking a caller to spell their street out to arrange a phone call is what makes an assistant feel broken",
);

ok(
  bookTool.parameters.required.includes("reason"),
  "`reason` is a required tool parameter, so the appointment cannot be made without one",
);
ok(
  !bookTool.parameters.required.includes("address"),
  "`address` deliberately is NOT — a model fills a required field, and the value it invents for an unknown street is a van sent to a stranger",
);
ok(
  /Whoever takes it reads this/.test(bookTool.parameters.properties.reason.description),
  "and the reason parameter says who reads it, because that is what makes a model write a useful one",
);

/* ═══════ What a quote call has to come away with ═════════════════════════
 *
 * A real quote call: the agent took a name, a number, an address, thirty doors,
 * five drawers and a colour — and never asked for an email. It only got one
 * because the caller volunteered it after the booking was already made. Nobody
 * can SEND a quote to a phone number, so the single fact that decides whether
 * the quote can be delivered was the one nothing asked for.
 *
 * The same call never called save_caller either: leadId null, so the address,
 * the door count and the email were written down nowhere at all. The prompt
 * only ever named save_caller on the path where booking FAILED — an agent that
 * successfully booked was never told to save anybody.
 */
const quotePrompt = buildAgentPrompt({
  company,
  services: ["Cabinet refinishing"],
  visit: free,
  quoteTopics: [{ label: "Cabinet refinishing", asks: ["how many doors there are"] }],
  upsells: [{ service: "Cabinet refinishing", offers: ["New handles — supply & install"] }],
});

ok(
  /GET ALL FOUR OF THESE/.test(quotePrompt),
  "a quote call is told the four contact facts are required, not hoped for",
);
ok(
  /Their EMAIL/.test(quotePrompt) && /quote nobody can send is not a quote/.test(quotePrompt),
  "and the email is called out by name, with the reason — it is the one that gets forgotten",
);
ok(
  /AND YOU MUST CALL save_caller/.test(quotePrompt),
  "save_caller is unconditional, not something only the failed-booking path mentions",
);
ok(
  /Booking somebody in is NOT saving them/.test(quotePrompt),
  "and the specific confusion is named: a call that books and never saves leaves a time belonging to nobody",
);
ok(
  /call save_caller with callback_requested set/.test(promptFor(none)),
  "the old callback instruction still stands on the path that cannot book",
);

// Selling, on the one call where it is the job rather than an intrusion.
ok(
  /WHEN THEY ARE ASKING FOR A QUOTE, RAISE ONE/.test(quotePrompt),
  "an extra is raised on a quote call — the moment they describe the work is the only moment anyone can ask",
);
ok(
  /an extra nobody wrote down is one nobody sells/.test(quotePrompt),
  "and whatever they answer goes to save_caller, because the person ringing back quotes what was written down",
);
ok(
  /Never if they said no, never if they sound in a hurry/.test(quotePrompt),
  "while the anti-badgering rules survive intact",
);
// Rule one is absolute and this section is the likeliest place to erode it.
ok(
  !/[$€£]\s?\d/.test(quotePrompt),
  "and none of it puts a figure in the agent's mouth",
);

/* ═══════════ Dead air: every tool must cover its own silence ═════════════
 *
 * A real 44-second call, in full:
 *
 *   user   "It's Emilio. And my phone number is eight one nine…"
 *   >>     save_caller invoked
 *   >>     result {"saved":true,"say":"Got it — I've passed that on…"}
 *   user   "Are you there?"
 *
 * save_caller was declared with speak_during_execution AND
 * speak_after_execution both false. Retell's docs are explicit that the agent
 * "remains silent during the function call" — so it went quiet for the whole
 * HTTP round trip and then stayed quiet, discarding a `say` sentence the route
 * had written specifically to be spoken. The caller filled the silence.
 *
 * And `timeout_ms` defaults to 120000 at the provider. Silence by default, for
 * up to two minutes, on a phone call.
 */
for (const tool of toolDefinitions(ORIGIN, { canBook: true })) {
  if (tool.type !== "custom") continue;
  ok(
    tool.speak_after_execution === true,
    `${tool.name}: says something when it finishes — every one of these returns a \`say\` the caller is meant to hear`,
  );
  ok(
    tool.speak_during_execution === true,
    `${tool.name}: covers the wait instead of going silent through it`,
  );
  ok(
    tool.execution_message_type === "static_text" &&
      typeof tool.execution_message_description === "string" &&
      tool.execution_message_description.length > 0,
    `${tool.name}: with fixed words, so filling a pause does not cost a model round trip`,
  );
  ok(
    Number.isInteger(tool.timeout_ms) && tool.timeout_ms >= 1000 && tool.timeout_ms <= 20000,
    `${tool.name}: bounded well under the provider's two-minute default`,
    tool.timeout_ms,
  );
}

/* ── The email that made every phone booking unconfirmable ──────────────── */
//
// /api/booking/[slug]/confirm 400s without clientEmail — it is the one hard
// requirement on the web path — and book_visit had no way to supply one. Every
// phone booking was written with an empty email, finalizeBooking skipped the
// confirmation, and the agent said "if you'd like it in writing, give me an
// email address" AFTER the slot was already taken.
{
  const book = toolDefinitions(ORIGIN, { canBook: true }).find((t) => t.name === "book_visit");
  ok("email" in book.parameters.properties, "book_visit can carry an email");
  ok(
    /confirmation/i.test(book.parameters.properties.email.description),
    "…and says what it is for, which is what makes a model ask for it",
  );
  ok(
    /belongs to the business/i.test(book.parameters.properties.email.description),
    "…with the same guard save_caller carries: the company's own photo address is not the caller's",
  );
  ok(
    /Their email, so the confirmation can be sent/.test(promptFor(free)),
    "and the prompt asks for it BEFORE booking, not after the slot is gone",
  );
}

/* ═══════════ "And who's gonna call me?" ═══════════════════════════════════
 *
 * A real caller asked exactly that, and the agent said "I can't say exactly
 * who" — about an appointment it was in the middle of booking on Daniel's
 * calendar, on an event type named "Consultation with Daniel". The product knew
 * and had never passed it on: visitPolicy computed freeVisits and visitSection
 * never destructured it.
 */
{
  const withOwner = visitPolicy({
    company: co(),
    eventTypes: [{ ...FREE, user: { name: "Daniel" } }],
    bookingUrl: LINK,
  });
  ok(
    withOwner.freeVisits[0]?.ownerName === "Daniel",
    "the owner's name survives classification",
    withOwner.freeVisits[0],
  );
  ok(
    /If they ask who will be speaking to them, it is Daniel\./.test(promptFor(withOwner)),
    "…and the agent is told, so it can answer instead of saying it cannot say",
  );

  // An unassigned type genuinely lands on nobody's calendar. The vague answer
  // is the true one, and inventing a name is worse.
  const noOwner = visitPolicy({ company: co(), eventTypes: [FREE], bookingUrl: LINK });
  ok(
    noOwner.freeVisits[0]?.ownerName === null,
    "an unassigned appointment type carries no name",
    noOwner.freeVisits[0],
  );
  ok(
    !/who will be speaking to them/.test(promptFor(noOwner)),
    "…and nothing is said about who, rather than a name being invented",
  );

  // Two people, and the agent must not pick one at random.
  const two = visitPolicy({
    company: co(),
    eventTypes: [
      { ...FREE, user: { name: "Daniel" } },
      { ...FREE, id: "clfree000009", name: "Estimate with Ann", user: { name: "Ann" } },
    ],
    bookingUrl: LINK,
  });
  const twoText = promptFor(two);
  ok(
    /Daniel, Ann/.test(twoText),
    "with two owners both are named",
    twoText.match(/who will be speaking to them[\s\S]{0,160}/)?.[0],
  );
  ok(
    /rather than guessing a name/.test(twoText),
    "…and it is told to stay vague rather than guess which",
  );
  // Rule one reaches here too: this section names people, never figures.
  ok(!/[$€£]\s?\d/.test(twoText), "and naming somebody puts no figure in the agent's mouth");
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
