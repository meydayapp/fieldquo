// scripts/check-lead-chase.mjs
//
// The enquiry chase: when it must NOT run, what it says, and what it costs.
//
//   npm run check:lead-chase
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The owner, 2026-11-03: the lead follow-ups "should only be active if they
// don't have an appointment set up. and they also don't have a quote. or job.
// because the purpose is to get them to schedule."
//
// Every one of those is a way to send the wrong message to a real homeowner,
// and not one of them is visible in the cron's `where` clause:
//
//   · a lead who booked a visit on Tuesday is still at status "new" with no
//     quote, so the finder returns them — and then tells them, under the
//     contractor's name, that nobody has been able to reach them.
//   · a quote that was never written onto LeadRequest.quoteId but IS theirs
//     (same client, after the lead) — the link the Leads board already prints
//     on the card.
//   · a human mid-conversation, which an automated "someone will be in touch"
//     interrupts.
//   · and the switch-on burst: the enquiry defaults are seeded OFF, so the
//     first run after a company tries them would otherwise chase every lead
//     sitting at "new" since the row was created. 28 of them on one live
//     tenant.
//
// So leadChaseBlocker is EXECUTED against each of those, and the cost of the
// wording is MEASURED rather than asserted — the table at the end is the
// number the owner sees before this ships, not after.

import { readFileSync } from "node:fs";
import {
  LEAD_STOP_REASONS,
  leadChaseBlocker,
  chaseFloor,
} from "@/lib/followUps/stopConditions";
import { activationStamp } from "@/lib/followUps/defaults";
import { memberIsBookable } from "@/lib/booking/bookableMembers";
import { selfBookingSlug, selfBookingUrl, LEAD_TEXT_REQUIRES_BOOKING } from "@/lib/booking/selfBookingLink";
import { SMS_TEMPLATE_TYPES, validateTemplate, renderMessage } from "@/lib/sms/renderTemplate";
import { SMS_LANGUAGES } from "@/lib/sms/templates";
import { FOLLOW_UP_TEXT_REASONS } from "@/lib/sms/followUpTextRules";
import { smsSegments, TEXT_CENTS } from "@/lib/businessNumber/costs";
import { isGsm7 } from "@/lib/sales/checkin/draft";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const cron = code(read("app/api/cron/follow-ups/route.js"));
const sender = code(read("lib/sms/followUpText.js"));
const stops = code(read("lib/followUps/leadChaseFacts.js"));
const pureStops = code(read("lib/followUps/stopConditions.js"));
const page = read("app/app/settings/follow-ups/page.js");
const diagram = read("app/app/settings/follow-ups/FlowDiagram.js");
const rulesRoute = code(read("app/api/settings/follow-up-rules/route.js"));
const ruleRoute = code(read("app/api/settings/follow-up-rules/[id]/route.js"));
const booking = code(read("lib/booking/bookableMembers.js"));
const leadRoute = code(read("app/api/leads/[id]/route.js"));
const leadsPage = read("app/app/leads/page.js");
const schema = read("prisma/schema.prisma");

// ══ 1. leadChaseBlocker, executed ══════════════════════════════════════════
console.log("\nWhen an enquiry must be left alone");

const DAY = 86400000;
const now = new Date("2026-11-03T12:00:00Z");
// A rule switched on a week ago; a lead that arrived two days ago.
const rule = { builtInKey: "lead_new_d1", createdAt: new Date(now - 60 * DAY), activatedAt: new Date(now - 7 * DAY) };
const lead = (over = {}) => ({ status: "new", quoteId: null, createdAt: new Date(now - 2 * DAY), ...over });

ok("a new enquiry, nothing else, IS chased", leadChaseBlocker({ lead: lead(), rule, now }) === null);

// The owner's three, each on its own.
ok("an appointment is booked → appointment",
  leadChaseBlocker({ lead: lead(), rule, facts: { hasAppointment: true }, now }) === "appointment");
ok("the work is sold → job",
  leadChaseBlocker({ lead: lead(), rule, facts: { hasJob: true }, now }) === "job");
ok("a quote recorded on the lead → quoted",
  leadChaseBlocker({ lead: lead({ quoteId: "q1" }), rule, now }) === "quoted");
// The one the dashboard used to miss: a quote nobody wrote onto the lead.
ok("an INFERRED quote (same client, after the lead) → quoted",
  leadChaseBlocker({ lead: lead(), rule, facts: { hasQuote: true }, now }) === "quoted");
// Both: the reason reported is the furthest the lead actually got, which is
// why "job" is checked before "quoted" — otherwise "job" could never fire.
ok("a quote AND a job → job, so neither reason is unreachable",
  leadChaseBlocker({ lead: lead({ quoteId: "q1" }), rule, facts: { hasQuote: true, hasJob: true }, now }) === "job");
// Every reason the function can return, and nothing it cannot. The list is
// frozen and the settings page's sentence has to name each one, so a reason
// added without a way to reach it — or without an explanation — fails here.
ok("every declared reason is one the function can actually return",
  ["answered", "appointment", "job", "quoted", "replied", "reached", "before_rule"].every((r) => LEAD_STOP_REASONS.includes(r))
    && LEAD_STOP_REASONS.length === 7);

// An appointment beats a quote, because the chase ASKS them to book: telling
// somebody who booked on Tuesday that nobody can reach them is the worst of
// the four wrong messages.
ok("an appointment outranks a quote", leadChaseBlocker({ lead: lead({ quoteId: "q1" }), rule, facts: { hasAppointment: true }, now }) === "appointment");

console.log("\nThe reply rule");

ok("a reply AFTER they enquired → replied",
  leadChaseBlocker({ lead: lead(), rule, facts: { repliedAt: new Date(now - 1 * DAY) }, now }) === "replied");
// The message that CREATED a conversation lead cannot be a reply to it.
ok("a message from BEFORE the lead existed is not a reply",
  leadChaseBlocker({ lead: lead(), rule, facts: { repliedAt: new Date(now - 5 * DAY) }, now }) === null);
ok("a message at exactly the lead's own timestamp is not a reply",
  leadChaseBlocker({ lead: lead(), rule, facts: { repliedAt: new Date(now - 2 * DAY) }, now }) === null);
ok("no reply at all does not stop it",
  leadChaseBlocker({ lead: lead(), rule, facts: { repliedAt: null }, now }) === null);

// ══ The manual half — the one FieldQuo cannot see ═════════════════════════
//
// The owner, correcting the automatic reply rule: "it might be manually
// because the system isn't able to see if they answered the call. or reply
// back to a text from the company's number."
//
// Both paths matter and they are different: the automatic one needs the reply
// to be shown to have come AFTER the enquiry (an inbound message can be the
// one that created the lead), and the manual one cannot — the control does
// not exist until the lead does.
console.log("\nSomebody said they had spoken to them");

ok("marked reached → reached",
  leadChaseBlocker({ lead: lead(), rule, facts: { reachedAt: new Date(now - 1 * DAY) }, now }) === "reached");
ok("…and it is its own reason, not folded into \"replied\" — the two are different evidence",
  LEAD_STOP_REASONS.includes("reached") && LEAD_STOP_REASONS.includes("replied"));
// The asymmetry with the reply rule, stated as a test rather than a comment:
// a mark dated before the lead is still a true statement, because the button
// did not exist before the lead did. A floor would only discard the truth.
ok("a mark is not subject to the reply rule's date floor",
  leadChaseBlocker({ lead: lead(), rule, facts: { reachedAt: new Date(now - 5 * DAY) }, now }) === "reached");
// Reversible. This is the assertion that keeps a wrong mark from switching a
// lead off for ever.
ok("undone → chased again", leadChaseBlocker({ lead: lead(), rule, facts: { reachedAt: null }, now }) === null);
ok("…and an empty value is not a mark",
  leadChaseBlocker({ lead: lead(), rule, facts: { reachedAt: "" }, now }) === null
    && leadChaseBlocker({ lead: lead(), rule, facts: { reachedAt: undefined }, now }) === null);
// An OUTBOUND attempt must never read as contact. Only an inbound reply or a
// human's mark stops the chase; a call nobody answered is still unanswered.
ok("the blocker has no notion of an attempt at all — it reads only the two kinds of evidence",
  !/attempt/i.test(pureStops));

console.log("\nThe mark is stored, attributed and reversible");

ok("two additive nullable columns, not a status", /reachedAt\s+DateTime\?/.test(schema) && /reachedById\s+String\?/.test(schema));
ok("…and LeadStatus is untouched", !/reached/.test((schema.match(/enum LeadStatus \{[\s\S]*?\}/) || [""])[0]));
ok("the PATCH takes a boolean, so nobody can post a date in the past or the future",
  /typeof body\.reached !== "boolean"/.test(leadRoute));
ok("…stamping who and when together", /data\.reachedAt = body\.reached \? new Date\(\) : null;/.test(leadRoute)
  && /data\.reachedById = body\.reached \? member\.userId \|\| null : null;/.test(leadRoute));
ok("…and clearing BOTH on undo, so no statement is left with nobody behind it",
  /reachedById = body\.reached \? member\.userId \|\| null : null/.test(leadRoute));
ok("the change is logged like the other things a person asserts about a lead",
  /lead\.marked_reached/.test(leadRoute) && /lead\.marked_not_reached/.test(leadRoute));
ok("…only on a real change, so re-pressing is not recorded as news",
  /Boolean\(existing\.reachedAt\) !== Boolean\(data\.reachedAt\)/.test(leadRoute));
ok("the drawer reads who marked it", /reachedBy: \{ select: \{ id: true, name: true \} \}/.test(leadRoute));
ok("the cron carries the lead's own column through as a fact", /reachedAt: lead\.reachedAt \|\| null/.test(stops));

console.log("\nThe control says what it DOES");

ok("the lead drawer has the mark and the undo", /app\.leads\.reached\.mark/.test(leadsPage) && /app\.leads\.reached\.undo/.test(leadsPage));
ok("…behind the same edit permission as the rest of the lead", /patch\(\{ reached: true \}\)/.test(leadsPage) && /canEditLead/.test(leadsPage));
ok("…and it prints who marked it and when", /reachedBy\?\.name/.test(leadsPage) && /app\.leads\.reached\.onNote/.test(leadsPage));
// The label is the test. "Reached ☑" names a column; this has to read as an
// instruction a contractor can act on.
{
  const label = APP_MESSAGES.en["app.leads.reached.mark"] || "";
  const hint = APP_MESSAGES.en["app.leads.reached.hint"] || "";
  ok("the button says what happens, not what is stored", /stop/i.test(label) && /follow-?up/i.test(label), label);
  ok("the hint names the cases FieldQuo cannot see", /mobile/i.test(hint) && /Facebook|Instagram/i.test(hint), hint);
  ok("the undo says the follow-ups come back", /again|start/i.test(APP_MESSAGES.en["app.leads.reached.undo"] || ""));
}
for (const key of ["app.leads.reached.title", "app.leads.reached.mark", "app.leads.reached.hint", "app.leads.reached.onNote", "app.leads.reached.someone", "app.leads.reached.undo"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in all nine languages`, missing.length === 0, missing.join(","));
}

console.log("\nSomebody picked it up");

for (const status of ["contacted", "qualified", "converted", "lost"]) {
  ok(`status "${status}" → answered`, leadChaseBlocker({ lead: lead({ status }), rule, now }) === "answered");
}
ok("no lead at all → answered, never a send", leadChaseBlocker({ lead: null, rule, now }) === "answered");
ok("undefined input does not throw", leadChaseBlocker() === "answered" && leadChaseBlocker({}) === "answered");

// ══ 2. The switch-on burst ═════════════════════════════════════════════════
//
// This is the assertion that stands between a company trying the feature and
// 28 texts going out in one run.
console.log("\nThe switch-on floor");

ok("a lead older than the activation is NOT chased",
  leadChaseBlocker({ lead: lead({ createdAt: new Date(now - 30 * DAY) }), rule, now }) === "before_rule");
ok("a lead newer than the activation IS chased",
  leadChaseBlocker({ lead: lead({ createdAt: new Date(now - 1 * DAY) }), rule, now }) === null);
// The bug this column exists for: createdAt alone is the row's birthday, not
// the decision, and the enquiry defaults are seeded OFF months before anybody
// switches one on.
ok("the floor is the ACTIVATION, not the row's creation",
  chaseFloor(rule).getTime() === new Date(now - 7 * DAY).getTime());
ok("a rule never switched off falls back to createdAt, so the quote defaults are unchanged",
  chaseFloor({ createdAt: new Date(now - 60 * DAY), activatedAt: null }).getTime() === new Date(now - 60 * DAY).getTime());
ok("a hand-made rule keeps catching up on older enquiries",
  leadChaseBlocker({ lead: lead({ createdAt: new Date(now - 30 * DAY) }), rule: { builtInKey: null, createdAt: rule.createdAt }, now }) === null);
ok("chaseFloor survives rows with neither column", chaseFloor({}) === null && chaseFloor(null) === null);
ok("…and an unparseable stamp, rather than comparing against NaN", chaseFloor({ activatedAt: "whenever" }) === null);

console.log("\nThe stamp that sets the floor");

ok("switching OFF → ON stamps it", activationStamp({ active: false }, true, now).activatedAt === now);
ok("a row that was never active stamps it", activationStamp({}, true, now).activatedAt === now);
// Re-saving an active rule must not move the floor forward, or every edit
// would quietly narrow what the rule chases.
ok("re-saving an already-active rule stamps nothing", Object.keys(activationStamp({ active: true }, true, now)).length === 0);
ok("switching OFF stamps nothing", Object.keys(activationStamp({ active: true }, false, now)).length === 0);
ok("an untouched switch stamps nothing", Object.keys(activationStamp({ active: true }, undefined, now)).length === 0);
ok("the PATCH route stamps it", /activationStamp\(existing, active\)/.test(ruleRoute));
ok("a reset that switches a paused rule back on stamps it too",
  /activationStamp\(rule, def\.active !== false\)/.test(code(read("lib/followUps/defaults.js"))));
ok("the column exists and is nullable", /activatedAt\s+DateTime\?/.test(schema));

// ══ 3. The cron asks, once, with the matchers that already exist ═══════════
console.log("\nThe cron");

ok("it runs the enquiry blocker", /leadChaseBlocker\(\{/.test(cron));
ok("…before the FollowUpLog claim, so a booked lead never spends its one chase",
  cron.indexOf("leadChaseBlocker({") < cron.indexOf("followUpLog.create"));
ok("…and counts the reason the same way the quote stop reasons are counted",
  /if \(blocker\) \{\n\s*stop\(blocker\);/.test(cron));
ok("the facts are gathered ONCE per rule, not per lead",
  /const leadFacts =\n?\s*finder\.entityType === "lead" && entities\.length/.test(cron));
ok("…and not at all on a run where the finder found nothing",
  /entities\.length\n?\s*\? await gatherLeadChaseFacts/.test(cron));
// No third matcher: the two that already exist, and the one that writes.
ok("the facts reuse leadFacts' client/quote matching", /loadLeadFacts/.test(stops));
ok("…with assignRefs OFF, so asking does not write agency refs", /assignRefs: false/.test(stops));
ok("…and linkedDocuments' any-mode appointment rule", /loadLeadAppointments/.test(stops));
ok("…which is exported for exactly that, rather than copied",
  /export async function loadLeadAppointments/.test(read("lib/leads/linkedDocuments.js")));
ok("a CANCELLED appointment does not stop the chase — getting them to rebook is the point",
  /a\.status !== "cancelled"/.test(stops));
ok("the reply is the lead's LAST inbound, not the one that created it", /lastInboundAt/.test(stops));

// ── The decisions stay out of the browser bundle ─────────────────────────
//
// lib/dashboard/workPanel.js imports quoteChaseBlocker from stopConditions.js
// and app/components/dashboard/WorkPanel.js is a client component, so
// everything stopConditions.js can reach, a browser downloads. Putting the
// gatherer there — even behind `await import()`, which does NOT keep a module
// out of the bundle — failed `npm run build` with seven "Can't resolve 'dns'"
// errors tracing pg into a client component. Pinned here so the next person
// who finds the split odd finds out why before the build does.
ok("stopConditions.js reaches no database at all",
  !/lib\/db|leadFacts|linkedDocuments|campaignRollup/.test(pureStops));
ok("…and no dynamic import either, which is what looked like a precaution and wasn't",
  !/await import\(/.test(pureStops));
ok("the gatherer is the module that may reach them", /loadLeadFacts/.test(stops) && /loadLeadAppointments/.test(stops));
ok("…and the cron takes it from there, not from stopConditions",
  /from "@\/lib\/followUps\/leadChaseFacts"/.test(cron));

// ══ 4. The booking page, and what actually gates it ═══════════════════════
console.log("\nThe self-booking link");

ok("the slug is the booking slug, else the company's",
  selfBookingSlug({ bookingSlug: "chosen", slug: "fallback" }) === "chosen"
    && selfBookingSlug({ slug: "fallback" }) === "fallback"
    && selfBookingSlug({}) === null
    && selfBookingSlug(null) === null);
ok("blank and whitespace slugs are no slug", selfBookingSlug({ bookingSlug: "   ", slug: "" }) === null);
ok("the url is built once, from the origin the caller resolved",
  selfBookingUrl({ company: { slug: "acme" }, origin: "https://www.fieldquo.com" }) === "https://www.fieldquo.com/book/acme");
ok("a trailing slash on the origin does not double up",
  selfBookingUrl({ company: { slug: "acme" }, origin: "https://www.fieldquo.com/" }) === "https://www.fieldquo.com/book/acme");
ok("no origin → no url, never a relative link in a text",
  selfBookingUrl({ company: { slug: "acme" } }) === null && selfBookingUrl({ company: { slug: "acme" }, origin: "" }) === null);
ok("no slug → no url", selfBookingUrl({ company: {}, origin: "https://x.test" }) === null);
ok("an explicit slug wins, so the caller that already asked does not re-derive it",
  selfBookingUrl({ company: { slug: "ignored" }, origin: "https://x.test", slug: "asked" }) === "https://x.test/book/asked");

// The predicate both readers share. "Can a homeowner book" and "who can they
// book" must be the same question, or a text offers a link to an empty page.
ok("an estimator with availability is bookable", memberIsBookable({ role: "owner", userId: "u1" }, 1) === true);
ok("…with no availability is not — setting your hours is how you opt in", memberIsBookable({ role: "owner", userId: "u1" }, 0) === false);
ok("a member with no user row is not", memberIsBookable({ role: "owner", userId: null }, 3) === false);
ok("a role that cannot quote is not, however much availability they set", memberIsBookable({ role: "worker", userId: "u1" }, 5) === false);
ok("no member at all is not", memberIsBookable(null, 1) === false && memberIsBookable(undefined, 1) === false);
ok("a non-numeric count is not availability", memberIsBookable({ role: "owner", userId: "u1" }, "yes") === false);
ok("listBookableMembers uses the same predicate", /if \(!memberIsBookable\(m, scheduleCount\)\) continue;/.test(booking));
ok("hasBookableMember uses it too", /memberIsBookable\(m, perUser\.get\(m\.userId\) \|\| 0\)/.test(booking));
// The three real conditions — the slug is only one of them.
ok("it refuses a company with no slug", /reason: "no_slug"/.test(booking));
ok("it refuses one whose public profile is incomplete, like /book itself does",
  /clientFacingGaps\(company\)\.length > 0/.test(booking) && /reason: "profile_incomplete"/.test(booking));
ok("it refuses one with no estimator and one with nobody on availability",
  /reason: "no_estimator"/.test(booking) && /reason: "no_availability"/.test(booking));
// And the test it deliberately does NOT use.
ok("it does NOT count EventType rows — the consultation event is created lazily",
  !/eventType\.(count|findMany|findFirst)/.test(booking.slice(booking.indexOf("export async function hasBookableMember"))));

console.log("\nAnd what happens without one");

ok("the decision is a named constant, not a buried if", LEAD_TEXT_REQUIRES_BOOKING === true);
ok("the verdict refuses the enquiry chase with its own reason", /reason: "no_booking"/.test(sender));
ok("…only for the enquiry chase; a quote chase has its own link", /trigger === "lead_no_response"/.test(sender));
ok("…asked AFTER the opt-out, because it costs three queries",
  sender.indexOf("maySms(") < sender.indexOf("hasBookableMember("));
ok("…and BEFORE the claim, so a company that sets booking up next week is not already spent",
  cron.indexOf("followUpTextVerdict({") < cron.indexOf("followUpLog.create"));
ok("the cron passes the trigger and the origin to the verdict",
  /trigger: rule\.triggerEvent,\n\s*origin: getAppOrigin\(request\),/.test(cron));
ok("no_booking is a declared reason", FOLLOW_UP_TEXT_REASONS.includes("no_booking"));
ok("the link the text carries is the one the verdict proved resolves, not a second expression",
  /const bookingUrl = verdict\.bookingUrl \|\| null;/.test(sender));

// ══ 5. The wording: link first, promise second, nothing invented ══════════
console.log("\nThe wording");

const BOOK = "https://www.fieldquo.com/book/truefinish-cabinets";
const FULL = { company: "TrueFinish Cabinets", name: "Maureen", link: BOOK, assignedTo: "Daniel", phone: "819-555-0100" };

ok("{link} is now a legal enquiry token — it is the whole point of the text",
  validateTemplate("lead_follow_up", "{company}: {link}").ok);
ok("{assignedTo} is legal", validateTemplate("lead_follow_up", "{assignedTo} will call").ok);
ok("{amount} still is not — nobody has looked at the job", !validateTemplate("lead_follow_up", "{amount}").ok);
ok("{number} still is not — there is no quote", !validateTemplate("lead_follow_up", "{number}").ok);
ok("a quote chase may not use {assignedTo} or {video}",
  !validateTemplate("quote_follow_up", "{assignedTo}").ok && !validateTemplate("quote_follow_up", "{video}").ok);

for (const lang of SMS_LANGUAGES) {
  const full = renderMessage({ type: "lead_follow_up", templates: null, language: lang, values: FULL });
  // The order the owner asked for: the action, then who will be in touch,
  // then the number. Asserted as positions, because "contains" would pass on
  // a message that buries the link at the end.
  ok(`${lang}: the booking link comes before the phone number`, full.indexOf(BOOK) < full.indexOf("819-555-0100"), full);
  ok(`${lang}: it names the assigned person`, full.includes("Daniel"), full);
  ok(`${lang}: it names the company's phone`, full.includes("819-555-0100"), full);
  ok(`${lang}: it keeps the STOP keyword the inbound handler listens for`, /\bSTOP\b/.test(full), full);
  ok(`${lang}: it is not the English sentence`, lang === "en" || !/Book your estimate online/.test(full), full);

  // ── The three absences, each on its own ───────────────────────────────
  //
  // An unassigned lead is the one that matters most: 28 of 99 on the live
  // tenant, and "someone will be in touch" there is a promise nothing keeps.
  const noAssignee = renderMessage({ type: "lead_follow_up", templates: null, language: lang, values: { ...FULL, assignedTo: null } });
  ok(`${lang}: no assignee → the sentence is GONE, not "someone will be in touch"`,
    !noAssignee.includes("Daniel") && noAssignee.includes(BOOK) && !/undefined|null|\s{2,}|\s[,.;।]/.test(noAssignee), noAssignee);
  const noPhone = renderMessage({ type: "lead_follow_up", templates: null, language: lang, values: { ...FULL, phone: null } });
  ok(`${lang}: no phone on file → the clause is dropped cleanly`,
    !noPhone.includes("819") && !/undefined|null|\s{2,}|\s[,.;।]/.test(noPhone), noPhone);
  const bare = renderMessage({ type: "lead_follow_up", templates: null, language: lang, values: { company: "TrueFinish Cabinets", name: null, link: null, assignedTo: null, phone: null } });
  ok(`${lang}: nothing at all still reads as a sentence`,
    !/undefined|null|http|\s{2,}|\s[,.;।]/.test(bare) && /\bSTOP\b/.test(bare), bare);
  // No money, ever: nobody has looked at the job.
  ok(`${lang}: no figure, no currency`, !/\$|€|CAD|USD/.test(full), full);
}

// ══ 6. The cost, MEASURED ═════════════════════════════════════════════════
//
// The number the owner asked to see before this ships. Segment arithmetic,
// not a character count — those are different numbers and only one of them is
// on the invoice. A booking url is ~49 characters, and outside GSM-7 every
// character costs a slot of 67 rather than 153.
console.log("\nWhat it costs, per language, with a real booking url\n");

const rows = SMS_LANGUAGES.map((lang) => {
  const body = renderMessage({ type: "lead_follow_up", templates: null, language: lang, values: FULL });
  const segments = smsSegments(body);
  return {
    lang,
    chars: [...body].length,
    encoding: isGsm7(body) ? "GSM-7" : "UCS-2",
    perSegment: isGsm7(body) ? 153 : 67,
    segments,
    "¢ (own number)": segments * TEXT_CENTS,
    "3 chases ¢": segments * 3 * TEXT_CENTS,
  };
});
console.table(rows);
console.log(
  `     TEXT_CENTS = ${TEXT_CENTS}¢ per segment on a company's OWN brought number\n` +
    "     (lib/businessNumber/costs.js). From FieldQuo's shared number nothing is\n" +
    "     charged to the company and FieldQuo pays Twilio directly.\n",
);

// Two segments in English, four in the UCS-2 languages. Pinned so a wording
// edit that doubles the bill fails here rather than appearing on it.
for (const r of rows) {
  ok(`${r.lang}: ${r.segments} segment(s), ${r.encoding} — within the two-message ceiling for its encoding`,
    r.segments <= (r.encoding === "GSM-7" ? 2 : 4), r);
}
ok("English fits in two segments", rows.find((r) => r.lang === "en").segments === 2);
ok("French stays GSM-7 — the wording avoids À and ç on purpose, and it halves the bill",
  rows.find((r) => r.lang === "fr").encoding === "GSM-7");
// Measured, not assumed: this is where a guess was wrong once already.
{
  const en = renderMessage({ type: "lead_follow_up", templates: null, language: "en", values: FULL });
  const withVideo = `${en} https://www.youtube.com/watch?v=dQw4w9WgXcQ`;
  ok("adding the pre-quote video back costs ZERO extra segments, so it is out for a reason that is not cost",
    smsSegments(withVideo) === smsSegments(en), { base: smsSegments(en), withVideo: smsSegments(withVideo) });
}
console.log(`     → "${renderMessage({ type: "lead_follow_up", templates: null, language: "en", values: FULL })}"`);
console.log(`     → unassigned, no phone: "${renderMessage({ type: "lead_follow_up", templates: null, language: "en", values: { ...FULL, assignedTo: null, phone: null } })}"`);

// ══ 7. Every reason is a sentence somebody is shown ═══════════════════════
//
// A stop condition nobody was told about is a company wondering why its
// automation is quiet. The settings page prints ONE sentence per trigger (the
// same shape the quote chase has), so that sentence must name every reason.
console.log("\nEvery reason is explained");

{
  const sentence = APP_MESSAGES.en["app.followFlow.stopLeadAnswered"] || "";
  const MENTIONS = {
    appointment: /appointment|book/i,
    job: /sold|job/i,
    quoted: /quote/i,
    replied: /repl/i,
    answered: /New|status/i,
    reached: /reached|spoken/i,
    before_rule: null, // not a stop the company configured — it is the floor
  };
  for (const reason of LEAD_STOP_REASONS) {
    const re = MENTIONS[reason];
    if (!re) continue;
    ok(`"${reason}" is named in the sentence the page prints`, re.test(sentence), sentence);
  }
  ok("the sentence is in every language", Object.values(APP_MESSAGES).every((d) => d["app.followFlow.stopLeadAnswered"]));
}
for (const key of ["app.setFollowUps.smsNeedsBooking", "app.followFlow.smsNeedsBookingNote", "app.smsTemplates.token.bookLink", "app.smsTemplates.token.assignedTo"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in all nine languages`, missing.length === 0, missing.join(","));
}
// Every token hint on the enquiry type must resolve, or the screen prints a
// raw "app.smsTemplates.…" at a contractor.
{
  const spec = SMS_TEMPLATE_TYPES.lead_follow_up;
  const keys = [spec.labelKey, ...Object.values(spec.tokens).map((m) => m.hintKey)];
  const missing = Object.entries(APP_MESSAGES).flatMap(([l, d]) => keys.filter((k) => !d[k]).map((k) => `${l}:${k}`));
  ok("every enquiry token hint resolves in every language", missing.length === 0, missing.slice(0, 6));
}

console.log("\nThe screens say what a text rule needs");

ok("the page warns when there is no booking page", /app\.setFollowUps\.smsNeedsBooking/.test(page));
ok("…and treats an unanswered load as unknown, not as missing", /canSelfBook === false/.test(page) && !/!canSelfBook/.test(code(page)));
ok("the diagram draws such a step as not sending", /needsBooking/.test(diagram) && /smsNeedsBookingNote/.test(diagram));
ok("…only for the enquiry trigger", /rule\.triggerEvent === "lead_no_response"/.test(diagram));
ok("the rules API reports whether the booking page resolves", /canSelfBook: booking\?\.ok === true/.test(rulesRoute));
ok("…and a failed lookup is 'unknown', not 'you have no booking page'", /reason: "unknown"/.test(rulesRoute));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
