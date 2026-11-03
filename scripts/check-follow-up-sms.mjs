// scripts/check-follow-up-sms.mjs
//
// The follow-up cron's SECOND channel, and the pre-quote video the enquiry
// chase links to.
//
//   npm run check:follow-up-sms
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// lib/followUps/triggers.js used to end with `FOLLOW_UP_CHANNEL = "email"` and
// a comment saying to widen it only when the cron genuinely gained a channel.
// Widening a constant is one line; the thing that makes it honest is a long
// list of guards, and every one of them fails silently:
//
//   · a company that never chose follow-up texts starting to send them,
//   · a number that replied STOP getting chased anyway,
//   · a lead with a mobile and no email being filtered out of the query
//     before anything could decide to text it,
//   · a text spending the one FollowUpLog claim this rule ever gets at this
//     lead and then not going out,
//   · two of the longest texts FieldQuo sends landing in the platform's
//     "Other" bucket, where nobody can see a carrier dropping them,
//   · and a half-typed video address going out as a link in a homeowner's
//     phone under the contractor's brand.
//
// So the PURE rules are executed against the inputs that produce each of
// those, and the impure ones — the cron and the sender — are read as text for
// the ordering guarantees a unit test cannot see.

import { readFileSync } from "node:fs";
import {
  FOLLOW_UP_TEXT_TYPE,
  followUpTextOn,
  followUpTextType,
  FOLLOW_UP_TEXT_REASONS,
  clientFirstName,
} from "@/lib/sms/followUpTextRules";
import {
  SMS_TEMPLATE_TYPES,
  FOLLOW_UP_TEXT_TYPES,
  validateTemplate,
  renderMessage,
} from "@/lib/sms/renderTemplate";
import { SMS_COPY, SMS_LANGUAGES } from "@/lib/sms/templates";
import { SMS_PURPOSES, normalisePurpose } from "@/lib/sms/deliveryStatus";
import {
  FOLLOW_UP_CHANNELS,
  followUpChannel,
  triggerMaySms,
  SUPPORTED_TRIGGERS,
  TRIGGER_META,
} from "@/lib/followUps/triggers";
import { normalisePreQuoteVideoUrl, preQuoteVideoFor } from "@/lib/followUps/preQuoteVideo";
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
// A source read for a REGEX assertion has to lose its comments first. Every
// file here explains in prose the thing it must not do — followUpText.js
// spends a paragraph on what reading `company.id` cost — and a raw read cannot
// tell the explanation from the deed.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const senderSrc = read("lib/sms/followUpText.js");
const sender = code(senderSrc);
const cron = code(read("app/api/cron/follow-ups/route.js"));
const page = read("app/app/settings/follow-ups/page.js");
const messagesPage = read("app/app/settings/messages/page.js");
const templatesRoute = read("app/api/settings/message-templates/route.js");
const rulesRoute = read("app/api/settings/follow-up-rules/route.js");
const ruleRoute = read("app/api/settings/follow-up-rules/[id]/route.js");
const videoRoute = read("app/api/settings/pre-quote-video/route.js");
const schema = read("prisma/schema.prisma");

// ══ 1. The switch, executed ════════════════════════════════════════════════
//
// Four lines, and every one of them is either a way to text somebody who did
// not ask or a way to silence a company that did.
console.log("\nThe switch — OFF until the company says yes");

ok("on only when the column says true", followUpTextOn({ followUpSmsOn: true }) === true);
ok("off when the company turned it off", followUpTextOn({ followUpSmsOn: false }) === false);
// The difference from documentTextOn next door, which defaults ON. This one
// must read every kind of "nothing was said" as no, because the text it
// governs goes to somebody who has not replied.
ok(
  "a company that never chose is OFF, not on",
  followUpTextOn({}) === false && followUpTextOn({ followUpSmsOn: null }) === false && followUpTextOn({ followUpSmsOn: undefined }) === false,
);
ok(
  "a truthy-but-not-true value is not consent",
  followUpTextOn({ followUpSmsOn: 1 }) === false && followUpTextOn({ followUpSmsOn: "true" }) === false,
);
ok("no row at all is not consent", followUpTextOn(null) === false && followUpTextOn(undefined) === false);
ok(
  "the column defaults false in the schema, so an unmigrated row is off too",
  /followUpSmsOn\s+Boolean @default\(false\)/.test(schema),
);

// ══ 2. Which triggers may text, and which may not ══════════════════════════
console.log("\nWhich triggers may text");

ok("the enquiry and quote chases may", triggerMaySms("lead_no_response") && triggerMaySms("quote_no_response"));
ok(
  "the invoice and job chases may NOT — triggers.js argues both",
  !triggerMaySms("invoice_overdue") && !triggerMaySms("job_completed"),
);
ok("a trigger nobody defined may not", !triggerMaySms("made_up") && !triggerMaySms(undefined) && !triggerMaySms(null));
ok(
  "the type map and triggerMaySms cannot disagree",
  SUPPORTED_TRIGGERS.every((t) => Boolean(FOLLOW_UP_TEXT_TYPE[t]) === triggerMaySms(t)),
);
ok(
  "the one COMMERCIAL trigger has no SMS wording — a text has no room for an unsubscribe link",
  SUPPORTED_TRIGGERS.filter((t) => TRIGGER_META[t].commercial).every((t) => !triggerMaySms(t)),
);
ok("the map is frozen, so a caller cannot add a channel to a trigger at runtime", Object.isFrozen(FOLLOW_UP_TEXT_TYPE));
ok("followUpTextType is total", followUpTextType("quote_no_response") === "quote_follow_up" && followUpTextType("nope") === null);
ok(
  "the two types the switch governs are exactly the two the map names",
  [...FOLLOW_UP_TEXT_TYPES].sort().join(",") === Object.values(FOLLOW_UP_TEXT_TYPE).sort().join(","),
);

// ══ 3. followUpChannel, on the rows a real table produces ══════════════════
console.log("\nThe channel on a row");

ok("the column's two values", followUpChannel({ channel: "email" }) === "email" && followUpChannel({ channel: "sms" }) === "sms");
// The direction this must lean, and why: email is the channel every one of
// the 114 rows that existed before the column actually used, and it is also
// the one that costs nothing per send and carries no consent weight. An
// unreadable value resolving to "sms" would be a text nobody chose.
ok("a row from before the column reads as email", followUpChannel({}) === "email");
ok("an unknown channel reads as email, never as a text", followUpChannel({ channel: "whatsapp" }) === "email");
ok("nonsense reads as email", followUpChannel({ channel: 7 }) === "email" && followUpChannel({ channel: {} }) === "email");
ok("no row reads as email", followUpChannel(null) === "email" && followUpChannel(undefined) === "email");
ok("padding and case are tolerated", followUpChannel({ channel: " SMS " }) === "sms");
ok("every declared channel round-trips", FOLLOW_UP_CHANNELS.every((c) => followUpChannel({ channel: c }) === c));
ok("the column defaults email in the schema", /channel\s+String\s+@default\("email"\)/.test(schema));

// ══ 4. The sender's own guards, in order ═══════════════════════════════════
//
// Read rather than executed: the sender needs a database, and what matters
// here is the ORDER of its checks, which no unit test can see.
console.log("\nThe sender");

ok("it renders through renderMessage, so the company's wording is the wording", /renderMessage\(\{\s*type,/.test(sender));
ok("…choosing the type from the TRIGGER, never from a string per caller", /const type = followUpTextType\(trigger\);/.test(sender));
ok("…and a trigger with no wording sends nothing", /if \(!type\) return \{ texted: false, reason: "no_wording" \};/.test(sender));
ok("it asks maySms — SmsOptOut and CallConsent both", /maySms\(/.test(sender));
ok(
  "…BEFORE sendSms, inside the verdict the sender calls first",
  sender.search(/maySms\(/) < sender.search(/await sendSms\(/),
);
ok("it re-reads the switch FRESH from the row", /followUpSmsOn: true/.test(sender) && /followUpTextOn\(row\)/.test(sender));
ok(
  "a company row that isn't there is not a company that said no",
  /if \(!row\) return \{ send: false, reason: "no_company", to: null \};/.test(sender),
);
ok("it sends from the company's own line or the system number", /clientSmsFrom\(company\)/.test(sender));
ok("it files the delivery under the message type itself", /purpose: type,/.test(sender));
// The bug documentText.js shipped and caught: the tenant must never be read
// off the company row, because the cron's four finders select differently.
ok("the tenant is never read off the company row", !/company\??\.id/.test(sender), sender.match(/company\??\.id/g));
ok("…it takes companyId as its own argument", /sendFollowUpText\(\{\s*\n\s*trigger,\s*\n\s*companyId,/.test(senderSrc));
ok("…and refuses without one rather than texting on a guess", /if \(!companyId\) return \{ texted: false, reason: "no_company" \};/.test(sender));
ok("a quote chase with no share token sends nothing rather than a dangling sentence",
  /quote_follow_up" && !quoteUrl\) return \{ texted: false, reason: "no_link" \}/.test(sender));
ok("the trial phone gate keeps its own reason, not \"failed\"", /PHONE_REQUIRED_CODE/.test(sender) && /reason: "phone_unverified"/.test(sender));
ok("it never throws — one unreachable number must not end the run", /catch \(err\) \{[\s\S]{0,400}reason: "failed"/.test(sender));
ok("the video is read through preQuoteVideoFor, never off the column", /preQuoteVideoFor\(company\)/.test(sender) && !/company\?\.preQuoteVideoUrl/.test(sender));
ok("…and only the ENQUIRY chase carries one", /type === "lead_follow_up" \? preQuoteVideoFor\(company\) : null/.test(sender));
ok("every reason it can return is declared", FOLLOW_UP_TEXT_REASONS.length === 9
  && ["no_phone", "opted_out", "switched_off", "phone_unverified", "failed"].every((r) => FOLLOW_UP_TEXT_REASONS.includes(r)));
// Every reason string the sender actually returns must be one of the declared
// ones. A reason the cron counts under a name nobody listed is a counter
// nobody reads.
{
  const returned = [...sender.matchAll(/reason: "([a-z_]+)"/g)].map((m) => m[1]);
  const stray = [...new Set(returned)].filter((r) => !FOLLOW_UP_TEXT_REASONS.includes(r));
  ok("…and the sender returns no reason outside that list", stray.length === 0, stray);
}

// ══ 4b. The verdict, EXECUTED against a scripted database ══════════════════
//
// The three refusals above this are read off the source, which can only show
// that the code is written. These run it. Through scripts/db-stub-loader.mjs,
// so lib/sms/optOut.js's two real queries — SmsOptOut and CallConsent — are
// the ones that answer.
//
// This is the block the whole feature turns on: every other guard here is
// about cost or tidiness, and this one is about texting somebody who told this
// company to stop.
console.log("\nThe verdict, executed");

{
  const { rows, resetDbStub } = await import("@/lib/db");
  const { followUpTextVerdict } = await import("@/lib/sms/followUpText");

  const COMPANY = "co_1";
  const PHONE = "613-555-0142";
  const E164 = "+16135550142";

  const setup = ({ on = true, optedOut = null, callOptOut = false } = {}) => {
    resetDbStub();
    rows.company = [{ id: COMPANY, followUpSmsOn: on }];
    rows.smsOptOut = optedOut === null ? [] : [{ companyId: COMPANY, e164: E164, optedOut }];
    rows.callConsent = callOptOut ? [{ companyId: COMPANY, e164: E164, optedOutAt: new Date() }] : [];
  };

  setup();
  ok("a company that switched it on, a client with a number, no opt-out → send",
    (await followUpTextVerdict({ companyId: COMPANY, phone: PHONE })).send === true);
  ok("…normalised to E.164, which is what Twilio needs",
    (await followUpTextVerdict({ companyId: COMPANY, phone: PHONE })).to === E164);

  setup({ on: false });
  {
    const v = await followUpTextVerdict({ companyId: COMPANY, phone: PHONE });
    ok("a company that never switched it on → refused, and SAID so", v.send === false && v.reason === "switched_off", v);
  }

  setup({ optedOut: true });
  {
    const v = await followUpTextVerdict({ companyId: COMPANY, phone: PHONE });
    ok("a number that replied STOP → refused", v.send === false && v.reason === "opted_out", v);
    // The number still comes back, so the cron can report WHICH number was
    // refused rather than just that something was.
    ok("…and the refusal still names the number", v.to === E164);
  }

  // A STOP recorded against the same company but a DIFFERENT number must not
  // silence this one — the opt-out is per (company, number), and a matcher
  // that ignored the number would stop every text after the first STOP.
  setup({ optedOut: true });
  rows.smsOptOut = [{ companyId: COMPANY, e164: "+16135559999", optedOut: true }];
  ok("somebody else's STOP does not silence this client",
    (await followUpTextVerdict({ companyId: COMPANY, phone: PHONE })).send === true);

  // And a STOP recorded against another TENANT must not silence this one:
  // SmsOptOut is per company on purpose.
  setup();
  rows.smsOptOut = [{ companyId: "co_2", e164: E164, optedOut: true }];
  ok("another company's STOP does not silence this one",
    (await followUpTextVerdict({ companyId: COMPANY, phone: PHONE })).send === true);

  // A START reverses it, which is what carriers expect of the SMS channel.
  setup({ optedOut: false });
  ok("a number that replied START is textable again",
    (await followUpTextVerdict({ companyId: COMPANY, phone: PHONE })).send === true);

  // A VOICE opt-out refuses SMS too — the safer reading of "leave me alone"
  // (lib/sms/optOut.js's own argument). Asserted here because it is the one
  // consequence of maySms that nobody would guess from this file.
  setup({ callOptOut: true });
  {
    const v = await followUpTextVerdict({ companyId: COMPANY, phone: PHONE });
    ok("a number that opted out of CALLS is refused texts too", v.send === false && v.reason === "opted_out", v);
  }

  setup();
  for (const [label, phone] of [["none", null], ["empty", ""], ["gibberish", "ring me"], ["too short", "555"]]) {
    const v = await followUpTextVerdict({ companyId: COMPANY, phone });
    ok(`a client phone that is ${label} → refused as no_phone, never texted on a guess`,
      v.send === false && v.reason === "no_phone" && v.to === null, v);
  }

  setup();
  {
    const v = await followUpTextVerdict({ companyId: "co_missing", phone: PHONE });
    ok("a company row that isn't there is no_company, not switched_off", v.send === false && v.reason === "no_company", v);
  }
  {
    const v = await followUpTextVerdict({ companyId: null, phone: PHONE });
    ok("no tenant at all is refused before anything is read", v.send === false && v.reason === "no_company", v);
  }

  // Every reason the executed verdict produced is one the cron's counters and
  // FOLLOW_UP_TEXT_REASONS know about. A reason nobody declared is a count
  // nobody reads.
  resetDbStub();
}

// ══ 5. The cron sends by the RIGHT channel ═════════════════════════════════
console.log("\nThe cron");

ok("it reads the rule's channel", /const channel = followUpChannel\(rule\);/.test(cron));
ok("an email rule goes through sendEmail", /await sendEmail\(\{/.test(cron));
ok("a text rule goes through sendFollowUpText", /await sendFollowUpText\(\{/.test(cron));
// The one that matters: the two paths must be exclusive. An `if` without the
// `continue` would email AND text every chase, doubling the cost and sending
// a homeowner the same nudge twice.
{
  // The branch between the claim and the email machinery. Bounded by two
  // landmarks that survive comment-stripping, because `cron` has had its
  // comments removed — a slice anchored on a comment would silently become
  // the empty string and every assertion over it would pass vacuously.
  const smsStart = cron.indexOf('if (channel === "sms") {', cron.indexOf("followUpLog.create"));
  const smsEnd = cron.indexOf("TRIGGER_META[rule.triggerEvent]?.commercial");
  const smsBranch = smsStart > -1 && smsEnd > smsStart ? cron.slice(smsStart, smsEnd) : "";
  ok("the text path is entered only for an sms rule", smsBranch.length > 0);
  ok("…and leaves before the email path, so no chase goes out twice",
    (smsBranch.match(/continue;/g) || []).length >= 2 && !/sendEmail/.test(smsBranch));
  ok("…counting the send", /texted\+\+;/.test(smsBranch));
  ok("…and counting every decline by reason", /smsSkip\(outcome\.reason\);/.test(smsBranch));
}
ok("an sms rule on a trigger with no wording is skipped and counted, not rendered empty",
  /if \(!FOLLOW_UP_TEXT_TYPE\[rule\.triggerEvent\]\) \{\n\s*skippedNoSmsWording\+\+;/.test(cron));
// The template checks belong to the EMAIL branch. Holding a text rule to them
// would skip every one of them, because a text rule has no template by design.
ok("the template checks are inside the email branch only",
  /\} else \{\n\s*if \(!rule\.template && !builtIn\) \{/.test(cron));

console.log("\nThe cron's ordering guarantees");

{
  const verdictAt = cron.indexOf("followUpTextVerdict(");
  const claimAt = cron.indexOf("followUpLog.create");
  const sendAt = cron.indexOf("sendFollowUpText({");
  ok("the verdict (switch, phone, opt-out) is asked BEFORE the claim", verdictAt > -1 && verdictAt < claimAt);
  ok("…so a STOP or a missing mobile never spends this rule's one chase", /smsSkip\(verdict\.reason\);\n\s*continue;/.test(cron));
  ok("the claim still happens before the send, so two overlapping runs can't double-text", claimAt < sendAt);
  ok("a trial that hasn't verified a mobile gets its claim BACK",
    /outcome\.reason === "phone_unverified"\) \{[\s\S]{0,260}deleteMany\(\{ where: \{ ruleId: rule\.id, entityId: entity\.id \} \}\)/.test(cron));
}
ok("the lead finder asks for a mobile on a text rule, not an email address",
  /channel === "sms" \? \{ phone: \{ not: null \} \} : \{ email: \{ not: null \} \}/.test(cron));
ok("…and the channel is actually passed to it", /finder\.find\(rule, channel\)/.test(cron));
ok("the client's own language decides the wording", /const language = followUpLanguage\(finder\.entityType, entity\);/.test(cron));
ok("the quote link comes from the one module that builds it, not a second expression",
  /mergeDataFor\(finder\.entityType, entity, request, null, language\)/.test(cron) && /quoteUrl: merge\.quoteUrl \|\| null/.test(cron));
ok("the enquiry chase passes the service the homeowner asked about",
  /service: finder\.entityType === "lead" \? entity\.category\?\.label \|\| null : null/.test(cron));
ok("the response says how many went and why the rest didn't",
  /\n    texted,/.test(cron) && /\n    smsSkipped,/.test(cron) && /\n    skippedNoSmsWording,/.test(cron));
// The "no automatic emails or texts" switch on a client governs both channels.
// It sits above the channel branch, so a text cannot slip past it.
ok("the client-level auto-message gate is asked before either channel sends",
  cron.indexOf("autoMessageGate(") > -1 && cron.indexOf("autoMessageGate(") < cron.indexOf("sendFollowUpText({"));

// ══ 6. The routes refuse what the cron would have to skip ══════════════════
console.log("\nThe save routes");

ok("POST refuses an unknown channel rather than storing it", /FOLLOW_UP_CHANNELS\.includes\(wants\)/.test(rulesRoute));
ok("POST refuses sms on a trigger with no wording", /wants === "sms" && !triggerMaySms\(triggerEvent\)/.test(rulesRoute));
ok("POST requires a template for email only", /wants === "email" && !templateId/.test(rulesRoute));
ok("POST stores no template on a text rule", /templateId: wants === "sms" \? null : templateId,/.test(rulesRoute));
ok("PATCH checks the channel against the trigger it WILL have", /const nextTrigger = triggerEvent === undefined \? existing\.triggerEvent : triggerEvent;/.test(ruleRoute));
ok("…and the trigger against the channel it WILL have", /const nextChannel = channel === undefined \? followUpChannel\(existing\) : String\(channel\);/.test(ruleRoute));
ok("PATCH refuses a swing back to email with nothing to send", /nextChannel === "email" && !willHaveTemplate && !existing\.builtInKey/.test(ruleRoute));
ok("PATCH drops the template when a rule becomes a text", /nextChannel === "sms" && existing\.templateId && \{ templateId: null \}/.test(ruleRoute));
ok("the rules GET tells the page whether texts are switched on at all", /smsEnabled: followUpTextOn\(company\)/.test(rulesRoute));
ok("…and whether there is a video to link", /hasPreQuoteVideo: Boolean\(company\?\.preQuoteVideoUrl\)/.test(rulesRoute));

// ══ 7. The wording, in all eight SMS languages ═════════════════════════════
console.log("\nThe wording — eight languages, measured not estimated");

// A real pre-quote video url and a real share token, because the difference
// between two segments and three is what FieldQuo pays.
const VIDEO = "https://www.youtube.com/watch?v=" + "x".repeat(11);
const QUOTE_URL = "https://www.fieldquo.com/q/" + "x".repeat(43);

ok("every catalogue language has both follow-up texts",
  SMS_LANGUAGES.every((l) => ["leadFollowUp", "quoteFollowUp"].every((k) => typeof SMS_COPY[l][k] === "function")));

for (const lang of SMS_LANGUAGES) {
  const lead = renderMessage({
    type: "lead_follow_up",
    templates: null,
    language: lang,
    values: { company: "TrueFinish Cabinets", name: "Maureen", service: "kitchen cabinet refinishing", video: VIDEO, phone: "819-555-0100" },
  });
  ok(`${lang}: the enquiry text is personalised — company, first name, service`,
    lead.includes("TrueFinish Cabinets") && lead.includes("Maureen") && lead.includes("kitchen cabinet refinishing"), lead);
  ok(`${lang}: …and carries the pre-quote video`, lead.includes(VIDEO), lead);
  ok(`${lang}: …and the number to call, because a reply here is read by nobody`, lead.includes("819-555-0100"), lead);
  ok(`${lang}: keeps the STOP keyword the inbound handler listens for`, /\bSTOP\b/.test(lead), lead);
  ok(`${lang}: fits in two segments' worth even with the video link`, lead.length <= 320, lead.length);
  ok(`${lang}: is not the English sentence`, lang === "en" || !/haven't been able to reach you/.test(lead), lead);
  // The three tokens that can legitimately be absent, each on its own: a lead
  // with no name, a form with no service picked, a company with no video and
  // no phone. Every one must read as a sentence rather than leaving a hole.
  const bare = renderMessage({
    type: "lead_follow_up",
    templates: null,
    language: lang,
    values: { company: "TrueFinish Cabinets", name: null, service: null, video: null, phone: null },
  });
  ok(`${lang}: no name, no service, no video, no phone → still a sentence`,
    !/undefined|null|\(\)|\s{2,}|\s[,.;।]/.test(bare) && /\bSTOP\b/.test(bare), bare);
  ok(`${lang}: …and it mentions no video when there is none`, !bare.includes("http"), bare);

  const quote = renderMessage({
    type: "quote_follow_up",
    templates: null,
    language: lang,
    values: { company: "TrueFinish Cabinets", name: "Maureen", number: "Q-2026-0042", link: QUOTE_URL },
  });
  ok(`${lang}: the quote chase names the quote and carries its link`,
    quote.includes("Q-2026-0042") && quote.includes(QUOTE_URL), quote);
  ok(`${lang}: keeps STOP and fits in two segments' worth`, /\bSTOP\b/.test(quote) && quote.length <= 320, quote.length);
  ok(`${lang}: is not the English sentence`, lang === "en" || !/is still open/.test(quote), quote);
  // No money in either built-in wording: a phone is read by whoever holds it,
  // and a chase that re-states a figure reads as a bill.
  ok(`${lang}: neither built-in names a figure`, !/\$|€|CAD|USD/.test(lead + quote), [lead, quote]);
  const noNumber = renderMessage({
    type: "quote_follow_up",
    templates: null,
    language: lang,
    values: { company: "TrueFinish Cabinets", name: "Maureen", number: null, link: QUOTE_URL },
  });
  ok(`${lang}: a quote with no number still reads as a sentence`,
    !/undefined|null|\s{2,}|\s[,.;।]/.test(noNumber) && noNumber.includes(QUOTE_URL), noNumber);
}
console.log(`     → "${renderMessage({ type: "lead_follow_up", templates: null, language: "en", values: { company: "TrueFinish Cabinets", name: "Maureen", service: "kitchen cabinet refinishing", video: VIDEO, phone: "819-555-0100" } })}"`);
console.log(`     → "${renderMessage({ type: "quote_follow_up", templates: null, language: "en", values: { company: "TrueFinish Cabinets", name: "Maureen", number: "Q-2026-0042", link: QUOTE_URL } })}"`);

console.log("\nA company's own wording, and what it may not say");

const custom = renderMessage({
  type: "lead_follow_up",
  templates: { lead_follow_up: "{company}: Hi {name}, still keen to quote your {service}? Watch {video} then call {phone}." },
  language: "en",
  templateLanguage: "en",
  values: { company: "TrueFinish", name: "Maureen", service: "cabinets", video: VIDEO, phone: "819-555-0100" },
});
ok("a custom enquiry text fills every token", custom === `TrueFinish: Hi Maureen, still keen to quote your cabinets? Watch ${VIDEO} then call 819-555-0100.`, custom);
ok("an enquiry text may NOT use {amount} — nobody has looked at the job yet", !validateTemplate("lead_follow_up", "{company}: that'll be {amount}").ok);
ok("an enquiry text may NOT use {link} — there is no quote to link to", !validateTemplate("lead_follow_up", "{company}: {link}").ok);
ok("a quote chase may NOT use {video} — the video is for before the visit", !validateTemplate("quote_follow_up", "{company}: {video}").ok);
ok("a quote chase MAY use {number} and {link}", validateTemplate("quote_follow_up", "{company}: quote {number} — {link}").ok);
// A Spanish-reading homeowner must not get the company's English wording.
{
  const esReader = renderMessage({
    type: "lead_follow_up",
    templates: { lead_follow_up: "Yo {name}, still want that {service} quote?" },
    language: "es",
    templateLanguage: "en",
    values: { company: "TrueFinish", name: "Maureen", service: "cabinets" },
  });
  ok("a Spanish client gets the built-in Spanish, not the English custom text",
    /No hemos logrado/.test(esReader) && !/still want/.test(esReader), esReader);
}

// ══ 8. Registered purposes, and the health page's labels ═══════════════════
//
// SMS_PURPOSES is a CLOSED list and normalisePurpose folds anything else into
// "other" with no error. That is the right default — an unregistered send path
// must still be tracked — but it means a new type silently loses its identity
// on the one page that exists to say which KIND of text a carrier is dropping.
console.log("\nDelivery purposes");

const healthSrc = read("app/platform/sms-health/page.js");
for (const type of FOLLOW_UP_TEXT_TYPES) {
  ok(`${type.padEnd(18)} is a registered SMS purpose`, SMS_PURPOSES.includes(type));
  ok(`${type.padEnd(18)} survives normalisePurpose unchanged (does not fall into "other")`, normalisePurpose(type) === type);
  ok(`${type.padEnd(18)} has a label on the SMS health page`, new RegExp(`\\n  ${type}: "`).test(healthSrc));
}
ok("an unregistered purpose still falls into \"other\" rather than throwing", normalisePurpose("follow_up_whatsapp") === "other");

// ══ 9. The pre-quote video, executed against what people paste ═════════════
console.log("\nThe pre-quote video link");

ok("a plain https link is kept exactly as typed",
  normalisePreQuoteVideoUrl("https://youtu.be/abc123").url === "https://youtu.be/abc123");
ok("…including a query string somebody pasted deliberately",
  normalisePreQuoteVideoUrl("https://www.youtube.com/watch?v=abc&t=30s").url === "https://www.youtube.com/watch?v=abc&t=30s");
ok("surrounding whitespace is trimmed", normalisePreQuoteVideoUrl("  https://vimeo.com/123  ").url === "https://vimeo.com/123");
// Empty is a legal save: it means "no video", and the follow-ups then mention
// none. Reporting it as an error would make clearing the field impossible.
ok("empty clears it rather than failing", normalisePreQuoteVideoUrl("").ok && normalisePreQuoteVideoUrl("").url === null);
ok("whitespace only clears it too", normalisePreQuoteVideoUrl("   \n ").url === null);
ok("null and undefined clear it", normalisePreQuoteVideoUrl(null).url === null && normalisePreQuoteVideoUrl(undefined).url === null);
// The single most common paste. Refused rather than repaired — prefixing
// https:// would be this function guessing at an address a homeowner is sent
// to, and the field is eight characters from correct.
ok("a scheme-less paste is refused, not silently repaired",
  !normalisePreQuoteVideoUrl("youtu.be/abc123").ok && normalisePreQuoteVideoUrl("youtu.be/abc123").reason === "not_a_url");
ok("http is refused — a browser warning over the contractor's video",
  !normalisePreQuoteVideoUrl("http://youtu.be/abc").ok && normalisePreQuoteVideoUrl("http://youtu.be/abc").reason === "not_https");
// These two are the ones that matter most: a stored script in a link the
// company's own clients are sent.
ok("javascript: is refused", !normalisePreQuoteVideoUrl("javascript:alert(1)").ok);
ok("data: is refused", !normalisePreQuoteVideoUrl("data:text/html,<script>alert(1)</script>").ok);
ok("file: is refused", !normalisePreQuoteVideoUrl("file:///Users/me/video.mp4").ok);
ok("a scheme with no host is refused", !normalisePreQuoteVideoUrl("https://").ok);
ok("a host with no dot is refused", !normalisePreQuoteVideoUrl("https://localhost/video").ok);
ok("a bare word is refused", !normalisePreQuoteVideoUrl("video").ok && !normalisePreQuoteVideoUrl("tbc").ok);
ok("a non-string is refused rather than coerced into a link",
  !normalisePreQuoteVideoUrl(42).ok && !normalisePreQuoteVideoUrl({}).ok && normalisePreQuoteVideoUrl([]).url === null);

console.log("\n…and read back the same way it was saved");

ok("a stored https link reads back", preQuoteVideoFor({ preQuoteVideoUrl: "https://youtu.be/abc" }) === "https://youtu.be/abc");
ok("a company with none reads null", preQuoteVideoFor({ preQuoteVideoUrl: null }) === null);
ok("a column the caller forgot to select reads null, never undefined", preQuoteVideoFor({}) === null);
ok("no company reads null", preQuoteVideoFor(null) === null && preQuoteVideoFor(undefined) === null);
// The reason this is a reader and not a property access: a value that somehow
// stopped being a usable address must produce NO video — and therefore no
// sentence about one — rather than a dead link in a homeowner's phone.
ok("a stored value that is no longer a usable link reads null, not a dead link",
  preQuoteVideoFor({ preQuoteVideoUrl: "youtu.be/abc" }) === null
    && preQuoteVideoFor({ preQuoteVideoUrl: "javascript:alert(1)" }) === null
    && preQuoteVideoFor({ preQuoteVideoUrl: "tbc" }) === null);
// It is NOT storyVideoUrl. Two columns, two audiences — and the enquiry
// follow-up must never reach for the "About us" film.
ok("it is a column of its own in the schema", /preQuoteVideoUrl\s+String\?/.test(schema));
ok("the sender reads nothing but the pre-quote column", !/storyVideoUrl/.test(sender));
ok("the cron reads nothing but the pre-quote column", !/storyVideoUrl/.test(cron));

console.log("\nThe editor");

ok("the field lives on Settings › Client messages, beside the wording it appears in",
  /PreQuoteVideo/.test(messagesPage) && /api\/settings\/pre-quote-video/.test(messagesPage));
ok("…and validates with the SAME function the server and the send path use",
  /normalisePreQuoteVideoUrl/.test(messagesPage) && /normalisePreQuoteVideoUrl/.test(videoRoute));
ok("the route refuses what the validator refuses, rather than storing it", /if \(!check\.ok\)/.test(videoRoute) && /data: \{ preQuoteVideoUrl: check\.url \}/.test(videoRoute));
ok("a support session cannot change it — impersonation is read-only", /member\.impersonation/.test(videoRoute));
ok("only owners and admins may", /requirePermission\(member\.role, "user:manage"\)/.test(videoRoute));
ok("the change is logged with the url, because this is a link clients are sent", /metadata: \{ url: check\.url \}/.test(videoRoute));
ok("the screen offers to open it, because the only thing that can be wrong is the address",
  /app\.setMessages\.video\.open/.test(messagesPage) && /target="_blank"/.test(messagesPage));
ok("a company with no video is told so, rather than shown a working-looking link",
  /app\.setMessages\.video\.none/.test(messagesPage));
// The preview must not promise a video the send cannot make.
ok("the server's preview fills {video} with the company's OWN url, not a sample",
  /"video" in spec\.tokens && \{ video: company\?\.preQuoteVideoUrl \|\| null \}/.test(templatesRoute));
ok("…and the local preview has no sample url for it either", /video: "",/.test(messagesPage));

console.log("\nThe switch on Settings › Client messages");

ok("the enquiry chase carries the switch; the quote chase follows it",
  /owner: "lead_follow_up"/.test(templatesRoute) && /types: FOLLOW_UP_TEXT_TYPES/.test(templatesRoute));
ok("it writes the company's own column", /write: \(enabled\) => \(\{ followUpSmsOn: enabled \}\)/.test(templatesRoute));
ok("it reads through followUpTextOn, never the column directly",
  /on: \(company\) => followUpTextOn\(company\)/.test(templatesRoute));
ok("the route selects the column it reports", /followUpSmsOn: true/.test(templatesRoute));
// The copy has to say it is off and why, because a company that did not
// choose this must not be able to switch it on without knowing what it costs.
{
  const on = APP_MESSAGES.en["app.setMessages.followUpSmsOn"] || "";
  const off = APP_MESSAGES.en["app.setMessages.followUpSmsOff"] || "";
  const hint = APP_MESSAGES.en["app.setMessages.followUpSmsHint"] || "";
  ok("the ON copy says who gets texted", /mobile/i.test(on), on);
  ok("the OFF copy says follow-ups go by email only", /email only/i.test(off), off);
  ok("the hint says it is automatic, that they did not ask, and that it is billed",
    /automatic/i.test(hint) && /didn’t ask|didn't ask/i.test(hint) && /billed/i.test(hint), hint);
}

console.log("\nThe follow-ups page says what a text rule depends on");

ok("it offers the channel only where the server will accept it", /triggerMaySms\(form\.triggerEvent\)/.test(page));
ok("…and drops back to email when the trigger changes to one that can't text",
  /channel: triggerMaySms\(triggerEvent\) \? f\.channel : "email"/.test(page));
ok("a text rule needs no template, so Create stops demanding one",
  /disabled=\{saving \|\| \(form\.channel !== "sms" && !form\.templateId\)\}/.test(page));
ok("…and the New-rule button is no longer disabled for a company with no template",
  /disabled=\{Boolean\(loadError\)\}/.test(page));
ok("it warns when the company's follow-up-text switch is off", /app\.setFollowUps\.smsOffWarning/.test(page));
// Comments stripped: the paragraph beside that line explains the distinction
// by quoting `!smsEnabled`, and an assertion that cannot tell prose from code
// is one somebody "fixes" by deleting the explanation.
ok("…and treats an unanswered load as unknown rather than as off",
  /smsEnabled === false/.test(page) && !/!smsEnabled/.test(code(page)));
ok("it says where a text's wording is edited", /app\.setFollowUps\.smsWordingPre/.test(page) && /app\/settings\/messages/.test(page));
ok("it says whether a pre-quote video exists", /app\.setFollowUps\.preQuoteVideoSet/.test(page) && /app\.setFollowUps\.preQuoteVideoNone/.test(page));

// ══ 10. Every new label, in all nine app languages ═════════════════════════
//
// check:translations gates French only, by policy. These keys are on screens a
// contractor configures money-spending automation from, so they are held to
// all nine here — the same bar scripts/check-follow-up-flow.mjs holds the
// diagram's keys to.
console.log("\nNine languages");

const NEW_KEYS = [
  "app.followFlow.sendSms",
  "app.followFlow.smsWording",
  "app.followFlow.noSmsWording",
  "app.followFlow.smsOffNote",
  "app.followFlow.noPhoneNote",
  "app.setFollowUps.channel",
  "app.setFollowUps.channelEmail",
  "app.setFollowUps.channelSms",
  "app.setFollowUps.smsWordingHint",
  "app.setFollowUps.smsWordingPre",
  "app.setFollowUps.smsWordingPost",
  "app.setFollowUps.smsOffWarning",
  "app.setFollowUps.preQuoteVideoSet",
  "app.setFollowUps.preQuoteVideoNone",
  "app.setFollowUps.sampleService",
  "app.setMessages.followUpSmsOn",
  "app.setMessages.followUpSmsOff",
  "app.setMessages.followUpSmsHint",
  "app.setMessages.followUpSmsFollowsOn",
  "app.setMessages.followUpSmsFollowsOff",
  "app.setMessages.video.title",
  "app.setMessages.video.hint",
  "app.setMessages.video.label",
  "app.setMessages.video.invalid",
  "app.setMessages.video.open",
  "app.setMessages.video.none",
  "app.setMessages.video.loadError",
  "app.setMessages.video.saveError",
  "app.setMessages.video.rulesPre",
  "app.setMessages.video.rulesPost",
  "app.smsTemplates.type.lead_follow_up",
  "app.smsTemplates.type.quote_follow_up",
  "app.smsTemplates.token.enquiryService",
  "app.smsTemplates.token.preQuoteVideo",
];

for (const [lang, dict] of Object.entries(APP_MESSAGES)) {
  const missing = NEW_KEYS.filter((k) => !dict[k]);
  ok(`${lang}: all ${NEW_KEYS.length} new keys present`, missing.length === 0, missing.join(", "));
}
// Every labelKey and hintKey the two new types declare must resolve, or the
// screen renders a raw "app.smsTemplates.…" at a contractor.
for (const type of FOLLOW_UP_TEXT_TYPES) {
  const spec = SMS_TEMPLATE_TYPES[type];
  const keys = [spec.labelKey, ...Object.values(spec.tokens).map((m) => m.hintKey)];
  const missing = Object.entries(APP_MESSAGES).flatMap(([lang, dict]) =>
    keys.filter((k) => !dict[k]).map((k) => `${lang}:${k}`),
  );
  ok(`${type.padEnd(18)} every label and token hint resolves in every language`, missing.length === 0, missing.slice(0, 6));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
