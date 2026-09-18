// scripts/check-call-qa.mjs
//
//   npm run check:call-qa
//
// The call-quality scorecard, executed.
//
// The deterministic half is run against synthetic transcripts — a disclosure
// present and absent, a banned move on the rep's line and the same words on
// the contractor's, the talk-ratio arithmetic, the first-twenty-seconds
// window. The model call is stubbed in schema mode so the whole of
// scoreAttempt() runs: budget checked BEFORE the vendor, usage metered AFTER
// with the idempotency ref, a refused budget spending nothing, a failed model
// leaving a sentence on the row. Then the rollups — three numbers that are
// never collapsed, the human pass overriding the model's, test-line dials
// excluded — and the agency's scope, proven by moving a rep off the team
// between two reads.
//
// Judged by exit code. Every source read is decommented first, for the
// reason check-sales-portal-i18n.mjs gives.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { rows, writes, reads, resetDbStub } from "./fixtures/dbStub.mjs";
import {
  analyseTranscript,
  overallFrom,
  scoreAttempt,
  scoreMissing,
  OVERALL_WEIGHTS,
  QA_SCHEMA,
  SKIP_REASONS,
  TALK_RATIO_BAND,
  IDENTITY_WINDOW_SECONDS,
  transcriptForModel,
  buildQaPrompt,
} from "@/lib/sales/calls/qa";
import {
  callQaQueue,
  callQaDetail,
  reviewCallQa,
  agencyCanHear,
  repCallQuality,
  orderForReview,
  flagTranscript,
  parseReview,
  queueRow,
} from "@/lib/sales/calls/qaQueue";
import { qualitySummary, buildCallQuality, effectiveOverall, previousPeriod } from "@/lib/sales/callQuality";
import { buildPerformanceReport, buildCallActivity } from "@/lib/sales/performanceReport";
import { buildSalesPerformance, NOT_TRACKED } from "@/lib/sales/performance";
import { agencyTeamIds } from "@/lib/sales/agency";
import { repViewer, visibleRepIds } from "@/lib/sales/team";
import { RECORDING_DISCLOSURE } from "@/lib/sales/playbook/recordingDisclosure";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)?.slice(0, 300)}` : ""}`);
  }
}
const section = (h) => console.log(`\n${h}\n`);

// ── Synthetic transcripts ──────────────────────────────────────────────────
const seg = (speaker, start, end, text) => ({ speaker, start, end, text });
const GOOD = [
  seg("rep", 0, 6, `Hi, is that Dubois Painting? Dana here, from FieldQuo — ${RECORDING_DISCLOSURE.en} I know I'm catching you out of nowhere. Can I give you thirty seconds on why I called?`),
  seg("contractor", 6, 9, "Go on then."),
  seg("rep", 9, 16, "When you go out and look at a job, are you usually able to give them a price while you're standing there, or does it get put together back at the house?"),
  seg("contractor", 16, 30, "Back at the house, usually. Evenings. My wife does the paperwork."),
  seg("rep", 30, 40, "If that's how it goes, that's exactly why I'm calling. Can I ask you three things about how the work comes in? How many of you are on the tools?"),
  seg("contractor", 40, 55, "Me and two lads. Busy enough, mostly referrals."),
  seg("rep", 55, 63, "When someone reaches out today, how long is it usually before they've actually got a quote in their hands — same day, a couple of days, a week?"),
  seg("contractor", 63, 80, "Couple of days if I'm honest. Sometimes a week."),
  seg("rep", 80, 96, "I can show you in fifteen minutes how it works for a business like yours. Have you got your calendar handy — what works better for you, mornings or afternoons? I'll send the invite."),
  seg("contractor", 96, 100, "Thursday morning I suppose."),
];
const NO_DISCLOSURE = GOOD.map((s, i) => (i === 0 ? seg("rep", 0, 6, "Hi, is that Dubois Painting? Dana here, from FieldQuo. I know I'm catching you out of nowhere. Can I give you thirty seconds on why I called?") : s));
const BANNED = [...GOOD, seg("rep", 100, 104, "No problem — I'll leave you alone then, sorry to bother you."), seg("contractor", 104, 106, "Cheers.")];
const CONTRACTOR_SAYS_BANNED = [...GOOD, seg("contractor", 100, 104, "Honestly just leave me alone, I'll never call you again.")];

// ═══════════════════════════════════════════════════════════════════════════
section("1. The rubric sums to 100 and the schema is strict-mode shaped");
// ═══════════════════════════════════════════════════════════════════════════
{
  const total = Object.values(OVERALL_WEIGHTS).reduce((a, b) => a + b, 0);
  ok("OVERALL_WEIGHTS sums to 100", total === 100, total);
  ok("every weight is a positive integer", Object.values(OVERALL_WEIGHTS).every((w) => Number.isInteger(w) && w > 0));
  const strict = (node) => {
    if (!node || typeof node !== "object") return true;
    if (node.type === "object") {
      if (node.additionalProperties !== false) return false;
      const props = Object.keys(node.properties || {});
      if (!Array.isArray(node.required) || props.some((p) => !node.required.includes(p))) return false;
      return props.every((p) => strict(node.properties[p]));
    }
    if (node.type === "array") return strict(node.items);
    return true;
  };
  ok("QA_SCHEMA: every object closes additionalProperties and requires every property (strict mode)", strict(QA_SCHEMA));
  ok("the schema asks for coaching sentences", QA_SCHEMA.properties.coaching?.type === "array");
  ok("the banned-move enum is the library's own list", Array.isArray(QA_SCHEMA.properties.bannedMoves.items.properties.move.enum) && QA_SCHEMA.properties.bannedMoves.items.properties.move.enum.includes("foreclosing exit line"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The deterministic half, on synthetic transcripts");
// ═══════════════════════════════════════════════════════════════════════════
{
  const names = { repName: "Dana Solo", businessName: "Dubois Painting" };
  const d = analyseTranscript(GOOD, names);
  ok("a good call is eligible", d.eligible && d.skippedReason === null, d);
  ok("the disclosure is found on the rep's first line, with its index and time", d.disclosure.said && d.disclosure.index === 0 && d.disclosure.at === 0, d.disclosure);
  ok("FieldQuo, the rep's first name and the business are all inside the first 20 s", d.first20.companyNamed && d.first20.repNamed && d.first20.businessNamed, d.first20);
  ok("no banned move on a clean call", d.bannedMoves.length === 0, d.bannedMoves);
  ok("the turnaround question's own words are detected", d.turnaroundKeyword === true);
  // rep: 6 + 7 + 10 + 8 + 16 = 47 ; contractor: 3 + 14 + 15 + 17 + 4 = 53 → 0.47
  ok("talk ratio is rep seconds over rep + contractor seconds", d.talk.repSeconds === 47 && d.talk.contractorSeconds === 53 && d.talk.ratio === 0.47, d.talk);
  ok("…and the ratio sits inside the cold-call band (0.45–0.65, Gong's 55:45)", TALK_RATIO_BAND.min === 0.45 && TALK_RATIO_BAND.max === 0.65 && d.talk.ratio >= TALK_RATIO_BAND.min && d.talk.ratio <= TALK_RATIO_BAND.max);
  ok("the longest uninterrupted rep burst is the longest single run (16 s here) and is flagged under 25 s", d.talk.longestRepBurstSeconds === 16 && d.talk.burstTooShort === true, d.talk);
  ok("two rep lines in a row sum into one burst", analyseTranscript([seg("rep", 0, 10, "a"), seg("rep", 10, 30, "b"), seg("contractor", 30, 40, "c"), seg("rep", 40, 45, "d")], names).talk.longestRepBurstSeconds === 30);
  ok("an unknown segment between two rep lines breaks the run", analyseTranscript([seg("rep", 0, 10, "a"), seg("unknown", 10, 12, "?"), seg("rep", 12, 40, "b"), seg("contractor", 40, 60, "c")], names).talk.longestRepBurstSeconds === 28);
  ok("the reason for the call is found with its time (the pivot at 30 s, inside the first minute)", d.reason.said && d.reason.at === 30 && d.reason.withinDue === true, d.reason);
  ok("…the opener's own 'why I called' (the permission ask) is NOT the reason", analyseTranscript([seg("rep", 0, 5, "Can I give you thirty seconds on why I called?"), seg("contractor", 5, 30, "ok")], names).reason.said === false);
  ok("…and the v3 opener's spelling counts too", analyseTranscript([seg("rep", 0, 5, "Hi. The reason I'm calling is your quotes."), seg("contractor", 5, 30, "ok")], names).reason.at === 0);
  ok("…a reason after the first minute is not withinDue", analyseTranscript([seg("contractor", 0, 70, "…"), seg("rep", 70, 75, "that's exactly why I'm calling")], names).reason.withinDue === false);
  ok("the close asked for a calendar", d.calendarAsked === true && analyseTranscript(NO_DISCLOSURE.slice(0, 4), names).calendarAsked === false);
  // line 0 has two, line 2 one, line 4 two, line 6 one, line 8 one.
  ok("question marks on the rep's lines are counted", d.repQuestionMarks === 7, d.repQuestionMarks);

  const nd = analyseTranscript(NO_DISCLOSURE, names);
  ok("a call without the sentence has disclosure.said false and no index", !nd.disclosure.said && nd.disclosure.index === null);

  const fr = analyseTranscript([seg("rep", 0, 5, `Bonjour — ${RECORDING_DISCLOSURE.fr} Dana de FieldQuo.`), seg("contractor", 5, 30, "Oui, allez-y.")], names);
  ok("the French disclosure counts too", fr.disclosure.said);

  const b = analyseTranscript(BANNED, names);
  ok("a banned move on the rep's line is caught by index, with the move named", b.bannedMoves.some((m) => m.index === 10 && m.move === "foreclosing exit line"), b.bannedMoves);
  ok("…and the apology on the same line is a second entry", b.bannedMoves.some((m) => m.index === 10 && m.move === "apology"));
  const c = analyseTranscript(CONTRACTOR_SAYS_BANNED, names);
  ok("the same words on the CONTRACTOR's line are not the rep's banned move", c.bannedMoves.length === 0, c.bannedMoves);

  const late = analyseTranscript([seg("rep", 0, 10, "Hello there."), seg("contractor", 10, 22, "Who is this?"), seg("rep", 25, 32, "Dana from FieldQuo, Dubois Painting?")], names);
  ok(`FieldQuo said at 25 s is outside the ${IDENTITY_WINDOW_SECONDS}-second window`, !late.first20.companyNamed && !late.first20.repNamed, late.first20);

  const onlyRep = analyseTranscript([seg("rep", 0, 30, "Hello? Hello? I think you've gone.")], names);
  ok("a call where the contractor never spoke is skipped as no_conversation", !onlyRep.eligible && onlyRep.skippedReason === "no_conversation");
  const mixed = analyseTranscript([seg("unknown", 0, 30, "hello hello"), seg("unknown", 30, 60, "yes yes")], names);
  ok("a mixed track is skipped as speakers_unknown", !mixed.eligible && mixed.skippedReason === "speakers_unknown");
  const short = analyseTranscript([seg("rep", 0, 4, "Hi is that Dubois?"), seg("contractor", 4, 8, "Wrong number.")], names);
  ok("a call that ended inside twenty seconds is skipped as too_short", !short.eligible && short.skippedReason === "too_short");
  ok("every skip reason has a sentence", ["no_conversation", "speakers_unknown", "too_short"].every((k) => typeof SKIP_REASONS[k] === "string" && SKIP_REASONS[k].length > 20));

  let threw = false;
  try {
    analyseTranscript(null, {});
    analyseTranscript([{ speaker: 42, start: "x", end: null, text: 7 }, null, "junk"], { repName: 3 });
    analyseTranscript([seg("rep", -5, -1, "negative"), seg("contractor", 100, 50, "end before start")], names);
  } catch (err) {
    threw = err.message;
  }
  ok("hostile input never throws", threw === false, threw);
  const neg = analyseTranscript([seg("contractor", 100, 50, "end before start"), seg("rep", 0, 30, "x")], names);
  ok("an end before its start contributes zero seconds, not a negative", neg.talk.contractorSeconds === 0);
  ok("an empty transcript has a null ratio, never NaN", analyseTranscript([], names).talk.ratio === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The overall is a rubric over both halves");
// ═══════════════════════════════════════════════════════════════════════════
{
  const d = analyseTranscript(GOOD, { repName: "Dana Solo", businessName: "Dubois Painting" });
  const allYes = {
    identityCheck: { met: true, evidence: "" },
    permissionAsk: { asked: true, phrasedForYes: true, evidence: "" },
    candour: { met: true, evidence: "" },
    bannedMoves: [],
    pivot: { delivered: true, afterContractorAnswer: true, evidence: "" },
    discovery: { questionCount: 3, turnaroundAsked: true, evidence: "" },
    objections: [],
    nextStep: { offered: true, dated: true, evidence: "" },
    closeAsk: { met: true, evidence: "" },
  };
  const full = overallFrom({ deterministic: d, scores: allYes });
  ok("everything met is 100", full.overall === 100, full);
  ok("the lines add up to the overall", full.lines.reduce((n, l) => n + l.points, 0) === full.overall);
  const none = overallFrom({ deterministic: analyseTranscript(NO_DISCLOSURE, {}), scores: { ...allYes, permissionAsk: { asked: false }, candour: { met: false }, pivot: { delivered: false }, discovery: { questionCount: 1, turnaroundAsked: false }, nextStep: { offered: false }, closeAsk: { met: false }, bannedMoves: [{ move: "flattery", line: "x" }] } });
  ok("nothing met but the ratio and objections is the sum of those two lines", none.overall === OVERALL_WEIGHTS.talkRatio + OVERALL_WEIGHTS.objections + OVERALL_WEIGHTS.turnaround, none.overall);
  const withObjection = overallFrom({ deterministic: d, scores: { ...allYes, objections: [{ objection: "no time", repSaid: "ok bye", libraryAnswer: false, handled: false }] } });
  ok("an unhandled objection loses exactly its line", withObjection.overall === 100 - OVERALL_WEIGHTS.objections);
  const bannedDet = overallFrom({ deterministic: analyseTranscript(BANNED, { repName: "Dana" }), scores: allYes });
  ok("a deterministic banned move zeroes the noBannedMove line even when the model saw none", bannedDet.lines.find((l) => l.key === "noBannedMove").points === 0);
  const wideRatio = overallFrom({ deterministic: { ...d, talk: { ...d.talk, ratio: 0.9 } }, scores: allYes });
  ok("a rep who talked 90% of the time loses the talk-ratio line", wideRatio.overall === 100 - OVERALL_WEIGHTS.talkRatio);
  ok("no scores means no overall, not zero", overallFrom({ deterministic: d, scores: null }).overall === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. scoreAttempt — budget before, meter after, honest on every path");
// ═══════════════════════════════════════════════════════════════════════════
const REP = { id: "rep_1", name: "Dana Solo", language: "fr" };
const PROSPECT = { businessName: "Dubois Painting", province: "QC" };
const ATTEMPT = (over = {}) => ({
  id: "att_1",
  salesRepId: REP.id,
  prospectId: "p1",
  recordingUrl: "https://api.twilio.com/rec/1",
  transcript: GOOD,
  transcribedAt: new Date("2026-09-17T10:00:00Z"),
  playbookKey: "COMPETITIVE_DISPLACEMENT",
  playbookVersion: "1",
  jurisdictionCode: "CA-ON",
  dialledAt: new Date("2026-09-17T09:55:00Z"),
  talkSeconds: 100,
  endedAt: null,
  salesRep: REP,
  prospect: PROSPECT,
  qa: null,
  ...over,
});
const MODEL_ANSWER = {
  identityCheck: { met: true, evidence: "Dana here, from FieldQuo" },
  permissionAsk: { asked: true, phrasedForYes: true, evidence: "Can I give you thirty seconds" },
  candour: { met: true, evidence: "catching you out of nowhere" },
  bannedMoves: [],
  pivot: { delivered: true, afterContractorAnswer: true, evidence: "that's exactly why I'm calling" },
  discovery: { questionCount: 3, turnaroundAsked: true, evidence: "quote in their hands" },
  objections: [],
  nextStep: { offered: true, dated: true, evidence: "Thursday morning" },
  closeAsk: { met: true, evidence: "mornings or afternoons" },
  gatekeeper: { firstSpeakerDecisionMaker: true, nameObtained: false, timeObtained: false, evidence: "Go on then." },
  coaching: ["Un.", "Deux.", "Trois.", "Quatre — one too many."],
};
function harness({ budgetOk = true, modelOk = true } = {}) {
  const calls = [];
  return {
    calls,
    opts: {
      checkBudgetFn: async () => {
        calls.push("budget");
        return budgetOk ? { ok: true, budgets: [] } : { ok: false, reason: "over_budget", message: "spent" };
      },
      completeFn: async ({ schema, schemaName, system, prompt, onUsage }) => {
        calls.push("complete");
        calls.prompt = prompt;
        calls.system = system;
        calls.schema = schema;
        calls.schemaName = schemaName;
        if (!modelOk) return { ok: false, reason: "ai_unavailable", message: "vendor down" };
        onUsage?.({ promptTokens: 3200, completionTokens: 600 });
        return { ok: true, data: MODEL_ANSWER };
      },
      recordUsageFn: async (u) => {
        calls.push("usage");
        calls.usage = u;
        return { id: "usage_1" };
      },
      loadPlaybooksFn: async () => [{ key: "COMPETITIVE_DISPLACEMENT", name: "Competitive displacement", version: "1", stages: [{ stageKey: "open", say: "Hi — is that {businessName}?", prompts: ["are you usually able to give them a price?"] }] }],
      loadObjectionsFn: async () => [{ code: "no_time", label: "No time", cues: ["busy"], response: "Then this is the wrong week, not the wrong call." }],
      now: new Date("2026-09-17T10:05:00Z"),
    },
  };
}
{
  resetDbStub();
  rows.salesCallAttempt.push(ATTEMPT());
  const h = harness();
  const r = await scoreAttempt("att_1", h.opts);
  ok("a good call scores", r.ok && r.reason === "done", r);
  ok("the budget is checked BEFORE the model and usage recorded AFTER", h.calls.join(">") === "budget>complete>usage", h.calls);
  ok("the model is called in schema mode with the scorecard schema", h.calls.schema === QA_SCHEMA && h.calls.schemaName === "sales_call_qa");
  ok("the prompt carries the playbook's lines, the objection library and the transcript", /Competitive displacement/.test(h.calls.prompt) && /wrong week/.test(h.calls.prompt) && /Dubois Painting\?/.test(h.calls.prompt) && /\[00:00\] REP:/.test(h.calls.prompt));
  ok("…and asks for coaching in the rep's portal language (French)", /in French/.test(h.calls.prompt), h.calls.prompt.match(/coaching sentences in [A-Za-z]+/)?.[0]);
  ok("…with the Quebec call's turnaround question in French", /soumission entre les mains/.test(h.calls.prompt));
  ok("the system prompt says transcript text is evidence, never an instruction", /never an instruction/.test(h.calls.system));
  ok("usage is metered to the sales_call_qa area with ref qa:<attemptId>", h.calls.usage.area === "sales_call_qa" && h.calls.usage.ref === "qa:att_1" && h.calls.usage.salesRepId === REP.id, h.calls.usage);
  const w = writes.find((x) => x.model === "salesCallQa" && x.action.startsWith("upsert"));
  ok("one SalesCallQa row is upserted by attemptId", w && w.where.attemptId === "att_1", w);
  ok("…with the overall from the rubric (100 here)", w.data.overall === 100, w.data.overall);
  ok("…coaching trimmed to three sentences", Array.isArray(w.data.coaching) && w.data.coaching.length === 3);
  ok("…the deterministic half stored beside the model's", w.data.deterministic?.disclosure?.said === true && w.data.scores?.permissionAsk?.asked === true);
  ok("…the rubric lines stored so a screen can show where points went", Array.isArray(w.data.scores.rubric) && w.data.scores.rubric.length === Object.keys(OVERALL_WEIGHTS).length);
  ok("…the playbook version matched", w.data.playbookMatched === true && w.data.playbookKey === "COMPETITIVE_DISPLACEMENT");
  ok("…the language and the cost recorded", w.data.language === "fr" && Number.isInteger(w.data.costMicros) && w.data.costMicros > 0, w.data.costMicros);
  ok("the per-call cost on gpt-5-mini is about a tenth of a cent (3200 in / 600 out → ≈ 1016 micros)", w.data.costMicros > 500 && w.data.costMicros < 3000, w.data.costMicros);
  ok("the invite check reads SalesEvent inside the call window: none here → false", w.data.deterministic.inviteCreated === false && reads.some((r) => r.model === "salesEvent" && r.action === "count"));

  // Already scored: nothing spent.
  const h2 = harness();
  rows.salesCallAttempt[0].qa = { id: "qa_1", reviewedAt: null, skippedReason: null, costMicros: w.data.costMicros };
  const again = await scoreAttempt("att_1", h2.opts);
  ok("a scored call is left alone without force, and nothing is spent", again.reason === "already" && h2.calls.length === 0, h2.calls);

  // Force on a paid row: a new ref, so the second bill is not hidden.
  const h3 = harness();
  const forced = await scoreAttempt("att_1", { ...h3.opts, force: true });
  ok("a forced rescore of a PAID row meters under a suffixed ref", forced.ok && /^qa:att_1:rescore:\d+$/.test(h3.calls.usage.ref), h3.calls.usage?.ref);
}
{
  resetDbStub();
  rows.salesCallAttempt.push(ATTEMPT({ transcript: BANNED }));
  rows.salesEvent.push({ id: "ev1", salesRepId: REP.id, createdAt: new Date("2026-09-17T09:58:00Z") });
  const h = harness();
  h.opts.loadPlaybooksFn = async () => [{ key: "COMPETITIVE_DISPLACEMENT", name: "CD", version: "1", stages: [{ stageKey: "close", say: "Sorry to bother you — thanks for your time.", prompts: [] }] }];
  const r = await scoreAttempt("att_1", h.opts);
  const w = writes.find((x) => x.model === "salesCallQa");
  ok("a banned move that is IN the stored script is attributed to the script; one that is not, to the rep", r.ok && w.data.deterministic.bannedMoves.find((b) => b.move === "apology")?.source === "script" && w.data.deterministic.bannedMoves.find((b) => b.move === "foreclosing exit line")?.source === "rep", w.data.deterministic.bannedMoves);
  ok("a SalesEvent created during the call window counts as the invite", w.data.deterministic.inviteCreated === true);
  ok("…and the schema now carries the gatekeeper read", QA_SCHEMA.required.includes("gatekeeper"));
}
{
  resetDbStub();
  rows.salesCallAttempt.push(ATTEMPT());
  const h = harness({ budgetOk: false });
  const r = await scoreAttempt("att_1", h.opts);
  ok("a spent budget refuses before the model, spends nothing and writes no row", !r.ok && r.reason === "over_budget" && h.calls.join(">") === "budget" && !writes.some((x) => x.model === "salesCallQa"), { r, calls: h.calls });
}
{
  resetDbStub();
  rows.salesCallAttempt.push(ATTEMPT({ transcript: [seg("rep", 0, 30, "Hello? Hello?")] }));
  const h = harness();
  const r = await scoreAttempt("att_1", h.opts);
  const w = writes.find((x) => x.model === "salesCallQa");
  ok("an unscorable call is written with its reason and no overall, and the model is never called", r.ok && r.reason === "skipped" && r.skippedReason === "no_conversation" && w?.data.overall === null && w?.data.skippedReason === "no_conversation" && h.calls.length === 0, { r, calls: h.calls });
}
{
  resetDbStub();
  rows.salesCallAttempt.push(ATTEMPT());
  const h = harness({ modelOk: false });
  const r = await scoreAttempt("att_1", h.opts);
  const w = writes.find((x) => x.model === "salesCallQa");
  ok("a failed model call leaves a sentence on the row under ai_failed:, and no usage is recorded", !r.ok && w?.data.skippedReason === "ai_failed:ai_unavailable" && w?.data.overall === null && !h.calls.includes("usage"), { r, data: w?.data });
  ok("…and the failure is in the platform error log", writes.some((x) => x.model === "platformErrorLog"));
}
{
  resetDbStub();
  rows.salesCallAttempt.push(ATTEMPT({ id: "att_x", transcript: null, transcribedAt: null }));
  const r = await scoreAttempt("att_x", harness().opts);
  ok("no transcript is a plain refusal", !r.ok && r.reason === "no_transcript");
  ok("no such attempt is a plain refusal", (await scoreAttempt("nope", harness().opts)).reason === "no_attempt");
}
{
  resetDbStub();
  rows.salesCallAttempt.push(ATTEMPT({ id: "a1", dialledAt: new Date("2026-09-01T00:00:00Z") }), ATTEMPT({ id: "a2", dialledAt: new Date("2026-09-02T00:00:00Z") }), ATTEMPT({ id: "a3", transcribedAt: null, transcript: null }));
  // scoreMissing uses the real scoreAttempt with defaults; the stub client
  // only stands in for the database, so hand it a client and let the
  // model be the one thing that is not exercised here — it was above.
  const r = await scoreMissing({ limit: 5, client: (await import("@/lib/db")).db }).catch((err) => ({ threw: err.message }));
  ok("scoreMissing offers only transcribed calls with no scorecard (2 of 3)", r.attempted === 2, r);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The hook: scoring runs on the transcript's success path");
// ═══════════════════════════════════════════════════════════════════════════
{
  const src = decomment(read("lib/sales/calls/transcribe.js"));
  ok("transcribe.js imports scoreAttempt", /import \{ scoreAttempt \} from "\.\/qa"/.test(src));
  const writeAt = src.indexOf("transcribedAt: new Date()");
  const scoreAt = src.indexOf("await score(attempt.id");
  ok("the transcript is written BEFORE the scorer runs", writeAt > 0 && scoreAt > writeAt);
  ok("a scorer that throws cannot fail the transcription", /score\(attempt\.id, \{ client \}\)\.catch\(/.test(src));
  ok("the scorer is injectable so a check can transcribe without it", /score = scoreAttempt/.test(src));
  const webhook = decomment(read("app/api/rep-dial/recording/route.js"));
  ok("the webhook still runs transcription (and so scoring) inside after()", /after\(async \(\) => \{[\s\S]*transcribeAttempt\(id\)/.test(webhook));
  const qaSrc = decomment(read("lib/sales/calls/qa.js"));
  ok("qa.js talks to the model only through lib/ai/provider.js complete()", /from "@\/lib\/ai\/provider"/.test(qaSrc) && !/new OpenAI/.test(qaSrc));
  ok("…and meters through platformAi.js, never a tenant's quota", /checkPlatformAiBudget/.test(qaSrc) && /recordPlatformAiUsage/.test(qaSrc) && !/checkAiQuota/.test(qaSrc));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Rollups — three numbers, the human pass, test dials, the trend");
// ═══════════════════════════════════════════════════════════════════════════
{
  const at = (d) => new Date(`2026-09-${String(d).padStart(2, "0")}T12:00:00Z`);
  const qa = (overall, over = {}) => ({ overall, reviewerOverall: null, reviewedAt: null, skippedReason: null, deterministic: { disclosure: { said: true }, bannedMoves: [], talk: { ratio: 0.5 } }, scores: { permissionAsk: { asked: true }, bannedMoves: [] }, ...over });
  const attempts = [
    { id: "1", salesRepId: "r1", dialledAt: at(10), recordingUrl: "u", qa: qa(80) },
    { id: "2", salesRepId: "r1", dialledAt: at(11), recordingUrl: "u", qa: qa(60, { reviewerOverall: 20, reviewedAt: at(12) }) },
    { id: "3", salesRepId: "r1", dialledAt: at(12), recordingUrl: "u", qa: { overall: null, skippedReason: "no_conversation", deterministic: {} } },
    { id: "4", salesRepId: "r1", dialledAt: at(13), recordingUrl: "u", qa: { overall: null, skippedReason: "ai_failed:ai_unavailable", deterministic: {} } },
    { id: "5", salesRepId: "r1", dialledAt: at(14), recordingUrl: "u", qa: null },
    { id: "6", salesRepId: "r1", dialledAt: at(14), recordingUrl: null, qa: null }, // handset: not recorded
    { id: "7", salesRepId: "r1", dialledAt: at(15), recordingUrl: "u", jurisdictionCode: "test", qa: qa(0) }, // a test dial
    { id: "8", salesRepId: "r2", dialledAt: at(3), recordingUrl: "u", qa: qa(40) }, // previous period
    { id: "9", salesRepId: "r2", dialledAt: at(12), recordingUrl: "u", qa: qa(70, { deterministic: { disclosure: { said: false }, bannedMoves: [{ move: "apology" }], talk: { ratio: 0.8 } } }) },
  ];
  const s = qualitySummary(attempts.filter((a) => a.salesRepId === "r1" && a.jurisdictionCode !== "test"));
  ok("recorded counts only calls with a recording (5, not the handset dial)", s.recorded === 5, s);
  ok("scored / notYetScored / unscorable / failed are four separate numbers (2 / 1 / 1 / 1)", s.scored === 2 && s.notYetScored === 1 && s.unscorable === 1 && s.failed === 1, s);
  ok("the human pass overrides the model in the average ((80 + 20) / 2 = 50, not 70)", s.averageOverall === 50, s.averageOverall);
  ok("reviewed is counted", s.reviewed === 1);
  ok("effectiveOverall prefers the reviewer's number", effectiveOverall({ overall: 60, reviewerOverall: 20 }) === 20 && effectiveOverall({ overall: 60 }) === 60 && effectiveOverall({ overall: null, skippedReason: "x" }) === null && effectiveOverall(null) === null);
  ok("component rates travel as rate() envelopes under the floor (2 of 2, no percentage)", s.disclosureSaid.value === null && s.disclosureSaid.hit === 2 && s.disclosureSaid.sampleSize === 2, s.disclosureSaid);

  const reps = [
    { id: "r1", name: "Ann", active: true, engagement: "agency", manager: { id: "ag", kind: "agency", name: "Northline" } },
    { id: "r2", name: "Bo", active: true },
  ];
  const q = buildCallQuality({ reps, attempts, from: at(8), to: at(16) });
  const r1 = q.reps.find((r) => r.id === "r1");
  ok("the test-line dial is excluded from the rep's counts (recorded 5, not 6)", r1.recorded === 5 && r1.scored === 2, r1);
  const r2 = q.reps.find((r) => r.id === "r2");
  ok("the previous period's call is not in this period's numbers (r2: 1 scored)", r2.scored === 1 && r2.averageOverall === 70);
  ok("the trend is this period's average minus the previous period's (70 − 40 = +30)", r2.trend === 30 && r2.previousAverageOverall === 40, r2);
  ok("a rep with no previous period has a null trend, not zero", r1.trend === null && r1.previousAverageOverall === null);
  ok("the agency row is one summary over its employees' calls", q.agencies.length === 1 && q.agencies[0].id === "ag" && q.agencies[0].recorded === 5 && q.agencies[0].reps === 1, q.agencies);
  ok("the floor total is over everyone in the period", q.total.recorded === 6 && q.total.scored === 3);
  ok("r2's banned move and missing disclosure show in the rates", r2.bannedMoveRate.hit === 1 && r2.disclosureSaid.hit === 0);
  const p = previousPeriod(at(8), at(16));
  ok("previousPeriod is the same span, ending just before this one starts", p.to.getTime() === at(8).getTime() - 1 && p.from.getTime() === at(8).getTime() - (at(16) - at(8)) - 1);
  ok("previousPeriod on garbage is null, not a throw", previousPeriod(null, null).from === null && previousPeriod("x", "y").from === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The performance report: one scope, every input");
// ═══════════════════════════════════════════════════════════════════════════
{
  const at = (d) => new Date(`2026-09-${String(d).padStart(2, "0")}T12:00:00Z`);
  const reps = [
    { id: "a", name: "A", code: "a", active: true, commissionPlanId: "p" },
    { id: "b", name: "B", code: "b", active: true, commissionPlanId: "p" },
    { id: "c", name: "C", code: "c", active: true, commissionPlanId: "p" },
  ];
  const attempts = ["a", "b", "c"].flatMap((id) => [
    { id: `${id}1`, salesRepId: id, direction: "out", dialChannel: "browser", dialledAt: at(10), answeredAt: at(10), talkSeconds: 120, disposition: "reached_interested", toE164: "+15550001", recordingUrl: "u", qa: { overall: 50 } },
    { id: `${id}2`, salesRepId: id, direction: "out", dialChannel: "handset", dialledAt: at(11), toE164: "+15550002", callbackAt: at(20) },
  ]);
  const inputs = {
    reps,
    attributions: reps.map((r) => ({ salesRepId: r.id, companyId: `co_${r.id}`, capturedAt: at(9) })),
    entries: reps.map((r) => ({ salesRepId: r.id, companyId: `co_${r.id}`, milestone: "activation", amountCents: 1000, payoutBatchId: null })),
    batches: [],
    leads: reps.map((r) => ({ salesRepId: r.id, status: "signed", convertedCompanyId: `co_${r.id}` })),
    companies: reps.map((r) => ({ id: `co_${r.id}`, stripeChargesEnabled: true })),
    attempts,
    from: at(1),
    to: at(30),
    now: at(15),
  };
  const everyone = buildPerformanceReport({ ...inputs, repIds: null });
  ok("null scope is everyone (3 reps)", everyone.reps.length === 3 && everyone.calls.reps.length === 3 && everyone.callQuality.reps.length === 3 && everyone.scope.repIds === null);
  const team = buildPerformanceReport({ ...inputs, repIds: ["a", "b"] });
  ok("a team scope narrows the rep table", team.reps.length === 2 && !team.reps.some((r) => r.id === "c"));
  ok("…the call figures", team.calls.reps.length === 2 && team.calls.total.dials === 4 && everyone.calls.total.dials === 6, team.calls.total.dials);
  ok("…the quality section", team.callQuality.reps.length === 2 && team.callQuality.total.recorded === 2);
  ok("…the headline and the funnel", team.headline.signupsTotal === 2 && team.funnel.stages[0].count === 2 && team.headline.owedCents === 2000);
  ok("…and the lead pipeline", team.pipeline.total === 2);
  ok("buildSalesPerformance itself takes the scope, so there is one builder", buildSalesPerformance({ ...inputs, repIds: ["c"] }).reps.length === 1 && buildSalesPerformance({ ...inputs, repIds: ["c"] }).scope.repIds[0] === "c");
  ok("an empty scope is nobody, never everyone", buildPerformanceReport({ ...inputs, repIds: [] }).reps.length === 0);
  const calls = buildCallActivity({ reps, attempts, from: at(1), to: at(30), now: at(15) });
  ok("call activity carries connectFigures() — the store's connected count, never one of its own (1 of 1 bridged per rep)", calls.reps[0].stats.connect.connected === 1 && calls.reps[0].stats.connect.measured === 1 && calls.reps[0].stats.dials === 2, calls.reps[0].stats.connect);
  ok("…with the carrier's answer rate as an envelope, under the floor", calls.reps[0].stats.connect.answerRate.value === null && calls.reps[0].stats.connect.answerRate.sampleSize === 1);
  ok("reporting.js's measuredDurations grew no second connected count", !/carrierAnswerRate/.test(decomment(read("lib/sales/calls/reporting.js"))));
  ok("…callbacks promised counted", calls.reps[0].stats.callbacks.booked === 1);
  ok("…and the calls' own not-tracked list travels with the section", Array.isArray(calls.notTracked) && calls.notTracked.some((n) => n.key === "handsetDurations"));
  ok("performance.js's NOT_TRACKED no longer refuses calls", !NOT_TRACKED.some((n) => n.key === "callsAndTalkTime"));
  ok("lib/sales/performance.js still imports no database", ["lib/sales/performance.js", "lib/sales/callQuality.js", "lib/sales/performanceReport.js"].every((f) => !/@\/lib\/db/.test(decomment(read(f)))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The queue, the detail, the review — and the agency's scope, read fresh");
// ═══════════════════════════════════════════════════════════════════════════
{
  resetDbStub();
  const AG = { id: "ag", kind: "agency", name: "Northline Contact", engagement: null, managerId: null, active: true };
  const emp = (id, name) => ({ id, kind: "rep", name, engagement: "agency", managerId: "ag", manager: { id: "ag", kind: "agency", name: "Northline Contact" }, active: true, language: "es" });
  rows.salesRep.push(AG, emp("e1", "Ann"), emp("e2", "Bo"), { id: "s1", kind: "rep", name: "Stranger", engagement: "freelancer", managerId: null, active: true });
  const at = (d) => new Date(`2026-09-${String(d).padStart(2, "0")}T12:00:00Z`);
  const mk = (id, repId, over = {}) => ({
    id,
    salesRepId: repId,
    salesRep: rows.salesRep.find((r) => r.id === repId),
    prospect: { id: `p_${id}`, businessName: `Biz ${id}`, city: "Ottawa", province: "ON" },
    dialledAt: at(10),
    answeredAt: at(10),
    talkSeconds: 100,
    recordingUrl: "u",
    recordingSeconds: 100,
    transcribedAt: at(10),
    transcript: GOOD,
    jurisdictionCode: "CA-ON",
    qa: null,
    ...over,
  });
  const qaRow = (attemptId, overall, over = {}) => ({ id: `qa_${attemptId}`, attemptId, overall, reviewerOverall: null, reviewedAt: null, skippedReason: null, deterministic: analyseTranscript(BANNED, { repName: "Ann" }), scores: { permissionAsk: { asked: true, evidence: "Can I give you thirty seconds on why I called?" }, bannedMoves: [] }, coaching: ["Uno.", "Dos.", "Tres."], language: "es", ...over });
  rows.salesCallAttempt.push(
    mk("c1", "e1", { qa: qaRow("c1", 35) }),
    mk("c2", "e1", { qa: qaRow("c2", 90, { reviewerOverall: 88, reviewedAt: at(11), reviewerName: "FieldQuo" }) }),
    mk("c3", "e2", { qa: qaRow("c3", 60) }),
    mk("c4", "e2"),
    mk("c5", "s1", { qa: qaRow("c5", 5) }),
    mk("c6", "e1", { jurisdictionCode: "test", qa: qaRow("c6", 1) }),
  );
  rows.salesCallQa.push(...rows.salesCallAttempt.filter((a) => a.qa).map((a) => a.qa));

  const all = await callQaQueue({ repIds: null });
  ok("the platform's queue (null scope) sees every recorded call that is not a test dial (5)", all.length === 5 && !all.some((r) => r.id === "c6"), all.map((r) => r.id));
  ok("…lowest-scored unreviewed first, then unscored, reviewed last", all.map((r) => r.id).join(",") === "c5,c1,c3,c4,c2", all.map((r) => `${r.id}:${r.effectiveOverall}:${r.state}`));
  ok("the queue row states are named", all.find((r) => r.id === "c4").state === "awaiting_score" && all.find((r) => r.id === "c2").state === "scored");
  ok("a reviewed row shows the reviewer's number as effective and the model's beside it", (() => { const r = all.find((x) => x.id === "c2"); return r.effectiveOverall === 88 && r.overall === 90 && r.reviewerName === "FieldQuo"; })());
  ok("banned moves are counted on the row", all.find((r) => r.id === "c1").bannedMoves === 2);

  // The agency: scope read fresh through agencyTeamIds.
  const teamIds = await agencyTeamIds(AG.id);
  const scope = visibleRepIds(repViewer(AG.id, teamIds));
  ok("the agency's fresh team is e1 and e2 (plus itself)", teamIds.length === 2 && scope.includes("ag") && scope.includes("e1") && scope.includes("e2") && !scope.includes("s1"));
  const mine = await callQaQueue({ repIds: scope });
  ok("the agency's queue holds its employees' calls and not the stranger's", mine.length === 4 && !mine.some((r) => r.id === "c5"), mine.map((r) => r.id));
  ok("a repId filter off the team returns nothing rather than leaking", (await callQaQueue({ repIds: scope, repId: "s1" })).length === 0);
  ok("the stranger's call is null for the agency, not a 403-shaped object", (await callQaDetail({ attemptId: "c5", repIds: scope })) === null);
  const detail = await callQaDetail({ attemptId: "c1", repIds: scope });
  ok("an employee's call opens with the flagged transcript and the scorecard", detail && detail.transcript.length === GOOD.length && detail.qa.overall === 35 && detail.transcript[0].disclosure === true);
  ok("the flagged lines carry the banned moves by index", flagTranscript(BANNED, detail.qa)[10].bannedMoves.includes("foreclosing exit line") && flagTranscript(BANNED, detail.qa)[10].bannedMoves.includes("apology"));
  ok("…and the model's quoted evidence marks the line it came from", flagTranscript(GOOD, detail.qa)[0].cited.includes("permissionAsk"));
  ok("hearing: the agency may play an employee's recording", (await agencyCanHear({ attemptId: "c1", teamRepIds: scope })).ok === true);
  ok("hearing: not the stranger's, not a test dial, not with an empty team", (await agencyCanHear({ attemptId: "c5", teamRepIds: scope })).ok === false && (await agencyCanHear({ attemptId: "c6", teamRepIds: scope })).ok === false && (await agencyCanHear({ attemptId: "c1", teamRepIds: [] })).ok === false);

  // The human pass, by the agency.
  writes.length = 0;
  const rv = await reviewCallQa({ attemptId: "c3", reviewer: { id: AG.id, kind: "agency", name: AG.name }, body: { overall: 42, note: "  Too fast on the pivot.  " }, repIds: scope, now: at(12) });
  ok("the agency's review lands with its name and kind", rv.ok && rv.qa.reviewerOverall === 42 && rv.qa.reviewerKind === "agency" && rv.qa.reviewerName === "Northline Contact" && rv.qa.reviewerNote === "Too fast on the pivot.", rv);
  ok("…as an update of the existing row, never a second one", writes.filter((w) => w.model === "salesCallQa").length === 1 && writes[0].action === "update");
  const rvNoRow = await reviewCallQa({ attemptId: "c4", reviewer: { id: AG.id, kind: "agency", name: AG.name }, body: { overall: 30, note: "" }, repIds: scope, now: at(12) });
  ok("a review on an unscored call creates the row with the deterministic half computed", rvNoRow.ok && writes.some((w) => w.model === "salesCallQa" && w.action === "create" && w.data.skippedReason === "not_scored" && w.data.deterministic?.disclosure?.said === true), rvNoRow);
  ok("a review on the stranger's call is 404, not written", (await reviewCallQa({ attemptId: "c5", reviewer: { id: AG.id, kind: "agency", name: AG.name }, body: { overall: 1 }, repIds: scope })).status === 404);
  ok("parseReview refuses 101, -1, 3.5 and words, accepts 0 and 100, trims the note", !parseReview({ overall: 101 }).ok && !parseReview({ overall: -1 }).ok && !parseReview({ overall: 3.5 }).ok && !parseReview({ overall: "abc" }).ok && parseReview({ overall: 0 }).ok && parseReview({ overall: 100 }).ok && parseReview({ overall: 50, note: "x".repeat(5000) }).note.length === 2000);
  ok("an unknown reviewer kind is refused", (await reviewCallQa({ attemptId: "c3", reviewer: { id: "x", kind: "rep" }, body: { overall: 1 }, repIds: null })).status === 400);

  // ── A rep moved off the team between two requests ─────────────────────
  const e2 = rows.salesRep.find((r) => r.id === "e2");
  e2.managerId = null;
  e2.engagement = "freelancer";
  const teamAfter = await agencyTeamIds(AG.id);
  const scopeAfter = visibleRepIds(repViewer(AG.id, teamAfter));
  ok("after the move, a fresh agencyTeamIds no longer lists e2", teamAfter.length === 1 && !scopeAfter.includes("e2"));
  ok("…so e2's call is gone from the agency's queue", !(await callQaQueue({ repIds: scopeAfter })).some((r) => r.id === "c3"));
  ok("…null on the detail", (await callQaDetail({ attemptId: "c3", repIds: scopeAfter })) === null);
  ok("…refused for hearing", (await agencyCanHear({ attemptId: "c3", teamRepIds: scopeAfter })).ok === false);
  ok("…and a review on it is 404", (await reviewCallQa({ attemptId: "c3", reviewer: { id: AG.id, kind: "agency", name: AG.name }, body: { overall: 9 }, repIds: scopeAfter })).status === 404);
  ok("while the platform (null scope) still sees it", (await callQaDetail({ attemptId: "c3", repIds: null }))?.id === "c3");

  // The rep's own door.
  const own = await repCallQuality({ repId: "e1" });
  ok("a rep's own view lists only their scored calls (c1 and c2; not c6 the test dial)", own.length === 2 && own.every((r) => ["c1", "c2"].includes(r.id)), own.map((r) => r.id));
  ok("…with the coaching and the rubric, and no transcript or audio", own.every((r) => Array.isArray(r.coaching) && !("transcript" in r) && !("audioHref" in r) && !("recordingUrl" in r)));
  ok("…and the effective (reviewed) number where there is one", own.find((r) => r.id === "c2").overall === 88 && own.find((r) => r.id === "c2").reviewed === true);
  ok("no rep id is nobody's calls", (await repCallQuality({ repId: null })).length === 0);

  ok("orderForReview: ties on score break newest first", (() => {
    const o = orderForReview([
      { id: "x", effectiveOverall: 50, reviewedAt: null, state: "scored", dialledAt: "2026-09-01T00:00:00Z" },
      { id: "y", effectiveOverall: 50, reviewedAt: null, state: "scored", dialledAt: "2026-09-02T00:00:00Z" },
    ]);
    return o[0].id === "y";
  })());
  ok("queueRow on a bare attempt says awaiting_transcript", queueRow({ id: "z", dialledAt: at(1), qa: null }).state === "awaiting_transcript");
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The routes: who may open which door");
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const f of [
    "app/api/sales/agency/performance/route.js",
    "app/api/sales/agency/call-quality/route.js",
    "app/api/sales/agency/call-quality/[attemptId]/route.js",
    "app/api/sales/agency/recording/[id]/audio/route.js",
  ]) {
    const src = decomment(read(f));
    ok(`${f} refuses a non-agency rep`, /isAgency\(rep\)/.test(src));
    ok(`${f} reads the team fresh with agencyTeamIds and scopes with visibleRepIds`, /agencyTeamIds\(rep\.id\)/.test(src) && /visibleRepIds\(repViewer\(rep\.id, teamIds\)\)/.test(src));
    ok(`${f} never reads a rep id list from the request`, !/searchParams\.get\("repIds"\)|body\.repIds/.test(src));
  }
  const audio = decomment(read("app/api/sales/agency/recording/[id]/audio/route.js"));
  ok("the agency audio proxy answers 404 for an out-of-scope call, never 403", /status: 404/.test(audio) && !/status: 403/.test(audio));
  ok("…streams with the provider's credentials, never a public link", /twilioMediaAuth\(\)/.test(audio) && /Authorization: auth/.test(audio));
  const detail = decomment(read("app/api/sales/agency/call-quality/[attemptId]/route.js"));
  ok("the agency detail route reads the team fresh on the POST as well as the GET", (detail.match(/await agencyTeamIds\(rep\.id\)/g) || []).length === 2);
  ok("…and records the review under reviewerKind agency with the agency's name", /kind: "agency", name: rep\.name/.test(detail));
  const own = decomment(read("app/api/sales/call-quality/route.js"));
  ok("the rep's own route scopes by the session's rep id and takes no id from the query", /repId: rep\.id/.test(own) && !/searchParams/.test(own));
  for (const f of [
    "app/api/platform/sales/call-quality/route.js",
    "app/api/platform/sales/call-quality/[attemptId]/route.js",
    "app/api/platform/sales/recordings/qa/route.js",
  ]) {
    ok(`${f} is superadmin-only`, /requireSuperadmin\(request/.test(decomment(read(f))));
  }
  const perfPlatform = decomment(read("app/api/platform/sales/performance/route.js"));
  const perfAgency = decomment(read("app/api/sales/agency/performance/route.js"));
  ok("both performance routes use the one loader", /loadPerformanceReport\(\{ from, to, repIds: null \}\)/.test(perfPlatform) && /loadPerformanceReport\(\{ from, to, repIds \}\)/.test(perfAgency));
  const load = decomment(read("lib/sales/performanceLoad.js"));
  ok("the loader excludes test dials at the query and selects qa beside the call rows", /excludingTestDials\(/.test(load) && /qa: \{ select:/.test(load));
  ok("the loader scopes every table by repIds when given", (load.match(/where: scopedWhere/g) || []).length >= 4 && /where: repWhere/.test(load));
  const sidebar = read("app/components/platform/PlatformSidebar.js");
  ok("the review queue has a nav row", /href: "\/platform\/sales\/call-quality"/.test(sidebar));
  const agencyPage = read("app/sales/agency/page.js");
  ok("the agency's page links to both new screens", /href="\/sales\/agency\/performance"/.test(agencyPage) && /href="\/sales\/agency\/call-quality"/.test(agencyPage));
  ok("the rep's Today page links to their scorecards", /href="\/sales\/call-quality"/.test(read("app/sales/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Nine languages for the portal's words");
// ═══════════════════════════════════════════════════════════════════════════
{
  const used = new Set();
  for (const f of ["app/sales/agency/performance/page.js", "app/sales/agency/call-quality/page.js", "app/sales/call-quality/page.js"]) {
    for (const m of read(f).matchAll(/"(app\.sales(?:AgencyPerf|CallQa|MyCallQa)\.[A-Za-z_.]+)"/g)) used.add(m[1]);
  }
  ok("the three pages use catalogue keys", used.size > 100, used.size);
  for (const lang of Object.keys(APP_MESSAGES)) {
    const missing = [...used].filter((k) => typeof APP_MESSAGES[lang][k] !== "string" || !APP_MESSAGES[lang][k]);
    ok(`${lang}: every key the pages use exists`, missing.length === 0, missing.slice(0, 5));
  }
  ok("the prompt builder tolerates a missing playbook and an empty objection library", /NO PLAYBOOK WAS RECORDED/.test(buildQaPrompt({ playbook: null, playbookMatched: false, objections: [], transcript: transcriptForModel(GOOD), language: "en", callLanguage: "en" })));
}

console.log(`\n${failures.length ? `${failures.length} FAILED of ${pass + failures.length}` : `PASSED — ${pass} passed, 0 failed`}`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
