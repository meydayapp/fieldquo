// scripts/check-follow-up-flow.mjs
//
// The follow-ups settings page draws a picture of an automation. This checks
// the picture still describes the automation.
//
//   npm run check:follow-up-flow
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// A diagram of a process is the easiest thing in a codebase to leave behind.
// The cron route gains a trigger, or a `where` clause loosens, and the drawing
// keeps confidently showing last quarter's behaviour — a control that appears
// to work and doesn't, in picture form.
//
// So nothing here is a list of expected values. Every assertion reads the cron
// route (app/api/cron/follow-ups/route.js) as text and compares it against the
// metadata the diagram is built from (lib/followUps/triggers.js). Add a trigger
// to one and not the other, or change the channel from email, and this fails.
//
// It also EXECUTES buildFlows() against rows the UI would rather not be handed:
// an unknown trigger, a null delay, a rule whose template was deleted.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SUPPORTED_TRIGGERS,
  TRIGGER_META,
  FOLLOW_UP_CHANNELS,
  followUpChannel,
  triggerMaySms,
} from "../lib/followUps/triggers.js";
import {
  buildFlows,
  delayMs,
  stopKeysFor,
  channelKeyFor,
  channelsIn,
  CHANNEL_KEYS,
  CHANNEL_OPTION_KEYS,
  SKIPPED_KEYS,
  STOP_KEYS,
  ONCE_KEYS,
  TRIGGER_LABEL_KEYS,
  TRIGGER_DESCRIPTION_KEYS,
} from "../lib/followUps/flow.js";
import { DURATION_UNIT_KEYS } from "../lib/i18n/duration.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { MERGE_FIELDS } from "../app/data/emailTemplateBlocks.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}

const cron = read("app/api/cron/follow-ups/route.js");
const diagram = read("app/app/settings/follow-ups/FlowDiagram.js");
const page = read("app/app/settings/follow-ups/page.js");

// ── 1. The cron and the metadata know the same triggers ────────────────────
console.log("\nTriggers\n");

// FINDERS is the cron's own switchboard: a trigger absent from it is a rule
// that silently never fires.
const findersBlock = cron.match(/const FINDERS = \{([\s\S]*?)\n\};/);
ok("cron declares a FINDERS map", Boolean(findersBlock));

const cronTriggers = findersBlock
  ? [...findersBlock[1].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1])
  : [];

ok(
  "every SUPPORTED_TRIGGER has a cron finder",
  SUPPORTED_TRIGGERS.every((k) => cronTriggers.includes(k)),
  `metadata ${SUPPORTED_TRIGGERS.join(",")} vs cron ${cronTriggers.join(",")}`,
);
ok(
  "every cron finder is a SUPPORTED_TRIGGER",
  cronTriggers.every((k) => SUPPORTED_TRIGGERS.includes(k)),
  `cron ${cronTriggers.join(",")}`,
);
ok(
  "TRIGGER_META covers exactly SUPPORTED_TRIGGERS",
  Object.keys(TRIGGER_META).length === SUPPORTED_TRIGGERS.length &&
    SUPPORTED_TRIGGERS.every((k) => TRIGGER_META[k]),
);

// ── 2. Each trigger's declared entityType is the one the cron writes ───────
console.log("\nEntity types\n");

for (const key of SUPPORTED_TRIGGERS) {
  const declared = TRIGGER_META[key]?.entityType;
  // [a-z_]+, not [a-z]+: "change_order" has an underscore in it, and the
  // narrower class silently matched nothing — an assertion that passes by
  // comparing a declared value against undefined is the kind this file exists
  // to prevent.
  const inCron = findersBlock?.[1].match(
    new RegExp(`${key}:\\s*\\{\\s*entityType:\\s*"([a-z_]+)"`),
  )?.[1];
  ok(`${key} → ${declared}`, Boolean(declared) && declared === inCron, `cron says ${inCron}`);
}

// ── 3. Stop conditions, and the words used for them ────────────────────────
console.log("\nStop conditions\n");

for (const key of SUPPORTED_TRIGGERS) {
  const { stopKey, onceKey } = stopKeysFor(key);
  ok(`${key} has a translated stop condition`, Boolean(stopKey));
  ok(`${key} has a translated "once per entity" note`, Boolean(onceKey));
}

// The dedupe that makes "once per entity" true is a unique constraint plus the
// claim-before-send in the cron. If the create() moves after sendEmail(), the
// sentence stops being true.
const claimIndex = cron.indexOf("followUpLog.create");
const sendIndex = cron.indexOf("sendEmail({");
ok(
  "cron claims the FollowUpLog row BEFORE sending",
  claimIndex > -1 && sendIndex > -1 && claimIndex < sendIndex,
);
ok(
  "FollowUpLog is uniquely keyed on (rule, entity)",
  /@@unique\(\[ruleId, entityId\]\)/.test(read("prisma/schema.prisma")),
);

// ── 4. Channels ────────────────────────────────────────────────────────────
//
// This block used to assert `FOLLOW_UP_CHANNEL === "email"` and that the cron
// mentioned no SMS at all, with a note saying the diagram would otherwise be
// describing a feature that isn't there. On 2026-11-02 the feature arrived, so
// the assertions moved WITH it rather than being deleted: the constant is a
// list, and each channel on it must be one the cron genuinely sends by.
console.log("\nChannels\n");

ok("FOLLOW_UP_CHANNELS is email and sms", FOLLOW_UP_CHANNELS.join(",") === "email,sms");
ok("cron sends email via sendEmail", /await sendEmail\(/.test(cron));
ok("cron sends text via the follow-up sender", /await sendFollowUpText\(\{/.test(cron));
ok(
  "cron BRANCHES on the rule's own channel rather than assuming one",
  /const channel = followUpChannel\(rule\);/.test(cron) && /if \(channel === "sms"\)/.test(cron),
);
ok(
  "every declared channel is one the cron has a branch for",
  FOLLOW_UP_CHANNELS.every((c) => (c === "email" ? /await sendEmail\(/ : /await sendFollowUpText\(/).test(cron)),
);
// The whole point of the constant: a channel nobody recognises must degrade
// to the one that has always worked, never to silence and never to a text.
ok("an unknown channel reads as email", followUpChannel({ channel: "whatsapp" }) === "email");
ok("a row from before the column reads as email", followUpChannel({}) === "email" && followUpChannel(null) === "email");
ok("case and padding don't make a text", followUpChannel({ channel: " SMS " }) === "sms" && followUpChannel({ channel: "Email" }) === "email");
// Two of the four triggers can text. triggers.js argues the gap; this pins it,
// because a third one gaining the channel without wording is a rule the cron
// loads and skips for ever.
// Three of the five can text. It was two until 2026-11-17, when the owner
// asked for "a reminder text and email" on an unsigned change order; the
// assertion moved WITH the feature rather than being deleted. The two that
// still cannot are argued in triggers.js, and a fourth gaining the channel
// without wording is a rule the cron loads and skips for ever.
ok("the enquiry, quote and change-order chases may text — and only those",
  SUPPORTED_TRIGGERS.filter(triggerMaySms).join(",")
    === "lead_no_response,quote_no_response,change_order_no_response");
ok("the cron refuses an sms rule on a trigger with no wording, and counts it",
  /if \(!FOLLOW_UP_TEXT_TYPE\[rule\.triggerEvent\]\)/.test(cron) && /skippedNoSmsWording/.test(cron));

// ── 4b. The text path's own guards, read in the cron ──────────────────────
console.log("\nThe text path\n");

ok("an opt-out is asked about BEFORE the claim, so a STOP never spends the chase",
  cron.indexOf("followUpTextVerdict(") > -1 &&
    cron.indexOf("followUpTextVerdict(") < cron.indexOf("followUpLog.create"));
ok("…and its reason is counted, not swallowed", /smsSkip\(verdict\.reason\)/.test(cron));
ok("every decline the sender can make is counted too", /smsSkip\(outcome\.reason\)/.test(cron));
ok("the response carries the per-reason counts and the sent count",
  /smsSkipped,/.test(cron) && /\n    texted,/.test(cron));
ok("a trial that hasn't verified a mobile gets its claim back, so the lead is chased later",
  /outcome\.reason === "phone_unverified"[\s\S]{0,200}followUpLog\n?\s*\.deleteMany/.test(cron));
ok("the lead finder asks for a MOBILE on a text rule, not an email address",
  /channel === "sms" \? \{ phone: \{ not: null \} \} : \{ email: \{ not: null \} \}/.test(cron));
ok("…and the channel reaches the finder at all", /finder\.find\(rule, channel\)/.test(cron));

// ── 5. The diagram only draws states the cron actually produces ────────────
console.log("\nHonesty of the drawn states\n");

ok(
  "cron loads active rules only, so a paused step really is skipped",
  // `deletedAt: null` beside it: a deleted FieldQuo default is a tombstone
  // (FollowUpRule.deletedAt), skipped for a different reason than a pause.
  /findMany\(\{\s*where: \{ active: true, deletedAt: null \}/.test(cron),
);
ok("diagram draws a paused step differently", /border-dashed/.test(diagram));
// The channel is drawn per STEP, from the row, not from a module constant —
// the old code was `FOLLOW_UP_CHANNEL === "email" ? t(...) : FOLLOW_UP_CHANNEL`,
// whose else branch would have printed the bare word "sms" at a contractor.
ok("diagram reads each step's own channel", /channelKeyFor\(rule\)/.test(diagram));
// The single-channel constant is gone from the diagram entirely — it is what
// the raw-value else branch hung off. Comments stripped first: the paragraph
// at the top of FlowDiagram.js explains the bug by QUOTING the old line, and
// an assertion that cannot tell prose from code is one somebody "fixes" by
// deleting the explanation. (Same trick scripts/check-sms-template.mjs uses
// on lib/sms/documentText.js, for the same reason.)
const diagramCode = diagram.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
ok("…and never reaches for the old single-channel constant", !/FOLLOW_UP_CHANNEL\b/.test(diagramCode));
ok("diagram says a text rule's wording lives on the messages screen", /app\.followFlow\.smsWording/.test(diagram));
ok("diagram draws an sms step as not-sending while the company's switch is off",
  /smsEnabled === false/.test(diagram) && /app\.followFlow\.smsOffNote/.test(diagram));
ok("…and treats an absent switch state as unknown, not as off",
  /smsEnabled === false/.test(diagram) && !/!smsEnabled/.test(diagram));
ok("diagram does NOT call a text rule broken for having no template",
  /channel === "sms"\s*\?\s*!triggerMaySms\(rule\.triggerEvent\)/.test(diagram));
// channelKeyFor / channelsIn executed, not read.
ok("channelKeyFor is total", channelKeyFor({ channel: "sms" }) === CHANNEL_KEYS.sms
  && channelKeyFor({}) === CHANNEL_KEYS.email
  && channelKeyFor({ channel: "pigeon" }) === CHANNEL_KEYS.email);
ok("channelsIn reports only the channels these rules use",
  channelsIn(buildFlows([{ id: "a", triggerEvent: "quote_no_response", channel: "sms" }])).join(",") === "sms"
    && channelsIn(buildFlows([{ id: "a", triggerEvent: "quote_no_response" }])).join(",") === "email"
    && channelsIn(buildFlows([
        { id: "a", triggerEvent: "quote_no_response" },
        { id: "b", triggerEvent: "lead_no_response", channel: "sms" },
      ])).join(",") === "email,sms");
ok("channelsIn survives the shapes a failed fetch produces", channelsIn(null).length === 0 && channelsIn(undefined).length === 0);
ok("every channel has a 'who gets skipped' sentence and a dropdown label",
  FOLLOW_UP_CHANNELS.every((c) => SKIPPED_KEYS[c] && CHANNEL_KEYS[c] && CHANNEL_OPTION_KEYS[c]));
ok(
  "cron skips a hand-made rule with no template",
  // A FieldQuo default (builtInKey) with no template sends its built-in
  // wording instead — lib/followUps/defaults.js — so the skip is qualified.
  // Inside the EMAIL branch since the channel arrived: a text rule has no
  // template by design, and holding it to this would have skipped every one.
  /if \(!rule\.template && !builtIn\) \{\n\s*skippedNoTemplate\+\+;/.test(cron),
);
ok(
  "…and an unknown trigger is still skipped whatever the channel",
  /if \(!finder\) \{\n\s*if \(!rule\.template\) skippedNoTemplate\+\+;/.test(cron),
);
ok("diagram draws a template-less step as broken", /noTemplate/.test(diagram));
ok(
  "diagram does NOT draw a FieldQuo default as broken",
  /: !rule\.template && !rule\.builtInKey;/.test(diagram),
);
ok(
  "cron skips a client with no email — on an EMAIL rule, which is the new qualification",
  // The window grew when the verdict gained the trigger and the origin for
  // the booking link. Anchored on the two lines that matter instead of a
  // character count, so the next line added between them does not break it.
  /const to = channel === "sms" \? null : entity\.client\?\.email;[\s\S]*?\} else if \(!to\) \{\n\s*skippedNoEmail\+\+;/.test(cron),
);
ok("diagram says so, per channel these rules actually use", /SKIPPED_KEYS\[channel\]/.test(diagram));

// ── 6. The diagram is not the only way to read the configuration ───────────
console.log("\nAccessibility\n");

ok("diagram is aria-hidden", /aria-hidden="true"/.test(diagram));
ok(
  "the list prints the same stop conditions in words",
  /stopKeysFor/.test(page) && /t\(stopKey\)/.test(page),
);
ok(
  "diagram never scrolls sideways — no horizontal overflow container",
  !/overflow-x/.test(diagram),
);

// ── 7. Every message key the diagram uses is defined, in every language ────
console.log("\nMessages\n");

const usedKeys = [
  ...Object.values(TRIGGER_LABEL_KEYS),
  ...Object.values(TRIGGER_DESCRIPTION_KEYS),
  ...Object.values(STOP_KEYS),
  ...Object.values(ONCE_KEYS),
  ...Object.values(DURATION_UNIT_KEYS),
  ...Object.values(CHANNEL_KEYS),
  ...Object.values(CHANNEL_OPTION_KEYS),
  ...Object.values(SKIPPED_KEYS),
  ...[...diagram.matchAll(/"(app\.followFlow\.[A-Za-z0-9]+)"/g)].map((m) => m[1]),
  ...[...page.matchAll(/"(app\.followFlow\.[A-Za-z0-9]+)"/g)].map((m) => m[1]),
];

for (const [code, dict] of Object.entries(APP_MESSAGES)) {
  const missing = [...new Set(usedKeys)].filter((k) => !(k in dict));
  ok(`${code}: all ${new Set(usedKeys).size} diagram keys present`, missing.length === 0, missing.join(", "));
}

// ── 7b. The enquiry trigger: a rule can chase a lead before any quote exists ─
//
// app.setMetaLeads.whatHappens tells a company that a Meta lead gets "your
// own follow-up rules". Every finder in the cron used to start at a quote, an
// invoice or a job, so that sentence was false for the one thing a lead IS
// before somebody quotes it. These pin the trigger that makes it true.
console.log("\nThe enquiry trigger\n");

ok("lead_no_response is a supported trigger", SUPPORTED_TRIGGERS.includes("lead_no_response"));
ok("its entity is the lead itself", TRIGGER_META.lead_no_response?.entityType === "lead");
ok("it is transactional — a reply to the person's own request, like quote_no_response",
  TRIGGER_META.lead_no_response?.commercial === false);
ok("it stops the way the metadata says: lead_answered has a stop sentence and a once sentence",
  stopKeysFor("lead_no_response").stopKey === STOP_KEYS.lead_answered
    && stopKeysFor("lead_no_response").onceKey === ONCE_KEYS.lead);
{
  const finder = cron.slice(cron.indexOf("async function findLeadNoResponse"), cron.indexOf("async function findQuoteNoResponse"));
  ok("the finder only takes leads still at status 'new'", /status: "new"/.test(finder));
  ok("…with no quote yet — once converted, quote_no_response owns it", /quoteId: null/.test(finder));
  ok("…that can be reached on the rule's own channel — an address for email, a mobile for a text",
    /channel === "sms" \? \{ phone: \{ not: null \} \} : \{ email: \{ not: null \} \}/.test(finder));
  ok("…older than the rule's delay, by createdAt (a lead has no sentAt)", /createdAt: \{ lte: cutoffFor\(rule\) \}/.test(finder));
  ok("…and never the same lead twice for one rule", /notIn: excluded/.test(finder));
  ok("the lead is shaped into the `client` slot the shared send code reads",
    /client: \{\s*name: lead\.name,\s*email: lead\.email/.test(finder));
  // mergeDataFor lives in lib/followUps/mergeData.js since it became
  // executable (scripts/check-canvas-email.mjs runs it); the cron calls it.
  const builder = read("lib/followUps/mergeData.js");
  ok("mergeDataFor has a lead branch that supplies no quote token",
    /if \(entityType === "lead"\) \{[\s\S]{0,400}?jobTitle: entity\.category\?\.label/.test(builder)
      && !/if \(entityType === "lead"\) \{[\s\S]{0,400}?quoteUrl/.test(builder)
      && /from "@\/lib\/followUps\/mergeData"/.test(cron));
}
ok("the settings page prints translated trigger labels, never TRIGGER_META.label raw",
  !/meta\.label/.test(page) && /t\(TRIGGER_LABEL_KEYS\[/.test(page));
ok("the settings page prints translated descriptions, never TRIGGER_META.description raw",
  !/\.description\}/.test(page) && /t\(TRIGGER_DESCRIPTION_KEYS\[/.test(page));
ok("choosing the enquiry trigger tells the user which fields a lead can fill",
  /entityType === "lead"[\s\S]{0,200}?app\.followFlow\.leadFields/.test(page));
ok("the Meta leads copy's claim still names follow-up rules (the thing this trigger backs)",
  /follow-up rules/.test(APP_MESSAGES.en["app.setMetaLeads.whatHappens"] || ""));

// ── 7c. The change-order trigger, EXECUTED ─────────────────────────────────
//
// An unsigned change order parks the plan step it changes
// (Task.waitingOnChangeOrderId — lib/jobs/changeOrderDecision.js), so the
// crew stands still while it waits, and until this trigger existed nothing
// chased one: no cron touched the ChangeOrder model at all.
//
// Everything below DRIVES the real finder against a scripted fake Prisma
// rather than reading its source. The matcher is generic — it interprets
// whatever `where` the finder passes — so the thing under test is the
// production clause, not a restatement of it. That matters more here than
// anywhere else in this file: the clause is the ENTIRE stop condition for
// this trigger (there is no quoteChaseBlocker equivalent, and the cron says
// why), so "sent but unsigned" being right IS the feature.
console.log("\nThe change-order trigger\n");

const { findChangeOrderNoResponse } = await import("../lib/followUps/changeOrderChase.js");
const { builtInEntityType } = await import("../lib/followUps/defaults.js");
const { mergeDataFor, followUpLanguage } = await import("../lib/followUps/mergeData.js");
const { templateBody } = await import("../lib/email/templateBody.js");

ok("change_order_no_response is a supported trigger", SUPPORTED_TRIGGERS.includes("change_order_no_response"));
ok("its entity is the change order itself", TRIGGER_META.change_order_no_response?.entityType === "change_order");
ok("it is TRANSACTIONAL — a change to work they already contracted for",
  TRIGGER_META.change_order_no_response?.commercial === false);
ok("…so the cron never puts an unsubscribe link on it: only commercial triggers mint a token",
  /if \(TRIGGER_META\[rule\.triggerEvent\]\?\.commercial\)/.test(cron));
// Email AND text, on the owner's word (2026-11-17): "a reminder text and
// email". Both halves asserted, because a channel offered in the dropdown
// that the save route refuses, or wording that exists with no way to pick
// it, are each a control that appears to work and doesn't.
ok("it may send by TEXT as well as email", triggerMaySms("change_order_no_response") === true);
ok("…and has wording to send, so the save routes will store an sms rule on it",
  /change_order_no_response: "change_order_follow_up"/.test(read("lib/sms/followUpTextRules.js")));
ok("…whose purpose is registered, so the SMS health page cannot fold it into 'Other'",
  /"change_order_follow_up"/.test(read("lib/sms/deliveryStatus.js"))
    && /change_order_follow_up:/.test(read("app/platform/sms-health/page.js")));
ok("…and the cron hands the text the /co/ link from the SAME merge data the email's button uses",
  /changeOrderUrl: merge\.changeOrderUrl \|\| null/.test(cron));
ok("…and the sender refuses to text without that link rather than saying 'review and sign' at nothing",
  /type === "change_order_follow_up" && !changeOrderUrl\) return \{ texted: false, reason: "no_link" \}/
    .test(read("lib/sms/followUpText.js")));
ok("it chases every 2 days by default — sooner than a quote's 3, because it holds up work",
  TRIGGER_META.change_order_no_response?.defaultDelay?.value === 2
    && TRIGGER_META.change_order_no_response?.defaultDelay?.unit === "days");
// Seeded as a FieldQuo default since 2026-11-17. This asserted the OPPOSITE
// for a day after that landed — the seeding commit changed defaults.js and
// left the check describing the world before it. It went unnoticed because
// `npm run build`, which is what Vercel runs, runs six checks and this is not
// one of them; only `check:all` reaches it. A check nobody runs is a comment.
ok("it IS seeded as a FieldQuo default, with built-in wording so an unconfigured company still chases",
  /change_order_no_response|CHANGE_ORDER_TRIGGER/.test(read("lib/followUps/defaults.js"))
    && /change_order_sent_d2/.test(read("lib/followUps/defaults.js"))
    && /change_order/.test(read("lib/followUps/defaultCopy.js")));
ok("…and builtInEntityType agrees with the cron's finder, or the rule is skipped as 'no template' forever",
  builtInEntityType("change_order_sent_d2") === "change_order"
    && /change_order_no_response: \{\s*\n\s*entityType: "change_order"/.test(cron));
ok("it stops the way the metadata says: a stop sentence and a once sentence",
  stopKeysFor("change_order_no_response").stopKey === STOP_KEYS.change_order_decided
    && stopKeysFor("change_order_no_response").onceKey === ONCE_KEYS.change_order);
ok("choosing it tells the user the quote chips come out blank and which ones don't",
  /entityType === "change_order"[\s\S]{0,300}?app\.followFlow\.changeOrderFields/.test(page));

// ── The scripted Prisma ────────────────────────────────────────────────────
//
// Generic enough to evaluate the clause the finder actually writes:
// equality, `{ not: null }`, `{ lte }`, `{ notIn }` and a one-level relation
// filter (`job: { companyId }`). An operator the finder starts using that
// this does not understand THROWS rather than quietly matching everything —
// a permissive fake is how a finder that returns the whole table passes.
function matches(row, where, path = "where") {
  for (const [field, cond] of Object.entries(where)) {
    const value = row[field];
    if (cond === null || typeof cond !== "object") {
      if (value !== cond) return false;
      continue;
    }
    if (Array.isArray(cond)) throw new Error(`${path}.${field}: array condition not understood`);
    for (const [op, operand] of Object.entries(cond)) {
      if (op === "not") {
        if (operand === null ? value === null || value === undefined : value === operand) return false;
      } else if (op === "lte") {
        if (!(value instanceof Date) || !(value.getTime() <= operand.getTime())) return false;
      } else if (op === "equals") {
        // The Json? null filter: Prisma spells "this column holds no JSON"
        // as a sentinel object (Prisma.DbNull / JsonNull / AnyNull), never a
        // bare null — see lib/followUps/changeOrderChase.js. Any of the three
        // means "unsigned" here, and the fake must agree with the real client
        // about that or it is back to being more permissive than production.
        const sentinel = operand && typeof operand === "object" && !(operand instanceof Date);
        if (sentinel) {
          if (value !== null && value !== undefined) return false;
        } else if (value !== operand) return false;
      } else if (op === "notIn") {
        if (operand.includes(value)) return false;
      } else if (op === "in") {
        if (!operand.includes(value)) return false;
      } else if (op === "companyId" || op === "historicalImportedAt") {
        // a relation filter: `job: { companyId: … }`
        if (!matches(value || {}, cond, `${path}.${field}`)) return false;
        break;
      } else {
        throw new Error(`${path}.${field}: operator "${op}" not understood by this fake`);
      }
    }
  }
  return true;
}

const DAY = 86_400_000;
const CO_COMPANY = { id: "co1", name: "Hallam Joinery", currency: "CAD", defaultLanguage: "en" };
const CO_CLIENT = { id: "cl1", name: "Maureen Avery", email: "maureen@example.com", phone: null, language: null };
const CO_JOB = {
  id: "job1",
  companyId: "co1",
  clientId: "cl1",
  title: "Kitchen refit",
  client: CO_CLIENT,
  company: CO_COMPANY,
  quote: { id: "q1", quoteNumber: "Q-104", language: "fr" },
  changeOrders: [{ id: "a", seq: 1, createdAt: new Date("2026-10-01") }, { id: "b", seq: 2, createdAt: new Date("2026-10-09") }],
};
const co = (over) => ({
  id: "b",
  jobId: "job1",
  seq: 2,
  createdAt: new Date("2026-10-09"),
  description: "Soft-close hinges throughout",
  priceDelta: 450,
  status: "waiting_client",
  sentAt: new Date(Date.now() - 3 * DAY),
  signature: null,
  shareToken: "tok_abc123",
  job: CO_JOB,
  ...over,
});

function fakeDb(rows, logs = []) {
  return {
    followUpLog: { findMany: async () => logs.map((entityId) => ({ entityId })) },
    changeOrder: { findMany: async ({ where }) => rows.filter((r) => matches(r, where)) },
  };
}
const RULE = { id: "r1", companyId: "co1", delayValue: 2, delayUnit: "days" };
const CUTOFF = new Date(Date.now() - 2 * DAY);
const found = async (row, logs = []) =>
  (await findChangeOrderNoResponse(fakeDb([row], logs), RULE, CUTOFF)).length === 1;

ok("a pending change order sent 3 days ago IS chased", await found(co()));
ok("one that was never sent is NOT — sentAt null means the client has never seen it",
  !(await found(co({ sentAt: null }))));
ok("one the client already signed is NOT", !(await found(co({ signature: { name: "Maureen Avery" } }))));
ok("an approved one is NOT", !(await found(co({ status: "approved" }))));
ok("a rejected one is NOT", !(await found(co({ status: "rejected" }))));
// ── The two faces of "pending", both of which must be left alone ─────────
//
// The brief for this feature said the sent-and-unsigned state was `pending`.
// It is not — it is `waiting_client`, and a census of the live tenant found
// 21 change orders of which ZERO are pending+sent+unsigned. A finder built
// on "pending" would have passed every assertion and chased nobody, which
// is this codebase's defining failure wearing a green tick. Both shapes are
// pinned here so nobody writes it back.
ok("a 'pending' change order that was never sent is NOT chased — the staff-side 'jotted down' state",
  !(await found(co({ status: "pending", sentAt: null, shareToken: null }))));
ok("one a staff member withdrew back to 'pending' is NOT — the company took it off the table",
  !(await found(co({ status: "pending" }))));
ok("one sent an hour ago is NOT — it is inside the delay",
  !(await found(co({ sentAt: new Date(Date.now() - 3_600_000) }))));
ok("one with no share token is NOT — there would be no page to send them to",
  !(await found(co({ shareToken: null }))));
ok("another tenant's change order is NOT — the scope goes through job.companyId",
  !(await found(co({ job: { ...CO_JOB, companyId: "other" } }))));
ok("one this rule already chased is NOT — the FollowUpLog dedupe", !(await found(co(), ["b"])));
ok("the clock is sentAt, not createdAt — a row CREATED weeks ago but sent an hour ago is left alone",
  !(await found(co({ createdAt: new Date(Date.now() - 30 * DAY), sentAt: new Date(Date.now() - 3_600_000) }))));

// ── The where clause, through Prisma's OWN validator ───────────────────────
//
// Everything above drives the finder against `fakeDb`, whose `matches` is a
// hand-written reading of a Prisma `where`. That is what let this ship:
// the finder asked for `signature: null` on a Json? column, the fake happily
// compared it, and Prisma REFUSES a bare null there — so every real run threw
// PrismaClientValidationError and not one change order was ever chased. A
// green tick on a fake that is more permissive than the real client is worth
// nothing, which is the whole lesson.
//
// So the clause also goes through the real client. No database is needed and
// none is used: Prisma validates the arguments BEFORE it opens a connection,
// so a client pointed at an unreachable port fails with P1001 when the query
// is well formed and with a validation error when it is not. P1001 is the
// pass here. followUpLog stays on the fake, because the dedupe read happens
// first and a connection error there would mask the clause under test.
{
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  // Port 1 refuses instantly on every platform — this must not hang a build.
  const pool = new Pool({ connectionString: "postgresql://none:none@127.0.0.1:1/none", max: 1 });
  const real = new PrismaClient({ adapter: new PrismaPg(pool) });
  const hybrid = { followUpLog: fakeDb([]).followUpLog, changeOrder: real.changeOrder };
  let kind = "no error";
  try {
    await findChangeOrderNoResponse(hybrid, RULE, CUTOFF);
  } catch (err) {
    kind = err?.constructor?.name === "PrismaClientValidationError"
      ? `rejected by Prisma: ${String(err.message).split("\n").find((l) => l.trim().startsWith("Argument ")) || "invalid where"}`
      : "validated";
  }
  ok("the finder's where clause is one the real Prisma client accepts",
    kind === "validated",
    kind === "validated" ? "" : kind);
  await real.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
}

{
  const [row] = await findChangeOrderNoResponse(fakeDb([co()]), RULE, CUTOFF);
  ok("the row is shaped into the client/company/companyId contract the shared send code reads",
    row.client?.email === "maureen@example.com" && row.company?.id === "co1"
      && row.companyId === "co1" && row.clientId === "cl1");
  ok("its language is the originating QUOTE's, resolved the way the quote chase resolves it",
    followUpLanguage("change_order", row) === "fr");

  const request = new Request("https://app.fieldquo.com/api/cron/follow-ups");
  const merge = mergeDataFor("change_order", row, request, null, "fr");
  // endsWith rather than an exact string: getAppOrigin honours
  // NEXT_PUBLIC_APP_URL when one is set, and which origin this process sees
  // is not what is under test. The path and the token are.
  ok("the link is the change order's own addendum page, /co/<shareToken>",
    merge.changeOrderUrl.endsWith("/co/tok_abc123"), merge.changeOrderUrl);
  ok("…and it is NOT a quote url — no /q/ anywhere, and {{quoteUrl}} is not supplied",
    !/\/q\//.test(merge.changeOrderUrl) && merge.quoteUrl === undefined);
  ok("the reference is the change order's own CO- label", merge.changeOrderNumber === "CO-2");
  ok("the amount is the delta in the document's currency and language",
    typeof merge.changeOrderAmount === "string" && /450/.test(merge.changeOrderAmount));

  // The RENDERED email, through the real template renderer — a button bound
  // to the chip the editor offers. This is the assertion that would have
  // caught a merge branch that filled {{quoteUrl}} instead: the href is what
  // a homeowner taps.
  const html = templateBody(
    { sections: [{ id: "b1", type: "button", label: "Review the change", url: "{{changeOrderUrl}}" }] },
    merge,
    { company: CO_COMPANY, language: "fr" },
  );
  const href = html.match(/<a[^>]+href="([^"]*)"/)?.[1];
  ok("the rendered button's href is the /co/ page",
    Boolean(href) && href.endsWith("/co/tok_abc123"), String(href));
  ok("…and the rendered email contains no quote link at all", !/\/q\//.test(html));
}
// ── The real row, from the live tenant ─────────────────────────────────────
//
// TrueFinish CO-1 for Edmond Hetu, $2,000, sent 2026-11-12 01:34:52 UTC by
// email+sms, opened 2026-11-14 18:41:57 UTC, still unsigned. This is the
// acceptance case the feature was asked for, written out as the ROW SHAPE
// production actually holds rather than a tidied-up fixture — `seq` present,
// `viewedAt` set, `decidedAt` null, status "waiting_client". A chase built
// against an invented shape is a chase nobody receives.
{
  const HETU = {
    id: "co_hetu",
    jobId: "job_hetu",
    seq: 1,
    createdAt: new Date("2026-11-11T20:10:00.000Z"),
    description: "Add soft-close to the pantry run",
    priceDelta: 2000,
    status: "waiting_client",
    sentAt: new Date("2026-11-12T01:34:52.000Z"),
    sentVia: "email+sms",
    // Opened, and opening is NOT answering. The finder keys off `signature`,
    // so a client who read it twice and did nothing is still chased — which
    // is the entire point of the trigger.
    viewedAt: new Date("2026-11-14T18:41:57.000Z"),
    decidedAt: null,
    decidedById: null,
    signature: null,
    shareToken: "tok_hetu_live",
    job: { ...CO_JOB, id: "job_hetu", client: { ...CO_CLIENT, name: "Edmond Hetu" } },
  };
  // The rule as a company would save it: 2 days, which is the default.
  const cutoff2d = new Date(Date.parse("2026-11-17T12:00:00.000Z") - 2 * DAY);
  const rows = await findChangeOrderNoResponse(fakeDb([HETU]), RULE, cutoff2d);
  ok("the live TrueFinish CO-1 (Edmond Hetu, $2,000, sent 12 Nov, unsigned) IS picked up at 2 days",
    rows.length === 1 && rows[0].id === "co_hetu");
  ok("…having been OPENED on 14 Nov does not count as answering it",
    rows.length === 1 && rows[0].viewedAt instanceof Date);
  const hetuMerge = mergeDataFor("change_order", rows[0], new Request("https://www.fieldquo.com/x"), null, "en");
  ok("…and the link it would send is its own /co/ page, labelled CO-1",
    hetuMerge.changeOrderUrl.endsWith("/co/tok_hetu_live") && hetuMerge.changeOrderNumber === "CO-1",
    `${hetuMerge.changeOrderNumber} ${hetuMerge.changeOrderUrl}`);
  // The TEXT the owner asked for, rendered through the real renderer.
  const { renderMessage: render } = await import("../lib/sms/renderTemplate.js");
  const sms = render({
    type: "change_order_follow_up",
    templates: null,
    language: "en",
    values: { company: "TrueFinish Cabinets", name: "Edmond", number: hetuMerge.changeOrderNumber, link: hetuMerge.changeOrderUrl },
  });
  ok("…and the TEXT carries the same /co/ link, names CO-1, keeps STOP and fits two segments' worth",
    sms.includes(hetuMerge.changeOrderUrl) && sms.includes("CO-1") && /\bSTOP\b/.test(sms) && sms.length <= 320,
    `${sms.length} chars`);
  ok("…with no /q/ quote link anywhere in it", !/\/q\//.test(sms));
}

ok("the finder refuses to be tested by a fake that understands less than it writes",
  (() => {
    try {
      matches({ a: 1 }, { a: { startsWith: "x" } });
      return false;
    } catch {
      return true;
    }
  })());

// ── 8. buildFlows against rows nobody wants to be handed ───────────────────
console.log("\nbuildFlows on hostile input\n");

ok("null → []", buildFlows(null).length === 0);
ok("not an array → []", buildFlows({ nope: true }).length === 0);
ok("rows with no id are dropped", buildFlows([{ triggerEvent: "job_completed" }]).length === 0);

const unknown = buildFlows([
  { id: "a", triggerEvent: "someone_added_this_later", delayValue: 1, delayUnit: "days" },
]);
ok("unknown trigger still groups", unknown.length === 1);
ok("unknown trigger has null meta, so the UI can say it never runs", unknown[0].meta === null);
ok("unknown trigger has no stop wording to invent", stopKeysFor("someone_added_this_later").stopKey === null);

ok("null delay sorts as zero rather than NaN", delayMs({ delayValue: null }) === 0);
ok("undefined rule doesn't throw", delayMs(undefined) === 0);
ok(
  "hours and days are comparable",
  delayMs({ delayValue: 48, delayUnit: "hours" }) === delayMs({ delayValue: 2, delayUnit: "days" }),
);
ok(
  "an unrecognised unit is treated as days, exactly as cutoffFor() does",
  delayMs({ delayValue: 1, delayUnit: "fortnights" }) === delayMs({ delayValue: 1, delayUnit: "days" }),
);

const ordered = buildFlows([
  { id: "late", triggerEvent: "quote_no_response", delayValue: 7, delayUnit: "days" },
  { id: "soon", triggerEvent: "quote_no_response", delayValue: 12, delayUnit: "hours" },
  { id: "mid", triggerEvent: "quote_no_response", delayValue: 3, delayUnit: "days" },
]);
ok(
  "steps on one trigger are ordered by when they fire, not when they were made",
  ordered[0].steps.map((s) => s.id).join(",") === "soon,mid,late",
);

// ══ Every chip in the editor is a token something actually supplies ═══════
//
// The merge-field palette used to carry a comment saying it was "harmless" to
// offer every token everywhere, because applyMergeFields resolves an unknown
// one to "". The conclusion did not follow. An empty string is WORSE than a
// visible {{token}}: a homeowner reading "Please send a deposit of  to secure
// your booking" sees a typo, not a bug, so nobody reports it — and it went out
// under the contractor's brand.
//
// Two chips were offered that no send path had ever supplied. `invoiceUrl` was
// the worse one, because the default "Payment received" template ships a "View
// your invoice" button bound to it, so that button rendered with an empty href.
// It is now supplied. `depositAmount` was removed instead: there is no deposit
// feature to derive it from (docs/PAYMENT-SCHEDULE.md — staged payments are
// display-only today).
//
// Checked against the SEND PATHS rather than against a list, so adding a chip
// without teaching something to fill it fails here.
const MERGE_SOURCES = [
  "app/api/cron/follow-ups/route.js",
  // The cron's token builder, moved out of the route so it can be executed.
  "lib/followUps/mergeData.js",
  "app/api/marketing/campaigns/[id]/send/route.js",
];
const supplied = new Set();
for (const rel of MERGE_SOURCES) {
  const src = fs
    .readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/^\s*\/\/.*$/gm, " ");
  for (const m of src.matchAll(/^\s{4,}([a-zA-Z][A-Za-z0-9]*):/gm)) supplied.add(m[1]);
}
for (const { token } of MERGE_FIELDS) {
  ok(
    `{{${token}}} is supplied by a real send path`,
    supplied.has(token),
    supplied.has(token)
      ? ""
      : "offered as a chip in the template editor and filled by nothing — it " +
        "renders as an empty string in a real email, which reads as a typo " +
        "rather than a bug and so never gets reported",
  );
}

// The PREVIEW fixtures get the same test, and for a sharper reason.
//
// depositAmount survived one pass: the chip was pulled from MERGE_FIELDS, but
// both fixtures kept a convincing "$1,275.00". That is the worse half. A chip
// you cannot click is merely absent; a preview that renders $1,275.00 for a
// token a real send leaves blank is the editor VOUCHING for something that
// never works — and it is exactly what would justify putting the chip back.
//
// So a fixture may only carry what a send path can fill.
const PREVIEW_FIXTURES = [
  "app/app/settings/email-templates/[id]/page.js",
  "app/api/settings/document-templates/[id]/test/route.js",
];

// The editor and the test send now draw ONE sample
// (lib/email/templateMergeFields.js), formatted per language and currency
// rather than carrying "$" literals. It is held to the same rule — by its
// exported token list, executed, not by reading an object literal whose
// figures are now computed.
{
  const shared = await import("../lib/email/templateMergeFields.js").catch(() => null);
  ok("the editor and the test send have one shared sample module", Boolean(shared?.sampleMergeData));
  const SAMPLE_TOKENS = shared?.SAMPLE_TOKENS || [];
  const orphans = SAMPLE_TOKENS.filter((k) => !supplied.has(k));
  ok("the shared sample previews nothing a send path can't fill", Boolean(shared) && orphans.length === 0,
    orphans.length ? `sample values for ${orphans.join(", ")}` : "");
  const drawn = shared ? Object.keys(shared.sampleMergeData({ language: "fr", currency: "EUR" })).filter((k) => k !== "lineItems") : [];
  ok("…and its token list is what it actually fills", drawn.length > 0 && drawn.length === SAMPLE_TOKENS.length && drawn.every((k) => SAMPLE_TOKENS.includes(k)));
  for (const rel of PREVIEW_FIXTURES) {
    ok(`${rel.split("/").slice(-2).join("/")} draws the shared sample`, /sampleMergeData\(/.test(read(rel)));
  }
}
for (const rel of PREVIEW_FIXTURES) {
  const src = fs
    .readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/^\s*\/\/.*$/gm, " ");
  // The sample block runs from the first merge key to the end of the object
  // literal. It used to stop at `lineItems:`, an array of objects whose own
  // keys would otherwise be read as tokens; the fixtures no longer carry that
  // array (the itemised sample is built from lib/email/templateLineItems.js at
  // render time), so the literal's closing brace is the end — and a
  // `lineItems:` that does appear inside the literal still ends it first.
  const start = src.indexOf("quoteNumber:");
  const ends = [src.indexOf("lineItems:", start), src.indexOf("\n};", start)].filter((i) => i > start);
  const block = start === -1 || !ends.length ? "" : src.slice(start, Math.min(...ends));
  const keys = [...block.matchAll(/^\s+([a-zA-Z][A-Za-z0-9]*):/gm)].map((m) => m[1]);
  const orphans = keys.filter((k) => !supplied.has(k));
  ok(
    `${rel.split("/").slice(-2).join("/")} previews nothing a send path can't fill`,
    orphans.length === 0,
    orphans.length
      ? `sample values for ${orphans.join(", ")} — the preview shows a figure the real email leaves blank`
      : "",
  );
}

console.log(
  `\n${checks} checks, ${failures} failure(s).${failures ? "" : " Diagram matches the cron."}\n`,
);
if (failures) process.exitCode = 1;
