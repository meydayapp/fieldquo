// scripts/check-sales-playbook.mjs
//
//   npm run check:sales-playbook
//
// The playbook engine: which script a rep opens, why, and what may be said out
// of it.
//
// ══ What is EXECUTED, and what is only read ══════════════════════════════
//
// Everything that decides something runs here against hostile input: the
// selectors against three-valued rows, `selectPlaybook` against conflicting
// priorities, the talking-point gate against a claim with no evidence and a
// capability FieldQuo does not have, `generateTalkingPoints` with no model
// configured, and `shapeAssignmentRequest` against a rep trying to pick their
// own arm. Most of the real bugs in this repo were found that way.
//
// What cannot be executed — "is the superadmin gate INSIDE this handler",
// "does the delete count re-read inside the transaction" — is matched against
// source with comments stripped, and EVERY positional rule is scoped to one
// named function pulled out by brace matching. `indexOf(a) < indexOf(b)`
// false-passes when `a` is absent, and a guard string appearing anywhere else
// in the same file must not manufacture a pass. That has produced a false pass
// five times in this project.
//
// ══ The properties, in the order they cost a deal ════════════════════════
//
//   1. SELECTION IS DETERMINISTIC AND INSPECTABLE. Four rules over observed
//      rows, a trace of every playbook considered, and a tie-break that does
//      not depend on the order Postgres returned the rows in.
//   2. A gap playbook can NEVER open on a business already running a
//      competitor's platform — not even with a higher priority. Telling
//      somebody on Jobber they need online booking ends the call.
//   3. Unknown is not absent. A capability nobody looked at must not select
//      the playbook that fires on its absence.
//   4. A talking point with no chain back to evidence is IMPOSSIBLE. So is one
//      citing a capability FieldQuo does not have.
//   5. No model, no blank screen. Every AI failure path falls through to the
//      rules and produces a shorter, correct script.
//   6. A rep cannot choose their experiment arm, and the request that tries is
//      REFUSED rather than ignored.
//   7. No winner is computed anywhere.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The AI half must run with no key whatever the developer's environment says.
// Set before any module reads it — `isAiConfigured()` reads process.env at call
// time, so this is enough, and it is what makes property 5 executable rather
// than argued.
delete process.env.OPENAI_API_KEY;

import { indexProspect } from "../lib/sales/intel/opportunity.js";
import { capabilityMatrix } from "../lib/sales/intel/capabilities.js";
import { assertStrictSchema } from "../lib/ai/jsonSchema.js";

import { STAGES, STAGE_KEYS, TALKING_POINT_STAGES, orderStages } from "../lib/sales/playbook/stages.js";
import { SELECTOR_KEYS, runSelector, selectorCatalogue } from "../lib/sales/playbook/selectors.js";
import { selectPlaybook } from "../lib/sales/playbook/select.js";
import { seedPlaybooks, validatePlaybook, varsIn } from "../lib/sales/playbook/defaults.js";
import {
  MAX_POINT_LENGTH,
  assembleTalkingPoints,
  deterministicTalkingPoints,
  talkingPointContext,
  validateTalkingPoint,
} from "../lib/sales/playbook/talkingPoints.js";
import {
  MAX_GENERATED_POINTS,
  generateTalkingPoints,
  talkingPointPrompt,
  talkingPointSchema,
} from "../lib/sales/playbook/generate.js";
import {
  objectionsForProspect,
  matchObjectionText,
  seedObjections,
  validateObjection,
} from "../lib/sales/playbook/objections.js";
import {
  CHOSEN_VARIANT_KEYS,
  applyVariant,
  deriveVariant,
  shapeAssignmentRequest,
  summariseExperiment,
  validateExperiment,
} from "../lib/sales/playbook/experiments.js";
import { buildCallScript, renderLine } from "../lib/sales/playbook/script.js";
import {
  PlaybookStoreUnavailable,
  REQUIRED_MODELS,
  installDefaults,
  loadObjections,
  loadPlaybooks,
  storeState,
} from "../lib/sales/playbook/store.js";
import { playbookVersionBump, shapeObjectionInput, shapePlaybookInput } from "../lib/sales/playbook/admin.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
/**
 * Returns the verdict, and that return value is load-bearing — see the
 * check-sales-rule-admin.mjs note about `ok()` returning undefined and silently
 * skipping twenty assertions behind `if (!ok(...)) continue`.
 */
function ok(name, condition, got) {
  if (condition) {
    pass++;
    return true;
  }
  failures.push(name);
  console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);

// ── Source helpers ─────────────────────────────────────────────────────────

/** Comments stripped before any regex touches source. A guard named in a comment is not a guard. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relative) {
  return stripComments(readFileSync(join(ROOT, relative), "utf8"));
}

/** The body of ONE named function, by brace matching. See check-sales-rule-admin.mjs. */
function functionBody(src, name) {
  const start = src.search(new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`));
  if (start === -1) return null;
  const paren = src.indexOf("(", start);
  if (paren === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  if (afterParams === -1) return null;
  const open = src.indexOf("{", afterParams);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

const FILES = {
  selectors: "lib/sales/playbook/selectors.js",
  select: "lib/sales/playbook/select.js",
  talkingPoints: "lib/sales/playbook/talkingPoints.js",
  generate: "lib/sales/playbook/generate.js",
  experiments: "lib/sales/playbook/experiments.js",
  store: "lib/sales/playbook/store.js",
  assemble: "lib/sales/playbook/assemble.js",
  platformAi: "lib/sales/playbook/platformAi.js",
  routePlaybooks: "app/api/platform/sales/playbooks/route.js",
  routePlaybook: "app/api/platform/sales/playbooks/[key]/route.js",
  routeObjections: "app/api/platform/sales/playbooks/objections/route.js",
  routeObjection: "app/api/platform/sales/playbooks/objections/[code]/route.js",
  routeExperiments: "app/api/platform/sales/playbooks/experiments/route.js",
  routeExperiment: "app/api/platform/sales/playbooks/experiments/[id]/route.js",
  routeInstall: "app/api/platform/sales/playbooks/install-defaults/route.js",
  routePreview: "app/api/platform/sales/playbooks/preview/route.js",
  page: "app/platform/sales/playbooks/page.js",
  pagePreview: "app/platform/sales/playbooks/preview/page.js",
  sidebar: "app/components/platform/PlatformSidebar.js",
};

// ── Fixtures ───────────────────────────────────────────────────────────────

const cap = (code, value, evidenceIds = [`ev-${code}`]) => ({ code, value, evidenceIds, confidence: 0.9 });
const tech = (technologyCode, isCompetitor) => ({
  technologyCode,
  isCompetitor,
  evidenceIds: [`ev-${technologyCode}`],
  confidence: 0.9,
});

const PLAYBOOKS = seedPlaybooks();
const MATRIX = capabilityMatrix();

const SCENARIOS = {
  competitor: indexProspect({
    capabilities: [cap("WEBSITE", true), cap("ONLINE_BOOKING", false), cap("PHONE_CONTACT", true)],
    technologies: [tech("JOBBER", true)],
  }),
  noWebsite: indexProspect({
    capabilities: [cap("WEBSITE", false), cap("PHONE_CONTACT", true)],
    technologies: [],
  }),
  bookingGap: indexProspect({
    capabilities: [cap("WEBSITE", true), cap("ONLINE_BOOKING", false)],
    technologies: [],
  }),
  bookingUnknown: indexProspect({
    capabilities: [cap("WEBSITE", true), cap("ONLINE_BOOKING", null)],
    technologies: [],
  }),
  conflict: indexProspect({
    capabilities: [
      cap("WEBSITE", true),
      cap("ONLINE_BOOKING", false),
      cap("EMAIL_CONTACT", true),
      cap("LEAD_CAPTURE_FORM", false),
    ],
    technologies: [],
  }),
  nothing: indexProspect({ capabilities: [], technologies: [] }),
};

// ═══════════════════════════════════════════════════════════════════════════
section("Stages — nine, fixed, never padded");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("there are exactly nine stages", STAGE_KEYS.length === 9, STAGE_KEYS);
  ok(
    "the nine are the ones §22 names",
    JSON.stringify(STAGE_KEYS) ===
      JSON.stringify([
        "open",
        "relevance",
        "discovery",
        "current_process",
        "pain",
        "fit",
        "objections",
        "next_step",
        "close",
      ]),
    STAGE_KEYS,
  );
  ok(
    "talking points are confined to relevance and fit",
    JSON.stringify(TALKING_POINT_STAGES) === JSON.stringify(["relevance", "fit"]),
    TALKING_POINT_STAGES,
  );
  ok(
    "no stage other than `objections` renders the objection library",
    STAGES.filter((s) => s.usesObjections).length === 1,
  );

  // A short playbook renders short and SAYS which stage is missing. Padding it
  // with an invented line is failure class 5.
  const short = orderStages([{ stageKey: "open" }, { stageKey: "close" }]);
  ok("a two-stage playbook stays two stages", short.ordered.length === 2, short.ordered.length);
  ok("the seven absent stages are reported", short.missing.length === 7, short.missing);
  ok(
    "stages come back in call order however they were given",
    JSON.stringify(orderStages([{ stageKey: "close" }, { stageKey: "open" }]).ordered.map((s) => s.stageKey)) ===
      JSON.stringify(["open", "close"]),
  );
  ok(
    "an unknown stage key is reported, not silently dropped",
    orderStages([{ stageKey: "smalltalk" }]).unknown.length === 1,
  );
  ok(
    "a duplicated stage is reported",
    orderStages([{ stageKey: "open" }, { stageKey: "open" }]).duplicates.length === 1,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Selectors — three-valued, and null never counts as absent");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the four rules the spec names all exist", SELECTOR_KEYS.length === 4, SELECTOR_KEYS);
  for (const key of ["competitor_detected", "no_website", "website_without_booking", "email_only_quote_request"]) {
    ok(`${key} is implemented`, SELECTOR_KEYS.includes(key));
  }

  ok("no_website matches a real false", runSelector("no_website", SCENARIOS.noWebsite).matched);
  ok(
    "no_website does NOT match an unknown website",
    runSelector("no_website", SCENARIOS.nothing).matched === false,
  );
  ok(
    "an unmatched selector says whether it was unknown or genuinely false",
    runSelector("no_website", SCENARIOS.nothing).unknown === true,
  );
  ok(
    "website_without_booking does NOT match when booking was never checked",
    runSelector("website_without_booking", SCENARIOS.bookingUnknown).matched === false,
  );
  ok(
    "and reports that as not-yet-observed rather than as a genuine miss",
    runSelector("website_without_booking", SCENARIOS.bookingUnknown).unknown === true,
  );
  ok(
    "website_without_booking matches website true + booking false",
    runSelector("website_without_booking", SCENARIOS.bookingGap).matched,
  );
  ok(
    "email_only is composed from three observations",
    runSelector("email_only_quote_request", SCENARIOS.conflict).matched,
  );
  ok(
    "competitor_detected matches a competitor technology",
    runSelector("competitor_detected", SCENARIOS.competitor).matched,
  );
  ok(
    "competitor_detected does not match a non-competitor technology",
    runSelector(
      "competitor_detected",
      indexProspect({ capabilities: [], technologies: [tech("WIX", false)] }),
    ).matched === false,
  );
  ok(
    "an unknown selector key is refused, never guessed at",
    runSelector("vibes", SCENARIOS.competitor).problem === "unknown_selector",
  );
  ok(
    "every selector carries the observation evidence it read",
    runSelector("competitor_detected", SCENARIOS.competitor).observationEvidenceIds.length > 0,
  );
  ok(
    "the catalogue names only observable capability codes",
    selectorCatalogue().every((s) => Array.isArray(s.reads)),
  );

  // The selectors module must not read a value with a coercion that turns null
  // into false. Scoped to the one function that reads a capability.
  const valueOf = functionBody(read(FILES.selectors), "valueOf");
  ok("selectors read a capability through one function", Boolean(valueOf));
  ok(
    "that function never coerces — no Boolean(), no !== true",
    valueOf && !/Boolean\(/.test(valueOf) && !/!==\s*true/.test(valueOf),
    valueOf,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Selection — deterministic, inspectable, and it never pitches what they have");
// ═══════════════════════════════════════════════════════════════════════════
{
  // ── A competitor is detected ────────────────────────────────────────────
  const displaced = selectPlaybook({ playbooks: PLAYBOOKS, index: SCENARIOS.competitor });
  ok(
    "a prospect on a competitor's platform opens the displacement playbook",
    displaced.selected?.key === "COMPETITIVE_DISPLACEMENT",
    displaced.selected?.key,
  );
  const bookingRefusal = displaced.trace.find((t) => t.key === "BOOKING_GAP");
  ok(
    "the booking-gap playbook is refused for pitching what they already have",
    bookingRefusal?.refusal === "pitches_what_they_have",
    bookingRefusal?.refusal,
  );
  ok(
    "the refusal explains itself in a sentence, not a code",
    typeof bookingRefusal?.refusalText === "string" && bookingRefusal.refusalText.length > 20,
  );
  ok("the selection reports that a competitor was detected", displaced.competitorDetected === true);
  ok(
    "the trace covers every playbook, used or not",
    displaced.trace.length === PLAYBOOKS.length,
    displaced.trace.length,
  );
  ok(
    "the selected playbook carries the observations that chose it",
    (displaced.selected?.facts || []).length > 0,
  );

  // The load-bearing one: a superadmin cannot get a gap pitch onto a
  // competitor's customer by raising a priority. The guard outranks priority.
  const overridden = selectPlaybook({
    playbooks: PLAYBOOKS.map((p) => (p.key === "ONLINE_PRESENCE" ? { ...p, priority: 999 } : p)),
    index: indexProspect({
      capabilities: [cap("WEBSITE", false)],
      technologies: [tech("JOBBER", true)],
    }),
  });
  ok(
    "priority 999 on a gap playbook still cannot beat the competitor guard",
    overridden.selected?.key === "COMPETITIVE_DISPLACEMENT",
    overridden.selected?.key,
  );
  ok(
    "and the gap playbook's refusal says why",
    overridden.trace.find((t) => t.key === "ONLINE_PRESENCE")?.refusal === "pitches_what_they_have",
  );

  // ── No website ──────────────────────────────────────────────────────────
  const presence = selectPlaybook({ playbooks: PLAYBOOKS, index: SCENARIOS.noWebsite });
  ok("no website opens the online-presence playbook", presence.selected?.key === "ONLINE_PRESENCE", presence.selected?.key);

  // ── A website, no booking ───────────────────────────────────────────────
  const booking = selectPlaybook({ playbooks: PLAYBOOKS, index: SCENARIOS.bookingGap });
  ok("a website with no booking opens the booking-gap playbook", booking.selected?.key === "BOOKING_GAP", booking.selected?.key);

  // ── Never looked ────────────────────────────────────────────────────────
  const blind = selectPlaybook({ playbooks: PLAYBOOKS, index: SCENARIOS.nothing });
  ok("nothing observed selects nothing", blind.selected === null);
  ok("and says so in the honest words", blind.reason === "nothing_observed", blind.reason);
  const unknownBooking = selectPlaybook({ playbooks: PLAYBOOKS, index: SCENARIOS.bookingUnknown });
  ok(
    "a website whose booking page we could not check selects nothing",
    unknownBooking.selected === null,
    unknownBooking.selected?.key,
  );
  ok(
    "and the trace calls it not-yet-observed rather than a genuine miss",
    unknownBooking.trace.find((t) => t.key === "BOOKING_GAP")?.refusal === "not_yet_observed",
  );
  ok("no playbooks at all is its own reason", selectPlaybook({ playbooks: [], index: SCENARIOS.bookingGap }).reason === "no_playbooks");

  // ── Two rules fighting ──────────────────────────────────────────────────
  const conflict = selectPlaybook({ playbooks: PLAYBOOKS, index: SCENARIOS.conflict });
  ok(
    "two matching playbooks resolve on priority",
    conflict.selected?.key === "BOOKING_GAP",
    conflict.selected?.key,
  );
  ok(
    "the loser is recorded as lower priority, not as a miss",
    conflict.trace.find((t) => t.key === "QUOTE_AUTOMATION")?.refusal === "lower_priority",
  );
  ok("and is offered as an alternative", conflict.alternatives.some((a) => a.key === "QUOTE_AUTOMATION"));

  const tied = PLAYBOOKS.map((p) =>
    p.key === "QUOTE_AUTOMATION" ? { ...p, priority: 80 } : p,
  );
  const tieA = selectPlaybook({ playbooks: tied, index: SCENARIOS.conflict });
  const tieB = selectPlaybook({ playbooks: [...tied].reverse(), index: SCENARIOS.conflict });
  ok(
    "an exact priority tie is broken on the key",
    tieA.selected?.key === "BOOKING_GAP",
    tieA.selected?.key,
  );
  ok(
    "and the answer does not depend on the order the rows arrived in",
    tieA.selected?.key === tieB.selected?.key,
    [tieA.selected?.key, tieB.selected?.key],
  );
  ok(
    "the tie-break is named as such in the trace",
    tieA.trace.find((t) => t.key === "QUOTE_AUTOMATION")?.refusal === "tie_broken_by_key",
  );

  // ── Switched off, and a selector nobody implements ──────────────────────
  const offOnly = selectPlaybook({
    playbooks: PLAYBOOKS.map((p) => ({ ...p, active: false })),
    index: SCENARIOS.bookingGap,
  });
  ok("a switched-off playbook never opens", offOnly.selected === null);
  ok("and the reason is the refusal, not a miss", offOnly.reason === "all_refused", offOnly.reason);
  const bogus = selectPlaybook({
    playbooks: [{ key: "X", name: "x", selectorKey: "vibes", priority: 10, active: true }],
    index: SCENARIOS.bookingGap,
  });
  ok("a playbook naming an unimplemented rule is refused", bogus.trace[0]?.refusal === "unknown_selector");

  // The competitor guard must be applied before the rule, in the selector
  // loop, and must read the index rather than a parameter a caller could set.
  const body = functionBody(read(FILES.select), "selectPlaybook");
  ok("selectPlaybook is one function", Boolean(body));
  ok(
    "the competitor guard is inside it",
    body && /competitorDetected\s*&&\s*def\.needsCompetitor === false/.test(body),
  );
  ok(
    "the guard is evaluated before the selector runs",
    body && body.indexOf("pitches_what_they_have") < body.indexOf("runSelector("),
    body && [body.indexOf("pitches_what_they_have"), body.indexOf("runSelector(")],
  );
  ok(
    "competitor presence is derived from the index, never from an argument",
    body && /index\?\.competitors/.test(body) && !/args\.competitor/.test(body),
  );
  ok(
    "the sort is priority then key, in that order",
    body && /\(Number\(b\?\.priority\)[\s\S]{0,120}localeCompare/.test(body),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Playbook content — a line with a hole in it cannot be saved");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the four starter playbooks validate", PLAYBOOKS.every((p) => validatePlaybook(p).ok));
  ok("each covers all nine stages", PLAYBOOKS.every((p) => p.stages.length === 9));
  ok(
    "only the displacement playbook may say {competitor}",
    PLAYBOOKS.filter((p) => p.stages.some((s) => varsIn(s.say).includes("competitor"))).every(
      (p) => p.key === "COMPETITIVE_DISPLACEMENT",
    ),
  );

  const smuggled = {
    ...PLAYBOOKS.find((p) => p.key === "BOOKING_GAP"),
    stages: [{ stageKey: "open", say: "You're on {competitor}, right?", prompts: [] }],
  };
  ok(
    "a {competitor} line on a non-competitor playbook is refused at write time",
    validatePlaybook(smuggled).problems.includes("competitor_var_without_competitor_rule"),
    validatePlaybook(smuggled).problems,
  );

  ok(
    "a variable nothing supplies is refused",
    validatePlaybook({
      key: "X",
      name: "x",
      selectorKey: "no_website",
      stages: [{ stageKey: "open", say: "Hi {ceoName}", prompts: [] }],
    }).problems.includes("unknown_var"),
  );
  ok(
    "a stage that does not exist is refused",
    validatePlaybook({
      key: "X",
      name: "x",
      selectorKey: "no_website",
      stages: [{ stageKey: "smalltalk", say: "", prompts: [] }],
    }).problems.includes("unknown_stage"),
  );
  ok(
    "a playbook with no selector is refused",
    validatePlaybook({ key: "X", name: "x", stages: [{ stageKey: "open", say: "", prompts: [] }] }).problems.includes(
      "no_selector",
    ),
  );
  ok(
    "a playbook naming an unimplemented selector is refused",
    validatePlaybook({
      key: "X",
      name: "x",
      selectorKey: "vibes",
      stages: [{ stageKey: "open", say: "", prompts: [] }],
    }).problems.includes("unknown_selector"),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("The talking-point gate — a claim with no evidence is impossible");
// ═══════════════════════════════════════════════════════════════════════════
{
  const opportunity = {
    capabilityCode: "ONLINE_BOOKING",
    reason: "They have a site and no way to book on it.",
    evidenceIds: ["ev-1"],
    ruleCode: "WEBSITE_NO_BOOKING",
    ruleVersion: "1",
    rank: 1,
  };
  const ctx = talkingPointContext({ opportunities: [opportunity], matrix: MATRIX });

  ok(
    "a point citing a real, evidenced opportunity is accepted",
    validateTalkingPoint({ capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "A slot they can pick." }, ctx).ok,
  );

  // ── A capability FieldQuo does not have ─────────────────────────────────
  ok(
    "a point citing an invented capability is refused",
    validateTalkingPoint(
      { capabilityCode: "ROUTE_OPTIMISATION", stageKey: "fit", text: "We plan your day." },
      ctx,
    ).refusal === "unknown_opportunity",
  );
  ok(
    "a point citing a real capability with no opportunity row is refused",
    validateTalkingPoint(
      { capabilityCode: "WHITE_LABEL_DOCUMENTS", stageKey: "fit", text: "Your name on it." },
      ctx,
    ).refusal === "unknown_opportunity",
  );

  // An opportunity row can only exist for a capability in the matrix — the FK
  // says so. But a row can OUTLIVE its capability being switched off, and a
  // corrupted or hand-written row can name one that was removed. Both refused.
  const ghostCtx = talkingPointContext({
    opportunities: [{ ...opportunity, capabilityCode: "TELEPORTATION" }],
    matrix: MATRIX,
  });
  ok(
    "an opportunity naming a capability that is not in the matrix at all is refused",
    validateTalkingPoint(
      { capabilityCode: "TELEPORTATION", stageKey: "fit", text: "We beam you there." },
      ghostCtx,
    ).refusal === "unknown_capability",
  );
  const offCtx = talkingPointContext({
    opportunities: [opportunity],
    matrix: MATRIX.map((c) => (c.code === "ONLINE_BOOKING" ? { ...c, active: false } : c)),
  });
  ok(
    "a capability switched off on the matrix screen stops being said out loud",
    validateTalkingPoint({ capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "A slot." }, offCtx).refusal ===
      "inactive_capability",
  );

  // ── No evidence ─────────────────────────────────────────────────────────
  const barrenCtx = talkingPointContext({
    opportunities: [{ ...opportunity, evidenceIds: [] }],
    matrix: MATRIX,
  });
  ok(
    "a point whose opportunity cites nothing is refused",
    validateTalkingPoint({ capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "A slot." }, barrenCtx).refusal ===
      "no_evidence",
  );
  ok(
    "a point with no citation at all is refused",
    validateTalkingPoint({ stageKey: "fit", text: "You should buy this." }, ctx).refusal === "no_citation",
  );
  ok(
    "evidence ids that are not strings do not count as evidence",
    validateTalkingPoint(
      { capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "A slot." },
      talkingPointContext({ opportunities: [{ ...opportunity, evidenceIds: [null, 0, ""] }], matrix: MATRIX }),
    ).refusal === "no_evidence",
  );

  // ── Numbers ─────────────────────────────────────────────────────────────
  for (const text of ["It costs $149 a month.", "Cuts admin by 30%.", "Answers in 3 rings.", "Half the price."]) {
    ok(
      `a model-written figure is refused: ${JSON.stringify(text)}`,
      validateTalkingPoint({ capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text, source: "ai" }, ctx).refusal ===
        "numeric_claim",
    );
  }
  ok(
    "the same sentence from a superadmin's rule template is allowed",
    validateTalkingPoint(
      { capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "It costs $149 a month.", source: "rule" },
      ctx,
    ).ok,
  );
  ok(
    "'cost' as a verb is not treated as a figure",
    validateTalkingPoint(
      { capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "Missed calls cost them work.", source: "ai" },
      ctx,
    ).ok,
  );

  // ── Shape ───────────────────────────────────────────────────────────────
  ok(
    "an empty point is refused",
    validateTalkingPoint({ capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "   " }, ctx).refusal === "empty",
  );
  ok(
    "a point longer than a breath is refused",
    validateTalkingPoint(
      { capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "a".repeat(MAX_POINT_LENGTH + 1) },
      ctx,
    ).refusal === "too_long",
  );
  ok(
    "a point aimed at a stage that carries none is refused",
    validateTalkingPoint({ capabilityCode: "ONLINE_BOOKING", stageKey: "open", text: "Hello." }, ctx).refusal ===
      "unknown_stage",
  );

  const { accepted, refused } = assembleTalkingPoints(
    [
      { capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "A slot they can pick." },
      { capabilityCode: "ONLINE_BOOKING", stageKey: "fit", text: "Another go at the same thing." },
      { capabilityCode: "NONSENSE", stageKey: "fit", text: "Invented." },
    ],
    ctx,
  );
  ok("one point per opportunity", accepted.length === 1, accepted.length);
  ok("the second is refused as a duplicate", refused.some((r) => r.refusal === "duplicate"));
  ok("the invented one is refused too", refused.some((r) => r.refusal === "unknown_opportunity"));
  ok("an accepted point carries its evidence chain", accepted[0].evidenceIds.length === 1);
  ok("and the rule that produced it", accepted[0].ruleCode === "WEBSITE_NO_BOOKING");

  // The gate must not be bypassable by the deterministic path.
  const deterministic = deterministicTalkingPoints(barrenCtx);
  ok(
    "the rules-only path goes through the same gate",
    deterministic.accepted.length === 0 && deterministic.refused[0]?.refusal === "no_evidence",
  );
  const good = deterministicTalkingPoints(ctx);
  ok("and produces the rule's own sentence when the chain holds", good.accepted[0]?.text === opportunity.reason);
  ok("marked as a rule sentence rather than a model's", good.accepted[0]?.source === "rule");

  // Scoped source rules: the gate is one function and every refusal is inside
  // it. A validator that returned `{ok:true}` on an unknown path would pass
  // every case above and fail here.
  const gate = functionBody(read(FILES.talkingPoints), "validateTalkingPoint");
  ok("the gate is one named function", Boolean(gate));
  for (const refusal of ["no_citation", "unknown_opportunity", "unknown_capability", "inactive_capability", "no_evidence"]) {
    ok(`${refusal} is refused inside the gate itself`, gate && gate.includes(`refuse("${refusal}")`));
  }
  ok(
    "the evidence check is a length comparison, not a truthiness test",
    gate && /evidenceIds\.length === 0/.test(gate),
  );
  ok(
    "the capability's active flag is compared to true, not merely truthy",
    gate && /cap\.active !== true/.test(gate),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("The AI half — the model writes sentences and cannot cite anything else");
// ═══════════════════════════════════════════════════════════════════════════
{
  const schema = talkingPointSchema(["ONLINE_BOOKING", "WEBSITE"]);
  const lint = assertStrictSchema(schema);
  ok("the schema is one the vendor accepts", lint.ok, lint.errors);

  const enumCodes = schema.properties.points.items.properties.capabilityCode.enum;
  ok(
    "the citation field is a CLOSED enum of this prospect's opportunities",
    JSON.stringify(enumCodes) === JSON.stringify(["ONLINE_BOOKING", "WEBSITE"]),
    enumCodes,
  );
  ok(
    "it is not a free string",
    !("pattern" in schema.properties.points.items.properties.capabilityCode),
  );
  ok(
    "the stage field is a closed enum too",
    JSON.stringify(schema.properties.points.items.properties.stageKey.enum) ===
      JSON.stringify(TALKING_POINT_STAGES),
  );

  // Not one numeric field, at any depth. A number-typed field is a claim that a
  // model's guess is good enough to show as a fact — lib/ai/jsonSchema.js's own
  // closing section.
  let numeric = 0;
  (function walk(node) {
    if (!node || typeof node !== "object") return;
    const types = [].concat(node.type || []);
    if (types.includes("number") || types.includes("integer")) numeric += 1;
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") walk(v);
    }
  })(schema);
  ok("there is no numeric field anywhere in the schema", numeric === 0, numeric);

  const prompt = talkingPointPrompt({
    prospect: { businessName: "Eco Painting Plus", city: "Ottawa" },
    playbook: { name: "Booking gap", selectorKey: "website_without_booking" },
    ctx: talkingPointContext({
      opportunities: [{ capabilityCode: "ONLINE_BOOKING", reason: "No way to book.", evidenceIds: ["e"], rank: 1 }],
      matrix: MATRIX,
    }),
  });
  ok("the prompt names the business", prompt.includes("Eco Painting Plus"));
  ok("the prompt hands over the opportunity codes", prompt.includes("ONLINE_BOOKING"));
  ok("the prompt does not leak a phone number field", !/phoneE164/.test(prompt));

  const gen = functionBody(read(FILES.generate), "generateTalkingPoints");
  ok("generation is one function", Boolean(gen));
  ok("it passes a schema to complete()", gen && /schema: talkingPointSchema\(ctx\.citableCodes\)/.test(gen));
  ok(
    "it does not hand-parse the reply",
    gen && !/JSON\.parse/.test(gen) && !/stripJsonFence/.test(gen),
  );
  ok(
    "it does not spend the writing model on a volume pipeline",
    gen && !/quality:\s*"writing"/.test(gen),
  );
  ok(
    "every returned point is marked as AI before it reaches the gate",
    gen && /source: "ai"/.test(gen),
  );
  ok(
    "usage is metered before the reply is judged",
    gen && gen.indexOf("recordPlatformAiUsage") < gen.indexOf("if (!result?.ok)"),
  );
  ok("the budget is checked before the call", gen && gen.indexOf("checkPlatformAiBudget") < gen.indexOf("await complete("));
  ok(
    "an empty citable list never reaches the model",
    gen && gen.indexOf("citableCodes?.length") < gen.indexOf("await complete("),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("No model — the script renders anyway, plainer");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the key really is unset for this run", !process.env.OPENAI_API_KEY);

  const ctx = talkingPointContext({
    opportunities: [
      { capabilityCode: "ONLINE_BOOKING", reason: "No way to book on their site.", evidenceIds: ["e1"], rank: 1 },
      { capabilityCode: "WEBSITE", reason: "No website at all.", evidenceIds: ["e2"], rank: 2 },
    ],
    matrix: MATRIX,
  });

  const result = await generateTalkingPoints({
    prospect: { id: "p1", businessName: "Eco Painting Plus" },
    playbook: PLAYBOOKS.find((p) => p.key === "BOOKING_GAP"),
    ctx,
  });

  ok("it does not throw with no model configured", Boolean(result));
  ok("it degrades rather than failing", result.degraded === true);
  ok("and names the reason", result.reason === "unconfigured", result.reason);
  ok("the reason is a sentence a person can read", typeof result.reasonText === "string" && result.reasonText.length > 20);
  ok("there are still points to say", result.points.length > 0, result.points.length);
  ok("they are the rules' own sentences", result.points.every((p) => p.source === "rule"));
  ok("every one still cites evidence", result.points.every((p) => p.evidenceIds.length > 0));
  ok("no model is claimed", result.model === null);

  const empty = await generateTalkingPoints({
    prospect: { id: "p2", businessName: "Nobody" },
    ctx: talkingPointContext({ opportunities: [], matrix: MATRIX }),
  });
  ok("a prospect with no opportunities produces no points", empty.points.length === 0);
  ok("and says there is nothing to say rather than inventing", empty.reason === "nothing_to_say", empty.reason);

  ok(
    "at most three points, so a rep can hold them",
    (await generateTalkingPoints({ prospect: {}, ctx })).points.length <= MAX_GENERATED_POINTS,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Objections — configurable, never generated, never hidden");
// ═══════════════════════════════════════════════════════════════════════════
{
  const OBJECTIONS = seedObjections();
  ok("the starter library validates", OBJECTIONS.every((o) => validateObjection(o).ok));
  ok("there is an answer to the competitor objection", OBJECTIONS.some((o) => o.code === "ALREADY_USE_COMPETITOR"));
  ok("and to 'too expensive'", OBJECTIONS.some((o) => o.code === "TOO_EXPENSIVE"));

  const forCompetitor = objectionsForProspect({ objections: OBJECTIONS, index: SCENARIOS.competitor });
  const forBlank = objectionsForProspect({ objections: OBJECTIONS, index: SCENARIOS.nothing });
  ok("every objection is shown whatever we know", forCompetitor.length === OBJECTIONS.length);
  ok("including when we know nothing at all", forBlank.length === OBJECTIONS.length);

  const competitorRow = forCompetitor.find((o) => o.code === "ALREADY_USE_COMPETITOR");
  ok("a matched context attaches this prospect's observations", Boolean(competitorRow.context));
  ok("with the evidence behind them", competitorRow.context.evidenceIds.length > 0);
  ok(
    "the same row with nothing observed is still shown, with no context",
    forBlank.find((o) => o.code === "ALREADY_USE_COMPETITOR").context === null,
  );
  ok(
    "an objection with no context rule is never given one",
    forCompetitor.find((o) => o.code === "TOO_EXPENSIVE").context === null,
  );

  ok(
    "cues match what a prospect actually says",
    matchObjectionText("well we already use jobber for that", OBJECTIONS).some(
      (o) => o.code === "ALREADY_USE_COMPETITOR",
    ),
  );
  ok("two objections in one sentence both match", matchObjectionText("we already use jobber and it's expensive", OBJECTIONS).length >= 2);
  ok("an empty utterance matches nothing", matchObjectionText("", OBJECTIONS).length === 0);
  ok(
    "a blank cue cannot match everything",
    validateObjection({ code: "X", label: "x", response: "y", cues: ["  "] }).problems.includes("empty_cue"),
  );
  ok(
    "an objection naming an unimplemented context rule is refused",
    validateObjection({ code: "X", label: "x", response: "y", contextSelectorKey: "vibes" }).problems.includes(
      "unknown_selector",
    ),
  );
  ok(
    "an objection with no response is refused",
    validateObjection({ code: "X", label: "x", response: "" }).problems.includes("no_response"),
  );

  // Nothing in the objection path may reach a model.
  const src = read("lib/sales/playbook/objections.js");
  ok("the objection module never calls a model", !/complete\(|runToolLoop\(|openai/i.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Experiments — a rep cannot choose their arm, and nobody declares a winner");
// ═══════════════════════════════════════════════════════════════════════════
{
  const experiment = {
    id: "exp1",
    key: "OPENER_2026Q4",
    name: "Opener",
    hypothesis: "A shorter opener gets past the first ten seconds more often.",
    playbookKey: "BOOKING_GAP",
    variants: [
      { key: "a", label: "Control", weight: 50, stages: [] },
      { key: "b", label: "Short", weight: 50, stages: [{ stageKey: "open", say: "Ninety seconds?", prompts: [] }] },
    ],
  };

  // ── The rep tries to pick ───────────────────────────────────────────────
  for (const field of CHOSEN_VARIANT_KEYS) {
    const attempt = shapeAssignmentRequest({ prospectId: "p1", [field]: "b" });
    ok(`a request naming ${field} is refused`, attempt.refusal === "rep_chose_variant", attempt);
    ok(`and ${field} is named back rather than silently dropped`, (attempt.keys || []).includes(field));
    ok(`nothing usable comes out of it`, attempt.value === undefined);
  }
  ok("a plain request is accepted", shapeAssignmentRequest({ prospectId: "p1" }).value?.prospectId === "p1");
  ok("a request with no prospect is refused", shapeAssignmentRequest({}).refusal === "no_prospect");
  ok(
    "the refusal explains why rather than just saying no",
    shapeAssignmentRequest({ prospectId: "p", variant: "b" }).error.includes("rep preference"),
  );

  // No function in the module may take a requested variant.
  const expSrc = read(FILES.experiments);
  ok(
    "no function signature accepts a requested variant",
    !/requestedVariant|chosenVariant|forceVariant\s*[,)=]/.test(
      expSrc.replace(/CHOSEN_VARIANT_KEYS[\s\S]*?\]\);/, ""),
    ),
  );

  // ── Deterministic, reproducible, and spread ─────────────────────────────
  const first = deriveVariant(experiment, "prospect-123");
  ok("a derivation produces an arm", Boolean(first.variantKey));
  ok(
    "the same prospect always lands in the same arm",
    [0, 1, 2, 3, 4].every(() => deriveVariant(experiment, "prospect-123").variantKey === first.variantKey),
  );
  ok(
    "a different experiment can put the same prospect elsewhere",
    typeof deriveVariant({ ...experiment, key: "OTHER" }, "prospect-123").variantKey === "string",
  );

  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 2000; i++) counts[deriveVariant(experiment, `p-${i}`).variantKey] += 1;
  ok("both arms get filled at 50/50", counts.a > 800 && counts.b > 800, counts);

  const oneSided = deriveVariant(
    { ...experiment, variants: [{ key: "a", weight: 1 }, { key: "b", weight: 0 }] },
    "anyone",
  );
  ok("a zero weight closes an arm", oneSided.variantKey === "a", oneSided);
  ok(
    "all-zero weights refuse rather than picking one",
    deriveVariant({ ...experiment, variants: [{ key: "a", weight: 0 }, { key: "b", weight: 0 }] }, "x").refusal ===
      "weights_all_zero",
  );
  ok("no prospect, no assignment", deriveVariant(experiment, "").refusal === "no_prospect");
  ok("no variants, no assignment", deriveVariant({ ...experiment, variants: [] }, "p").refusal === "no_variants");

  // ── Validation ──────────────────────────────────────────────────────────
  ok("the fixture validates", validateExperiment(experiment, { stageKeys: STAGE_KEYS }).ok);
  ok(
    "an experiment with no hypothesis is refused",
    validateExperiment({ ...experiment, hypothesis: "" }, { stageKeys: STAGE_KEYS }).problems.includes("no_hypothesis"),
  );
  ok(
    "one variant is not an experiment",
    validateExperiment({ ...experiment, variants: [{ key: "a", weight: 1 }] }, { stageKeys: STAGE_KEYS }).problems.includes(
      "too_few_variants",
    ),
  );
  ok(
    "two variants with one key are refused",
    validateExperiment(
      { ...experiment, variants: [{ key: "a", weight: 1 }, { key: "a", weight: 1 }] },
      { stageKeys: STAGE_KEYS },
    ).problems.includes("duplicate_variant_key"),
  );
  ok(
    "a variant overriding a stage that does not exist is refused",
    validateExperiment(
      {
        ...experiment,
        variants: [
          { key: "a", weight: 1, stages: [] },
          { key: "b", weight: 1, stages: [{ stageKey: "smalltalk" }] },
        ],
      },
      { stageKeys: STAGE_KEYS },
    ).problems.includes("unknown_stage"),
  );

  // ── An override replaces, it never adds or removes ──────────────────────
  const base = PLAYBOOKS.find((p) => p.key === "BOOKING_GAP").stages;
  const applied = applyVariant(base, experiment.variants[1]);
  ok("a variant cannot change how many stages there are", applied.length === base.length, applied.length);
  ok("the overridden stage takes the variant's words", applied.find((s) => s.stageKey === "open").say === "Ninety seconds?");
  ok("and is marked as an override", applied.find((s) => s.stageKey === "open").variantOverride === "b");
  ok(
    "a variant naming a stage the playbook does not have adds nothing",
    applyVariant(base, { key: "c", stages: [{ stageKey: "smalltalk", say: "weather" }] }).length === base.length,
  );

  // ── No verdict, anywhere ────────────────────────────────────────────────
  const summary = summariseExperiment(experiment, [
    { variantKey: "a" },
    { variantKey: "a" },
    { variantKey: "b" },
    { variantKey: "gone" },
  ]);
  ok("counts come back per arm", summary.variants.find((v) => v.key === "a").assigned === 2);
  ok("an assignment to a deleted arm is surfaced, not folded in", summary.orphanedAssignments === 1);
  ok("no winner is ever returned", summary.winner === null);
  ok("and the policy says so in words", summary.winnerPolicy.includes("No winner is declared here"));
  ok(
    "the module computes no significance test of any kind",
    !/pValue|p_value|zScore|significan|Math\.sqrt|chiSquare|confidenceInterval/i.test(expSrc),
  );
  ok("and no conversion rate", !/\* 100|\/ *total *\* /.test(expSrc));

  // The route that renders experiments must not compute one either.
  const routeSrc = read(FILES.routeExperiments);
  ok("nor does the experiments route", !/\* 100|pValue|significan/i.test(routeSrc));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Rendering — a hole in a line is shown, never spoken");
// ═══════════════════════════════════════════════════════════════════════════
{
  const playbook = PLAYBOOKS.find((p) => p.key === "COMPETITIVE_DISPLACEMENT");

  const complete = buildCallScript({
    playbook,
    prospect: { businessName: "Eco Painting Plus", city: "Ottawa" },
    index: SCENARIOS.competitor,
    rep: { name: "Daniel" },
    points: [],
    objections: [],
  });
  ok("a complete script renders nine stages", complete.stages.length === 9, complete.stages.length);
  ok("nothing is left unresolved", complete.unresolvedLines === 0, complete.unresolvedLines);
  ok(
    "no rendered line still contains a placeholder",
    complete.stages.every((s) => !s.say.text || !s.say.text.includes("{")),
  );
  ok("the competitor's name is in the relevance line", complete.stages[1].say.text.includes("JOBBER"));

  const noRep = buildCallScript({
    playbook,
    prospect: { businessName: "Eco Painting Plus" },
    index: SCENARIOS.competitor,
    rep: null,
    points: [],
    objections: [],
  });
  ok("a missing variable refuses the line rather than blanking it", noRep.unresolvedLines > 0);
  ok("the refused line reports which variable is missing", noRep.stages[0].say.missing.includes("repName"));
  ok("and carries no half-rendered text", noRep.stages[0].say.text === null);

  ok("renderLine leaves a template with no variables alone", renderLine("Plain words", {}).text === "Plain words");
  ok("and an empty template is empty, not null", renderLine("", {}).text === "");

  const short = buildCallScript({
    playbook: { ...playbook, stages: playbook.stages.filter((s) => s.stageKey !== "pain") },
    prospect: { businessName: "X" },
    index: SCENARIOS.competitor,
    rep: { name: "Daniel" },
  });
  ok("a missing stage is not padded", short.stages.length === 8, short.stages.length);
  ok("and is named", short.missingStages.includes("pain"), short.missingStages);

  const withPoints = buildCallScript({
    playbook,
    prospect: { businessName: "X" },
    index: SCENARIOS.competitor,
    rep: { name: "Daniel" },
    points: [{ stageKey: "fit", text: "Your name on the quote.", capabilityCode: "WHITE_LABEL_DOCUMENTS", evidenceIds: ["e"] }],
    objections: objectionsForProspect({ objections: seedObjections(), index: SCENARIOS.competitor }),
  });
  ok("talking points land on the fit stage", withPoints.stages.find((s) => s.stageKey === "fit").points.length === 1);
  ok("and nowhere else", withPoints.stages.filter((s) => s.points.length > 0).length === 1);
  ok(
    "objections land on the objection stage",
    withPoints.stages.find((s) => s.stageKey === "objections").objections.length > 0,
  );
  ok(
    "and nowhere else",
    withPoints.stages.filter((s) => s.objections.length > 0).length === 1,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("The store — the banner is computed, and writes refuse honestly");
// ═══════════════════════════════════════════════════════════════════════════
{
  const empty = storeState({});
  ok("an absent schema is detected", empty.ready === false);
  ok("and every missing model is named", empty.missing.length === Object.keys(REQUIRED_MODELS).length, empty.missing);
  ok("with the file that holds the definitions", empty.pendingSchemaFile.endsWith(".prisma"));

  const full = Object.fromEntries(Object.keys(REQUIRED_MODELS).map((k) => [k, {}]));
  ok("a complete client is ready", storeState(full).ready === true);
  ok(
    "one missing delegate is enough to hold everything back",
    storeState({ ...full, prospectTalkingPoint: undefined }).ready === false,
  );

  const builtIn = await loadPlaybooks({ client: {} });
  ok("reads fall back to the built-in library", builtIn.length === PLAYBOOKS.length);
  ok("and say so rather than pretending they were saved", builtIn.every((p) => p.source === "built-in"));
  ok("objections fall back too", (await loadObjections({ client: {} })).every((o) => o.source === "built-in"));

  let threw = null;
  try {
    await installDefaults({ client: {} });
  } catch (err) {
    threw = err;
  }
  ok("a write refuses loudly", threw instanceof PlaybookStoreUnavailable);
  ok("and names the missing models", threw?.missing?.length === Object.keys(REQUIRED_MODELS).length);
  ok("and points at the file to paste", threw?.message.includes("schema.pending.prisma"));

  const storeSrc = read(FILES.store);
  const state = functionBody(storeSrc, "storeState");
  ok("readiness is one function", Boolean(state));
  ok(
    "it is computed from the client, not from a constant",
    state && /client\?\.\[delegate\]/.test(state) && !/return\s*\{\s*ready:\s*(true|false)\s*[,}]/.test(state),
  );

  const install = functionBody(storeSrc, "installDefaults");
  ok(
    "installing defaults creates and never updates",
    install && /createMany/.test(install) && !/update\(|updateMany|upsert/.test(install),
  );
  ok("it filters out what already exists", install && /filter\(\(p\) => !havePlaybook\.has/.test(install));

  const assign = functionBody(storeSrc, "readOrCreateAssignment");
  ok("assignment reads the stored row first", assign && assign.indexOf("findUnique") < assign.indexOf("derive("));
  ok("and returns it untouched when it exists", assign && /if \(existing\) return \{ assignment: existing/.test(assign));
  ok(
    "there is no parameter that could carry a chosen variant",
    assign && !/variantKey\s*=|requestedVariant/.test(assign.slice(0, assign.indexOf("{", 1) + 400)),
  );
  ok("the assignment is attributed to the system", assign && /assignedBy: "system"/.test(assign));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Metering — FieldQuo's own spend, and an unpriced model is not a zero");
// ═══════════════════════════════════════════════════════════════════════════
{
  const src = read(FILES.platformAi);
  const record = functionBody(src, "recordPlatformAiUsage");
  ok("usage is recorded in one function", Boolean(record));
  ok(
    "an unpriced model stores null rather than a guess",
    record && /hasKnownPricing\(model\)[\s\S]{0,120}: null/.test(record),
  );
  ok("it never constructs its own price table", !/input:\s*\d|output:\s*\d/.test(src));
  ok("it writes to the platform ledger, not the tenant one", /platformAiUsage/.test(src) && !/db\.aiUsage/.test(src));
  ok("a retry cannot double-count", record && /upsert\(\{ where: \{ ref \}/.test(record));

  const check = functionBody(src, "checkPlatformAiBudget");
  ok("the budget check is its own function", Boolean(check));
  ok("an unreadable budget fails closed", check && /reason: "budget_unreadable"/.test(check));
  ok("having no budget at all is reported rather than hidden", check && /unbudgeted: budgets\.length === 0/.test(check));

  const stateFn = functionBody(src, "platformAiBudgetState");
  ok(
    "spend is summed from the ledger, never read off the cached column",
    stateFn && /platformAiUsage\.aggregate/.test(stateFn) && !/cachedSpentMicros/.test(stateFn),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Routes — superadmin only, store-aware, audited");
// ═══════════════════════════════════════════════════════════════════════════
{
  const WRITE_HANDLERS = [
    [FILES.routePlaybooks, "POST"],
    [FILES.routePlaybook, "PATCH"],
    [FILES.routePlaybook, "DELETE"],
    [FILES.routeObjections, "POST"],
    [FILES.routeObjection, "PATCH"],
    [FILES.routeObjection, "DELETE"],
    [FILES.routeExperiments, "POST"],
    [FILES.routeExperiment, "PATCH"],
    [FILES.routeExperiment, "DELETE"],
  ];

  for (const [file, method] of WRITE_HANDLERS) {
    const body = functionBody(read(file), method);
    if (!ok(`${file} ${method} exists`, Boolean(body))) continue;
    ok(`${file} ${method} gates on superadmin inside the handler`, /superadminOrRefusal\(request\)/.test(body));
    ok(
      `${file} ${method} refuses when the tables are absent`,
      /storeRefusal\(\)/.test(body) || /storeState\(\)/.test(body),
    );
    ok(`${file} ${method} writes an audit row`, /platformAuditLog\.create/.test(body));
    ok(`${file} ${method} audits in the same transaction as the write`, /\$transaction/.test(body));
  }

  // install-defaults is deliberately not in that list: it writes through
  // `installDefaults`, which carries the audit row inside its OWN transaction.
  // Asserting `platformAuditLog.create` in the handler would have forced the
  // audit back out of the transaction to satisfy the check — a check driving
  // the code toward the bug it exists to prevent.
  {
    const body = functionBody(read(FILES.routeInstall), "POST");
    ok("install-defaults exists", Boolean(body));
    ok("install-defaults gates on superadmin", body && /superadminOrRefusal\(request\)/.test(body));
    ok("install-defaults refuses when the tables are absent", body && /storeState\(\)/.test(body));
    ok("install-defaults attributes the write", body && /installDefaults\(\{ adminId: admin\.id \}\)/.test(body));
    ok("and writes no audit row of its own, after the fact", body && !/platformAuditLog/.test(body));
    const install = functionBody(read(FILES.store), "installDefaults");
    ok(
      "the audit row is inside installDefaults' own transaction",
      install && install.indexOf("$transaction") < install.indexOf("platformAuditLog.create"),
    );
  }

  for (const [file, method] of [
    [FILES.routePlaybooks, "GET"],
    [FILES.routeObjections, "GET"],
    [FILES.routeExperiments, "GET"],
    [FILES.routePreview, "GET"],
  ]) {
    const body = functionBody(read(file), method);
    if (!ok(`${file} ${method} exists`, Boolean(body))) continue;
    ok(`${file} ${method} gates on superadmin`, /superadminOrRefusal\(request\)/.test(body));
  }

  // The one validator, everywhere.
  ok(
    "the playbook routes use the seed's own validator",
    /validatePlaybook/.test(read(FILES.routePlaybooks)) && /validatePlaybook/.test(read(FILES.routePlaybook)),
  );
  ok(
    "the input shaper does not re-implement it",
    !/competitor_var_without_competitor_rule|unknown_var/.test(read("lib/sales/playbook/admin.js")),
  );

  // Deletion guards, re-read inside the write.
  const del = functionBody(read(FILES.routePlaybook), "DELETE");
  ok("a used playbook cannot be deleted", del && /prospectTalkingPoint\.count/.test(del));
  ok("the count is re-read inside the transaction", del && del.indexOf("$transaction") < del.indexOf("prospectTalkingPoint.count"));
  ok(
    "a playbook carrying an experiment cannot be deleted either — the cascade would take the assignments",
    del && /salesPlaybookExperiment\.count/.test(del),
  );
  const delExp = functionBody(read(FILES.routeExperiment), "DELETE");
  ok("an experiment with assignments cannot be deleted", delExp && /salesPlaybookAssignment\.count/.test(delExp));

  // The key is immutable.
  const patchPb = functionBody(read(FILES.routePlaybook), "PATCH");
  ok("a playbook key cannot be renamed", patchPb && /"key" in body/.test(patchPb));
  ok("and the version is not settable by hand", patchPb && /"version" in body/.test(patchPb));
  ok("the merged row is validated, not the patch alone", patchPb && /\{ \.\.\.existing, \.\.\.patch \}/.test(patchPb));
  ok("switching a broken playbook off is always allowed", patchPb && /deactivatingOnly/.test(patchPb));

  // An experiment freezes once it has assigned anybody.
  const patchExp = functionBody(read(FILES.routeExperiment), "PATCH");
  ok("a running experiment's arms cannot be rewritten", patchExp && /salesPlaybookAssignment\.count/.test(patchExp));
  ok("the count is re-read inside the write", patchExp && patchExp.indexOf("$transaction") < patchExp.indexOf("salesPlaybookAssignment.count"));
  ok("an experiment is created switched off", /active: false, startedAt: null/.test(read(FILES.routeExperiments)));

  // The preview never lets anybody choose an arm, and GET never spends.
  const previewGet = functionBody(read(FILES.routePreview), "GET");
  const previewPost = functionBody(read(FILES.routePreview), "POST");
  ok("opening the preview does not call a model", previewGet && /useAi: false/.test(previewGet));
  ok("generating is an explicit POST", previewPost && /useAi: true/.test(previewPost));
  ok("and refuses a body naming a variant", previewPost && /shapeAssignmentRequest\(body\)/.test(previewPost));
  ok(
    "the refusal is returned rather than the field being ignored",
    previewPost && previewPost.indexOf("shapeAssignmentRequest") < previewPost.indexOf("assembleProspectPlaybook"),
  );

  // Assembly order: the variant is fixed before anything is generated.
  const assembleSrc = functionBody(read(FILES.assemble), "assembleProspectPlaybook");
  ok("assembly is one function", Boolean(assembleSrc));
  ok(
    "the playbook is selected before the variant is assigned",
    assembleSrc && assembleSrc.indexOf("selectPlaybook(") < assembleSrc.indexOf("readOrCreateAssignment("),
  );
  ok(
    "the variant is assigned before any sentence is generated",
    assembleSrc && assembleSrc.indexOf("readOrCreateAssignment(") < assembleSrc.indexOf("generateTalkingPoints("),
  );
  ok(
    "the whole selection trace comes back to the caller",
    assembleSrc && /selection: \{ \.\.\.selection/.test(assembleSrc),
  );
  ok(
    "the index is built by the intel engine rather than re-implemented here",
    /indexProspect\(/.test(read(FILES.assemble)) && !/normaliseValue/.test(read(FILES.assemble)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Screens — mobile-first, English, and no control that cannot work");
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const [name, file] of [["playbooks", FILES.page], ["preview", FILES.pagePreview]]) {
    const src = read(file);
    ok(`${name} screen is a client component`, /"use client"/.test(readFileSync(join(ROOT, file), "utf8")));
    ok(`${name} screen uses fetchJson rather than a bare fetch`, /fetchJson/.test(src) && !/await fetch\(/.test(src));
    ok(`${name} screen has 44px touch targets`, /min-h-\[44px\]/.test(src));
    ok(`${name} screen keeps inputs at 16px so iOS does not zoom`, !/text-sm[^"]*"\s*;?\s*$/m.test(src) || /text-base/.test(src));
    // English-only by convention: zero of the 30 existing /platform pages use
    // i18n. Checked rather than assumed — /sales, the REP portal, does.
    ok(`${name} screen does not use i18n`, !/useTranslation/.test(src));
  }

  const page = read(FILES.page);
  // Was the literal `me?.role === "superadmin"` after a swallowed fetch of
  // /api/platform/me — so a failed identity call refused a real superadmin. The
  // shared hook is required instead, and the old shape asserted absent.
  ok("write controls need a superadmin", /usePlatformAdmin\(\)/.test(page));
  ok(
    "and a failed identity check is not read as a refusal",
    !/me\?\.role === "superadmin"/.test(page) &&
      !/fetchJson\("\/api\/platform\/me"\)\.catch/.test(page),
  );
  ok("and a store that exists", /const canWrite = isSuperadmin && store\.ready/.test(page));
  ok("every write control is behind that one flag", (page.match(/canWrite &&/g) || []).length >= 4);
  ok(
    "the missing-tables banner is rendered from the response, not hard-coded",
    /!store\.ready/.test(page) && /store\.missing/.test(page),
  );
  ok(
    "the screen never asserts what does or does not read the tables",
    !/nothing reads/i.test(page),
  );

  const preview = read(FILES.pagePreview);
  ok("the preview shows why a playbook was chosen", /selection\.selected/.test(preview));
  ok("and every playbook that was not", /selection\?\.trace/.test(preview));
  ok("and the evidence behind each talking point", /evidenceIds\.length/.test(preview));
  ok("the generate button posts only a prospect id", /body: \{ prospectId \}/.test(preview));

  ok("the screen is reachable from the console nav", /platform\/sales\/playbooks/.test(read(FILES.sidebar)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Input shaping — bounds, not judgement");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("a lower-case key is upper-cased", shapePlaybookInput({ key: "booking_gap", name: "x", selectorKey: "no_website", priority: 1, stages: [] }).value.key === "BOOKING_GAP");
  ok("a key with a space is refused", Boolean(shapePlaybookInput({ key: "book gap", name: "x", selectorKey: "no_website", priority: 1, stages: [] }).error));
  ok("a stage that does not exist is refused by the shaper too", Boolean(shapePlaybookInput({ key: "AAA", name: "x", selectorKey: "no_website", priority: 1, stages: [{ stageKey: "smalltalk" }] }).error));
  ok("a non-integer priority is refused", Boolean(shapePlaybookInput({ key: "AAA", name: "x", selectorKey: "no_website", priority: "high", stages: [] }).error));
  ok("prompts arrive as a trimmed list", JSON.stringify(shapePlaybookInput({ key: "AAA", name: "x", selectorKey: "no_website", priority: 1, stages: [{ stageKey: "open", say: "", prompts: ["  a  ", "", "b"] }] }).value.stages[0].prompts) === JSON.stringify(["a", "b"]));
  ok("cues can be posted as a newline block", JSON.stringify(shapeObjectionInput({ code: "AAA", label: "x", response: "y", cues: "one\n\ntwo ", priority: 1 }).value.cues) === JSON.stringify(["one", "two"]));
  ok("a partial patch leaves absent fields alone", Object.keys(shapePlaybookInput({ name: "new" }, { partial: true }).value).join() === "name");

  ok(
    "editing what a playbook decides bumps the version",
    playbookVersionBump("salesPlaybook", { version: "1", priority: 10 }, { priority: 20 }).bump === true,
  );
  ok(
    "renaming it does not",
    playbookVersionBump("salesPlaybook", { version: "1", name: "a" }, { name: "b" }).bump === false,
  );
  ok(
    "re-saving the same stages does not",
    playbookVersionBump("salesPlaybook", { version: "1", stages: [{ stageKey: "open" }] }, { stages: [{ stageKey: "open" }] })
      .bump === false,
  );
  ok(
    "an objection's cues are semantic — they decide which answer a rep finds",
    playbookVersionBump("salesObjection", { version: "1", cues: ["a"] }, { cues: ["b"] }).bump === true,
  );
  ok(
    "an unknown model throws rather than silently never bumping",
    (() => {
      try {
        playbookVersionBump("nope", {}, {});
        return false;
      } catch {
        return true;
      }
    })(),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  `\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
