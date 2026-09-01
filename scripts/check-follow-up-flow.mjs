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
  FOLLOW_UP_CHANNEL,
} from "../lib/followUps/triggers.js";
import {
  buildFlows,
  delayMs,
  stopKeysFor,
  STOP_KEYS,
  ONCE_KEYS,
  TRIGGER_LABEL_KEYS,
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
  const inCron = findersBlock?.[1].match(
    new RegExp(`${key}:\\s*\\{\\s*entityType:\\s*"([a-z]+)"`),
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

// ── 4. Channel ─────────────────────────────────────────────────────────────
console.log("\nChannel\n");

ok("FOLLOW_UP_CHANNEL is email", FOLLOW_UP_CHANNEL === "email");
ok("cron sends via sendEmail", /await sendEmail\(/.test(cron));
ok(
  "cron sends nothing by SMS — the diagram would be describing a feature that isn't there",
  !/sendSms|twilio/i.test(cron),
);

// ── 5. The diagram only draws states the cron actually produces ────────────
console.log("\nHonesty of the drawn states\n");

ok(
  "cron loads active rules only, so a paused step really is skipped",
  /findMany\(\{\s*where: \{ active: true \}/.test(cron),
);
ok("diagram draws a paused step differently", /border-dashed/.test(diagram));
ok(
  "cron skips a rule with no template",
  /if \(!finder \|\| !rule\.template\)/.test(cron),
);
ok("diagram draws a template-less step as broken", /noTemplate/.test(diagram));
ok(
  "cron skips a client with no email",
  /const to = entity\.client\?\.email;[\s\S]{0,120}skippedNoEmail/.test(cron),
);
ok("diagram says so", /noEmailNote/.test(diagram));

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
  ...Object.values(STOP_KEYS),
  ...Object.values(ONCE_KEYS),
  ...Object.values(DURATION_UNIT_KEYS),
  ...[...diagram.matchAll(/"(app\.followFlow\.[A-Za-z0-9]+)"/g)].map((m) => m[1]),
];

for (const [code, dict] of Object.entries(APP_MESSAGES)) {
  const missing = [...new Set(usedKeys)].filter((k) => !(k in dict));
  ok(`${code}: all ${new Set(usedKeys).size} diagram keys present`, missing.length === 0, missing.join(", "));
}

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
for (const rel of PREVIEW_FIXTURES) {
  const src = fs
    .readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/^\s*\/\/.*$/gm, " ");
  // The sample block runs from the first merge key to lineItems, which is an
  // array of objects whose own keys would otherwise be read as tokens.
  const start = src.indexOf("quoteNumber:");
  const block = start === -1 ? "" : src.slice(start, src.indexOf("lineItems:", start));
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
