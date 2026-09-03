// scripts/check-sales-admin.mjs
//
//   npm run check:sales-admin
//
// The superadmin's view of FieldQuo's own sales operation: adding a rep, giving
// them the things they need to work, and reading what they sold.
//
// ══ Why this file exists ══════════════════════════════════════════════════
//
// The owner added a rep and asked five questions, every one of which was a real
// gap: what the code is for, where the work email goes, where a number is
// assigned, where the rep's own link lives, and where the KPIs, insights and
// leads are. This is the regression guard for the answers.
//
// ══ What is EXECUTED, and what is only read ══════════════════════════════
//
// Everything that DECIDES something runs here against hostile input:
// suggestCode against a full set of collisions, codeProblem against capitals
// and underscores, workEmailProblem against a login address, outreachReadiness
// against a rep with no mailbox, and the whole of lib/sales/performance.js
// against a ledger with a reversal in it, a rep with three signups, a rep with
// none and a rep who has left. AGENTS.md is explicit that most of the real bugs
// in this repo were found that way rather than by reading.
//
// What cannot be executed — "is the superadmin gate INSIDE this handler",
// "does the screen render the blocker rather than a green tick" — is matched
// against source with comments stripped, and EVERY positional rule is scoped to
// a single named function pulled out by brace matching. A guard string
// appearing elsewhere in the same file must not manufacture a pass; that has
// produced a false pass four times in this project, which is why functionBody()
// is copied from scripts/check-sales-rule-admin.mjs rather than a file-wide
// includes(). For the same reason nothing here uses
// `src.indexOf(a) < src.indexOf(b)`: when `a` is absent that is `-1 < n`, which
// passes.
//
// ══ The properties, in the order they cost money ═════════════════════════
//
//   1. A rep with no work mailbox cannot send, the blocker names the mailbox
//      rather than DNS, and the console both says so and offers the field.
//   2. The code is generated, collision-aware, and the screen's suggestion and
//      the server's retry come from ONE function.
//   3. A rate below the floor is never printed as a percentage — the counts
//      are, which are honest at any n.
//   4. Commission is summed from the ledger, reversals included, and never
//      read from a cached total.
//   5. A deactivated rep keeps their history and stays on the page.
//   6. A rep has no write path to attribution or commission.
//   7. Nothing on these screens is a control that does not work.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

import {
  MAX_CODE_CANDIDATES,
  NUMBER_CAPABILITIES,
  codeCandidates,
  codeProblem,
  normaliseWorkEmail,
  salesNumberState,
  suggestCode,
  workEmailProblem,
} from "../lib/sales/repAdmin.js";
import { outreachReadiness } from "../lib/sales/outreachReadiness.js";
import {
  buildFunnel,
  buildLeadPipeline,
  buildRepRows,
  buildSalesPerformance,
  commissionForRep,
  milestoneCompanies,
  rate,
  rateStatement,
  NOT_TRACKED,
} from "../lib/sales/performance.js";
import { RATE_FLOOR } from "../lib/analytics/kpis.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];

/**
 * Returns the verdict, and that return value is load-bearing — see
 * check-sales-rule-admin.mjs, where writing `return;` on the passing branch
 * made `if (!ok(...)) continue` skip twenty assertions while the script printed
 * ALL PASS.
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

function read(relativePath) {
  return stripComments(readFileSync(join(ROOT, relativePath), "utf8"));
}

/**
 * Source with runs of whitespace collapsed.
 *
 * For asserting that a SENTENCE appears on a screen. JSX wraps prose across
 * lines at whatever column the formatter chose, so a literal match on a phrase
 * fails for a reason that has nothing to do with what the screen says — and the
 * tempting fix, shortening the phrase until it fits on one line, weakens the
 * assertion instead of the regex.
 */
function prose(relativePath) {
  return read(relativePath).replace(/\s+/g, " ");
}

/**
 * The object literal that follows `key: {`, by brace matching.
 *
 * Needed because a non-greedy `\{[\s\S]*?\}` stops at the first inner `}` — it
 * matched two lines of a Prisma `select` and left the rest of the object in
 * scope, which is exactly the kind of half-matched region that makes a
 * positional rule pass or fail for unrelated reasons.
 */
function objectAfter(src, key) {
  const at = src.indexOf(`${key}:`);
  if (at === -1) return null;
  const open = src.indexOf("{", at);
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

const FILES = {
  repsRoute: "app/api/platform/sales/reps/route.js",
  repRoute: "app/api/platform/sales/reps/[id]/route.js",
  perfRoute: "app/api/platform/sales/performance/route.js",
  repsPage: "app/platform/sales/reps/page.js",
  perfPage: "app/platform/sales/performance/page.js",
  sender: "lib/sales/outreachSender.js",
  readiness: "lib/sales/outreachReadiness.js",
  inbound: "lib/sales/outreachInbound.js",
  sidebar: "app/components/platform/PlatformSidebar.js",
  performance: "lib/sales/performance.js",
  repAdmin: "lib/sales/repAdmin.js",
};

console.log("Sales admin console — the five gaps the owner found\n");

// ═══════════════════════════════════════════════════════════════════════════
section("1. A rep with no work mailbox cannot send, and is told why");
// ═══════════════════════════════════════════════════════════════════════════
{
  const configured = {
    senderDomainVerified: true,
    replyAddressing: "plain",
    mailingAddress: "1 Main St, Ottawa ON",
    inboundSecretSet: true,
  };

  // Everything else about this deployment is perfect. The ONLY thing missing is
  // the mailbox, so any blocker other than the mailbox one is this check
  // catching the wrong thing.
  for (const missing of [null, undefined, "", "   "]) {
    const verdict = outreachReadiness({ ...configured, repEmail: missing });
    ok(
      `a rep whose work mailbox is ${JSON.stringify(missing)} cannot send`,
      verdict.canSend === false,
      verdict,
    );
    ok(
      `…and the blocker is the mailbox, not DNS (${JSON.stringify(missing)})`,
      verdict.blockers.length === 1 && verdict.blockers[0].code === "no_work_mailbox",
      verdict.blockers.map((b) => b.code),
    );
    ok(
      `…and the fix names where to set it (${JSON.stringify(missing)})`,
      /platform console/i.test(verdict.blockers[0].fix) && /Sales reps/.test(verdict.blockers[0].fix),
      verdict.blockers[0].fix,
    );
  }

  // A mailbox that IS set but is nonsense is a different sentence, because it
  // is a different thing to go and fix.
  const garbage = outreachReadiness({ ...configured, repEmail: "not-an-address" });
  ok(
    "a work mailbox that isn't an address is its own blocker",
    garbage.canSend === false && garbage.blockers[0].code === "rep_email_invalid",
    garbage.blockers.map((b) => b.code),
  );

  // And a rep with everything can send — otherwise the three assertions above
  // would pass over a function that refuses unconditionally.
  const fine = outreachReadiness({ ...configured, repEmail: "dana@fieldquo.com" });
  ok("a rep with a mailbox and a verified domain can send", fine.canSend === true, fine.blockers);
}

// ── The send path actually reads workEmail ─────────────────────────────────
//
// This is the half that had been missing: SalesRep.workEmail is documented as
// the address a rep sends from, with no fallback to their login, and
// outreachSender.js was reading `rep.email` anyway. A column with no writer and
// no reader on the path it exists for is AGENTS.md failure class 1 twice over.
{
  const src = read(FILES.sender);
  const status = functionBody(src, "outreachStatus");
  ok("outreachStatus exists as a named function", Boolean(status));
  ok(
    "outreachStatus asks for the WORK mailbox, not the login address",
    /repSendingAddress\(rep\)/.test(status) && !/repEmail:\s*rep\?\.email/.test(status),
    status,
  );

  const helper = functionBody(src, "repSendingAddress");
  ok("repSendingAddress reads workEmail", /rep\?\.workEmail/.test(helper), helper);
  ok(
    "…and never falls back to the login address",
    !/\|\|\s*rep\?\.email/.test(helper) && !/\|\|\s*rep\.email/.test(helper),
    helper,
  );

  const deliver = functionBody(src, "deliverOutreach");
  ok("deliverOutreach exists as a named function", Boolean(deliver));
  ok(
    "the From header is built from the sending address",
    /from:\s*`\$\{sanitiseHeaderText\(rep\.name, 120\)\} <\$\{sendingAddress\}>`/.test(deliver),
    deliver?.match(/from:[^\n]*/)?.[0],
  );
  ok(
    "the Reply-To is built from the sending address",
    /replyToAddress\(sendingAddress,/.test(deliver),
    deliver?.match(/replyToAddress\([^\n]*/)?.[0],
  );
  ok(
    "the stored copy records what actually went out",
    /fromAddress:\s*sendingAddress/.test(deliver),
    deliver?.match(/fromAddress:[^\n]*/)?.[0],
  );
  ok(
    "nothing in deliverOutreach still addresses mail from rep.email",
    !/rep\.email/.test(deliver),
    deliver?.match(/rep\.email[^\n]*/)?.[0],
  );
}

// ── The echo check moved with it ───────────────────────────────────────────
//
// A mailbox rule that forwards everything forwards the rep's own sent items,
// which now carry workEmail in their From. Matching only the login address
// would have quietly reopened the double-filing bug that check exists to close.
{
  const src = read(FILES.inbound);
  const body = functionBody(src, "fileInboundReply") || src;
  ok(
    "the inbound echo check knows about the work mailbox",
    /salesRep\?\.workEmail/.test(body),
    body.match(/workEmail[^\n]*/)?.[0],
  );
  ok(
    "…and still knows about the login address, for mail sent before the change",
    /salesRep\?\.email/.test(body),
  );
}

// ── The console both says it and offers the field ──────────────────────────
{
  const page = read(FILES.repsPage);
  ok(
    "the reps screen has a work mailbox field on the invite form",
    /id="rep-work-email"/.test(page),
  );
  ok(
    "…and says in plain words that a rep cannot send without one",
    /cannot send a single email/.test(page),
  );
  ok(
    "…and offers to assign or change it on an existing rep",
    /saveMailbox/.test(page) && /workEmail:\s*value/.test(page),
  );
  ok(
    "…and renders the sending verdict from the server, not a local guess",
    /rep\.sending\?\.canSend/.test(page) && /sending\?\.blockers/.test(page),
  );
  ok(
    "…printing the blocker's own title and fix rather than a generic message",
    /\{b\.title\}/.test(page) && /\{b\.fix\}/.test(page),
  );

  // The verdict must come from the same function the rep's own portal asks.
  const route = read(FILES.repsRoute);
  const get = functionBody(route, "GET");
  ok("the reps GET calls outreachStatus for each rep", /outreachStatus\(r\)/.test(get), get);
  ok("the reps GET returns workEmail", /workEmail:\s*r\.workEmail/.test(get), get);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The code is generated, collision-aware, and validated once");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok(
    "a name becomes the first candidate",
    suggestCode("Dana O'Brien", []) === "dana-o-brien",
    suggestCode("Dana O'Brien", []),
  );

  // The scenario the brief names: a GENERATED code colliding with a live one.
  ok(
    "a collision with an existing code yields the next free suffix",
    suggestCode("Dana O'Brien", ["dana-o-brien"]) === "dana-o-brien-2",
    suggestCode("Dana O'Brien", ["dana-o-brien"]),
  );
  ok(
    "…and keeps walking past several collisions",
    suggestCode("Dana", ["dana", "dana-2", "dana-3"]) === "dana-4",
    suggestCode("Dana", ["dana", "dana-2", "dana-3"]),
  );
  ok(
    "…and is case-insensitive about what is taken",
    suggestCode("Dana", ["DANA"]) === "dana-2",
    suggestCode("Dana", ["DANA"]),
  );
  ok(
    "…and returns NULL rather than a sixth guess when every candidate is taken",
    suggestCode("Dana", ["dana", "dana-2", "dana-3", "dana-4", "dana-5"]) === null,
    suggestCode("Dana", ["dana", "dana-2", "dana-3", "dana-4", "dana-5"]),
  );
  ok(
    "the suffix starts at 2 — there is no -1 on anybody's card",
    codeCandidates("Dana")[1] === "dana-2",
    codeCandidates("Dana"),
  );
  ok(
    "the candidate list is exactly as long as the route's retry budget",
    codeCandidates("Dana").length === MAX_CODE_CANDIDATES,
    codeCandidates("Dana").length,
  );
  // A name with nothing Latin in it still yields something, because an empty
  // code would collide with every other empty one.
  ok("a non-Latin name still yields a code", suggestCode("привет", []) === "rep");
  ok("…and collides properly when `rep` is taken", suggestCode("привет", ["rep"]) === "rep-2");

  // The scenario the brief names: an ADMIN-SUPPLIED code that is invalid.
  for (const [bad, why] of [
    ["Dana", "a capital"],
    ["dana_2", "an underscore"],
    ["dana 2", "a space"],
    ["d", "one character"],
    ["-dana", "a leading hyphen"],
    ["dana@2", "an at sign"],
    ["a".repeat(32), "over 31 characters"],
  ]) {
    const problem = codeProblem(bad);
    ok(`an admin-supplied code with ${why} is refused`, typeof problem === "string" && problem.length > 20, {
      bad,
      problem,
    });
  }
  ok("a valid admin-supplied code is accepted", codeProblem("dana-2") === null);
  ok("an absent code is not a problem — it means generate one", codeProblem("") === null);

  // ONE implementation. The screen prefills with codeCandidates and the route
  // retries with codeCandidates; two would show `dana-2` and store `dana-3`.
  const route = read(FILES.repsRoute);
  const post = functionBody(route, "POST");
  ok("the create route builds its candidates from the shared function", /codeCandidates\(name\)/.test(post), post);
  ok(
    "…and does not re-implement the suffix inline",
    !/\$\{base\}-\$\{attempt/.test(post),
    post?.match(/\$\{base\}[^\n]*/)?.[0],
  );
  ok("the create route validates the code through codeProblem", /codeProblem\(wantedCode\)/.test(post));
  ok("…and the mailbox through workEmailProblem", /workEmailProblem\(workEmail, email\)/.test(post));
  ok("…and actually writes the mailbox", /workEmail,/.test(post), post);

  const page = read(FILES.repsPage);
  ok("the screen prefills the code from the same function", /suggestCode\(name, takenCodes\)/.test(page));
  ok("…and validates it with the same function", /codeProblem\(draft\.code\)/.test(page));
  ok(
    "…and explains what the code is FOR, which was the owner's actual question",
    /signup\?sales=/.test(page) && /credited/.test(page),
  );
  ok(
    "…and stops following the name once somebody edits it by hand",
    /codeTouched/.test(page),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The work mailbox is validated the same way everywhere");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("an absent mailbox is allowed — it is bought after the rep is added", workEmailProblem("") === null);
  ok("…including null", workEmailProblem(null) === null);
  ok("a malformed mailbox is refused", typeof workEmailProblem("nope") === "string");
  ok(
    "a mailbox equal to the sign-in address is refused",
    typeof workEmailProblem("dana@x.com", "DANA@X.com") === "string",
  );
  ok(
    "…and the refusal says why, rather than 'invalid'",
    /sign-in address/.test(workEmailProblem("dana@x.com", "dana@x.com")),
  );
  ok("a distinct, well-formed mailbox is accepted", workEmailProblem("dana@fieldquo.com", "d@gmail.com") === null);
  ok("an over-long address is refused", typeof workEmailProblem(`${"a".repeat(250)}@b.com`) === "string");
  ok("normalisation lowercases and trims", normaliseWorkEmail("  Dana@FieldQuo.com ") === "dana@fieldquo.com");
  ok(
    "…and an empty string becomes NULL, never '' — a @unique column collides on ''",
    normaliseWorkEmail("   ") === null,
    normaliseWorkEmail("   "),
  );

  const patch = functionBody(read(FILES.repRoute), "PATCH");
  ok("the rep PATCH exists", Boolean(patch));
  ok("PATCH accepts a work mailbox", /"workEmail" in body/.test(patch), patch);
  ok("…distinguishing 'not mentioned' from 'cleared'", /touchesMailbox/.test(patch));
  ok("…validating it through the shared function", /workEmailProblem\(workEmail, existing\.email\)/.test(patch));
  ok("…and auditing the change", /sales_rep_work_mailbox_set/.test(patch));
  // The code must not be editable: the link is already on a card, and changing
  // it silently stops crediting every copy handed out. Asserted three ways,
  // because "no `code` anywhere" is untrue — the row is SELECTED back for the
  // response, which is fine and is not a write.
  const patchData = objectAfter(patch, "data");
  ok("the PATCH update has a data object", Boolean(patchData), patchData);
  ok(
    "PATCH never writes the attribution code — the link is already on a card",
    !/\bcode\b/.test(patchData),
    patchData?.match(/\bcode[^\n]*/)?.[0],
  );
  ok("…and never even reads one off the request", !/body\.code/.test(patch));
  ok(
    "…and does not destructure one out of the body",
    !/const\s*\{[^}]*\bcode\b[^}]*\}\s*=\s*body/.test(patch),
  );
  ok(
    "there is still no DELETE handler for a rep — their ledger is history",
    !/export async function DELETE/.test(read(FILES.repRoute)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Numbers: what is real is offered, what is not is stated");
// ═══════════════════════════════════════════════════════════════════════════
{
  const sms = NUMBER_CAPABILITIES.find((c) => c.key === "sms");
  const voice = NUMBER_CAPABILITIES.find((c) => c.key === "voice");
  ok("texting the signup link is declared available", sms?.available === true);
  ok("…and says it is shared rather than per rep", /Shared, not per rep/.test(sms?.detail || ""));
  ok("…and points at the screen that actually buys one", sms?.where === "/platform/crew-lines");

  ok("a per-rep callback number is declared NOT built", voice?.available === false);
  ok(
    "…and names the reason rather than 'coming soon'",
    /FIELDQUO_SALES_NUMBER/.test(voice?.detail || "") && /schema change/.test(voice?.detail || ""),
  );
  ok(
    "…and offers nowhere to go, because there is nowhere",
    voice?.where === null,
    voice?.where,
  );

  // Three states, and the third is the one a naive ternary loses.
  ok("no sales number held is its own state", salesNumberState({}).state === "none");
  ok("a held number is its own state", salesNumberState({ e164: "+16135550199" }).state === "held");
  ok(
    "a FAILED lookup is a third state, not 'none'",
    salesNumberState({ lookupFailed: true }).state === "unknown",
    salesNumberState({ lookupFailed: true }),
  );
  ok(
    "…and says nothing has changed, rather than telling somebody to go and buy one",
    /Nothing has changed/.test(salesNumberState({ lookupFailed: true }).detail),
  );

  const page = read(FILES.repsPage);
  ok("the screen renders the capability list", /numberCapabilities\.map/.test(page));
  ok(
    "…and renders no control for the unavailable one",
    /c\.where \?/.test(page),
    page.match(/c\.where[^\n]*/)?.[0],
  );

  const get = functionBody(read(FILES.repsRoute), "GET");
  ok("the route reads the sales-purpose number", /purpose:\s*"sales"/.test(get), get);
  ok(
    "…and reports a failed lookup as unknown rather than as none",
    /salesNumberState\(\{ lookupFailed: true \}\)/.test(get),
    get,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The rep's own link and facts are on the admin's screen");
// ═══════════════════════════════════════════════════════════════════════════
{
  const get = functionBody(read(FILES.repsRoute), "GET");
  for (const field of ["signupLink", "workEmail", "code", "companyCount"]) {
    ok(`the reps GET returns ${field}`, new RegExp(`${field}:`).test(get), get);
  }
  ok(
    "the link is built from the deployment's own origin, not a constant",
    /signupLinkFor\(origin, r\.code\)/.test(get),
    get,
  );

  const page = read(FILES.repsPage);
  ok("the screen shows the link", /rep\.signupLink/.test(page));
  ok(
    "…in a selectable field as well as behind a Copy button",
    /readOnly/.test(page) && /copy\(rep\.signupLink/.test(page),
  );
  ok(
    "…and the Copy button reports a refusal rather than silently doing nothing",
    /clipboard\.writeText/.test(page) && /wouldn't let the page copy/.test(page),
  );
  ok("the screen shows the attributed company count", /rep\.companyCount/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Rates below the floor are counts, never percentages");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the floor is the same integer that gates a contractor's win rate", RATE_FLOOR === 10, RATE_FLOOR);

  // The brief's scenario: a rep with THREE signups. Three of four converted is
  // 75%, and printing that would put them above a rep with 28 of 40.
  const three = rate(3, 4);
  ok("a rate over 4 outcomes has no percentage", three.value === null, three);
  ok("…but reports the counts, which are honest at any n", three.hit === 3 && three.sampleSize === 4);
  ok("…and says how many more are needed", three.remaining === RATE_FLOOR - 4, three);
  ok("…in a sentence the screen can print verbatim", three.statement === "3 of 4. 6 more and this becomes a percentage.", three.statement);

  // A perfect record under the floor is the exact case the floor exists for.
  const perfect = rate(3, 3);
  ok("3 of 3 does NOT become 100%", perfect.value === null, perfect);

  // The brief's scenario: a rep with ZERO signups.
  const none = rate(0, 0);
  ok("no outcomes at all yields no percentage", none.value === null, none);
  ok("…and a zero sample size, not a zero rate", none.sampleSize === 0 && none.hit === 0, none);
  ok("…with its own reason, distinct from below_floor", none.reason === "none_yet", none);
  ok("…and its own sentence", /Nothing to measure yet/.test(none.statement), none.statement);

  // At the floor exactly, a percentage appears.
  const atFloor = rate(5, RATE_FLOOR);
  ok("at the floor exactly, a percentage appears", atFloor.value === 50, atFloor);
  ok("…with no statement, because there is nothing to excuse", atFloor.statement === null);
  ok("a rate above the floor rounds to one decimal", rate(1, 3 * RATE_FLOOR).value === 3.3, rate(1, 30));
  ok("rateStatement returns null for a rate that exists", rateStatement(atFloor) === null);

  // And the screen must not do the division itself.
  const page = read(FILES.perfPage);
  ok(
    "the dashboard prints the module's counts rather than dividing them",
    /\{value\.hit\} of \{value\.sampleSize\}/.test(page),
  );
  ok(
    "…and contains no percentage arithmetic of its own",
    !/\/\s*value\.sampleSize/.test(page) && !/\*\s*100/.test(page),
    page.match(/\*\s*100[^\n]*/)?.[0],
  );
  ok("…and states the floor on the page", /report\.floors\.rate/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Commission is summed from the ledger, reversal included");
// ═══════════════════════════════════════════════════════════════════════════
{
  // The brief's scenario: a ledger containing a reversal. $20 activation, $40
  // first payment, then the first payment reversed. The rep is owed $20.
  //
  // The fixture carries a row in a PAID batch and a row in an OPEN one on
  // purpose. With only the paid batch, "paid" and "batched" are the same set
  // and a mutation collapsing the two would pass — which it did, the first time
  // this was mutation-tested.
  const entries = [
    { companyId: "c1", milestone: "activation", amountCents: 2000, payoutBatchId: null },
    { companyId: "c1", milestone: "first_payment", amountCents: 4000, payoutBatchId: "b1" },
    { companyId: "c1", milestone: "first_payment", amountCents: -4000, payoutBatchId: null },
    { companyId: "c2", milestone: "activation", amountCents: 2000, payoutBatchId: "b2" },
  ];
  const batches = new Map([
    ["b1", { id: "b1", status: "paid" }],
    ["b2", { id: "b2", status: "open" }],
  ]);
  const c = commissionForRep(entries, batches);

  ok("gross earned is the sum of the positive rows", c.earnedCents === 8000, c);
  ok("reversed is reported separately, not netted away", c.reversedCents === 4000, c);
  ok("the balance nets the reversal out", c.balanceCents === 4000, c);
  ok("paid counts only rows in a batch marked paid", c.paidCents === 4000, c);
  ok(
    "…and NOT a row sitting in a batch that has only been opened",
    c.batchedCents === 6000 && c.paidCents === 4000,
    c,
  );
  ok("owed is the balance less what was actually paid", c.owedCents === 0, c);
  ok("the reversal is counted, so the screen can mention it", c.reversalCount === 1, c);

  // The ORIGINAL row keeps its amount and its status. A reversal is a new row.
  ok(
    "nothing in the ledger was rewritten to produce those figures",
    entries[1].amountCents === 4000 && entries[2].amountCents === -4000,
  );

  // A milestone earned and then reversed is NOT reached.
  const reached = milestoneCompanies(entries);
  ok("activation is still reached", reached.activation.has("c1"), [...reached.activation]);
  ok(
    "a reversed first payment is NOT a reached milestone",
    !reached.first_payment.has("c1"),
    [...reached.first_payment],
  );

  // Two companies, one reversed and one not, must not cancel each other out.
  const twoCompanies = milestoneCompanies([
    { companyId: "c1", milestone: "activation", amountCents: 2000 },
    { companyId: "c1", milestone: "activation", amountCents: -2000 },
    { companyId: "c2", milestone: "activation", amountCents: 2000 },
  ]);
  ok(
    "a reversal on one company does not remove another company's milestone",
    !twoCompanies.activation.has("c1") && twoCompanies.activation.has("c2"),
    [...twoCompanies.activation],
  );

  // No cached total anywhere. SalesPayoutBatch.totalCentsAtClose is explicitly
  // NOT the figure paid from — a reversal landing after the close has to reduce
  // what is owed rather than be papered over.
  const perfSrc = read(FILES.performance);
  ok(
    "the module never reads totalCentsAtClose",
    !/totalCentsAtClose/.test(perfSrc.replace(/`[^`]*`/g, "")),
    perfSrc.match(/totalCentsAtClose[^\n]*/)?.[0],
  );
  ok("…and sums through balanceCents from lib/sales/commission.js", /balanceCents/.test(perfSrc));
  ok(
    "…which it imports rather than reimplements",
    /from "\.\/commission"/.test(perfSrc),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. A rep with no signups, and a rep who has left");
// ═══════════════════════════════════════════════════════════════════════════
{
  const now = new Date("2026-09-02T12:00:00Z");
  const reps = [
    { id: "quiet", name: "Quiet", code: "quiet", active: true, commissionPlanId: "p1" },
    { id: "gone", name: "Gone", code: "gone", active: false, endedAt: new Date("2026-06-01T00:00:00Z"), commissionPlanId: "p1" },
    { id: "busy", name: "Busy", code: "busy", active: true, commissionPlanId: "p1" },
  ];
  const attributions = [
    // Three signups for Busy, all this week — the below-floor scenario.
    { salesRepId: "busy", companyId: "b1", capturedAt: new Date("2026-08-31T09:00:00Z") },
    { salesRepId: "busy", companyId: "b2", capturedAt: new Date("2026-09-01T09:00:00Z") },
    { salesRepId: "busy", companyId: "b3", capturedAt: new Date("2026-09-02T09:00:00Z") },
    // One from before the departed rep left. History.
    { salesRepId: "gone", companyId: "g1", capturedAt: new Date("2026-04-02T09:00:00Z") },
  ];
  const entries = [
    { salesRepId: "gone", companyId: "g1", milestone: "activation", amountCents: 2000, payoutBatchId: null },
    // A milestone the departed rep's company reached AFTER they left. It still
    // earns — lib/sales/commission.js's departedRepStillEarns() is explicit.
    { salesRepId: "gone", companyId: "g1", milestone: "retention", amountCents: 6500, payoutBatchId: null },
  ];

  const rows = buildRepRows({ reps, attributions, entries, batches: [], leads: [], now });
  const quiet = rows.find((r) => r.id === "quiet");
  const gone = rows.find((r) => r.id === "gone");
  const busy = rows.find((r) => r.id === "busy");

  ok("a rep with zero signups is still on the page", Boolean(quiet));
  ok("…showing zero, which is a real count", quiet.signups.total === 0 && quiet.signups.thisWeek === 0, quiet.signups);
  ok("…with no commission and no reversal", quiet.commission.balanceCents === 0 && quiet.commission.reversalCount === 0);
  ok(
    "…and no conversion percentage invented from nothing",
    quiet.leads.winRate.value === null && quiet.leads.conversionRate.value === null,
    quiet.leads,
  );

  ok("a rep with three signups has all three counted", busy.signups.total === 3, busy.signups);
  ok("…and this week is a UTC Monday week", busy.signups.thisWeek === 3, busy.signups);
  ok(
    "…and Busy is ranked first, because the ranking is signups this week",
    rows[0].id === "busy",
    rows.map((r) => r.id),
  );

  ok("a DEACTIVATED rep is still listed", Boolean(gone));
  ok("…with their signup history intact", gone.signups.total === 1, gone.signups);
  ok("…and their ledger intact", gone.commission.balanceCents === 8500, gone.commission);
  ok("…including a milestone their company reached after they left", gone.milestones.retention === 1, gone.milestones);
  ok("…and their departure date, so the row is not confusing", Boolean(gone.endedAt));
  ok("…and marked inactive rather than quietly dropped", gone.active === false);

  const perfPage = read(FILES.perfPage);
  ok("the dashboard renders a deactivated rep's status", /Deactivated \{day\(rep\.endedAt\)\}/.test(perfPage));
  ok("…saying the history is kept", /history kept/.test(perfPage));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The funnel names what it cannot see");
// ═══════════════════════════════════════════════════════════════════════════
{
  // earnMilestone() writes NOTHING for a rep with no commission plan, so their
  // companies are invisible to the ledger-sourced stages. Reporting a smaller
  // number as though it were the number is exactly the failure this file exists
  // to catch.
  const funnel = buildFunnel({
    attributions: [
      { salesRepId: "planned", companyId: "c1" },
      { salesRepId: "unplanned", companyId: "c2" },
    ],
    companies: [
      { id: "c1", stripeChargesEnabled: true },
      { id: "c2", stripeChargesEnabled: true },
    ],
    entries: [{ companyId: "c1", milestone: "first_payment", amountCents: 4000 }],
    unplannedRepIds: ["unplanned"],
  });

  ok("activation comes from the company itself, not the ledger", funnel.stages[1].source === "fact");
  ok("…so both activated companies are counted", funnel.stages[1].count === 2, funnel.stages);
  ok("the payment stages come from the ledger", funnel.stages[2].source === "ledger");
  ok("…and are flagged incomplete when a rep has no plan", funnel.stages[2].incomplete === true);
  ok("…naming how many companies are invisible", funnel.blindCompanies === 1, funnel.blindCompanies);
  ok("…in a sentence a person can act on", /has no commission plan/.test(funnel.incompleteReason || ""), funnel.incompleteReason);

  const clean = buildFunnel({
    attributions: [{ salesRepId: "planned", companyId: "c1" }],
    companies: [{ id: "c1", stripeChargesEnabled: true }],
    entries: [],
    unplannedRepIds: [],
  });
  ok("…and NOT flagged when every rep has a plan", clean.stages[2].incomplete === false && clean.incompleteReason === null);

  // A company that never enabled charges must not be counted as activated just
  // because the column is absent from the row.
  const missing = buildFunnel({
    attributions: [{ salesRepId: "r", companyId: "c9" }],
    companies: [{ id: "c9" }],
    entries: [],
    unplannedRepIds: [],
  });
  ok("a company with no charges flag is not counted as activated", missing.stages[1].count === 0, missing.stages[1]);
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Leads, and the two denominators that are not the same question");
// ═══════════════════════════════════════════════════════════════════════════
{
  const pipeline = buildLeadPipeline([
    { status: "new" },
    { status: "contacted" },
    { status: "demoed" },
    { status: "signed", convertedCompanyId: "c1" },
    { status: "lost" },
    { status: "wandered_off" },
  ]);
  ok("every documented status has a column", pipeline.byStatus.length === 5, pipeline.byStatus);
  ok("…counted correctly", pipeline.counts.new === 1 && pipeline.counts.signed === 1);
  ok(
    "a status outside the documented five is counted and REPORTED, not silently dropped",
    pipeline.unknownStatus === 1 && pipeline.total === 6,
    pipeline,
  );
  ok("the win rate is over DECIDED leads", pipeline.winRate.sampleSize === 2, pipeline.winRate);
  ok("the conversion rate is over EVERY lead", pipeline.conversionRate.sampleSize === 6, pipeline.conversionRate);
  ok("both are suppressed below the floor", pipeline.winRate.value === null && pipeline.conversionRate.value === null);
  ok("an empty pipeline yields zeros, not nulls, for the counts", buildLeadPipeline([]).total === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. What the dashboard refuses to print");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("there is a NOT_TRACKED list", Array.isArray(NOT_TRACKED) && NOT_TRACKED.length >= 3);
  for (const entry of NOT_TRACKED) {
    ok(`${entry.key} has a label`, typeof entry.label === "string" && entry.label.length > 3);
    ok(
      `${entry.key} gives a reason long enough to be one`,
      typeof entry.reason === "string" && entry.reason.length > 120,
      entry.reason,
    );
    // A reason that opens by restating the label says nothing. This is the
    // shape a "not tracked" panel decays into, and prefixing one is exactly the
    // mutation that slipped past a length check.
    ok(
      `${entry.key} does not open with a content-free phrase`,
      !/^\s*(not available|not tracked|unavailable|coming soon|n\/a|tbd)\b/i.test(entry.reason),
      entry.reason.slice(0, 40),
    );
    // It has to name a real thing — a model, a file, a column — so a reader can
    // go and check whether the gap is still true. Every current reason names at
    // least one camel-humped identifier from the schema or the repo.
    ok(
      `${entry.key} names something in the codebase that is actually missing`,
      /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/.test(entry.reason),
      entry.reason,
    );
  }
  const keys = NOT_TRACKED.map((n) => n.key);
  ok("cost per acquisition is refused — nothing holds what a rep costs", keys.includes("costPerAcquisition"));
  ok("call and talk-time metrics are refused — there is no human calling path", keys.includes("callsAndTalkTime"));

  const page = read(FILES.perfPage);
  ok("the dashboard renders the list", /report\.notTracked\.map/.test(page));
  ok(
    "…and says why a zero would be wrong",
    /would read as a measurement/.test(prose(FILES.perfPage)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. The dashboard is superadmin-only and cannot write");
// ═══════════════════════════════════════════════════════════════════════════
{
  const src = read(FILES.perfRoute);
  const get = functionBody(src, "GET");
  ok("the performance route has a GET", Boolean(get));
  ok("…which refuses anything below superadmin", /admin\.role !== "superadmin"/.test(get) && /status:\s*403/.test(get), get);
  ok("…and refuses an unauthenticated caller", /status:\s*401/.test(get), get);

  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    ok(
      `the performance route has no ${method} handler`,
      !new RegExp(`export async function ${method}\\b`).test(src),
    );
  }

  // The property that matters most: a rep must never gain a write path to
  // attribution or commission. Walked over every route under the rep's own
  // API rather than asserted about one file.
  const salesApi = [];
  (function walk(dir) {
    for (const name of readdirSync(join(ROOT, dir))) {
      const child = join(dir, name);
      if (statSync(join(ROOT, child)).isDirectory()) walk(child);
      else if (name === "route.js") salesApi.push(relative(".", child));
    }
  })("app/api/sales");

  ok("there are rep-facing routes to check", salesApi.length > 0, salesApi.length);
  for (const file of salesApi) {
    const routeSrc = read(file);
    const writes = /\.(salesAttribution|salesCommissionEntry|salesPayoutBatch)\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)/.exec(
      routeSrc,
    );
    ok(`${file} cannot write attribution, commission or payouts`, writes === null, writes?.[0]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. Both screens are reachable, English-only, and honest about UTC");
// ═══════════════════════════════════════════════════════════════════════════
{
  const sidebar = read(FILES.sidebar);
  ok(
    "the dashboard has a nav row — an orphan page is a page nobody finds",
    /href: "\/platform\/sales\/performance"/.test(sidebar),
  );
  ok("the reps screen still has one", /href: "\/platform\/sales\/reps"/.test(sidebar));

  // The console is English-only by convention: 0 of 30 existing pages use i18n.
  for (const file of [FILES.repsPage, FILES.perfPage]) {
    const src = read(file);
    ok(`${file} adds no t() to the platform console`, !/\bt\(["'`]/.test(src), src.match(/\bt\(["'`][^\n]*/)?.[0]);
  }

  // bucketSignups is UTC and Monday-based, and the screen has to say so rather
  // than let a rep in Kyiv assume it is their day.
  const page = read(FILES.perfPage);
  ok("the dashboard says the day boundaries are UTC", /UTC/.test(page));
  ok(
    "…and says lifetime figures ignore the selected period",
    /ignore the period/.test(page),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("14. The whole report holds together");
// ═══════════════════════════════════════════════════════════════════════════
{
  const report = buildSalesPerformance({
    reps: [{ id: "r1", name: "Dana", code: "dana", active: true, commissionPlanId: "p1" }],
    attributions: [{ salesRepId: "r1", companyId: "c1", capturedAt: new Date("2026-09-01T00:00:00Z") }],
    entries: [
      { salesRepId: "r1", companyId: "c1", milestone: "activation", amountCents: 2000, payoutBatchId: null },
    ],
    batches: [],
    leads: [],
    companies: [{ id: "c1", stripeChargesEnabled: true }],
    from: new Date("2026-09-01T00:00:00Z"),
    to: new Date("2026-09-30T23:59:59Z"),
    now: new Date("2026-09-02T12:00:00Z"),
  });

  ok("the headline owes what the ledger says", report.headline.owedCents === 2000, report.headline);
  ok("…and nothing has been paid", report.headline.paidCents === 0);
  ok("…and the period count is separate from the lifetime count", report.headline.signupsInPeriod === 1 && report.headline.signupsTotal === 1);
  ok("the funnel is present", report.funnel.stages.length === 4);
  ok("the not-tracked list travels with the report", report.notTracked.length === NOT_TRACKED.length);
  ok("the floor travels with the report, so the screen cannot state a different one", report.floors.rate === RATE_FLOOR);

  // The module must not import a database — that is what makes every assertion
  // above executable offline.
  ok(
    "lib/sales/performance.js imports no database",
    !/@\/lib\/db/.test(read(FILES.performance)),
  );
  ok(
    "lib/sales/repAdmin.js imports no database",
    !/@\/lib\/db/.test(read(FILES.repAdmin)),
  );
  ok(
    "…and repAdmin does not import node:crypto through invite.js, which would break the client bundle",
    !/from "\.\/invite"/.test(read(FILES.repAdmin)),
    read(FILES.repAdmin).match(/from "\.\/invite"[^\n]*/)?.[0],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  `\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
