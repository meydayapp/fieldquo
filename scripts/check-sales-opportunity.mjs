// scripts/check-sales-opportunity.mjs
//
//   npm run check:sales-opportunity
//
// The sales-intelligence engine, executed against the inputs that break it.
//
// ══ Why almost all of this is execution ════════════════════════════════════
//
// lib/sales/intel/{capabilities,opportunity,confidence,rules}.js are pure by
// design — they take already-loaded rows and return a decision — so the real
// shipped functions run here against hostile input with no database and no
// fixtures. AGENTS.md says most of the real bugs in this repo were found that
// way, and every property below is a sentence somebody would otherwise say to
// a contractor on a phone call:
//
//   * "You have no online booking page" — said to a business that has one,
//     because a crawler timeout was read as an absence. This is the single
//     most important assertion in the file and it has its own section.
//   * "You need online booking" — said to a business already paying Jobber for
//     it. A competitor detection has to change the strategy, not add a bullet.
//   * "You should really get a website" — said with nothing behind it, because
//     a rule matched on absences and cited no evidence at all.
//   * "We've confirmed they have eleven employees" — an inference rendered as
//     a fact because it scored well.
//
// ══ The parts that cannot be executed ══════════════════════════════════════
//
// "Is the guard still inside this function" is a source question. Those are
// matched against source with comments stripped, and EVERY positional rule is
// scoped to ONE named function pulled out by brace matching. A guard string
// appearing elsewhere in the same file must not manufacture a pass — this has
// produced a false pass twice in this repo, and section 11 is written in this
// shape because of it.
//
// Mutation-tested: each guarantee was broken in turn against a `cp` backup and
// this script was confirmed to fail. See the session report for the list.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  capabilityMatrix,
  capabilityCodes,
  citedMatrixKeys,
  displacementCapabilities,
  isDisplacementSafe,
  isExcludedCapability,
  repScript,
  EXCLUDED_CAPABILITIES,
  OBSERVABLE_CAPABILITY_CODES,
  mergeTalkingPoints,
} from "@/lib/sales/intel/capabilities";
import {
  buildOpportunities,
  evaluateCondition,
  evaluateRule,
  indexProspect,
  normaliseValue,
  renderReason,
  validateRule,
  REFUSALS,
} from "@/lib/sales/intel/opportunity";
import {
  fieldConfidence,
  identityConfidence,
  opportunityConfidence,
  presentCapability,
  presentInference,
  presentOpportunity,
  seedConfidenceRules,
  SIGNALS,
  FUZZY_CEILING,
  MATCH_THRESHOLD,
  LAYER_FACT,
  LAYER_INFERENCE,
  LAYER_RECOMMENDATION,
} from "@/lib/sales/intel/confidence";
import { seedOpportunityRules, requiredDetectors } from "@/lib/sales/intel/rules";
import { matrixEntry } from "@/lib/marketing/featureMatrix";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (title) => console.log(`\n${title}\n`);

/**
 * Strip comments so a source assertion cannot pass on a sentence explaining
 * the thing rather than the thing. String and template literals are preserved;
 * a `//` inside a URL in a string is not a comment.
 */
function codeOnly(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * The body of ONE named function, by brace matching from its declaration.
 *
 * The whole reason section 11 exists in this shape. A regex over a whole file
 * asking "does the already-has guard appear" passes when the guard has been
 * moved out of the function that needs it and left in a sibling — which is the
 * bug, not the absence of the string.
 */
function bodyOf(src, declaration) {
  const start = src.indexOf(declaration);
  if (start === -1) return null;

  // Skip the PARAMETER LIST first. Every function here destructures its
  // options — `function presentCapability(row, { rules = [] })` — so scanning
  // for the first `{` after the name returns the parameter object and every
  // assertion below then runs against four characters of signature and passes
  // or fails for no reason. Match parentheses, then take the brace after them.
  const openParen = src.indexOf("(", start);
  if (openParen === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i + 1;
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

/**
 * A sanity check on the matcher itself.
 *
 * The bug it just had — returning a destructured parameter list — made six
 * assertions fail loudly, which was lucky. The same bug on a function whose
 * parameters happen to contain the string being looked for would have made
 * them PASS, which is the false pass this whole section exists to avoid. So
 * the matcher is asserted against a known shape before anything trusts it.
 */
{
  const sample = 'export function f(a, { b = [] } = {}) {\n  return "MARKER";\n}\nfunction g() { return "OTHER"; }\n';
  const body = bodyOf(sample, "export function f");
  ok("the brace matcher returns a body and not a parameter list", /MARKER/.test(body || ""), body);
  ok("…and stops at the end of that function", !/OTHER/.test(body || ""), body);
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. The matrix is DERIVED from claims that are themselves proof-checked
   ═══════════════════════════════════════════════════════════════════════ */
section("1. The capability matrix is traceable to shipped code");

const matrix = capabilityMatrix();
ok("the matrix is not empty", matrix.length > 0, matrix.length);

ok(
  "every capability cites at least one marketing-matrix key",
  matrix.every((c) => (c.recommendedTalkingPoints.matrixKeys || []).length > 0),
  matrix.filter((c) => !c.recommendedTalkingPoints.matrixKeys.length).map((c) => c.code),
);

const badKeys = citedMatrixKeys().filter((k) => !matrixEntry(k));
ok(
  "every cited marketing-matrix key still exists (so check:feature-matrix covers it)",
  badKeys.length === 0,
  badKeys,
);

const dupes = capabilityCodes().filter((c, i, a) => a.indexOf(c) !== i);
ok("no duplicate capability codes", dupes.length === 0, dupes);

const bothWays = capabilityCodes().filter((c) => isExcludedCapability(c));
ok(
  "no capability is both sellable and explicitly excluded",
  bothWays.length === 0,
  bothWays,
);

ok("the exclusion list is populated, so absence is on the record", EXCLUDED_CAPABILITIES.length > 0);
ok(
  "every exclusion carries a reason",
  EXCLUDED_CAPABILITIES.every((e) => typeof e.reason === "string" && e.reason.length > 40),
  EXCLUDED_CAPABILITIES.filter((e) => (e.reason || "").length <= 40).map((e) => e.code),
);

// The hedge must survive the trip from a public page into a rep's mouth.
const partials = matrix.filter((c) =>
  c.recommendedTalkingPoints.matrixKeys.some((k) => matrixEntry(k)?.readiness === "partial"),
);
ok(
  "a capability built on a PARTIAL marketing claim carries that claim's limits as a caveat",
  partials.length > 0 && partials.every((c) => c.recommendedTalkingPoints.caveats.length > 0),
  partials.map((c) => [c.code, c.recommendedTalkingPoints.caveats.length]),
);

// The caveat has to reach the rep's mouth, not just the row. `points` is the
// editable half and deliberately does NOT contain it, so the composition is
// the thing worth asserting — a renderer reading `points` alone would drop the
// qualification off a partial claim.
ok(
  "repScript appends the mandatory caveats after the editable sentences",
  partials.every((c) => {
    const script = repScript(c);
    return c.recommendedTalkingPoints.caveats.every((cav) => script.includes(cav));
  }),
  partials.map((c) => [c.code, repScript(c).length, c.recommendedTalkingPoints.caveats.length]),
);
ok(
  "…and the metered-usage note too, so 'included' is never said unqualified",
  repScript(matrix.find((c) => c.code === "AI_RECEPTIONIST")).some((l) => /prepaid credit/.test(l)),
);
ok(
  "…and the editable half does not already contain them, or they would be deletable",
  partials.every((c) =>
    c.recommendedTalkingPoints.caveats.every((cav) => !c.recommendedTalkingPoints.points.includes(cav)),
  ),
);

// LIVE_CHAT: FieldQuo has none, and a prospect's chat widget is still a real
// signal. Both halves have to hold or one of the two lists is wrong.
ok("LIVE_CHAT is not sellable", !capabilityCodes().includes("LIVE_CHAT"));
ok("LIVE_CHAT is still observable about a prospect", OBSERVABLE_CAPABILITY_CODES.includes("LIVE_CHAT"));
ok("LIVE_CHAT's absence is explained", EXCLUDED_CAPABILITIES.some((e) => e.code === "LIVE_CHAT"));

ok(
  "plan tiers: every capability says which plans it is on",
  matrix.every((c) => typeof c.recommendedTalkingPoints.planNote === "string" && c.recommendedTalkingPoints.planNote),
);

// The metered-usage sentence is a claim about OUR price and must not be
// dropped: "the receptionist is included" is false about talk time.
const receptionist = matrix.find((c) => c.code === "AI_RECEPTIONIST");
ok(
  "AI_RECEPTIONIST carries the prepaid-credit note rather than claiming 'included'",
  Boolean(receptionist?.recommendedTalkingPoints.usageNote),
  receptionist?.recommendedTalkingPoints.usageNote,
);

/* ═══════════════════════════════════════════════════════════════════════════
   2. THE headline property: unknown is not absent
   ═══════════════════════════════════════════════════════════════════════ */
section("2. null is not false — the assertion this whole file exists for");

ok("normaliseValue(true) === true", normaliseValue(true) === true);
ok("normaliseValue(false) === false", normaliseValue(false) === false);
ok("normaliseValue(null) === null", normaliseValue(null) === null);
ok("normaliseValue(undefined) === null", normaliseValue(undefined) === null);
// The JSON round-trip case. Boolean("false") is true and Boolean(0) is false;
// both are wrong here and both are what a naive coercion produces.
ok('normaliseValue("false") === null — a string is not an observation', normaliseValue("false") === null);
ok('normaliseValue("true") === null', normaliseValue("true") === null);
ok("normaliseValue(0) === null", normaliseValue(0) === null);
ok("normaliseValue(1) === null", normaliseValue(1) === null);
ok('normaliseValue("") === null', normaliseValue("") === null);

const FALSE_COND = { kind: "capability", code: "ONLINE_BOOKING", is: false };

const idxKnownFalse = indexProspect({
  capabilities: [{ code: "ONLINE_BOOKING", value: false, confidence: 0.8, evidenceIds: ["ev-1"] }],
});
const idxNull = indexProspect({
  capabilities: [{ code: "ONLINE_BOOKING", value: null, confidence: 0.5, evidenceIds: ["ev-2"] }],
});
const idxMissing = indexProspect({ capabilities: [] });
const idxStringFalse = indexProspect({
  capabilities: [{ code: "ONLINE_BOOKING", value: "false", confidence: 0.9, evidenceIds: ["ev-3"] }],
});

ok("`is: false` FIRES on a genuine false", evaluateCondition(FALSE_COND, idxKnownFalse).matched === true);
ok(
  "`is: false` does NOT fire on null — the crawler could not reach the page",
  evaluateCondition(FALSE_COND, idxNull).matched === false,
);
ok(
  "`is: false` does NOT fire on a missing row",
  evaluateCondition(FALSE_COND, idxMissing).matched === false,
);
ok(
  '`is: false` does NOT fire on the string "false"',
  evaluateCondition(FALSE_COND, idxStringFalse).matched === false,
);

const TRUE_COND = { kind: "capability", code: "ONLINE_BOOKING", is: true };
ok("`is: true` does not fire on null either", evaluateCondition(TRUE_COND, idxNull).matched === false);
ok(
  "`capabilityUnknown` fires on null",
  evaluateCondition({ kind: "capabilityUnknown", code: "ONLINE_BOOKING" }, idxNull).matched === true,
);
ok(
  "`capabilityUnknown` fires on a missing row",
  evaluateCondition({ kind: "capabilityUnknown", code: "ONLINE_BOOKING" }, idxMissing).matched === true,
);
ok(
  "`capabilityUnknown` does NOT fire on a real false",
  evaluateCondition({ kind: "capabilityUnknown", code: "ONLINE_BOOKING" }, idxKnownFalse).matched === false,
);

// And the same property through the whole engine, which is where it actually
// costs money.
const rules = seedOpportunityRules();
const nullRun = buildOpportunities({
  capabilities: [
    { code: "WEBSITE", value: true, confidence: 0.9, evidenceIds: ["e-w"] },
    { code: "ONLINE_BOOKING", value: null, confidence: 0.5, evidenceIds: ["e-b"] },
    { code: "ONLINE_PAYMENT", value: null, confidence: 0.5, evidenceIds: ["e-p"] },
  ],
  rules,
});
ok(
  "end to end: a prospect whose booking and payment are UNKNOWN gets no gap recommendations",
  nullRun.opportunities.length === 0,
  nullRun.opportunities.map((o) => o.capabilityCode),
);
ok(
  "…and the run is marked incomplete rather than reported as a confident nothing",
  nullRun.incomplete === true,
);
ok(
  "…and it names what was never checked",
  nullRun.unchecked.includes("ONLINE_BOOKING") && nullRun.unchecked.includes("ONLINE_PAYMENT"),
  nullRun.unchecked,
);

const falseRun = buildOpportunities({
  capabilities: [
    { code: "WEBSITE", value: true, confidence: 0.9, evidenceIds: ["e-w"] },
    { code: "ONLINE_BOOKING", value: false, confidence: 0.8, evidenceIds: ["e-b"] },
  ],
  rules,
});
ok(
  "…and the SAME prospect with a genuine false does get the recommendation",
  falseRun.opportunities.some((o) => o.capabilityCode === "ONLINE_BOOKING"),
  falseRun.opportunities.map((o) => o.capabilityCode),
);

/* ═══════════════════════════════════════════════════════════════════════════
   3. A recommendation with no evidence is impossible
   ═══════════════════════════════════════════════════════════════════════ */
section("3. Nothing is recommended without a citation");

const noEvidenceRun = buildOpportunities({
  capabilities: [
    // A real false, and the detector recorded no evidence for it. The claim is
    // unciteable, so the recommendation may not exist.
    { code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: [] },
  ],
  rules,
});
ok(
  "a matching rule whose rows carry no evidence produces nothing",
  noEvidenceRun.opportunities.length === 0,
  noEvidenceRun.opportunities,
);
ok(
  "…and says why: no_evidence",
  noEvidenceRun.skipped.some((s) => s.ruleCode === "NO_WEBSITE" && s.refusal === "no_evidence"),
  noEvidenceRun.skipped,
);

// A rule made only of absences. It matches, and it saw nothing.
const absenceOnlyRule = {
  code: "ABSENCE_ONLY",
  capabilityCode: "WEBSITE",
  priority: 10,
  active: true,
  conditions: {
    all: [
      { kind: "capabilityUnknown", code: "ONLINE_BOOKING" },
      { kind: "competitor", present: false },
    ],
  },
  reasonTemplate: "They might not have a website.",
};
const absenceRun = buildOpportunities({ capabilities: [], rules: [absenceOnlyRule] });
ok(
  "a rule built ONLY from absences can never produce a recommendation",
  absenceRun.opportunities.length === 0 &&
    absenceRun.skipped.some((s) => s.refusal === "no_evidence"),
  absenceRun.skipped,
);

ok(
  "every opportunity the seeded rules can produce carries at least one evidence id",
  [
    buildOpportunities({
      capabilities: [
        { code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["a"] },
        { code: "ONLINE_PAYMENT", value: false, confidence: 0.6, evidenceIds: ["b"] },
        { code: "PHONE_CONTACT", value: true, confidence: 0.9, evidenceIds: ["c"] },
        { code: "LIVE_CHAT", value: false, confidence: 0.7, evidenceIds: ["d"] },
        { code: "PUBLISHED_HOURS", value: false, confidence: 0.7, evidenceIds: ["e"] },
      ],
      rules,
    }),
  ][0].opportunities.every((o) => o.evidenceIds.length > 0),
);

/* ═══════════════════════════════════════════════════════════════════════════
   4. Never recommend what they already have
   ═══════════════════════════════════════════════════════════════════════ */
section("4. Never recommend something they already have");

// A rule deliberately written wrong: it recommends ONLINE_BOOKING while
// conditioning on the prospect HAVING it. The guard, not the rule author, has
// to stop this.
const perverseRule = {
  code: "PERVERSE",
  capabilityCode: "ONLINE_BOOKING",
  priority: 50,
  active: true,
  conditions: { all: [{ kind: "capability", code: "ONLINE_BOOKING", is: true }] },
  reasonTemplate: "They should get online booking.",
};
const perverse = buildOpportunities({
  capabilities: [{ code: "ONLINE_BOOKING", value: true, confidence: 0.9, evidenceIds: ["x"] }],
  rules: [perverseRule],
});
ok(
  "a rule that recommends what the prospect demonstrably has is refused by the guard",
  perverse.opportunities.length === 0 &&
    perverse.skipped.some((s) => s.refusal === "already_has"),
  perverse.skipped,
);

// …and UNKNOWN must not trigger the already-has guard, or the fix for one bug
// becomes the other bug.
const unknownHas = evaluateRule(
  {
    code: "R",
    capabilityCode: "WEBSITE",
    priority: 1,
    active: true,
    conditions: { all: [{ kind: "capability", code: "WEBSITE", is: false }] },
    reasonTemplate: "No site.",
  },
  indexProspect({ capabilities: [{ code: "WEBSITE", value: false, confidence: 0.8, evidenceIds: ["z"] }] }),
);
ok("a false capability is not treated as 'already has'", unknownHas.refusal === null, unknownHas.refusal);

// Incompatibility: a link-in-bio page for somebody with a real website.
const bioRule = {
  code: "BIO",
  capabilityCode: "BIO_LINK",
  priority: 5,
  active: true,
  conditions: { all: [{ kind: "capability", code: "WEBSITE", is: true }] },
  reasonTemplate: "One link for their profiles.",
};
const bio = buildOpportunities({
  capabilities: [{ code: "WEBSITE", value: true, confidence: 0.9, evidenceIds: ["w"] }],
  rules: [bioRule],
});
ok(
  "an incompatible capability is refused (BIO_LINK to a business with a website)",
  bio.skipped.some((s) => s.refusal === "incompatible"),
  bio.skipped,
);

// Prerequisite: a booking deposit with nothing to take it on.
const depositRule = {
  code: "DEP",
  capabilityCode: "BOOKING_DEPOSIT",
  priority: 5,
  active: true,
  conditions: { all: [{ kind: "capability", code: "WEBSITE", is: true }] },
  reasonTemplate: "Take a deposit.",
};
const deposit = buildOpportunities({
  capabilities: [{ code: "WEBSITE", value: true, confidence: 0.9, evidenceIds: ["w"] }],
  rules: [depositRule],
});
ok(
  "a capability with an unmet prerequisite is refused (a deposit needs a booking page)",
  deposit.skipped.some((s) => s.refusal === "missing_prerequisite"),
  deposit.skipped,
);

/* ═══════════════════════════════════════════════════════════════════════════
   5. A competitor changes the strategy
   ═══════════════════════════════════════════════════════════════════════ */
section("5. A competitor detection changes the conversation");

const jobber = [{ technologyCode: "JOBBER", isCompetitor: true, confidence: 0.9, evidenceIds: ["j-1"] }];

const withCompetitor = buildOpportunities({
  capabilities: [
    // Everything a gap-filling pitch would jump on. All genuinely false.
    { code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["c-w"] },
    { code: "ONLINE_BOOKING", value: false, confidence: 0.9, evidenceIds: ["c-b"] },
    { code: "ONLINE_PAYMENT", value: false, confidence: 0.9, evidenceIds: ["c-p"] },
    { code: "LEAD_CAPTURE_FORM", value: false, confidence: 0.9, evidenceIds: ["c-l"] },
    { code: "PHONE_CONTACT", value: true, confidence: 0.9, evidenceIds: ["c-ph"] },
  ],
  technologies: jobber,
  rules,
});
const pitched = withCompetitor.opportunities.map((o) => o.capabilityCode);

ok(
  "the pitch to a business running a competitor never includes ONLINE_BOOKING",
  !pitched.includes("ONLINE_BOOKING"),
  pitched,
);
ok("…nor ONLINE_PAYMENT", !pitched.includes("ONLINE_PAYMENT"), pitched);
ok("…nor LEAD_CAPTURE_FORM", !pitched.includes("LEAD_CAPTURE_FORM"), pitched);
ok(
  "…and it is not empty — the displacement argument is made",
  pitched.length > 0,
  pitched,
);
ok(
  "every capability pitched over a competitor survives one being installed",
  pitched.every((code) => isDisplacementSafe(code, matrix)),
  pitched.filter((c) => !isDisplacementSafe(c, matrix)),
);
ok(
  "the displacement reason names the competitor it was derived from",
  withCompetitor.opportunities.some((o) => o.reason.includes("JOBBER")),
  withCompetitor.opportunities.map((o) => o.reason.slice(0, 60)),
);
ok(
  "the displacement recommendation cites the competitor sighting as evidence",
  withCompetitor.opportunities.every((o) => o.evidenceIds.includes("j-1")),
  withCompetitor.opportunities.map((o) => o.evidenceIds),
);

// The same prospect without the competitor gets an entirely different list.
const withoutCompetitor = buildOpportunities({
  capabilities: [
    { code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["c-w"] },
    { code: "ONLINE_BOOKING", value: false, confidence: 0.9, evidenceIds: ["c-b"] },
    { code: "ONLINE_PAYMENT", value: false, confidence: 0.9, evidenceIds: ["c-p"] },
    { code: "LEAD_CAPTURE_FORM", value: false, confidence: 0.9, evidenceIds: ["c-l"] },
    { code: "PHONE_CONTACT", value: true, confidence: 0.9, evidenceIds: ["c-ph"] },
  ],
  rules,
});
const plainPitch = withoutCompetitor.opportunities.map((o) => o.capabilityCode);
ok(
  "without the competitor the SAME gaps do produce the table-stakes pitch",
  plainPitch.includes("ONLINE_PAYMENT"),
  plainPitch,
);
ok(
  "so the competitor changed the strategy, it did not merely add a line",
  JSON.stringify(pitched) !== JSON.stringify(plainPitch),
  { pitched, plainPitch },
);

// An adjacent tool is not a competitor. isCompetitor is stored, not derived.
const adjacent = buildOpportunities({
  capabilities: [
    { code: "WEBSITE", value: true, confidence: 0.9, evidenceIds: ["a-w"] },
    { code: "ONLINE_BOOKING", value: false, confidence: 0.9, evidenceIds: ["a-b"] },
  ],
  technologies: [
    { technologyCode: "MAILCHIMP", isCompetitor: false, confidence: 0.8, evidenceIds: ["m"] },
  ],
  rules,
});
ok(
  "an adjacent tool does not trigger the displacement path",
  adjacent.opportunities.some((o) => o.capabilityCode === "ONLINE_BOOKING"),
  adjacent.opportunities.map((o) => o.capabilityCode),
);

// A JSON round trip that turns the flag into a string must not switch the
// whole conversation to a displacement pitch.
const stringFlag = indexProspect({
  technologies: [{ technologyCode: "JOBBER", isCompetitor: "false", confidence: 0.9, evidenceIds: ["j"] }],
});
ok('isCompetitor: "false" is not read as a competitor', stringFlag.competitors.length === 0);

ok(
  "the displacement set is non-empty, so there is always something honest to say",
  displacementCapabilities(matrix).length > 0,
);

/* ═══════════════════════════════════════════════════════════════════════════
   6. Hostile input
   ═══════════════════════════════════════════════════════════════════════ */
section("6. Hostile input");

const empty = buildOpportunities({ rules });
ok("a prospect with no capabilities at all produces nothing", empty.opportunities.length === 0);
ok("…and says nothing_observed rather than nothing_matched", empty.reason === "nothing_observed", empty.reason);
ok("…and carries a readable sentence", typeof empty.reasonText === "string" && empty.reasonText.length > 10);

const allNull = buildOpportunities({
  capabilities: OBSERVABLE_CAPABILITY_CODES.map((code) => ({
    code,
    value: null,
    confidence: 0.5,
    evidenceIds: [`ev-${code}`],
  })),
  rules,
});
ok(
  "every capability null produces nothing — not a full sheet of false gaps",
  allNull.opportunities.length === 0,
  allNull.opportunities.map((o) => o.capabilityCode),
);
ok("…and is flagged incomplete", allNull.incomplete === true);

ok("no rules at all is reported as no_rules", buildOpportunities({ capabilities: [] , rules: [] }).reason === "no_rules");

// A rule pointing at a capability that was switched off.
const offMatrix = matrix.map((c) => (c.code === "WEBSITE" ? { ...c, active: false } : c));
const inactiveRun = buildOpportunities({
  capabilities: [{ code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["e"] }],
  rules,
  matrix: offMatrix,
});
ok(
  "a rule referencing an INACTIVE capability is refused, not silently recommended",
  !inactiveRun.opportunities.some((o) => o.capabilityCode === "WEBSITE") &&
    inactiveRun.skipped.some((s) => s.refusal === "inactive_capability"),
  inactiveRun.skipped,
);

// A rule pointing at a capability code that does not exist.
const ghostRule = {
  code: "GHOST",
  capabilityCode: "TELEPORTATION",
  priority: 99,
  active: true,
  conditions: { all: [{ kind: "capability", code: "WEBSITE", is: false }] },
  reasonTemplate: "They need teleportation.",
};
const ghost = buildOpportunities({
  capabilities: [{ code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["e"] }],
  rules: [ghostRule],
});
ok(
  "a rule recommending a capability that does not exist produces nothing",
  ghost.opportunities.length === 0 && ghost.skipped.some((s) => s.refusal === "unknown_capability"),
  ghost.skipped,
);
ok(
  "…and validateRule rejects it at write time too",
  validateRule(ghostRule).problems.includes("unknown_capability"),
);

// An inactive rule.
const offRule = { ...rules[0], active: false };
ok(
  "an inactive rule is refused",
  buildOpportunities({
    capabilities: [{ code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["e"] }],
    technologies: jobber,
    rules: [offRule],
  }).skipped.some((s) => s.refusal === "inactive_rule"),
);

// A rule with no conditions would recommend to everybody.
ok(
  "a rule with no conditions is refused rather than matching everyone",
  buildOpportunities({
    capabilities: [{ code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["e"] }],
    rules: [{ code: "OPEN", capabilityCode: "WEBSITE", priority: 1, active: true, conditions: {}, reasonTemplate: "x" }],
  }).skipped.some((s) => s.refusal === "no_conditions"),
);

// A condition kind nobody implemented.
ok(
  "an unknown condition kind is refused, not treated as satisfied",
  buildOpportunities({
    capabilities: [{ code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["e"] }],
    rules: [
      {
        code: "WEIRD",
        capabilityCode: "WEBSITE",
        priority: 1,
        active: true,
        conditions: { all: [{ kind: "vibes", code: "WEBSITE" }] },
        reasonTemplate: "x",
      },
    ],
  }).skipped.some((s) => s.refusal === "unknown_condition_kind"),
);

// A condition on a code no detector produces can never fire — caught at write
// time so nobody wonders why a rule is silent for a month.
ok(
  "validateRule rejects a condition on an unobservable capability code",
  validateRule({
    code: "TYPO",
    capabilityCode: "WEBSITE",
    conditions: { all: [{ kind: "capability", code: "ONLINE_BOKING", is: false }] },
    reasonTemplate: "x",
  }).problems.includes("unobservable_condition"),
);

// `is` has to be a real boolean.
ok(
  'validateRule rejects `is: "false"` rather than reading it as unknown',
  validateRule({
    code: "STR",
    capabilityCode: "WEBSITE",
    conditions: { all: [{ kind: "capability", code: "WEBSITE", is: "false" }] },
    reasonTemplate: "x",
  }).problems.includes("unknown_condition_kind"),
);

// Two rows for one code that disagree cancel to unknown, rather than last-wins.
const conflicted = indexProspect({
  capabilities: [
    { code: "ONLINE_BOOKING", value: false, confidence: 0.9, evidenceIds: ["a"] },
    { code: "ONLINE_BOOKING", value: true, confidence: 0.9, evidenceIds: ["b"] },
  ],
});
ok(
  "two capability rows that disagree collapse to unknown, not to last-wins",
  conflicted.capByCode.get("ONLINE_BOOKING").value === null,
  conflicted.capByCode.get("ONLINE_BOOKING"),
);
ok("…and the conflict is reported rather than swallowed", conflicted.conflicts.length === 1, conflicted.conflicts);

// Garbage rows.
const garbage = buildOpportunities({
  capabilities: [null, undefined, 42, "nope", { value: false }, { code: 7, value: false }],
  technologies: [null, {}, { technologyCode: null }],
  rules: [null, undefined, {}, { code: "X" }],
});
ok("garbage rows do not throw", Array.isArray(garbage.opportunities));
ok("garbage rows produce no recommendations", garbage.opportunities.length === 0, garbage.opportunities);

ok("buildOpportunities() with no arguments does not throw", Array.isArray(buildOpportunities().opportunities));

/* ═══════════════════════════════════════════════════════════════════════════
   7. Conflicting rules, ranking, determinism
   ═══════════════════════════════════════════════════════════════════════ */
section("7. Conflicting rules and determinism");

const capsForConflict = [
  { code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["w1"] },
  { code: "ONLINE_PAYMENT", value: false, confidence: 0.4, evidenceIds: ["p1"] },
];
const ruleA = {
  code: "A_LOW",
  capabilityCode: "WEBSITE",
  priority: 10,
  active: true,
  conditions: { all: [{ kind: "capability", code: "WEBSITE", is: false }] },
  reasonTemplate: "Reason from the low-priority rule.",
};
const ruleB = {
  code: "B_HIGH",
  capabilityCode: "WEBSITE",
  priority: 90,
  active: true,
  conditions: { all: [{ kind: "capability", code: "WEBSITE", is: false }] },
  reasonTemplate: "Reason from the high-priority rule.",
};

const conflictRun = buildOpportunities({ capabilities: capsForConflict, rules: [ruleA, ruleB] });
ok(
  "two rules wanting the same capability produce ONE opportunity",
  conflictRun.opportunities.filter((o) => o.capabilityCode === "WEBSITE").length === 1,
  conflictRun.opportunities,
);
ok(
  "…the higher-priority rule wins",
  conflictRun.opportunities[0].ruleCode === "B_HIGH",
  conflictRun.opportunities[0].ruleCode,
);
ok(
  "…the loser is reported as duplicate_capability rather than vanishing",
  conflictRun.skipped.some((s) => s.ruleCode === "A_LOW" && s.refusal === "duplicate_capability"),
  conflictRun.skipped,
);
ok(
  "…and the winner's reason is not spliced together with the loser's",
  conflictRun.opportunities[0].reason === "Reason from the high-priority rule.",
);

// Equal priority: broken on rule code, so the answer never depends on input
// order or on the database's ORDER BY.
const tieA = { ...ruleA, code: "ZZZ", priority: 50 };
const tieB = { ...ruleB, code: "AAA", priority: 50 };
const tie1 = buildOpportunities({ capabilities: capsForConflict, rules: [tieA, tieB] });
const tie2 = buildOpportunities({ capabilities: capsForConflict, rules: [tieB, tieA] });
ok(
  "an equal-priority tie is broken deterministically, whatever order the rules arrive in",
  tie1.opportunities[0].ruleCode === tie2.opportunities[0].ruleCode &&
    tie1.opportunities[0].ruleCode === "AAA",
  [tie1.opportunities[0].ruleCode, tie2.opportunities[0].ruleCode],
);

// Ranking: sales priority decides what a rep reads first.
const ranked = buildOpportunities({
  capabilities: [
    { code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["a"] },
    { code: "ONLINE_PAYMENT", value: false, confidence: 0.9, evidenceIds: ["b"] },
    { code: "PHONE_CONTACT", value: true, confidence: 0.9, evidenceIds: ["c"] },
    { code: "LIVE_CHAT", value: false, confidence: 0.9, evidenceIds: ["d"] },
    { code: "PUBLISHED_HOURS", value: false, confidence: 0.9, evidenceIds: ["e"] },
  ],
  rules,
});
ok("ranks are 1..n with no gaps", ranked.opportunities.every((o, i) => o.rank === i + 1), ranked.opportunities.map((o) => o.rank));
ok(
  "ranked by sales priority, descending",
  ranked.opportunities.every(
    (o, i) => i === 0 || o.capabilitySalesPriority <= ranked.opportunities[i - 1].capabilitySalesPriority,
  ),
  ranked.opportunities.map((o) => [o.capabilityCode, o.capabilitySalesPriority]),
);

// Determinism against input order — the whole result, not just the first row.
const shuffle = (a) => [...a].reverse();
const detCaps = [
  { code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["a"] },
  { code: "ONLINE_PAYMENT", value: false, confidence: 0.6, evidenceIds: ["b"] },
  { code: "PHONE_CONTACT", value: true, confidence: 0.9, evidenceIds: ["c"] },
  { code: "LIVE_CHAT", value: false, confidence: 0.7, evidenceIds: ["d"] },
  { code: "PUBLISHED_HOURS", value: false, confidence: 0.7, evidenceIds: ["e"] },
];
const run1 = buildOpportunities({ capabilities: detCaps, rules });
const run2 = buildOpportunities({ capabilities: shuffle(detCaps), rules: shuffle(rules) });
ok(
  "the same rows in a different order produce an identical result",
  JSON.stringify(run1.opportunities) === JSON.stringify(run2.opportunities),
  { run1: run1.opportunities.map((o) => o.capabilityCode), run2: run2.opportunities.map((o) => o.capabilityCode) },
);

// Two capabilities at IDENTICAL sales priority, fired by rules at identical
// priority, with identical confidence. Nothing but the tie-break on capability
// code separates them, so this is the only case that can catch its removal —
// and without it a re-run silently reshuffles the order a rep reads.
const twinMatrix = matrix.map((c) =>
  c.code === "WEBSITE" || c.code === "ONLINE_PAYMENT" ? { ...c, salesPriority: 50 } : c,
);
const twinCaps = [
  { code: "WEBSITE", value: false, confidence: 0.8, evidenceIds: ["t1"] },
  { code: "ONLINE_PAYMENT", value: false, confidence: 0.8, evidenceIds: ["t2"] },
];
const twinRules = [
  {
    code: "T_WEBSITE",
    capabilityCode: "WEBSITE",
    priority: 50,
    active: true,
    conditions: { all: [{ kind: "capability", code: "WEBSITE", is: false }] },
    reasonTemplate: "No site.",
  },
  {
    code: "T_PAYMENT",
    capabilityCode: "ONLINE_PAYMENT",
    priority: 50,
    active: true,
    conditions: { all: [{ kind: "capability", code: "ONLINE_PAYMENT", is: false }] },
    reasonTemplate: "No card payment.",
  },
];
const twinA = buildOpportunities({ capabilities: twinCaps, rules: twinRules, matrix: twinMatrix });
const twinB = buildOpportunities({
  capabilities: [...twinCaps].reverse(),
  rules: [...twinRules].reverse(),
  matrix: twinMatrix,
});
ok(
  "two capabilities tied on every rank key are still ordered deterministically",
  JSON.stringify(twinA.opportunities.map((o) => o.capabilityCode)) ===
    JSON.stringify(twinB.opportunities.map((o) => o.capabilityCode)),
  [twinA.opportunities.map((o) => o.capabilityCode), twinB.opportunities.map((o) => o.capabilityCode)],
);
ok(
  "…and the tie is broken on the capability code, so the order is explicable",
  twinA.opportunities[0].capabilityCode === "ONLINE_PAYMENT",
  twinA.opportunities.map((o) => o.capabilityCode),
);

// No AI anywhere near the decision.
for (const file of [
  "lib/sales/intel/opportunity.js",
  "lib/sales/intel/confidence.js",
  "lib/sales/intel/rules.js",
  "lib/sales/intel/capabilities.js",
]) {
  const src = codeOnly(read(file));
  ok(`${file} never calls a model`, !/\b(complete|runToolLoop)\s*\(|lib\/ai\//.test(src));
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The starter rule set covers what was asked for
   ═══════════════════════════════════════════════════════════════════════ */
section("8. The starter rule set");

const byCode = new Map(rules.map((r) => [r.code, r]));
for (const code of [
  "NO_WEBSITE",
  "WEBSITE_NO_BOOKING",
  "EMAIL_ONLY_CONTACT",
  "NO_ONLINE_PAYMENT",
  "COMPETITOR_WHITE_LABEL",
  "NO_CHAT_NO_HOURS",
]) {
  ok(`starter rule ${code} exists`, byCode.has(code));
}

ok(
  "every starter rule validates against the matrix",
  rules.every((r) => validateRule(r, { matrix }).ok),
  rules.filter((r) => !validateRule(r, { matrix }).ok).map((r) => [r.code, validateRule(r, { matrix }).problems]),
);

const competitorRules = rules.filter((r) =>
  (r.conditions.all || []).some((c) => c.kind === "competitor" && c.present !== false),
);
ok("there is at least one displacement rule", competitorRules.length > 0);
ok(
  "every displacement rule recommends only a capability that survives a competitor",
  competitorRules.every((r) => isDisplacementSafe(r.capabilityCode, matrix)),
  competitorRules.map((r) => r.capabilityCode),
);

// A displacement rule that pitched a table-stakes capability must be refused at
// write time, not only at evaluation time.
ok(
  "validateRule refuses a displacement rule pitching a table-stakes capability",
  validateRule(
    {
      code: "BAD_DISPLACEMENT",
      capabilityCode: "ONLINE_BOOKING",
      conditions: { all: [{ kind: "competitor", present: true }] },
      reasonTemplate: "You need online booking.",
    },
    { matrix },
  ).problems.includes("competitor_table_stakes"),
);

const gapRules = rules.filter((r) => !competitorRules.includes(r));
ok(
  "every non-displacement rule states that it does not apply when a competitor is installed",
  gapRules.every((r) => (r.conditions.all || []).some((c) => c.kind === "competitor" && c.present === false)),
  gapRules.filter((r) => !(r.conditions.all || []).some((c) => c.kind === "competitor" && c.present === false)).map((r) => r.code),
);

ok(
  "the detectors the starter rules depend on are all in the observable vocabulary",
  requiredDetectors().every((c) => OBSERVABLE_CAPABILITY_CODES.includes(c)),
  requiredDetectors(),
);

// A template naming something we cannot supply produces no sentence at all.
ok("renderReason fills what it can", renderReason("a {competitor} b", { competitor: "JOBBER" }) === "a JOBBER b");
ok("renderReason refuses a template with a value it was not given", renderReason("a {mystery} b", {}) === null);
ok("renderReason refuses an empty template", renderReason("", {}) === null);
ok(
  "a rule whose template names an unsupplied variable is refused at evaluation",
  buildOpportunities({
    capabilities: [{ code: "WEBSITE", value: false, confidence: 0.9, evidenceIds: ["e"] }],
    rules: [
      {
        code: "HOLE",
        capabilityCode: "WEBSITE",
        priority: 1,
        active: true,
        conditions: { all: [{ kind: "capability", code: "WEBSITE", is: false }] },
        reasonTemplate: "They have no {mystery}.",
      },
    ],
  }).skipped.some((s) => s.refusal === "unresolved_reason"),
);
ok(
  "no rendered reason ever contains an unfilled placeholder",
  ranked.opportunities.every((o) => !/\{\w+\}/.test(o.reason)) &&
    withCompetitor.opportunities.every((o) => !/\{\w+\}/.test(o.reason)),
);

ok(
  "every refusal code the engine can emit has an English sentence",
  [...new Set([
    ...garbage.skipped, ...ghost.skipped, ...conflictRun.skipped, ...perverse.skipped,
    ...bio.skipped, ...deposit.skipped, ...inactiveRun.skipped, ...noEvidenceRun.skipped,
  ].map((s) => s.refusal))].every((r) => typeof REFUSALS[r] === "string"),
);

/* ═══════════════════════════════════════════════════════════════════════════
   9. Confidence: deterministic ranks far above fuzzy, and stays there
   ═══════════════════════════════════════════════════════════════════════ */
section("9. Confidence");

const confRules = seedConfidenceRules();

const deterministicWeights = Object.entries(SIGNALS)
  .filter(([, s]) => s.category === "identity_deterministic")
  .map(([, s]) => s.weight);
const fuzzyWeights = Object.entries(SIGNALS)
  .filter(([, s]) => s.category === "identity_fuzzy")
  .map(([, s]) => s.weight);
ok(
  "the weakest deterministic identity signal is at least twice the strongest fuzzy one",
  Math.min(...deterministicWeights) >= 2 * Math.max(...fuzzyWeights),
  { min: Math.min(...deterministicWeights), max: Math.max(...fuzzyWeights) },
);
ok("the fuzzy ceiling sits strictly below the match threshold", FUZZY_CEILING < MATCH_THRESHOLD, {
  FUZZY_CEILING,
  MATCH_THRESHOLD,
});

const placeId = identityConfidence({ signals: ["identity.google_place_id"], rules: confRules });
ok("a Place ID match is a match", placeId.decision === "match" && placeId.tier === "deterministic", placeId);

const everyFuzzy = identityConfidence({
  signals: ["identity.similar_name", "identity.nearby_address", "identity.same_city"],
  rules: confRules,
  candidates: [{ id: "p1" }, { id: "p2" }],
});
ok("a pile of fuzzy signals never reaches a match", everyFuzzy.decision === "review", everyFuzzy);
ok("…and is capped at the fuzzy ceiling", everyFuzzy.value <= FUZZY_CEILING, everyFuzzy.value);
ok("…and comes back with the candidates so a person can be asked", everyFuzzy.candidates.length === 2);
ok("…and says why", everyFuzzy.reason === "fuzzy_only", everyFuzzy.reason);

// The tuning attack: a superadmin raises the fuzzy weights to 1.0. Weight is a
// dial; category is a boundary, and a boundary somebody can move is not one.
const tuned = identityConfidence({
  signals: ["identity.similar_name", "identity.nearby_address", "identity.same_city"],
  rules: [
    { signal: "identity.similar_name", weight: 1, enabled: true },
    { signal: "identity.nearby_address", weight: 1, enabled: true },
    { signal: "identity.same_city", weight: 1, enabled: true },
  ],
});
ok(
  "fuzzy signals tuned to 1.0 still cannot produce an automatic match",
  tuned.decision === "review" && tuned.value <= FUZZY_CEILING,
  tuned,
);

// A ConfidenceRule row cannot smuggle a signal into a different category.
const reclassified = identityConfidence({
  signals: ["identity.similar_name"],
  rules: [{ signal: "identity.similar_name", weight: 1, enabled: true, category: "identity_deterministic" }],
});
ok(
  "a row claiming a different category does not reclassify the signal",
  reclassified.tier === "fuzzy" && reclassified.decision === "review",
  reclassified,
);

ok(
  "an unrecognised signal contributes nothing rather than a default",
  identityConfidence({ signals: ["identity.vibes"], rules: confRules }).reason === "no_known_signals",
);
ok("no signals at all says so", identityConfidence({ rules: confRules }).reason === "no_signals");
ok(
  "a disabled signal is reported as disabled, not as absent",
  identityConfidence({
    signals: ["identity.exact_phone"],
    rules: [{ signal: "identity.exact_phone", weight: 0.95, enabled: false }],
  }).reason === "disabled_signals",
);
ok(
  "the same signal twice does not manufacture certainty",
  fieldConfidence({ signals: ["detection.page_content", "detection.page_content"], rules: confRules }).value ===
    fieldConfidence({ signals: ["detection.page_content"], rules: confRules }).value,
);

ok(
  "the envelope matches lib/analytics/kpis.js's shape",
  ["value", "sampleSize", "incomplete", "reason", "reasonText"].every((k) => k in placeId),
  Object.keys(placeId),
);

// A recommendation is only as sure as its weakest citation.
const oc = opportunityConfidence([0.9, 0.4, 0.8]);
ok("opportunity confidence is the weakest link, not the average", oc.value === 0.4, oc);
ok("…and says so", oc.reason === "weakest_link");
ok("opportunity confidence over nothing is null, not 0", opportunityConfidence([]).value === null);

/* ═══════════════════════════════════════════════════════════════════════════
   10. A high score never promotes an inference to a fact
   ═══════════════════════════════════════════════════════════════════════ */
section("10. Layers do not collapse at the API boundary");

const softFact = presentCapability(
  { code: "ONLINE_BOOKING", value: false, signals: ["detection.page_content"], evidenceIds: ["a"] },
  { rules: confRules },
);
const hardFact = presentCapability(
  { code: "ONLINE_BOOKING", value: true, signals: ["detection.script_src"], evidenceIds: ["b"] },
  { rules: confRules },
);
ok("a fact is stamped as a fact", softFact.layer === LAYER_FACT);
ok(
  "a capability seen only in page prose is NOT verified, however it scores",
  softFact.verified === false,
  softFact,
);
ok("a capability read off a script tag IS verified", hardFact.verified === true, hardFact);

const unknownFact = presentCapability(
  { code: "ONLINE_BOOKING", value: null, signals: ["detection.script_src"], evidenceIds: ["c"] },
  { rules: confRules },
);
ok("an unknown value is never verified — there is no statement to verify", unknownFact.verified === false);
ok("…and null survives serialisation as null, not as false", unknownFact.value === null);

const strongInference = presentInference(
  {
    kind: "company_scale",
    value: "SMALL_BUSINESS",
    // Everything at once: first-party, a human correction, a direct detection.
    signals: ["detection.transcript", "correction.human", "detection.script_src"],
    source: "call",
    evidenceIds: ["t"],
  },
  { rules: confRules },
);
ok("an inference is stamped as an inference", strongInference.layer === LAYER_INFERENCE);
ok(
  "an inference at maximum confidence is STILL not verified",
  strongInference.verified === false && strongInference.confidence.value >= 0.99,
  strongInference,
);
ok(
  "an inference's value stays a classification, never a number",
  typeof strongInference.value === "string" && !/^\d+$/.test(strongInference.value),
);

const rec = presentOpportunity(ranked.opportunities[0]);
ok("a recommendation is stamped as a recommendation", rec.layer === LAYER_RECOMMENDATION);
ok("a recommendation is never verified — it is an argument", rec.verified === false);
ok("a recommendation carries its evidence out to the client", rec.evidenceIds.length > 0);
ok("…and the rule that produced it, so a bad one is traceable", Boolean(rec.ruleCode));

/* ═══════════════════════════════════════════════════════════════════════════
   11. Source checks, each scoped to ONE named function by brace matching
   ═══════════════════════════════════════════════════════════════════════ */
section("11. The guards are still inside the functions that need them");

const oppSrc = codeOnly(read("lib/sales/intel/opportunity.js"));
const confSrc = codeOnly(read("lib/sales/intel/confidence.js"));

const normaliseBody = bodyOf(oppSrc, "export function normaliseValue");
ok("normaliseValue is findable", Boolean(normaliseBody));
ok(
  "normaliseValue compares against the boolean literals rather than coercing",
  /v === true/.test(normaliseBody) && /v === false/.test(normaliseBody),
  normaliseBody,
);
ok(
  "normaliseValue contains no truthiness coercion",
  !/Boolean\(|!!|\bv\s*\?/.test(normaliseBody),
  normaliseBody,
);

const condBody = bodyOf(oppSrc, "export function evaluateCondition");
ok("evaluateCondition is findable", Boolean(condBody));
ok(
  "evaluateCondition normalises the stored value before comparing it",
  /normaliseValue/.test(condBody),
  condBody?.slice(0, 200),
);
ok(
  "evaluateCondition decides `capability` on an explicit equality, not truthiness",
  /value === want/.test(condBody),
);

const evalBody = bodyOf(oppSrc, "export function evaluateRule");
ok("evaluateRule is findable", Boolean(evalBody));
for (const [label, re] of [
  ["the already-has guard", /already_has/],
  ["the incompatibility guard", /incompatible/],
  ["the prerequisite guard", /missing_prerequisite/],
  ["the competitor guard", /competitor_table_stakes/],
  ["the evidence gate", /no_evidence/],
  ["the reason gate", /unresolved_reason/],
]) {
  ok(`${label} is inside evaluateRule itself`, re.test(evalBody), label);
}
ok(
  "the already-has guard asks `=== true`, so unknown does not block a recommendation",
  /row\?\.value === true|value === true/.test(bodyOf(oppSrc, "function holds") || ""),
  bodyOf(oppSrc, "function holds"),
);
ok(
  "the competitor guard requires tableStakes to be exactly false, so a missing classification is safe",
  /tableStakes !== false/.test(evalBody),
);

const inferBody = bodyOf(confSrc, "export function presentInference");
ok("presentInference is findable", Boolean(inferBody));
ok(
  "presentInference hard-codes verified: false rather than computing it",
  /verified: false/.test(inferBody) && !/verified:\s*[a-zA-Z]/.test(inferBody.replace("verified: false", "")),
  inferBody,
);

const capBody = bodyOf(confSrc, "export function presentCapability");
ok("presentCapability is findable", Boolean(capBody));
ok(
  "presentCapability derives verified from the KIND of signal, never from the number",
  /confidence\.verifying === true/.test(capBody) && !/confidence\.value\s*[><]/.test(capBody),
  capBody,
);

const identBody = bodyOf(confSrc, "export function identityConfidence");
ok("identityConfidence is findable", Boolean(identBody));
ok(
  "the fuzzy ceiling is applied inside identityConfidence, on category rather than on weight",
  /FUZZY_CEILING/.test(identBody) && /deterministic\.length/.test(identBody),
  identBody?.slice(0, 300),
);

const weightsBody = bodyOf(confSrc, "export function weightsFrom");
ok("weightsFrom is findable", Boolean(weightsBody));
ok(
  "weightsFrom reads weight from a rule row and never category",
  /row\.weight/.test(weightsBody) && !/row\.category|row\?\.category/.test(weightsBody),
  weightsBody,
);

/* ═══════════════════════════════════════════════════════════════════════════
   12. The screen and the route are real controls
   ═══════════════════════════════════════════════════════════════════════ */
section("12. The superadmin screen is wired to something that works");

const listRoute = codeOnly(read("app/api/platform/sales/capabilities/route.js"));
const itemRoute = codeOnly(read("app/api/platform/sales/capabilities/[code]/route.js"));
const page = codeOnly(read("app/platform/sales/capabilities/page.js"));
const sidebar = codeOnly(read("app/components/platform/PlatformSidebar.js"));

const listGuard = bodyOf(listRoute, "async function superadminOrRefusal");
ok("the list route has a superadmin guard", Boolean(listGuard));
ok(
  "…and it refuses anything below superadmin",
  /admin\.role !== "superadmin"/.test(listGuard),
  listGuard,
);

const patchBody = bodyOf(itemRoute, "export async function PATCH");
ok("PATCH is findable", Boolean(patchBody));
ok("PATCH is superadmin-only", /admin\.role !== "superadmin"/.test(patchBody));
ok(
  "PATCH awaits params — they are a Promise in Next 16",
  /await params/.test(patchBody),
  patchBody?.slice(0, 400),
);
ok(
  "PATCH refuses the derived fields with a 400 rather than ignoring them",
  /DERIVED_FIELDS/.test(patchBody) && /status: 400/.test(patchBody),
);
ok(
  "…and the derived list includes the caveats and the table-stakes classification",
  /caveats/.test(itemRoute) && /tableStakes/.test(itemRoute),
);
ok(
  "PATCH bounds salesPriority rather than storing whatever arrives",
  /Number\.isInteger/.test(patchBody) && /100/.test(patchBody),
);

ok(
  "the page calls the list route — the route has a caller",
  page.includes("/api/platform/sales/capabilities"),
);
ok(
  "the page calls the item route with a code",
  /\/api\/platform\/sales\/capabilities\/\$\{/.test(page),
);
ok("the page errors are reported, never swallowed", /fetchJson/.test(page) && /setError/.test(page));
ok(
  "the sidebar links the page — a screen nothing links to is unreachable",
  sidebar.includes("/platform/sales/capabilities"),
);
ok(
  "switching a capability off warns how many rules stop firing",
  /rules\.filter\(\(r\) => r\.active\)/.test(page) && /stop producing/.test(page),
);
ok(
  "the read-only caveats are rendered rather than silently omitted",
  /caveats\.map/.test(page),
);
ok(
  "the composed rep script is served by the route and rendered by the page",
  /repScript\(c\)/.test(listRoute) && /cap\.script\.map/.test(page),
);

/* ═══════════════════════════════════════════════════════════════════════════
   13. The seed
   ═══════════════════════════════════════════════════════════════════════ */
section("13. The seed refreshes what is derived and keeps what was authored");

const seeded = matrix.find((c) => c.code === "ONLINE_BOOKING");
const authored = mergeTalkingPoints(
  {
    recommendedTalkingPoints: {
      points: ["A sentence a superadmin wrote."],
      caveats: ["stale caveat"],
      planNote: "stale",
    },
  },
  seeded,
);
ok(
  "a re-seed keeps a superadmin's own talking points",
  authored.points.length === 1 && authored.points[0] === "A sentence a superadmin wrote.",
  authored.points,
);
ok(
  "…and refreshes the derived caveats and plan note from the marketing matrix",
  authored.planNote === seeded.recommendedTalkingPoints.planNote &&
    JSON.stringify(authored.caveats) === JSON.stringify(seeded.recommendedTalkingPoints.caveats),
  authored,
);
ok(
  "…and refreshes the table-stakes classification, which is not the superadmin's to set",
  authored.tableStakes === seeded.recommendedTalkingPoints.tableStakes,
);
ok(
  "a capability with no prior row gets the seed's own points",
  mergeTalkingPoints(null, seeded).points.length === seeded.recommendedTalkingPoints.points.length,
);

ok(
  "every confidence signal seeds with a category this engine recognises",
  seedConfidenceRules().every((r) => SIGNALS[r.signal]?.category === r.category),
);

console.log(
  `\n${failures.length ? "FAILED" : "PASSED"} — ${pass} assertions passed, ${failures.length} failed`,
);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
