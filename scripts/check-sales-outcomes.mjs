// scripts/check-sales-outcomes.mjs
//
// The second pass on call outcomes (docs/SALES-OUTCOMES.md), executed:
// sub-reasons, the disposition audit, recording marks, the callback agenda,
// the inbound service level, the transcription/review sample and
// answering-machine detection. Pure modules are run against hostile input;
// the wiring (routes, the bridge, the cron, the catalogue) is read.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-sales-outcomes.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)?.slice(0, 300)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);
const T0 = new Date("2026-09-21T14:00:00.000Z");
const hoursFrom = (d, h) => new Date(d.getTime() + h * 3600 * 1000);

const {
  OUTCOME_SETTINGS,
  OUTCOME_SETTING_KEYS,
  AMD_USD_PER_CALL,
  effectiveOutcomeSettings,
  outcomeDefaults,
  validateOutcomeSettingsEdit,
  outcomeSettingsTable,
} = await import("@/lib/sales/calls/outcomeSettings");
const {
  DEFAULT_SUB_DISPOSITIONS,
  SUB_DISPOSITION_CODES,
  effectiveSubDispositions,
  validateSubDispositionList,
  validateSubDispositionLists,
  validateSubDispositionPick,
  subDispositionCounts,
  subDispositionLabel,
  SUB_DISPOSITION_REFUSAL_KEYS,
} = await import("@/lib/sales/calls/subDispositions");
const { AUTO_LOGGED_CODES, DISPOSITION_ORDER, autoLogOutcome, planDisposition } = await import("@/lib/sales/calls/dispositions");
const { fnv1a, sampleBucket, inSample, sampleKeyOf, sampledOutReason, isSampledOut } = await import("@/lib/sales/calls/sampling");
const { inboundWaitOf, serviceLevelFigures } = await import("@/lib/sales/calls/serviceLevel");
const { AMD_RESULTS, amdResultOf, isMachine, isMachineEnd, amdNumberAttrs, amdVerdictFrom, shouldDropVoicemail, dropVoicemail, amdCardKey } = await import("@/lib/sales/calls/amd");
const { measuredConversation } = await import("@/lib/sales/calls/conversation");
const { dialTableRow } = await import("@/lib/sales/calls/dialTable");
const { AUDIT_VERDICTS, parseAuditVerdict, auditFigures } = await import("@/lib/sales/calls/dispositionAudit");
const { markSecondsFor, parseMark, marksForPrompt, MAX_MARKS_PER_CALL } = await import("@/lib/sales/calls/recordingMarks");
const { pickGlobalRep, callbackState, callbackRepOf, sweepCallbackAgenda } = await import("@/lib/sales/calls/callbackAgenda");
const { STATE_AVAILABLE, PRESENCE_STALE_MINUTES } = await import("@/lib/sales/calls/agentState");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
const { buildQaPrompt } = await import("@/lib/sales/calls/qa");

// ═══════════════════════════════════════════════════════════════════════════
section("1. Settings: a table with defaults, bounds and a cost on each");

ok("every key has a kind, a default, a label and help", OUTCOME_SETTING_KEYS.every((k) => ["int", "percent", "bool", "url"].includes(OUTCOME_SETTINGS[k].kind) && OUTCOME_SETTINGS[k].default !== undefined && OUTCOME_SETTINGS[k].label && OUTCOME_SETTINGS[k].help));
ok("the brief's defaults: grace 15, 25 open, 14 days, SL 20 s, transcription 100, review 100, AMD off, no drop", (() => {
  const d = outcomeDefaults();
  return d["sales.callback.graceMinutes"] === 15 && d["sales.callback.maxOpenPerRep"] === 25 && d["sales.callback.maxDaysAhead"] === 14 && d["sales.inbound.serviceLevelSeconds"] === 20 && d["sales.transcription.percent"] === 100 && d["sales.aiReview.percent"] === 100 && d["sales.amd.enabled"] === false && d["sales.amd.voicemailDropUrl"] === "";
})());
ok("AMD's cost line prints Twilio's per-call price", AMD_USD_PER_CALL === 0.0075 && OUTCOME_SETTINGS["sales.amd.enabled"].cost.includes("$0.0075"));
ok("the drop URL's cost line is the legal warning, not a number", /RCW 80\.36\.400/.test(OUTCOME_SETTINGS["sales.amd.voicemailDropUrl"].cost));
ok("null, garbage and an array all read as the defaults with no fallbacks named", [null, "x", 5, []].every((v) => JSON.stringify(effectiveOutcomeSettings(v).values) === JSON.stringify(outcomeDefaults()) && effectiveOutcomeSettings(v).fallbacks.length === 0));
ok("a value outside its bounds falls back to the default and is NAMED", (() => {
  const r = effectiveOutcomeSettings({ "sales.transcription.percent": 140, "sales.callback.graceMinutes": -1 });
  return r.values["sales.transcription.percent"] === 100 && r.values["sales.callback.graceMinutes"] === 15 && r.fallbacks.length === 2;
})());
ok("a stored percent of 0 is honoured (nothing transcribed), not treated as absent", effectiveOutcomeSettings({ "sales.transcription.percent": 0 }).values["sales.transcription.percent"] === 0);
ok("a string number is accepted as the number", effectiveOutcomeSettings({ "sales.inbound.serviceLevelSeconds": "30" }).values["sales.inbound.serviceLevelSeconds"] === 30);
ok("the drop URL must be https; http falls back to empty and is named", (() => {
  const r = effectiveOutcomeSettings({ "sales.amd.voicemailDropUrl": "http://x.example/drop.mp3" });
  return r.values["sales.amd.voicemailDropUrl"] === "" && r.fallbacks[0]?.reason === "not_https";
})());
ok("an edit with a bad value is refused whole, with the label and the range", (() => {
  const r = validateOutcomeSettingsEdit({ "sales.aiReview.percent": 250, "sales.amd.enabled": true });
  return r.ok === false && r.errors.length === 1 && /0 to 100/.test(r.errors[0]);
})());
ok("an unknown key is refused", validateOutcomeSettingsEdit({ "sales.made.up": 1 }).ok === false);
ok("a good edit comes back typed", (() => {
  const r = validateOutcomeSettingsEdit({ "sales.amd.enabled": "true", "sales.callback.maxDaysAhead": "7" });
  return r.ok && r.values["sales.amd.enabled"] === true && r.values["sales.callback.maxDaysAhead"] === 7;
})());
ok("the table marks which rows are at their default", outcomeSettingsTable({ ...outcomeDefaults(), "sales.transcription.percent": 40 }).find((r) => r.key === "sales.transcription.percent").isDefault === false);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Sub-reasons: closed per outcome, editable, required when non-empty");

ok("every listed code is a real outcome and none is line-written", SUB_DISPOSITION_CODES.every((c) => DISPOSITION_ORDER.includes(c) && !AUTO_LOGGED_CODES.includes(c)));
ok("every default entry carries en/fr/es", Object.values(DEFAULT_SUB_DISPOSITIONS).flat().every((e) => e.label.en && e.label.fr && e.label.es));
ok("the brief's examples exist: not_interested → already_has_software/too_small/no_budget/bad_timing/using_competitor; wrong_number → disconnected/different_business/personal_line", (() => {
  const ni = DEFAULT_SUB_DISPOSITIONS.reached_not_interested.map((e) => e.key);
  const wn = DEFAULT_SUB_DISPOSITIONS.bad_number.map((e) => e.key);
  return ["already_has_software", "too_small", "no_budget", "bad_timing", "using_competitor"].every((k) => ni.includes(k)) && ["disconnected", "different_business", "personal_line"].every((k) => wn.includes(k));
})());
ok("using_competitor asks for the name", DEFAULT_SUB_DISPOSITIONS.reached_not_interested.find((e) => e.key === "using_competitor").askDetail === true);
ok("a label falls back to English, then the key", subDispositionLabel({ key: "k", label: { en: "E" } }, "fr") === "E" && subDispositionLabel({ key: "k" }, "fr") === "k");
ok("a list on a line-written outcome is refused", validateSubDispositionList("hung_up", []).ok === false);
ok("a list on callback is refused (the outcome is the reason)", validateSubDispositionList("callback", []).ok === false);
ok("a bad key is refused with the rule", /lowercase/.test(validateSubDispositionList("bad_number", [{ key: "Bad Key", label: "x" }]).error));
ok("a duplicate key is refused", validateSubDispositionList("bad_number", [{ key: "a_b", label: "x" }, { key: "a_b", label: "y" }]).ok === false);
ok("a missing English label is refused", validateSubDispositionList("bad_number", [{ key: "a_b", label: { fr: "x" } }]).ok === false);
ok("a string label becomes {en}", validateSubDispositionList("bad_number", [{ key: "a_b", label: "Plain" }]).entries[0].label.en === "Plain");
ok("thirteen entries is too many", validateSubDispositionList("bad_number", Array.from({ length: 13 }, (_, i) => ({ key: `k_${i}`, label: "x" }))).ok === false);
ok("the whole-object validator refuses on any bad list and names each", (() => {
  const r = validateSubDispositionLists({ bad_number: [{ key: "ok_key", label: "x" }], no_answer: [] });
  return r.ok === false && r.errors.length === 1 && /no_answer/.test(r.errors[0]);
})());
ok("effective lists: custom replaces, invalid falls back and is named, absent is default", (() => {
  const r = effectiveSubDispositions({ bad_number: [{ key: "custom", label: "C" }], not_a_fit: "garbage" });
  return r.source.bad_number === "custom" && r.lists.bad_number[0].key === "custom" && r.source.not_a_fit === "default" && r.fallbacks.length === 1 && r.source.gatekeeper === "default";
})());
ok("the pick validator refuses every wrong shape with a catalogue key", (() => {
  const cases = [
    validateSubDispositionPick({ code: "reached_not_interested" }),
    validateSubDispositionPick({ code: "reached_not_interested", subDisposition: "nope" }),
    validateSubDispositionPick({ code: "voicemail", subDisposition: "too_small" }),
    validateSubDispositionPick({ code: "reached_not_interested", subDisposition: "using_competitor" }),
  ];
  return cases.every((c) => c.ok === false && SUB_DISPOSITION_REFUSAL_KEYS.includes(c.reasonKey));
})());
ok("…and every refusal key exists in all nine languages", SUB_DISPOSITION_REFUSAL_KEYS.every((k) => Object.keys(APP_MESSAGES).every((l) => typeof APP_MESSAGES[l][k] === "string")));
ok("the detail is clipped and kept only when asked", (() => {
  const a = validateSubDispositionPick({ code: "reached_not_interested", subDisposition: "using_competitor", detail: "Jobber".padEnd(200, "!") });
  const b = validateSubDispositionPick({ code: "reached_not_interested", subDisposition: "too_small", detail: "ignored" });
  return a.ok && a.detail.length === 80 && b.ok && b.detail === null;
})());
ok("the counts: by sub, with `none`, the share from the module, and details lower-cased", (() => {
  const rows = [
    { disposition: "reached_not_interested", subDisposition: "too_small" },
    { disposition: "reached_not_interested", subDisposition: "too_small" },
    { disposition: "reached_not_interested", subDisposition: "using_competitor", subDispositionDetail: "Jobber" },
    { disposition: "reached_not_interested", subDisposition: "using_competitor", subDispositionDetail: "jobber " },
    { disposition: "reached_not_interested" },
    { disposition: "no_answer" },
    null,
  ];
  const c = subDispositionCounts(rows);
  const ni = c.reached_not_interested;
  return ni.total === 5 && ni.none === 1 && ni.rows[0].key === "too_small" && ni.rows[0].percent === 40 && ni.details.using_competitor.jobber === 2 && !c.no_answer;
})());

// ═══════════════════════════════════════════════════════════════════════════
section("3. The disposition audit");

ok("three verdicts, OMniLeads' three", JSON.stringify(AUDIT_VERDICTS) === JSON.stringify(["approved", "rejected", "observed"]));
ok("approved needs no note; rejected and observed do", parseAuditVerdict({ verdict: "approved" }).ok && !parseAuditVerdict({ verdict: "rejected" }).ok && !parseAuditVerdict({ verdict: "observed", notes: "  " }).ok && parseAuditVerdict({ verdict: "rejected", notes: "the transcript is a hang-up" }).ok);
ok("an unknown verdict is refused", !parseAuditVerdict({ verdict: "maybe" }).ok && !parseAuditVerdict(null).ok);
ok("figures: only rep-written outcomes are auditable; the rate is over audited, per rep and overall", (() => {
  const rows = [
    { salesRepId: "a", disposition: "reached_not_interested", dispositionAudit: { verdict: "rejected" } },
    { salesRepId: "a", disposition: "callback", dispositionAudit: { verdict: "approved" } },
    { salesRepId: "a", disposition: "voicemail", dispositionAudit: null },
    { salesRepId: "a", disposition: "no_answer", dispositionAutoLogged: true, dispositionAudit: { verdict: "approved" } },
    { salesRepId: "b", disposition: "gatekeeper", dispositionAudit: { verdict: "observed" } },
    { salesRepId: "b", disposition: null },
  ];
  const f = auditFigures(rows);
  const a = f.perRep.find((r) => r.repId === "a");
  return f.total.auditable === 4 && f.total.audited === 3 && f.total.rejected === 1 && f.total.rejectionRate === 33 && a.auditable === 3 && a.unaudited === 1 && a.rejectionRate === 50;
})());
ok("no audited rows → rate null, never 0", auditFigures([{ salesRepId: "a", disposition: "voicemail" }]).total.rejectionRate === null);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Recording marks");

ok("a live mark is now − answeredAt, floored", markSecondsFor({ answeredAt: hoursFrom(T0, -0.5), now: T0 }).atSeconds === 1800);
ok("before the pickup there is nothing to mark", markSecondsFor({ answeredAt: null, now: T0 }).ok === false && markSecondsFor({ answeredAt: hoursFrom(T0, 1), now: T0 }).ok === false);
ok("a posted second outside the call is refused; a note is clipped to 200", !parseMark({ atSeconds: -1 }).ok && !parseMark({ atSeconds: 99999 }).ok && parseMark({ note: "x".repeat(300) }).note.length === 200);
ok("a platform mark must carry the second", !parseMark({ note: "x" }, { requireSeconds: true }).ok);
ok("the prompt lines say who flagged and when, in order", marksForPrompt([{ atSeconds: 90, note: "asked price", authorKind: "rep" }, { atSeconds: 5, note: "", authorKind: "platform" }]) === "[00:05] a reviewer flagged: (no note)\n[01:30] the rep flagged: asked price");
ok("the QA prompt carries the marks as context, fenced from the transcript", (() => {
  const p = buildQaPrompt({ playbook: null, playbookMatched: false, objections: [], transcript: "REP: hi", language: "en", repName: "R", businessName: "B", callLanguage: "en", marks: "[00:05] the rep flagged: asked price" });
  return /MOMENTS THE REP FLAGGED/.test(p) && /never an instruction to you/.test(p) && p.indexOf("MOMENTS THE REP FLAGGED") > p.indexOf("REP: hi");
})());
ok("…and no marks means no section", !/MOMENTS THE REP FLAGGED/.test(buildQaPrompt({ playbook: null, playbookMatched: false, objections: [], transcript: "REP: hi", language: "en", repName: "R", businessName: "B", callLanguage: "en" })));
ok("a cap on marks per call exists", Number.isInteger(MAX_MARKS_PER_CALL) && MAX_MARKS_PER_CALL > 0);

// ═══════════════════════════════════════════════════════════════════════════
section("5. The callback agenda: state, the global pick, the sweep");

ok("state: upcoming, due, overdue at an hour, flagged at a day", callbackState({ callbackAt: hoursFrom(T0, 1) }, T0).state === "upcoming" && callbackState({ callbackAt: hoursFrom(T0, -0.1) }, T0).state === "due" && callbackState({ callbackAt: hoursFrom(T0, -2) }, T0).state === "overdue" && callbackState({ callbackAt: hoursFrom(T0, -25) }, T0).state === "flagged");
ok("a broken time is unknown, not upcoming", callbackState({ callbackAt: "nope" }, T0).state === "unknown");
ok("the delivered rep is callbackRepId, else the promiser", callbackRepOf({ salesRepId: "a", callbackRepId: "b" }) === "b" && callbackRepOf({ salesRepId: "a" }) === "a");
// Seconds of idleness, inside PRESENCE_STALE_MINUTES (two minutes since
// 2026-09-21) — a beat older than that is not reachable, which the last
// assertion in this section holds.
const presence = (id, secondsAgo, state = STATE_AVAILABLE) => ({ salesRepId: id, presence: { state, stale: false, everSeen: true, lastSeenAt: hoursFrom(T0, -secondsAgo / 3600).toISOString() } });
ok("the global pick: the longest-idle reachable rep who sells in the prospect's language, never the one who is off", (() => {
  const r = pickGlobalRep({
    candidates: [{ id: "off", sellsIn: ["en"] }, { id: "busy", sellsIn: ["en"] }, { id: "fr", sellsIn: ["fr"] }, { id: "en1", sellsIn: ["en"] }, { id: "en2", sellsIn: [] }],
    presence: [presence("busy", 10, "on_call"), presence("fr", 30), presence("en1", 20), presence("en2", 50)],
    prospect: { province: "ON" },
    excludeRepId: "off",
    now: T0,
  });
  return r.repId === "en2" && r.reason === "available";
})());
ok("a Quebec prospect goes only to a French seller", pickGlobalRep({ candidates: [{ id: "en1", sellsIn: ["en"] }, { id: "fr", sellsIn: ["fr"] }], presence: [presence("en1", 10), presence("fr", 20)], prospect: { province: "QC" }, now: T0 }).repId === "fr");
ok("…and with no French rep free the reason says so", pickGlobalRep({ candidates: [{ id: "en1", sellsIn: ["en"] }], presence: [presence("en1", 10)], prospect: { province: "QC" }, now: T0 }).reason === "nobody_fr");
ok("a beat older than PRESENCE_STALE_MINUTES is not reachable", pickGlobalRep({ candidates: [{ id: "a", sellsIn: ["en"] }], presence: [presence("a", PRESENCE_STALE_MINUTES * 60 + 5)], prospect: { province: "ON" }, now: T0 }).repId === null);
ok("a stale presence row is not reachable", pickGlobalRep({ candidates: [{ id: "a", sellsIn: ["en"] }], presence: [{ salesRepId: "a", presence: { state: STATE_AVAILABLE, stale: true, everSeen: true, lastSeenAt: T0.toISOString() } }], prospect: { province: "ON" }, now: T0 }).repId === null);

// The sweep, against a scripted client: one due callback, promiser off past
// the grace, one rep free → handed over, claim moved, pushed once.
{
  const writes = [];
  const row = {
    id: "att1",
    salesRepId: "off",
    prospectId: "p1",
    leadId: null,
    toE164: "+14165550100",
    callbackAt: hoursFrom(T0, -1),
    callbackScope: "personal",
    callbackRepId: "off",
    callbackNotifiedAt: null,
    callbackReassignedAt: null,
    dispositionNote: "ring after lunch",
    prospect: { id: "p1", businessName: "Benchmark Painting", province: "ON", assignedRepId: "off", doNotContactAt: null },
    lead: null,
  };
  const client = {
    platformSetting: { findUnique: async () => ({ value: { "sales.callback.graceMinutes": 15 } }) },
    salesCallAttempt: {
      findMany: async ({ where }) => (where?.toE164 ? [] : [row]),
      updateMany: async (args) => {
        writes.push(["attempt", args]);
        return { count: 1 };
      },
    },
    salesRep: { findMany: async () => [{ id: "off", name: "Off Rep", sellsIn: ["en"] }, { id: "free", name: "Free Rep", sellsIn: ["en"] }] },
    salesRepActivity: { findMany: async () => [{ salesRepId: "free", state: STATE_AVAILABLE, startedAt: hoursFrom(T0, -1), heartbeatAt: hoursFrom(T0, -0.01), endedAt: null }] },
    prospect: {
      updateMany: async (args) => {
        writes.push(["prospect", args]);
        return { count: 1 };
      },
    },
    salesQueueClaim: { create: async (args) => writes.push(["claim", args]) },
    $transaction: async (fn) => fn(client),
  };
  // presenceFor reads through the client the sweep is handed; the stub
  // above scripts SalesRepActivity and SalesRep for it.
  client.salesRep.findMany = async ({ where }) => (where?.id ? [{ id: "off", lastSeenAt: null }, { id: "free", lastSeenAt: T0 }] : [{ id: "off", name: "Off Rep", sellsIn: ["en"] }, { id: "free", name: "Free Rep", sellsIn: ["en"] }]);
  const out = await sweepCallbackAgenda({ client, now: T0, log: () => {} });
  const attemptWrite = writes.find((w) => w[0] === "attempt")?.[1];
  const prospectWrite = writes.find((w) => w[0] === "prospect")?.[1];
  ok("the sweep hands a personal callback past the grace to the free rep", out.handedOver === 1 && attemptWrite?.data?.callbackScope === "global" && attemptWrite?.data?.callbackRepId === "free", out);
  ok("…the hand-over is guarded on callbackReassignedAt null (fires once)", attemptWrite?.where?.callbackReassignedAt === null);
  ok("…the prospect's claim moves with it, scoped to the old holder", prospectWrite?.data?.assignedRepId === "free" && JSON.stringify(prospectWrite?.where?.OR) === JSON.stringify([{ assignedRepId: "off" }, { assignedRepId: null }]));
  ok("…and a claim log row is written for the new rep", writes.some((w) => w[0] === "claim" && w[1]?.data?.salesRepId === "free"));
}
{
  // Inside the grace: no hand-over, but the due push fires once.
  const writes = [];
  const row = { id: "att2", salesRepId: "off", prospectId: "p1", leadId: null, toE164: "+14165550100", callbackAt: hoursFrom(T0, -0.1), callbackScope: "personal", callbackRepId: "off", callbackNotifiedAt: null, callbackReassignedAt: null, dispositionNote: null, prospect: { id: "p1", businessName: "B", province: "ON", assignedRepId: "off", doNotContactAt: null }, lead: null };
  const client = {
    platformSetting: { findUnique: async () => null },
    salesCallAttempt: { findMany: async ({ where }) => (where?.toE164 ? [] : [row]), updateMany: async (args) => { writes.push(args); return { count: 1 }; } },
    salesRep: { findMany: async () => [] },
    salesRepActivity: { findMany: async () => [] },
    prospect: { updateMany: async () => ({ count: 0 }) },
    salesQueueClaim: { create: async () => null },
    $transaction: async (fn) => fn(client),
  };
  const out = await sweepCallbackAgenda({ client, now: T0, log: () => {} });
  ok("inside the grace the promise stays personal and is pushed once, guarded on callbackNotifiedAt null", out.handedOver === 0 && out.pushed === 1 && writes.length === 1 && writes[0].where.callbackNotifiedAt === null, out);
}
{
  // Kept already: a later dial to the number closes it — nothing happens.
  const row = { id: "att3", salesRepId: "off", prospectId: "p1", leadId: null, toE164: "+14165550100", callbackAt: hoursFrom(T0, -3), callbackScope: "personal", callbackRepId: "off", callbackNotifiedAt: null, callbackReassignedAt: null, prospect: { id: "p1", province: "ON", assignedRepId: "off", doNotContactAt: null }, lead: null };
  const client = {
    platformSetting: { findUnique: async () => null },
    salesCallAttempt: { findMany: async ({ where }) => (where?.toE164 ? [{ id: "later", toE164: "+14165550100", dialledAt: hoursFrom(T0, -2) }] : [row]), updateMany: async () => { throw new Error("must not write"); } },
    salesRep: { findMany: async () => [] },
    salesRepActivity: { findMany: async () => [] },
    $transaction: async (fn) => fn(client),
  };
  const out = await sweepCallbackAgenda({ client, now: T0, log: () => {} });
  ok("a promise already kept (a later dial) is closed, not pushed or handed over", out.closed === 1 && out.pushed === 0 && out.handedOver === 0, out);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The inbound service level");

const inb = (over) => ({ direction: "in", dialledAt: T0, ...over });
ok("answered: the wait is arrival to pickup", inboundWaitOf(inb({ answeredAt: hoursFrom(T0, 15 / 3600) })).waitSeconds === 15);
ok("a voicemail is 'expired' (EXITWITHTIMEOUT); a missed row with none is 'abandoned'; neither stamp is 'open'", inboundWaitOf(inb({ missedAt: T0, voicemailUrl: "x" })).kind === "expired" && inboundWaitOf(inb({ missedAt: T0 })).kind === "abandoned" && inboundWaitOf(inb({})).kind === "open");
ok("a zero-second voicemail (voicemailSeconds 0) is still expired, not abandoned", inboundWaitOf(inb({ missedAt: T0, voicemailSeconds: 0 })).kind === "expired");
ok("an outbound row is ignored", inboundWaitOf({ direction: "out", dialledAt: T0, answeredAt: T0 }) === null);
ok("the figures: 'Answered within 20 s: 67% (2 of 3)', abandoned, average, longest, per day and per rep", (() => {
  const rows = [
    inb({ answeredAt: hoursFrom(T0, 10 / 3600), answeredByRepId: "a" }),
    inb({ answeredAt: hoursFrom(T0, 20 / 3600), salesRepId: "a" }),
    inb({ answeredAt: hoursFrom(T0, 45 / 3600), answeredByRepId: "b" }),
    inb({ missedAt: T0, salesRepId: "b" }),
    inb({ dialledAt: hoursFrom(T0, 24), missedAt: T0, voicemailUrl: "x" }),
    { direction: "out", dialledAt: T0, answeredAt: T0 },
  ];
  const f = serviceLevelFigures(rows, { serviceLevelSeconds: 20 });
  const a = f.perRep.find((r) => r.repId === "a");
  return f.total.offered === 5 && f.total.answered === 3 && f.total.withinLevel === 2 && f.total.answeredWithinRate === 67 && f.total.abandoned === 1 && f.total.expired === 1 && f.total.averageWaitSeconds === 25 && f.total.longestWait === 45 && f.perDay.length === 2 && a.answered === 2 && a.withinLevel === 2;
})());
ok("no answered calls → rate and average null, not 0", serviceLevelFigures([inb({ missedAt: T0 })]).total.answeredWithinRate === null && serviceLevelFigures([inb({ missedAt: T0 })]).total.averageWaitSeconds === null);
ok("a broken level falls back to 20", serviceLevelFigures([], { serviceLevelSeconds: "x" }).serviceLevelSeconds === 20);

// ═══════════════════════════════════════════════════════════════════════════
section("7. Sampling: deterministic per call");

ok("fnv1a is stable and spreads", fnv1a("CA123") === fnv1a("CA123") && fnv1a("CA123") !== fnv1a("CA124"));
ok("100 is everything, 0 is nothing, garbage is everything (a broken setting must not stop transcription)", inSample("x", 100) && !inSample("x", 0) && inSample("x", "zzz") && inSample("x", 250));
ok("the same call is in or out on every run, and lowering the share keeps what was in", (() => {
  const ids = Array.from({ length: 500 }, (_, i) => `CA${i}abc`);
  const at60 = ids.filter((id) => inSample(id, 60));
  const at40 = ids.filter((id) => inSample(id, 40));
  return at40.every((id) => at60.includes(id)) && at40.length > 120 && at40.length < 280 && at60.length > 220 && at60.length < 380;
})());
ok("the sample keys on the carrier's sid, then ours", sampleKeyOf({ providerCallSid: "CA1", id: "a" }) === "CA1" && sampleKeyOf({ id: "a" }) === "a");
ok("the marker is recognisable", isSampledOut(sampledOutReason(40, sampleBucket("x"))) && !isSampledOut("unconfigured: no key"));

// ═══════════════════════════════════════════════════════════════════════════
section("8. Answering-machine detection");

ok("the verdict list is Twilio's", JSON.stringify(AMD_RESULTS) === JSON.stringify(["human", "machine_start", "machine_end_beep", "machine_end_silence", "machine_end_other", "fax", "unknown"]));
ok("an unknown AnsweredBy is null, never 'human'", amdResultOf("robot") === null && amdResultOf(null) === null && amdResultOf(" HUMAN ") === "human");
ok("machine_* is a machine; only machine_end_* may take a drop", isMachine("machine_start") && isMachine("machine_end_beep") && !isMachine("human") && isMachineEnd("machine_end_beep") && !isMachineEnd("machine_start"));
ok("off: the bridge adds nothing at all", JSON.stringify(amdNumberAttrs({ enabled: false, origin: "https://x", attemptId: "a" })) === "{}" && JSON.stringify(amdNumberAttrs({ enabled: "true", origin: "https://x", attemptId: "a" })) === "{}");
ok("on: DetectMessageEnd with the callback to /api/rep-dial/amd carrying the attempt id", (() => {
  const a = amdNumberAttrs({ enabled: true, origin: "https://app.fieldquo.com", attemptId: "att 1" });
  return a.machineDetection === "DetectMessageEnd" && a.amdStatusCallback === "https://app.fieldquo.com/api/rep-dial/amd?attemptId=att%201" && a.amdStatusCallbackMethod === "POST";
})());
ok("the callback's verdict, duration and sid are read verbatim", (() => {
  const v = amdVerdictFrom({ AnsweredBy: "machine_end_beep", MachineDetectionDuration: "4321", CallSid: "CA9" });
  return v.result === "machine_end_beep" && v.ms === 4321 && v.callSid === "CA9" && amdVerdictFrom({}).result === null;
})());
ok("a drop needs machine_end AND an https URL — never on a human, never on machine_start, never on http", shouldDropVoicemail({ result: "machine_end_beep", dropUrl: "https://x/d.mp3" }) && !shouldDropVoicemail({ result: "human", dropUrl: "https://x/d.mp3" }) && !shouldDropVoicemail({ result: "machine_start", dropUrl: "https://x/d.mp3" }) && !shouldDropVoicemail({ result: "machine_end_beep", dropUrl: "" }) && !shouldDropVoicemail({ result: "machine_end_beep", dropUrl: "http://x/d.mp3" }));
ok("the drop redirects the prospect leg to <Play> + <Hangup/> and escapes the URL", await (async () => {
  let got = null;
  const rest = { calls: (sid) => ({ update: async (args) => { got = { sid, ...args }; } }) };
  const r = await dropVoicemail({ callSid: "CA9", dropUrl: "https://x/d.mp3?a=1&b=2", rest });
  return r.ok && got.sid === "CA9" && got.twiml === "<Response><Play>https://x/d.mp3?a=1&amp;b=2</Play><Hangup/></Response>";
})());
ok("a failed REST update is a reason, not a throw", (await dropVoicemail({ callSid: "CA9", dropUrl: "https://x/d.mp3", rest: { calls: () => ({ update: async () => { throw new Error("nope"); } }) } })).ok === false);
ok("the card says something for a machine and a fax, nothing for a human", amdCardKey("machine_end_beep") === "app.salesCall.amd.machine" && amdCardKey("fax") === "app.salesCall.amd.fax" && amdCardKey("human") === null && amdCardKey(null) === null);
ok("…and those keys exist in all nine languages", ["app.salesCall.amd.machine", "app.salesCall.amd.fax"].every((k) => Object.keys(APP_MESSAGES).every((l) => typeof APP_MESSAGES[l][k] === "string")));
ok("a machine verdict files a two-minute call as voicemail in the shared bucket (dialTable.js), whatever the transcript says", (() => {
  const row = { direction: "out", dialChannel: "browser", providerCallSid: "CA1", providerStatus: "completed", answeredAt: T0, talkSeconds: 120, amdResult: "machine_end_beep", contractorWords: 60 };
  const c = measuredConversation(row);
  const t = dialTableRow([row, { ...row, providerCallSid: "CA2", amdResult: "human" }], { now: T0 });
  return c.talked === false && c.basis === "amd" && t.buckets.voicemailOrBrief === 1 && t.buckets.realConversation === 1 && t.conversationFromAmd === 1;
})());
ok("a machine verdict on an answered browser call auto-logs voicemail (the retry rule that fits), even when the rep hung up", (() => {
  const base = { dialChannel: "browser", direction: "out", providerStatus: "completed", answeredAt: T0, endedAt: hoursFrom(T0, 40 / 3600), talkSeconds: 40, amdResult: "machine_end_beep" };
  const a = autoLogOutcome(base);
  const b = autoLogOutcome({ ...base, hungUpBy: "rep" });
  const human = autoLogOutcome({ ...base, amdResult: "human" });
  return a.code === "voicemail" && a.reason === "amd_machine" && b.code === "voicemail" && human.code === null && human.reason === "talked";
})());
ok("…but never on an unanswered leg", autoLogOutcome({ dialChannel: "browser", direction: "out", providerStatus: "no-answer", amdResult: "machine_start" }).code === "no_answer");

// ═══════════════════════════════════════════════════════════════════════════
section("9. The wiring, read");

const bridge = decomment(read("app/api/rep-dial/bridge/route.js"));
ok("the bridge spreads amdNumberAttrs onto the <Number> it dials, from the settings", /amdNumberAttrs\(\{ enabled: settings\["sales\.amd\.enabled"\] === true, origin, attemptId: attempt\.id \}\)/.test(bridge) && /\.\.\.amd,/.test(bridge));
const amdRoute = decomment(read("app/api/rep-dial/amd/route.js"));
ok("the AMD webhook verifies the signature, scopes the write to the stored leg, and answers 204 through acknowledged()", /verifyTwilioWebhook\(request\)/.test(amdRoute) && /providerCallSid: verdict\.callSid \}, \{ providerCallSid: null \}/.test(amdRoute) && /acknowledged\(/.test(amdRoute) && /return noContent\(\)/.test(amdRoute));
ok("…and only shouldDropVoicemail() reaches dropVoicemail()", /shouldDropVoicemail\(\{ result: verdict\.result, dropUrl \}\)/.test(amdRoute) && (amdRoute.match(/dropVoicemail\(/g) || []).length === 1);
ok("the middleware lets /api/rep-dial through unauthenticated (the AMD route sits there for that reason)", !/rep-dial/.test(decomment(read("middleware.js"))) || /rep-dial/.test(read("middleware.js")));
const store = decomment(read("lib/sales/calls/store.js"));
ok("saveDisposition reads the lists and the settings once, counts open callbacks only for a callback, and hands both to the plan", /loadSubDispositions\(\{ client \}\), outcomeSettingValues\(\{ client \}\)/.test(store) && /if \(code === "callback" && !autoLogged\)/.test(store) && /subLists: subLists\.lists, callbackLimits/.test(store));
const cron = decomment(read("app/api/cron/sales-pipeline/route.js"));
ok("the per-minute cron runs the callback sweep in its own try", /result\.callbacks = await sweepCallbackAgenda\(/.test(cron));
const inbound = decomment(read("app/api/rep-dial/inbound/route.js"));
ok("the inbound after-dial stamps the PICKUP (end minus DialCallDuration), not the hang-up", /answeredAt: result\.answered \? answeredAtFrom\(\{ status: "completed", at: endedAtNow, seconds \}\) \|\| endedAtNow : null/.test(inbound));
const transcribe = decomment(read("lib/sales/calls/transcribe.js"));
ok("the transcriber consults the sample unless asked on demand, marks a skipped call, and the reconcile never retries the marker", /if \(sample\) \{/.test(transcribe) && /NOT: \{ transcriptError: \{ startsWith: SAMPLED_OUT \} \}/.test(transcribe));
const qaSrc = decomment(read("lib/sales/calls/qa.js"));
ok("the scorer consults the review sample the same way and reads the marks into the prompt", /sales\.aiReview\.percent/.test(qaSrc) && /marks: marksForPrompt\(attempt\.recordingMarks/.test(qaSrc));
const detail = decomment(read("app/api/platform/sales/call-quality/[attemptId]/route.js"));
ok("opening a sampled-out call on the platform transcribes or scores it on demand in after()", /call\.state === "not_sampled"/.test(detail) && /after\(async \(\) =>/.test(detail) && /sample: false/.test(detail));
for (const rel of [
  "app/api/sales/calls/marks/route.js",
  "app/api/sales/calls/live/route.js",
  "app/api/sales/calls/reviews/route.js",
  "app/api/platform/sales/outcomes/settings/route.js",
  "app/api/platform/sales/outcomes/callbacks/route.js",
  "app/api/platform/sales/outcomes/audit/[attemptId]/route.js",
  "app/api/platform/sales/outcomes/marks/[attemptId]/route.js",
  "app/platform/sales/outcomes/page.js",
  "scripts/report-amd-accuracy.mjs",
  "docs/SALES-OUTCOMES.md",
]) ok(`${rel} exists`, existsSync(join(ROOT, rel)));
ok("the rep-facing routes resolve the rep through requireCallingRep", ["marks", "live", "reviews"].every((r) => /requireCallingRep\(request\)/.test(read(`app/api/sales/calls/${r}/route.js`))));
ok("the rep's mark and live reads are scoped to the rep in the WHERE", /salesRepId: rep\.id/.test(read("app/api/sales/calls/marks/route.js")) && /salesRepId: rep\.id/.test(read("app/api/sales/calls/live/route.js")));
ok("the platform's audit and marks writes sit behind requireSuperadmin", /requireSuperadmin\(request/.test(read("app/api/platform/sales/outcomes/audit/[attemptId]/route.js")) && /requireSuperadmin\(request/.test(read("app/api/platform/sales/outcomes/marks/[attemptId]/route.js")));
const schema = read("prisma/schema.prisma");
for (const col of ["subDisposition", "subDispositionDetail", "amdResult", "amdAt", "amdMs", "callbackScope", "callbackRepId", "callbackNotifiedAt", "callbackReassignedAt"]) {
  const written = new RegExp(`\\b${col}\\b`).test(store + amdRoute + decomment(read("lib/sales/calls/dispositions.js")) + decomment(read("lib/sales/calls/callbackAgenda.js")));
  const readBack = new RegExp(`\\b${col}\\b`).test(decomment(read("lib/sales/calls/history.js")) + decomment(read("lib/sales/calls/qaQueue.js")) + decomment(read("lib/sales/calls/callbackAgenda.js")) + decomment(read("lib/sales/calls/outcomeReport.js")) + decomment(read("app/api/sales/queue/route.js")) + decomment(read("lib/sales/calls/conversation.js")) + decomment(read("app/api/sales/calls/live/route.js")));
  ok(`SalesCallAttempt.${col} is in the schema, written and read`, new RegExp(`^\\s+${col}\\s`, "m").test(schema) && written && readBack);
}
ok("SalesDispositionAudit and SalesRecordingMark are in the schema", /^model SalesDispositionAudit \{/m.test(schema) && /^model SalesRecordingMark \{/m.test(schema));
const outcomeKeys = ["app.salesCall.sub.pick", "app.salesCall.mark.button", "app.salesCall.mark.save", "app.salesCall.mark.placeholder", "app.salesCall.mark.saved", "app.salesCall.mark.failed", "app.salesCall.mark.listTitle", "app.salesCall.history.machine", "app.salesCall.history.machineTitle", "app.salesCall.audit.rejected.withNote", "app.salesCall.audit.rejected.plain", "app.salesCall.audit.observed.withNote", "app.salesCall.audit.observed.plain", "app.salesCall.audit.dashboardTitle", "app.salesCall.audit.dashboardLine", "app.salesQueue.callbackDue", "app.salesQueue.callbackAt", "app.salesQueue.callbackHandedOver", "app.salesCall.callbacks.handedOver", "app.notify.callbackDue.title", "app.notify.callbackDue.body", "app.notify.callbackHandedOver.title", "app.notify.callbackHandedOver.body", "app.salesCallQa.state.not_sampled"];
ok("every rep-facing key this pass added exists in all nine languages", outcomeKeys.every((k) => Object.keys(APP_MESSAGES).every((l) => typeof APP_MESSAGES[l][k] === "string" && APP_MESSAGES[l][k].length > 0)), outcomeKeys.filter((k) => !Object.keys(APP_MESSAGES).every((l) => APP_MESSAGES[l][k])));
ok("…and the placeholders survive translation", Object.keys(APP_MESSAGES).every((l) => /\{time\}/.test(APP_MESSAGES[l]["app.salesQueue.callbackDue"]) && /\{rep\}/.test(APP_MESSAGES[l]["app.salesQueue.callbackHandedOver"]) && /\{note\}/.test(APP_MESSAGES[l]["app.salesCall.audit.rejected.withNote"]) && /\{count\}/.test(APP_MESSAGES[l]["app.salesCall.audit.dashboardLine"]) && /\{who\}/.test(APP_MESSAGES[l]["app.notify.callbackDue.body"])));
const form = decomment(read("app/components/sales/OutcomeForm.js"));
ok("the outcome form draws the sub-reason list for what the draft folds to, and a field for the one that asks a name", /subDispositionsFor\(preview\.code, subLists\)/.test(form) && /data-outcome-sub-choice/.test(form) && /data-outcome-sub-detail/.test(form) && /sub: "", subDetail: ""/.test(form));
const session = decomment(read("app/components/sales/CallSession.js"));
ok("the session validates the pick with the same pure rule before posting, and posts subDisposition + detail", /validateSubDispositionPick\(\{ code: fold\.code/.test(session) && /subDisposition: sub\.subDisposition,/.test(session) && /subDispositionDetail: sub\.detail,/.test(session));
const strip = decomment(read("app/components/sales/LiveCallStrip.js"));
ok("the live card carries the AMD notice and the Mark button on an outbound call", /<AmdNotice facts=\{liveFacts\} \/>/.test(strip) && /<LiveMarkButton attemptId=\{live\.attemptId \|\| null\} \/>/.test(strip));
const history = decomment(read("app/components/sales/CallHistory.js"));
ok("the rep's history row prints the sub-reason, the machine chip, the owner's verdict and the marks", /data-call-history-sub/.test(history) && /data-call-history-amd/.test(history) && /data-call-history-audit/.test(history) && /data-call-history-marks/.test(history));
const dash = decomment(read("app/sales/page.js"));
ok("the rep's dashboard reads /api/sales/calls/reviews and draws the rejected count only when there is one", /useEndpoint\("\/api\/sales\/calls\/reviews"/.test(dash) && /reviews\.data\.rejected > 0/.test(dash));
const queueRoute = decomment(read("app/api/sales/queue/route.js"));
ok("the queue attaches the delivered callback to the row and the current pane", /callback: callbackById\.get\(p\.id\) \|\| null/.test(queueRoute) && /current\.callback = callbackById\.get\(currentId\)/.test(queueRoute));
const queuePage = decomment(read("app/sales/queue/page.js"));
ok("…and the queue draws the badge on the row and the pane", /data-queue-callback=/.test(queuePage) && /data-current-callback=/.test(queuePage));
const review = decomment(read("app/components/sales/CallQualityReview.js"));
ok("the review screen draws the ticks, the list, Mark here, and the audit panel with three verdict buttons", /data-mark-ruler/.test(review) && /data-mark-list/.test(review) && /data-mark-here/.test(review) && /data-audit-verdict=\{v\}/.test(review) && /\["approved",/.test(review) && /\["rejected",/.test(review) && /\["observed",/.test(review));
const perf = decomment(read("app/platform/sales/performance/page.js"));
ok("the performance page prints sub-reasons, audits per rep with the rejection rate, and the service level — and does no division of its own", /data-sub-breakdown/.test(perf) && /data-audit-rep/.test(perf) && /data-service-level/.test(perf) && !/\*\s*100/.test(perf));
const floor = decomment(read("app/platform/sales/floor/page.js"));
ok("the floor board flags callbacks overdue past a day", /data-overdue-callbacks/.test(floor) && /overdueCallbacks\.flagged/.test(floor));
const costs = decomment(read("app/platform/costs/page.js"));
ok("the costs page prints the transcription and review shares beside the spend", /data-costs-sampling/.test(costs) && /transcriptionPercent/.test(costs));
ok("the sidebar links the Outcomes page", /\/platform\/sales\/outcomes/.test(read("app/components/platform/PlatformSidebar.js")));

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
