// scripts/check-sales-rule-admin.mjs
//
//   npm run check:sales-rule-admin
//
// The three superadmin config screens — opportunity rules, confidence weights,
// technology signatures — and the properties that make them a UI rather than a
// row somebody edits by hand.
//
// ══ What is EXECUTED, and what is only read ══════════════════════════════
//
// Everything that decides something runs here against hostile input:
// nextVersion, versionBumpFor, sameValue, and the three input shapers. Most of
// the real bugs in this repo were found that way and not by reading.
//
// What cannot be executed — "is the superadmin gate INSIDE this handler",
// "does the delete count re-read inside the transaction" — is matched against
// source with comments stripped, and EVERY positional rule is scoped to a
// single named function pulled out by brace matching. A guard string appearing
// elsewhere in the same file must not manufacture a pass; that has produced a
// false pass four times in this project, which is why functionBody() exists
// here and in scripts/check-sales-suppression.mjs rather than a file-wide
// includes().
//
// ══ The properties, in the order they cost money ═════════════════════════
//
//   1. ONE validator. The routes call validateRule — the evaluator's own — and
//      the shared input shaper does NOT re-implement any of it. A second
//      opinion is how a rule saves cleanly and then never fires.
//   2. Nothing that has produced a result can be deleted, and the count is
//      re-read inside the write transaction rather than trusted from the GET
//      that rendered the button.
//   3. Every write is superadmin-only and audited in the SAME transaction as
//      the write.
//   4. Version bumps when the row's meaning changes and not when its label
//      does.
//   5. A confidence row's CATEGORY is never taken from the request.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  SEMANTIC_FIELDS,
  nextVersion,
  sameValue,
  versionBumpFor,
} from "../lib/sales/intel/versioning.js";
import {
  shapeConfidenceInput,
  shapeRuleInput,
  shapeSignatureInput,
  signaturePatternProblems,
} from "../lib/sales/intel/configAdmin.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
/**
 * Returns the verdict, and that return value is load-bearing.
 *
 * Written first as `return;` on the passing branch, which made
 * `if (!ok(...)) continue` skip the twenty assertions after it — every one of
 * them silently unrun while the script printed ALL PASS. Found by mutation
 * testing, not by reading, which is the whole argument for mutation testing.
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

/**
 * The body of ONE named function, by brace matching.
 *
 * The parameter list is walked to its closing paren first: taking the next `{`
 * after the name lands on the destructuring brace of `PATCH(request, { params
 * })` and matches a two-word "body", against which every assertion passes or
 * fails for reasons unrelated to the handler.
 */
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

const ROUTES = {
  rules: "app/api/platform/sales/rules/route.js",
  rule: "app/api/platform/sales/rules/[code]/route.js",
  confidence: "app/api/platform/sales/confidence/route.js",
  signal: "app/api/platform/sales/confidence/[signal]/route.js",
  signatures: "app/api/platform/sales/signatures/route.js",
  signature: "app/api/platform/sales/signatures/[code]/route.js",
};

const PAGES = {
  rules: "app/platform/sales/rules/page.js",
  confidence: "app/platform/sales/confidence/page.js",
  signatures: "app/platform/sales/signatures/page.js",
};

// ═══════════════════════════════════════════════════════════════════════════
section("nextVersion — never returns the input, whatever it is handed");
// ═══════════════════════════════════════════════════════════════════════════
{
  const cases = [
    ["1", "2"],
    ["2", "3"],
    ["9", "10"],
    ["99", "100"],
    ["v3", "v4"],
    ["2026.1", "2026.2"],
    ["v007", "v008"],
    ["draft", "draft.2"],
    ["", "2"],
  ];
  for (const [input, want] of cases) {
    ok(`nextVersion(${JSON.stringify(input)}) → ${want}`, nextVersion(input) === want, nextVersion(input));
  }
  ok("null and undefined do not crash it", nextVersion(null) === "2" && nextVersion(undefined) === "2");
  ok("a number is not a version string, and is treated as absent", nextVersion(7) === "2", nextVersion(7));
  // The property, rather than another case: a bump that does not bump would
  // make every stored stamp ambiguous.
  const inputs = ["1", "v3", "draft", "", "0", "1.0", "  4  "];
  ok(
    "it never returns what it was given",
    inputs.every((i) => nextVersion(i) !== i.trim()),
  );
  ok("a huge version does not lose precision", nextVersion("99999999999999999999") === "100000000000000000000");
}

// ═══════════════════════════════════════════════════════════════════════════
section("sameValue — a re-save of the same thing is not a change");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok(
    "key order does not make two identical conditions different",
    sameValue({ all: [{ kind: "capability", code: "WEBSITE", is: false }] }, {
      all: [{ is: false, code: "WEBSITE", kind: "capability" }],
    }),
  );
  ok("a genuine change is a change", !sameValue({ all: [] }, { all: [{ kind: "competitor" }] }));
  ok("0.90 and 0.9 are one weight", sameValue("0.90", 0.9));
  ok("0.9 and 0.8 are not", !sameValue(0.9, 0.8));
  ok("null equals null", sameValue(null, null) && sameValue(null, undefined));
  ok("null does not equal a value", !sameValue(null, 0) && !sameValue(0, null));
  ok("true and false differ", !sameValue(true, false));
  ok("nested arrays compare by order", !sameValue([1, 2], [2, 1]));
}

// ═══════════════════════════════════════════════════════════════════════════
section("versionBumpFor — meaning bumps, labels do not");
// ═══════════════════════════════════════════════════════════════════════════
{
  const rule = {
    code: "NO_WEBSITE",
    name: "No website found",
    capabilityCode: "WEBSITE",
    priority: 90,
    conditions: { all: [{ kind: "capability", code: "WEBSITE", is: false }] },
    reasonTemplate: "…",
    active: true,
    version: "1",
  };

  ok(
    "editing the conditions bumps",
    versionBumpFor("opportunityRule", rule, { conditions: { all: [] } }).version === "2",
  );
  ok(
    "editing the capability bumps",
    versionBumpFor("opportunityRule", rule, { capabilityCode: "ONLINE_BOOKING" }).bump,
  );
  ok(
    "editing the reason bumps — it is the sentence a rep reads",
    versionBumpFor("opportunityRule", rule, { reasonTemplate: "something else" }).bump,
  );
  ok(
    "editing the priority bumps — it decides which of two rules is refused",
    versionBumpFor("opportunityRule", rule, { priority: 10 }).bump,
  );
  ok("renaming does NOT bump", !versionBumpFor("opportunityRule", rule, { name: "New name" }).bump);
  ok(
    "switching it off does NOT bump",
    !versionBumpFor("opportunityRule", rule, { active: false }).bump,
  );
  ok(
    "re-saving the same conditions in a different key order does NOT bump",
    !versionBumpFor("opportunityRule", rule, {
      conditions: { all: [{ is: false, kind: "capability", code: "WEBSITE" }] },
    }).bump,
  );
  ok(
    "the changed fields are named, so the audit row can say what moved",
    versionBumpFor("opportunityRule", rule, { priority: 1, name: "x" }).changed.join() === "priority",
  );

  const sig = { code: "JOBBER", name: "Jobber", isCompetitor: true, patterns: [], version: "1" };
  ok("a signature's patterns bump", versionBumpFor("technologySignature", sig, { patterns: [{}] }).bump);
  ok(
    "a signature's competitor flag bumps — it changes what a detection MEANS",
    versionBumpFor("technologySignature", sig, { isCompetitor: false }).bump,
  );
  ok(
    "a signature's name does not",
    !versionBumpFor("technologySignature", sig, { name: "Jobber Inc" }).bump,
  );

  const conf = { signal: "detection.meta", weight: 0.6, enabled: true, version: "1" };
  ok("a weight bumps", versionBumpFor("confidenceRule", conf, { weight: 0.5 }).bump);
  ok("disabling bumps — it changes the number", versionBumpFor("confidenceRule", conf, { enabled: false }).bump);
  ok(
    "saving the same weight does not",
    !versionBumpFor("confidenceRule", conf, { weight: 0.6 }).bump,
  );

  let threw = false;
  try {
    versionBumpFor("somethingElse", {}, {});
  } catch {
    threw = true;
  }
  ok("an unknown model throws rather than silently never bumping", threw);

  // The classification itself, asserted rather than trusted: `active` in any
  // of these lists would make every on/off toggle a new version.
  ok(
    "no model treats `active` as a semantic field",
    Object.values(SEMANTIC_FIELDS).every((f) => !f.includes("active")),
  );
  ok(
    "no model treats `name` as a semantic field",
    Object.values(SEMANTIC_FIELDS).every((f) => !f.includes("name")),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("shapeRuleInput — the request is bounded, the RULE is not judged here");
// ═══════════════════════════════════════════════════════════════════════════
{
  const good = {
    code: "no_online_payment",
    name: "No way to pay",
    capabilityCode: "ONLINE_PAYMENT",
    priority: 75,
    reasonTemplate: "There is nothing here that takes a card.",
    conditions: '{"all":[{"kind":"capability","code":"ONLINE_PAYMENT","is":false}]}',
  };
  const r = shapeRuleInput(good);
  ok("a good rule shapes cleanly", !r.error, r.error);
  ok("the code is upper-cased", r.value?.code === "NO_ONLINE_PAYMENT", r.value?.code);
  ok("JSON text is parsed to an object", typeof r.value?.conditions === "object");

  ok("a lower-case-only code with spaces is refused", Boolean(shapeRuleInput({ ...good, code: "no pay" }).error));
  ok("a two-character code is refused", Boolean(shapeRuleInput({ ...good, code: "AB" }).error));
  ok("a missing name is refused", Boolean(shapeRuleInput({ ...good, name: "   " }).error));
  ok("a missing capability is refused", Boolean(shapeRuleInput({ ...good, capabilityCode: "" }).error));
  ok("an empty reason is refused", Boolean(shapeRuleInput({ ...good, reasonTemplate: "" }).error));
  ok("priority 1001 is refused", Boolean(shapeRuleInput({ ...good, priority: 1001 }).error));
  ok("priority -1 is refused", Boolean(shapeRuleInput({ ...good, priority: -1 }).error));
  ok("a fractional priority is refused", Boolean(shapeRuleInput({ ...good, priority: 1.5 }).error));

  const bad = shapeRuleInput({ ...good, conditions: '{"all":[' });
  ok("malformed JSON is refused", Boolean(bad.error));
  ok(
    "…and the parser's own message is passed through, so the typo is findable",
    /JSON/i.test(bad.error) && bad.error.length > 40,
    bad.error,
  );
  ok("a JSON array of conditions is refused", Boolean(shapeRuleInput({ ...good, conditions: "[]" }).error));
  ok("empty conditions text is refused", Boolean(shapeRuleInput({ ...good, conditions: "  " }).error));

  // Partial: PATCH must not read an absent field as "clear it".
  const p = shapeRuleInput({ name: "Just the name" }, { partial: true });
  ok("a partial shape reads only what was sent", Object.keys(p.value).join() === "name", Object.keys(p.value || {}));
  ok("a partial shape with nothing in it is empty, not an error", !shapeRuleInput({}, { partial: true }).error);

  // The single-validator property, asserted against the source of the shared
  // module: it must not grow a second opinion about a rule's conditions.
  const shared = read("lib/sales/intel/configAdmin.js");
  ok(
    "the shared shaper does NOT re-implement the condition vocabulary",
    !/CONDITION_KINDS|OBSERVABLE_CAPABILITY_CODES|evaluateCondition/.test(shared),
  );
  ok(
    "…and does not import validateRule either — validation belongs to the routes",
    !/validateRule/.test(shared),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("shapeSignatureInput — a fingerprint that matches nothing is refused");
// ═══════════════════════════════════════════════════════════════════════════
{
  const good = {
    code: "JOBBER",
    name: "Jobber",
    isCompetitor: true,
    patterns: '[{"kind":"script_src","pattern":"getjobber.com","weight":0.9}]',
  };
  ok("a good signature shapes cleanly", !shapeSignatureInput(good).error, shapeSignatureInput(good).error);

  ok("an empty pattern list is refused", Boolean(shapeSignatureInput({ ...good, patterns: "[]" }).error));
  ok(
    "an unknown pattern kind is refused",
    Boolean(shapeSignatureInput({ ...good, patterns: '[{"kind":"vibes","pattern":"x"}]' }).error),
  );
  ok(
    "an empty pattern string is refused",
    Boolean(shapeSignatureInput({ ...good, patterns: '[{"kind":"html","pattern":"  "}]' }).error),
  );
  ok(
    "a weight above 1 is refused",
    Boolean(shapeSignatureInput({ ...good, patterns: '[{"kind":"html","pattern":"x","weight":2}]' }).error),
  );
  ok(
    "a weight of 0 is refused — it would be a pattern that counts for nothing",
    Boolean(shapeSignatureInput({ ...good, patterns: '[{"kind":"html","pattern":"x","weight":0}]' }).error),
  );
  ok(
    "a pattern object that is a string is refused",
    Boolean(shapeSignatureInput({ ...good, patterns: '["getjobber.com"]' }).error),
  );
  ok("an object where a list belongs is refused", Boolean(shapeSignatureInput({ ...good, patterns: "{}" }).error));
  ok(
    "isCompetitor must be a boolean, not a string",
    Boolean(shapeSignatureInput({ ...good, isCompetitor: "yes" }).error),
  );
  ok(
    "every problem is reported at once, not one per save",
    signaturePatternProblems([{ kind: "nope", pattern: "" }]).length >= 2,
    signaturePatternProblems([{ kind: "nope", pattern: "" }]),
  );
  ok(
    "a 300-character pattern is refused",
    Boolean(
      shapeSignatureInput({ ...good, patterns: JSON.stringify([{ kind: "html", pattern: "x".repeat(300) }]) })
        .error,
    ),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("shapeConfidenceInput — weight is a dial, category is a boundary");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("a weight change is accepted", shapeConfidenceInput({ weight: 0.42 }).value.weight === 0.42);
  ok("enabled is accepted", shapeConfidenceInput({ enabled: false }).value.enabled === false);
  ok("weight 1 is accepted", !shapeConfidenceInput({ weight: 1 }).error);
  ok("weight 0 is accepted — off is a legitimate weight", !shapeConfidenceInput({ weight: 0 }).error);
  ok("weight 1.1 is refused", Boolean(shapeConfidenceInput({ weight: 1.1 }).error));
  ok("weight -0.1 is refused", Boolean(shapeConfidenceInput({ weight: -0.1 }).error));
  ok("a non-numeric weight is refused", Boolean(shapeConfidenceInput({ weight: "heavy" }).error));
  ok(
    "the weight is rounded to what Decimal(4,3) can hold",
    shapeConfidenceInput({ weight: 0.123456 }).value.weight === 0.123,
  );
  ok("nothing to change is refused", Boolean(shapeConfidenceInput({}).error));

  // THE property this file exists for. Category off the request would let a
  // superadmin promote a resemblance to a verified identity.
  ok(
    "sending a category is REFUSED, not ignored",
    Boolean(shapeConfidenceInput({ weight: 0.5, category: "identity_deterministic" }).error),
  );
  ok("renaming the signal is refused", Boolean(shapeConfidenceInput({ signal: "x" }).error));
  ok("setting the version by hand is refused", Boolean(shapeConfidenceInput({ version: "9" }).error));
  ok(
    "…and no accepted shape can ever carry a category",
    shapeConfidenceInput({ weight: 0.5 }).value.category === undefined,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Every write is superadmin-only — scoped to one handler at a time");
// ═══════════════════════════════════════════════════════════════════════════
{
  const handlers = [
    [ROUTES.rules, "GET"],
    [ROUTES.rules, "POST"],
    [ROUTES.rule, "PATCH"],
    [ROUTES.rule, "DELETE"],
    [ROUTES.confidence, "GET"],
    [ROUTES.signal, "PATCH"],
    [ROUTES.signatures, "GET"],
    [ROUTES.signatures, "POST"],
    [ROUTES.signature, "PATCH"],
    [ROUTES.signature, "DELETE"],
  ];
  for (const [file, name] of handlers) {
    const body = functionBody(read(file), name);
    if (!ok(`${file} has a ${name} handler`, Boolean(body))) continue;
    ok(`  ${name} calls superadminOrRefusal`, /superadminOrRefusal\(request\)/.test(body));
    ok(`  ${name} returns the refusal rather than continuing`, /if\s*\(refusal\)\s*return/.test(body));
  }

  // The gate itself, in the one place it lives.
  const shared = read("lib/sales/intel/configAdmin.js");
  const gate = functionBody(shared, "superadminOrRefusal");
  ok("the gate exists as a named function", Boolean(gate));
  ok("…and refuses anything that is not a superadmin", /role\s*!==\s*"superadmin"/.test(gate));
  ok("…with a 403, not a silent pass", /status:\s*403/.test(gate));
  ok("…and 401s an absent admin", /status:\s*401/.test(gate));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Nothing that produced a result can be deleted");
// ═══════════════════════════════════════════════════════════════════════════
{
  const ruleDelete = functionBody(read(ROUTES.rule), "DELETE");
  ok("the rule DELETE counts what the rule produced", /prospectOpportunity\.count/.test(ruleDelete));
  ok(
    "…inside the transaction, on the tx client — not from the earlier page load",
    /tx\.prospectOpportunity\.count/.test(ruleDelete) && !/db\.prospectOpportunity\.count/.test(ruleDelete),
  );
  ok("…and refuses with a 409 rather than deleting", /status:\s*409/.test(ruleDelete));
  ok("…and the delete is inside the same transaction", /tx\.opportunityRule\.delete/.test(ruleDelete));
  ok("…and the deletion is audited", /tx\.platformAuditLog\.create/.test(ruleDelete));
  ok(
    "…and the audit keeps the conditions, so what was removed is recoverable",
    /conditions:\s*existing\.conditions/.test(ruleDelete),
  );

  const sigDelete = functionBody(read(ROUTES.signature), "DELETE");
  ok("the signature DELETE counts its detections", /tx\.prospectTechnology\.count/.test(sigDelete));
  ok("…and refuses with a 409", /status:\s*409/.test(sigDelete));
  ok("…and is audited inside the transaction", /tx\.platformAuditLog\.create/.test(sigDelete));

  // A confidence signal must have no delete at all: the vocabulary is a code
  // contract, and a missing row means "use the default", not "off".
  const signal = read(ROUTES.signal);
  ok("there is no DELETE for a confidence signal", !/export\s+async\s+function\s+DELETE/.test(signal));
  ok("…and no POST that could invent one", !/export\s+async\s+function\s+POST/.test(signal));

  // And the screens must not render a control that would be refused.
  const rulesPage = read(PAGES.rules);
  ok(
    "the rules screen only renders Delete when the row is deletable",
    /rule\.deletable\s*\?/.test(rulesPage),
  );
  const sigPage = read(PAGES.signatures);
  ok(
    "the signatures screen only renders Delete when the row is deletable",
    /s\.deletable\s*\?/.test(sigPage),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("One validator, and every write audited in the same transaction");
// ═══════════════════════════════════════════════════════════════════════════
{
  const post = functionBody(read(ROUTES.rules), "POST");
  ok("creating a rule runs validateRule", /validateRule\(/.test(post));
  ok("…against the matrix loaded from the database", /loadCapabilityMatrix\(/.test(post));
  ok("…including inactive capabilities, so the refusal names the real problem", /includeInactive:\s*true/.test(post));
  ok("…and refuses rather than storing an unfireable rule", /status:\s*400/.test(post));
  ok("…and the create and the audit row are one transaction", /db\.\$transaction/.test(post));
  ok("…with the audit written on the tx client", /tx\.platformAuditLog\.create/.test(post));
  ok("…and a new rule starts at version 1", /version:\s*"1"/.test(post));

  const patch = functionBody(read(ROUTES.rule), "PATCH");
  ok("editing a rule runs validateRule", /validateRule\(/.test(patch));
  ok(
    "…on the MERGED row, not on the patch alone",
    /const merged = \{ \.\.\.existing, \.\.\.patch \}/.test(patch),
  );
  ok("…and consults versionBumpFor rather than deciding inline", /versionBumpFor\(/.test(patch));
  ok("…and writes the audit inside the transaction", /tx\.platformAuditLog\.create/.test(patch));
  ok("…and records the version it moved from and to", /versionFrom/.test(patch) && /versionTo/.test(patch));
  ok(
    "…and switching a rule OFF is never blocked by the rule being broken",
    /deactivatingOnly/.test(patch),
  );
  ok("…and the code is immutable", /"code" in body/.test(patch));
  ok("…and the version cannot be set by hand", /"version" in body/.test(patch));

  const signal = functionBody(read(ROUTES.signal), "PATCH");
  ok("a confidence row's category comes from SIGNALS", /category:\s*known\.category/.test(signal));
  ok("…and never from the request body", !/category:\s*body\./.test(signal));
  ok("…an unknown signal is refused with a 404", /status:\s*404/.test(signal));
  ok("…and the change is audited", /tx\.platformAuditLog\.create/.test(signal));
  ok("…and versionBumpFor decides the version", /versionBumpFor\(/.test(signal));

  const sigPatch = functionBody(read(ROUTES.signature), "PATCH");
  ok("a signature edit consults versionBumpFor", /versionBumpFor\(/.test(sigPatch));
  ok("…and is audited in the transaction", /tx\.platformAuditLog\.create/.test(sigPatch));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Next 16 — params is a Promise in every dynamic handler");
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const [file, name] of [
    [ROUTES.rule, "PATCH"],
    [ROUTES.rule, "DELETE"],
    [ROUTES.signal, "PATCH"],
    [ROUTES.signature, "PATCH"],
    [ROUTES.signature, "DELETE"],
  ]) {
    const body = functionBody(read(file), name);
    ok(`${file} ${name} awaits params`, /await params/.test(body));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("The screens say what is true");
// ═══════════════════════════════════════════════════════════════════════════
{
  // A detector exists now — lib/sales/intel/technology.js — so the two
  // assertions that used to live here (that the route hard-coded
  // `detectionsPending: true`, and that the screen said "Nothing reads these
  // patterns yet") were asserting the OPPOSITE of what is true. A check that
  // proves the wrong behaviour is worse than no check, which is the lesson
  // STATUS.md already records from check-sales-outreach.mjs. Inverted.
  //
  // What replaces them is the stronger property: the banner must be COMPUTED
  // rather than asserted. A hard-coded `true` is exactly what went stale.
  const sigRoute = read(ROUTES.signatures);
  ok(
    "the signatures route no longer hard-codes detectionsPending",
    !/detectionsPending:\s*true/.test(sigRoute),
    sigRoute.match(/detectionsPending[^\n]*/)?.[0],
  );
  ok(
    "…it derives it from a count of prospects actually crawled",
    /crawledProspects\s*===\s*0/.test(sigRoute) && /lastCrawledAt/.test(sigRoute),
  );
  const sigPage = read(PAGES.signatures);
  ok("…and the screen renders it", /detectionsPending/.test(sigPage));
  ok(
    "…saying the patterns are live and nothing has been crawled",
    /These patterns are live\. Nothing has been crawled yet\./.test(sigPage),
  );

  // Each screen must state its own version policy, because the two policies
  // genuinely differ and a reader cannot guess which one they are looking at.
  ok("the rules screen states what bumps a version", /changes what the rule DECIDES/.test(read(PAGES.rules)));
  ok(
    "the confidence screen says its version is only a counter",
    /not a provenance trail/.test(read(PAGES.confidence)),
  );

  // Every page must gate its controls on the role rather than on hope.
  for (const [name, file] of Object.entries(PAGES)) {
    const src = read(file);
    ok(`${name} screen resolves the viewer's role`, /me\?\.role === "superadmin"/.test(src));
    ok(`${name} screen hides write controls from a non-superadmin`, /isSuperadmin &&/.test(src));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  `\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
