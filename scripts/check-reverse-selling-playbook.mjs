// scripts/check-reverse-selling-playbook.mjs
//
// The Reverse Selling playbook (lib/sales/playbook/reverseSelling.js): the
// owner's closer call script of 2026-09-30, added BESIDE the four starter
// playbooks and installed switched off.
//
// What this holds, executed rather than read wherever it can be:
//
//   1. it is a valid playbook, switched off, on the general selector, above
//      the four — and the four still win while it is off;
//   2. the referral ask is in Wrap up (close), both branches, with the offer
//      and the early plant;
//   3. every trial, price, seat, crew and referral figure is DERIVED — from
//      TRIAL_DAYS / TRIAL_CARD_REQUIRED, SEAT_LADDER and lib/referrals — and
//      no line carries a hand-typed digit;
//   4. no story names a customer — only the document's "A lot of owners I
//      talk to…" pattern;
//   5. the four starter playbooks render BYTE-IDENTICAL output with the
//      Reverse Selling rows installed (switched off), and match the
//      fingerprints taken on the code before it existed;
//   6. the objection answers the document asks for exist, are found by what
//      a contractor says, follow the five-step answer, are scoped to this
//      playbook and replace (on its screen only) the shared answer to the
//      same objection;
//   7. nothing in it makes a banned move (bannedMoves.js);
//   8. the pieces outside the stage lines — the referral plant beside "stay
//      on the line", the AI call script's trial close, the talking-point
//      rules — appear for this playbook and change nothing for any other;
//   9. the console keeps the rep notes and the objection scope on a save,
//      and "install" creates exactly this playbook, switched off (the
//      dry-run of what the button would write);
//  10. the call coach scores the book-the-demo moves on that playbook's calls
//      only, and the old rubric's output is unchanged;
//  11. version 2 (owner, 2026-10-01): the cold call's next step books a DEMO
//      with two choices of time; no answer on its screen runs past four
//      spoken sentences; every lead source has its own short script; the
//      follow-ups, the seven-part demo, the check-ins and the partner call
//      exist; version 1's long answers survive word for word as Backup; and
//      docs/sales/REVERSE-SELLING-SCRIPTS.md says exactly what the code says;
//  12. version 3 (owner, 2026-10-02): the demo is thirty minutes, from ONE
//      constant (NEXT_STEP_MINUTES.demo → REP_DEMO_MINUTES); the call screen
//      draws ONE script (no stepper, no second script, a switch that swaps it
//      in place); one cold-call script; the playbook opens on every prospect,
//      including one nothing was recorded for, and is refused on any playbook
//      that is not an approach; and a v2 install refreshes to v3.
//
// Run: npm run check:reverse-selling-playbook
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TRIAL_CARD_REQUIRED, TRIAL_DAYS } from "@/lib/pricing";
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { REFEREE_BONUS_MONTHS, REFERRER_BONUS_MONTHS } from "@/lib/referrals";
import { integerInWords } from "@/lib/sales/intel/pageExcerpts";
import { indexProspect } from "@/lib/sales/intel/opportunity";
import { REVERSE_SELLING_APPROACH, REVERSE_SELLING_KEY, approachForPlaybook, isReverseSelling } from "@/lib/sales/playbook/approaches";
import { selectForProspect, objectionsForSelection } from "@/lib/sales/playbook/assemble";
import { shapePlaybookInput } from "@/lib/sales/playbook/admin";
import { bannedMovesIn } from "@/lib/sales/playbook/bannedMoves";
import { seedPlaybooks, validatePlaybook } from "@/lib/sales/playbook/defaults";
import { matchObjectionText, objectionsForPlaybook, objectionsForProspect, seedObjections } from "@/lib/sales/playbook/objections";
import { carriesDisclosure } from "@/lib/sales/playbook/recordingDisclosure";
import {
  DEMO_MINUTES_WORDS,
  DEMO_OFFER,
  PLAN_SENTENCE,
  REFERRAL_OFFER,
  REVERSE_SELLING_PRIORITY,
  REVERSE_SELLING_SELECTOR,
  REVERSE_SELLING_VERSION,
  STARTS_AT,
  TRIAL_DAYS_WORDS,
  reverseSellingBackup,
  seedReverseSellingObjections,
  seedReverseSellingPlaybook,
  spokenSentences,
} from "@/lib/sales/playbook/reverseSelling";
import {
  COLD_SOURCES,
  LEAD_SOURCE_KEYS,
  NOT_A_COLD_CALL,
  SCRIPT_GROUPS,
  SWITCH_LABEL_KEYS,
  callScreenScripts,
  demoBookedNow,
  demoPacing,
  fillScripts,
  leadSourceFor,
  reverseSellingScripts,
} from "@/lib/sales/playbook/reverseSellingScripts";
import { REP_DEMO_MINUTES } from "@/lib/sales/demoBooking/slots";
import { NEXT_STEP_MINUTES } from "@/lib/sales/nextSteps";
import { REFERRAL_ASK } from "@/lib/sales/technique";
import { RETIRED_OBJECTIONS, RETIRED_PLAYBOOKS, isUnedited, objectionFingerprint } from "@/lib/sales/playbook/seedHistory";
import { buildCallScript } from "@/lib/sales/playbook/script";
import { runSelector } from "@/lib/sales/playbook/selectors";
import { REFERRAL_PLANT, STAY_ON_THE_LINE, referralPlantFor } from "@/lib/sales/playbook/stayOnTheLine";
import { builtInObjections, builtInPlaybooks, installDefaults, refreshBuiltIns } from "@/lib/sales/playbook/store";
import { playbookFingerprint } from "@/lib/sales/playbook/seedHistory";
import { REVERSE_SELLING_POINT_RULES, talkingPointPrompt } from "@/lib/sales/playbook/generate";
import {
  CALL_SCRIPT_STYLE_RULES,
  CALL_SCRIPT_SYSTEM,
  callScriptInputHash,
  callScriptInputs,
  callScriptPrompt,
  callScriptStyleRules,
  callScriptSystem,
} from "@/lib/sales/intel/callScript";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import {
  QA_SCHEMA,
  REVERSE_SELLING_QA_PROPERTY,
  REVERSE_SELLING_QA_SECTION,
  REVERSE_SELLING_WEIGHTS,
  analyseReverseSelling,
  analyseTranscript,
  buildQaPrompt,
  overallFrom,
  qaSchemaFor,
  reverseSellingFrom,
  scoreAttempt,
  scoresReverseSelling,
  transcriptForModel,
} from "@/lib/sales/calls/qa";
import { rows as stubRows, writes as stubWrites, resetDbStub } from "./fixtures/dbStub.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");

let passed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) passed += 1;
  else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? "" : `  got: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
  }
}
const section = (t) => console.log(`\n── ${t}`);

const W = integerInWords;
const PB = seedReverseSellingPlaybook();
const OBJ = seedReverseSellingObjections();
const stage = (key) => PB.stages.find((s) => s.stageKey === key);
const allLines = PB.stages.flatMap((s) => [s.say, ...s.prompts]);
const allTips = PB.stages.flatMap((s) => s.tips || []);
const allResponses = OBJ.map((o) => o.response);
const SCRIPTS = reverseSellingScripts();
// Names and part labels are headings ("version 1.0", "1. Agenda") and are
// never read out, so the digit rule is for the lines, notes and sources.
const scriptText = SCRIPTS.flatMap((s) => [s.when, s.source, ...s.lines.map((l) => l.text), ...s.notes]).filter(Boolean);
const scriptHeadings = SCRIPTS.flatMap((s) => [s.name, ...s.lines.map((l) => l.label || "")]).filter(Boolean);
const everything = [...allLines, ...allTips, ...allResponses, ...scriptText];
const script = (key) => SCRIPTS.find((s) => s.key === key);

// The fixtures the BEFORE fingerprints were taken on — the same shapes
// check-sales-playbook.mjs uses.
const cap = (code, value, evidenceIds = [`ev-${code}`]) => ({ code, value, evidenceIds, confidence: 0.9 });
const tech = (technologyCode, isCompetitor) => ({ technologyCode, isCompetitor, evidenceIds: [`ev-${technologyCode}`], confidence: 0.9 });
const SCENARIOS = {
  competitor: indexProspect({ capabilities: [cap("WEBSITE", true), cap("ONLINE_BOOKING", false), cap("PHONE_CONTACT", true)], technologies: [tech("JOBBER", true)] }),
  noWebsite: indexProspect({ capabilities: [cap("WEBSITE", false), cap("PHONE_CONTACT", true)], technologies: [] }),
  bookingGap: indexProspect({ capabilities: [cap("WEBSITE", true), cap("ONLINE_BOOKING", false)], technologies: [] }),
  emailOnly: indexProspect({ capabilities: [cap("WEBSITE", true), cap("EMAIL_CONTACT", true), cap("LEAD_CAPTURE_FORM", false), cap("ONLINE_BOOKING", true)], technologies: [] }),
  nothing: indexProspect({ capabilities: [], technologies: [] }),
};
const PROSPECT = { businessName: "Acme Painting", city: "Ottawa", tradeKey: "painting" };
const REP = { name: "Dana Whitfield", workName: "Dana" };

/** What the rep's screen gets for one prospect: the same composition assemble.js runs. */
function compose({ allPlaybooks, objectionRows, index }) {
  const { playbooks, selection } = selectForProspect({ allPlaybooks, index });
  const objections = objectionsForSelection({ objectionRows, allPlaybooks, selection, index });
  const script = selection.selected
    ? buildCallScript({ playbook: playbooks.find((p) => p.key === selection.selected.key), prospect: PROSPECT, index, rep: REP, points: [], objections })
    : null;
  return { selection, objections, script };
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. A valid playbook, switched off, on the general rule, above the four");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("it validates", validatePlaybook(PB).ok, validatePlaybook(PB).problems);
  ok("its key is the stable approach key", PB.key === REVERSE_SELLING_KEY && isReverseSelling(PB.key) && approachForPlaybook(PB.key) === REVERSE_SELLING_APPROACH);
  ok("…and no starter playbook is an approach", seedPlaybooks().every((p) => approachForPlaybook(p.key) === null));
  ok("it is installed SWITCHED OFF", PB.active === false);
  // Version 3: it opens on EVERY prospect — a business nothing has been
  // recorded for too — so once it is on, nobody falls through to the old AI
  // script (owner, 2026-10-02).
  ok("it opens on every_prospect", PB.selectorKey === REVERSE_SELLING_SELECTOR && REVERSE_SELLING_SELECTOR === "every_prospect");
  ok("every_prospect matches a business nothing has been recorded for", runSelector("every_prospect", SCENARIOS.nothing).matched === true);
  ok("…and is refused on any playbook that is not an approach — a starter can never be put on it",
    seedPlaybooks().every((p) => validatePlaybook({ ...p, selectorKey: "every_prospect" }).problems.includes("selector_needs_approach")) &&
      !validatePlaybook(PB).problems.includes("selector_needs_approach"));
  ok("its priority is above all four", seedPlaybooks().every((p) => p.priority < REVERSE_SELLING_PRIORITY));
  ok("it covers the nine stages", PB.stages.length === 9);
  ok("anything_observed refuses a business nothing has been recorded for", runSelector("anything_observed", SCENARIOS.nothing).matched === false);
  for (const [name, index] of Object.entries(SCENARIOS)) {
    if (name === "nothing") continue;
    const off = selectForProspect({ allPlaybooks: builtInPlaybooks(), index }).selection.selected?.key;
    const on = selectForProspect({ allPlaybooks: builtInPlaybooks().map((p) => (p.key === PB.key ? { ...p, active: true } : p)), index }).selection.selected?.key;
    ok(`${name}: while it is off a starter playbook opens`, off && off !== PB.key, off);
    ok(`${name}: once it is switched on, it opens`, on === PB.key, on);
  }
  ok("switched OFF, a business nothing was recorded for still gets no playbook — exactly as before",
    selectForProspect({ allPlaybooks: builtInPlaybooks(), index: SCENARIOS.nothing }).selection.selected === null &&
      selectForProspect({ allPlaybooks: builtInPlaybooks(), index: SCENARIOS.nothing }).selection.reason === "nothing_observed");
  ok("switched ON, a business nothing was recorded for gets Reverse Selling — every prospect does",
    selectForProspect({ allPlaybooks: builtInPlaybooks().map((p) => ({ ...p, active: true })), index: SCENARIOS.nothing }).selection.selected?.key === PB.key);
  ok("it may not say {competitor} — it can open with no competitor detected",
    !validatePlaybook({ ...PB, stages: [{ stageKey: "open", say: "You run {competitor}.", prompts: [] }] }).ok);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The referral ask is in Wrap up — both branches, the offer, the plant");
// ═══════════════════════════════════════════════════════════════════════════
{
  const close = stage("close");
  ok("Wrap up opens on the booked demo, then the referral ask", /who do you know that could benefit from this too/i.test(close.say) && /You're all set for \[day\] at \[time\]/.test(close.say), close.say);
  ok("…the didn't-book branch is there", close.prompts.some((p) => /If they didn't book/.test(p) && /who do you know that's growing their company/.test(p)));
  ok("…and the asked-for-a-trial branch keeps the owner's congratulations", close.prompts.some((p) => /If they started the trial because they asked/.test(p) && /Congrats/.test(p)));
  ok("…the hesitation helpers are there", close.prompts.some((p) => /a guy you sub for/.test(p)) && close.prompts.some((p) => /wants to scale their business/.test(p)));
  ok("…the referral offer is said", close.prompts.some((p) => p.includes(REFERRAL_OFFER)));
  ok("…with where their link lives", close.prompts.some((p) => /Settings, Refer & Earn/.test(p)));
  ok("…and the details to collect", close.prompts.some((p) => /name, trade, phone number/.test(p)));
  ok("the early plant is a Wrap up note", (close.tips || []).some((t) => /The way I know I did my job is if a month from now/.test(t)));
  ok("…and ask on every call, booked or not", (close.tips || []).some((t) => /Ask on every call, whether they booked or not/.test(t)));
  ok("discovery's 'everything is fine' branch ends politely with a referral ask", (stage("current_process").tips || []).some((t) => /ask for a referral/.test(t)));
  ok("ask-resolve-ask moved to the demo, and a firm no twice still goes to the referral question", script("demo").notes.some((t) => /same firm no twice/.test(t) && /referral question/.test(t)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Trial, price and referral text come from the constants");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the trial is free with no card — the only state the script has a true sentence for", TRIAL_CARD_REQUIRED === false);
  ok("TRIAL_DAYS_WORDS is TRIAL_DAYS in words", TRIAL_DAYS_WORDS === W(TRIAL_DAYS) && TRIAL_DAYS_WORDS.length > 0);
  const rungs = [...SEAT_LADDER].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const r of rungs) {
    ok(`the plan sentence carries ${r.label} at ${r.price}, ${r.seats} seat(s), ${r.crewSeats} crew — in words`,
      PLAN_SENTENCE.includes(`${r.label}, ${W(r.price)}`) && PLAN_SENTENCE.includes(`${r.seats === 1 ? "one seat" : `${W(r.seats)} seats`} and ${W(r.crewSeats)} crew`), PLAN_SENTENCE);
  }
  ok("'what is it?' carries the plan sentence for a rep asked every price", (stage("fit").tips || []).some((t) => t.includes(PLAN_SENTENCE)));
  ok("…and the demo's value part says it", script("demo").lines.some((l) => l.text.includes(PLAN_SENTENCE)));
  ok("the trial, only when asked, says its length and no card", stage("fit").prompts.some((p) => /^Only if they ask/.test(p) && p.includes(`The first ${W(TRIAL_DAYS)} days are free and no card is needed to start`)));
  ok("the demo the call books is REP_DEMO_MINUTES long, in words", DEMO_MINUTES_WORDS === W(REP_DEMO_MINUTES) && DEMO_OFFER === `${W(REP_DEMO_MINUTES)} minutes on a screen`);
  ok("the demo is thirty minutes, from ONE constant: REP_DEMO_MINUTES is the call panel's NEXT_STEP_MINUTES.demo",
    REP_DEMO_MINUTES === NEXT_STEP_MINUTES.demo && REP_DEMO_MINUTES === 30 && DEMO_MINUTES_WORDS === "thirty" &&
      /export const REP_DEMO_MINUTES = NEXT_STEP_MINUTES\.demo;/.test(read("lib/sales/demoBooking/slots.js")));
  // Version 1's own words (Backup) say "ten minutes" for building a quote on
  // the call; they are kept word for word, so they are left out of this one.
  const live = [...allLines, ...allTips, ...allResponses, ...SCRIPTS.filter((s) => s.group !== "backup").flatMap((s) => [...s.lines.map((l) => l.text), ...s.notes])].join(" ");
  // Number words only: "by minute two" in the demo's pacing note is a clock
  // mark, and the word before "minute" there is not a number.
  const NUMBER_WORDS = new Set(Array.from({ length: 121 }, (_, n) => W(n)));
  const minuteWords = [...live.matchAll(/\b([a-z]+(?:-[a-z]+)?)[- ]minutes?\b/gi)].map((m) => m[1].toLowerCase()).filter((w) => NUMBER_WORDS.has(w));
  ok("no live line types a meeting length: every 'N minutes' is REP_DEMO_MINUTES (or the signup's five)", minuteWords.length > 0 && minuteWords.every((w) => w === W(REP_DEMO_MINUTES) || w === "five"), minuteWords);
  ok("…and nothing still says the old fifteen-minute demo", !/fifteen minutes|fifteen-minute/i.test(live), live.match(/[^.]*fifteen[- ]minute[^.]*/i)?.[0]);
  ok("'starts at' is the first rung", STARTS_AT === `${W(rungs[0].price)} dollars a month`);
  ok("the referrer's reward is REFERRER_BONUS_MONTHS, on paying", REFERRAL_OFFER.includes(REFERRER_BONUS_MONTHS === 1 ? "you get a month of FieldQuo free" : `you get ${W(REFERRER_BONUS_MONTHS)} months`) && /signs up and starts paying/.test(REFERRAL_OFFER));
  ok("the newcomer's is REFEREE_BONUS_MONTHS, on their trial, through the link", REFERRAL_OFFER.includes(REFEREE_BONUS_MONTHS === 1 ? "an extra free month" : `${W(REFEREE_BONUS_MONTHS)} extra free months`) && /with your link/.test(REFERRAL_OFFER));
  // Every "free for N days" and every "N dollars" anywhere is a constant.
  const trialMentions = [...everything.join(" ").matchAll(/free for (\w+(?:-\w+)?) days/g)].map((m) => m[1]);
  ok("every 'free for N days' is TRIAL_DAYS", trialMentions.length > 0 && trialMentions.every((w) => w === W(TRIAL_DAYS)), trialMentions);
  const dollars = [...everything.join(" ").matchAll(/((?:\w+[- ])*?\w+) dollars/g)].map((m) => m[1].split(/[,;:]\s*/).pop().trim());
  ok("every '… dollars' is a rung price", dollars.every((d) => rungs.some((r) => d.endsWith(W(r.price)))), dollars);
  // A digit is a hand-typed number. Lines, prompts and answers carry none;
  // notes are held to the same rule so a typed price cannot hide in one.
  ok("no stage line, prompt, note or answer carries a digit", everything.every((t) => !/\d/.test(t)), everything.filter((t) => /\d/.test(t)));
  ok("the two seeds read the constants rather than restating them",
    /from "@\/lib\/pricing"/.test(read("lib/sales/playbook/reverseSelling.js")) &&
      /from "@\/lib\/pricing\/ladder"/.test(read("lib/sales/playbook/reverseSelling.js")) &&
      /from "@\/lib\/referrals"/.test(read("lib/sales/playbook/reverseSelling.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. No story names a customer");
// ═══════════════════════════════════════════════════════════════════════════
{
  const text = everything.join("\n");
  ok("no '[first name]' placeholder", !/\[first name\]/i.test(text));
  ok("no 'I spoke with a …' / 'I talked to a …' single-customer story", !/\bI (?:spoke|talked) (?:with|to) (?:a|an) /i.test(text), text.match(/\bI (?:spoke|talked) (?:with|to) (?:a|an) [^.]*/i)?.[0]);
  // Every reference to people the rep talks to is the document's pattern.
  const PATTERNS = [/A lot of (?:the )?owners I talk to/i, /Most guys I talk to/i, /most of the contractors I call/i];
  const refs = [...text.matchAll(/[^.?!"]*\bI (?:talk|spoke|talked|call)\b[^.?!"]*/gi)].map((m) => m[0].trim());
  ok("every story is the 'A lot of owners I talk to…' pattern", refs.every((r) => PATTERNS.some((p) => p.test(r)) || !/\b(?:owner|owners|guy|guys|contractor|contractors|painter|people)\b/i.test(r)), refs);
  ok("no business is named in a story (no 'Inc', 'Ltd', 'LLC', '& Sons')", !/\b(?:Inc|Ltd|LLC|& Sons)\b/.test(text));
  ok("the story rule itself is on the rep's screen", (stage("objections").tips || []).some((t) => /only tell stories that really happened/.test(t) && /Never invent a customer/.test(t)));
  ok("…and the story bank", (stage("objections").tips || []).some((t) => /Story bank/.test(t)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The four starter playbooks are byte-identical");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Taken on the code BEFORE the Reverse Selling playbook existed (commit
  // 6de80db0), through the same fixtures and the same composition. A
  // deliberate rewrite of the starter words changes these: update them in
  // the same commit, which is the point — nobody changes the working script
  // by accident.
  const BEFORE = {
    seedPlaybooks: "258e521e7bbdebddbede5e5f8260ce85",
    seedObjections: "0ae0891de5c05ec5c27d1cb7e5cb7d8e",
    competitor: "c26a829cd0527faec8a1bbb4fe0dbc83",
    noWebsite: "76ede8cf8870eb5e12316eb189e6354d",
    bookingGap: "7287af7f03f0c357d9af49df07d16d5f",
    emailOnly: "b8ee68c46bab8f94ab2ac5fefdaad437",
    nothing: "90e30d96ae65f71a0994c7ccbd885e1e",
  };
  ok("the four starter playbooks' rows are unchanged", md5(seedPlaybooks()) === BEFORE.seedPlaybooks, md5(seedPlaybooks()));
  ok("the shared objection library is unchanged", md5(seedObjections()) === BEFORE.seedObjections, md5(seedObjections()));
  for (const [name, index] of Object.entries(SCENARIOS)) {
    const installed = compose({ allPlaybooks: builtInPlaybooks(), objectionRows: builtInObjections(), index });
    const without = compose({ allPlaybooks: seedPlaybooks(), objectionRows: seedObjections(), index });
    ok(`${name}: with Reverse Selling installed (off), the screen is what it was before it existed`, md5(installed) === BEFORE[name], md5(installed));
    ok(`${name}: …and identical to a database without it`, md5(installed) === md5(without));
  }
  const starterKeys = new Set(seedPlaybooks().map((p) => p.key));
  const rsCodes = new Set(OBJ.map((o) => o.code));
  for (const [name, index] of Object.entries(SCENARIOS)) {
    // Even switched ON, a starter playbook never shows a Reverse Selling answer.
    const all = builtInPlaybooks().map((p) => (p.key === PB.key ? { ...p, active: true } : p));
    for (const key of starterKeys) {
      const row = all.find((p) => p.key === key);
      const shown = objectionsForPlaybook({ objections: builtInObjections(), playbook: row, playbooks: all });
      if (shown.some((o) => rsCodes.has(o.code))) ok(`${name}/${key}: never shows a Reverse Selling answer`, false);
    }
  }
  ok("a starter stage carries no tips key, so its rendered object is unchanged",
    buildCallScript({ playbook: seedPlaybooks()[0], prospect: PROSPECT, index: SCENARIOS.competitor, rep: REP }).stages.every((s) => !("tips" in s)));
  ok("the starter fingerprints (seedHistory) are unchanged by the tips-aware hash",
    seedPlaybooks().every((p) => playbookFingerprint(p) === playbookFingerprint({ ...p, stages: p.stages.map(({ stageKey, say, prompts }) => ({ stageKey, say, prompts })) })));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The objection answers: found, short, redirected, scoped");
// ═══════════════════════════════════════════════════════════════════════════
{
  const rsOn = { ...PB, active: true };
  const all = [...seedPlaybooks(), rsOn];
  const library = objectionsForPlaybook({ objections: builtInObjections(), playbook: rsOn, playbooks: all });
  const codes = new Set(library.map((o) => o.code));
  const scope = stage("objections");
  ok("it owns every answer it seeds", OBJ.every((o) => scope.ownObjectionCodes.includes(o.code)));
  ok("its screen shows all of them", OBJ.every((o) => codes.has(o.code)));
  ok("…and none of the shared answers it replaces", scope.hideObjectionCodes.every((c) => !codes.has(c)), scope.hideObjectionCodes.filter((c) => codes.has(c)));
  ok("…every one of which is a real shared code", scope.hideObjectionCodes.every((c) => seedObjections().some((o) => o.code === c)));
  // Version 2: every shared answer has a short Reverse Selling version, so a
  // rep on this playbook never reads a six-sentence answer on a cold call.
  ok("every shared answer is replaced on its screen by a short one", seedObjections().every((o) => scope.hideObjectionCodes.includes(o.code)), seedObjections().filter((o) => !scope.hideObjectionCodes.includes(o.code)).map((o) => o.code));
  ok("…so its screen shows its own answers and nothing else", library.every((o) => o.code.startsWith("RS_")), library.filter((o) => !o.code.startsWith("RS_")).map((o) => o.code));
  ok("…and the shared rows themselves are untouched (the starter screens still show them)", md5(seedObjections()) === "0ae0891de5c05ec5c27d1cb7e5cb7d8e");

  // ── No cold-call objection answer runs more than four spoken sentences ──
  // Directions to the rep (in parentheses) are not spoken and not counted.
  for (const o of library) {
    const n = spokenSentences(o.response).length;
    ok(`${o.code}: two to four spoken sentences (${n})`, n >= 2 && n <= 4, spokenSentences(o.response));
  }
  ok("the objections stage's own line is four sentences or fewer", spokenSentences(stage("objections").say).length <= 4, spokenSentences(stage("objections").say));
  ok("spokenSentences counts sentences, not directions", spokenSentences("(Let them answer. Then wait.) One. Two? \"Three.\" Four!").length === 4 && spokenSentences("(Only a direction.)").length === 0);

  // What a contractor says → the Reverse Selling answer, by its cues.
  const HEARD = {
    "I'm busy right now, call me later": "RS_IM_BUSY",
    "I need to talk to my wife first": "RS_PARTNER",
    "I don't have time to learn new software": "RS_NO_TIME_TO_LEARN",
    "Excel works fine for me": "RS_PAPER_WORKS",
    "pen and paper works fine": "RS_PAPER_WORKS",
    "that's too expensive": "RS_TOO_EXPENSIVE",
    "I tried software before and hated it": "RS_TRIED_SOFTWARE",
    "just send me some info": "RS_SEND_INFO",
    "I want to think about it": "RS_THINK_ABOUT_IT",
    "we already use Jobber": "RS_ALREADY_USE_APP",
    "we use housecall pro": "RS_ALREADY_USE_APP",
    "do you have a time clock?": "RS_DO_YOU_HAVE",
    "not interested": "RS_NOT_INTERESTED",
    "I'm not sure": "RS_BEST_WORST_CASE",
    "software is for big companies": "RS_BELIEF_BIG_COMPANIES",
    "I'm not a computer guy": "RS_BELIEF_NOT_COMPUTER_GUY",
    "paperwork is just part of the job": "RS_BELIEF_PAPERWORK_IS_THE_JOB",
    "my customers don't care what the quote looks like": "RS_BELIEF_QUOTE_LOOKS",
    "customers pay when they pay": "RS_BELIEF_PAY_WHEN_THEY_PAY",
    "I'll hire an office person later": "RS_BELIEF_HIRE_OFFICE_LATER",
    "where did you get my number?": "RS_HOW_DID_YOU_GET_MY_NUMBER",
    "is this a sales call?": "RS_IS_THIS_A_SALES_CALL",
    "never heard of you": "RS_NEVER_HEARD_OF_YOU",
    "you want the owner": "RS_WRONG_PERSON",
    "how much is it?": "RS_JUST_TELL_ME_THE_PRICE",
    "am I locked in to a contract?": "RS_CONTRACT_LOCK_IN",
    "who owns my data?": "RS_WHO_OWNS_MY_DATA",
    "my bookkeeper uses quickbooks": "RS_BOOKKEEPER_USES_SOMETHING_ELSE",
    "all my work is word of mouth": "RS_DONT_NEED_A_WEBSITE",
    "every job is different, they need to talk to me": "RS_BOOKING_NOT_FOR_US",
    "they email me, email works": "RS_EMAIL_WORKS_FINE",
    "I've got more work than I can handle": "RS_PLENTY_OF_WORK",
  };
  for (const [heard, code] of Object.entries(HEARD)) {
    const hit = matchObjectionText(heard, library).map((o) => o.code);
    ok(`"${heard}" finds ${code}`, hit.includes(code), hit);
  }
  // The redirect: "let's not decide anything now" (or its kin) + the demo +
  // control handed back. Four answers redirect differently, on purpose: the
  // reflex no (A-S-P, then a question), the wrong person (who and when),
  // and the two "who is this?" answers (the opener's hand-over).
  const OWN_SHAPE = new Set(["RS_NOT_INTERESTED", "RS_WRONG_PERSON", "RS_HOW_DID_YOU_GET_MY_NUMBER", "RS_IS_THIS_A_SALES_CALL"]);
  for (const o of OBJ) {
    if (OWN_SHAPE.has(o.code)) continue;
    const r = o.response;
    ok(`${o.code} redirects to the demo and hands control back`, r.includes(DEMO_OFFER) && /Then you decide/.test(r) && /fair enough\?/i.test(r));
  }
  ok("…and never argues for the trial on the call", OBJ.every((o) => !/start (?:it|the trial|your trial) (?:now|while we're on the phone)/i.test(o.response)));
  ok("the hand-over answers hand over", ["RS_HOW_DID_YOU_GET_MY_NUMBER", "RS_IS_THIS_A_SALES_CALL"].every((c) => /you decide/.test(OBJ.find((o) => o.code === c).response) && /Fair enough\?/.test(OBJ.find((o) => o.code === c).response)));
  ok("the competitor answer links the battlecard and never trashes the app", /battlecard is on the Playbook tab/.test(OBJ.find((o) => o.code === "RS_ALREADY_USE_APP").response) && /Never trash the other app/.test(OBJ.find((o) => o.code === "RS_ALREADY_USE_APP").response));
  ok("'do you have X' never promises it is coming", /Never promise it's coming/.test(OBJ.find((o) => o.code === "RS_DO_YOU_HAVE").response));
  ok("'not interested' keeps the do-not-call switch", /mark do-not-call in the dialer/.test(OBJ.find((o) => o.code === "RS_NOT_INTERESTED").response));
  ok("'where did you get my number' keeps the do-not-call switch", /mark do-not-call in the dialer/.test(OBJ.find((o) => o.code === "RS_HOW_DID_YOU_GET_MY_NUMBER").response));
  ok("the price answer is the first rung, from the ladder", OBJ.find((o) => o.code === "RS_JUST_TELL_ME_THE_PRICE").response.includes(STARTS_AT));
  // The short answers take their cues and context from the shared row they
  // replace, so a rep finds both by the same words.
  for (const o of OBJ.filter((x) => !["RS_IM_BUSY", "RS_PARTNER", "RS_NO_TIME_TO_LEARN", "RS_PAPER_WORKS", "RS_TOO_EXPENSIVE", "RS_TRIED_SOFTWARE", "RS_SEND_INFO", "RS_THINK_ABOUT_IT", "RS_ALREADY_USE_APP", "RS_DO_YOU_HAVE", "RS_NOT_INTERESTED", "RS_BEST_WORST_CASE"].includes(x.code) && !x.code.startsWith("RS_BELIEF_"))) {
    const shared = seedObjections().find((s) => `RS_${s.code}` === o.code);
    ok(`${o.code} is found by the same cues as ${shared?.code}`, shared && md5(o.cues) === md5(shared.cues) && o.contextSelectorKey === (shared.contextSelectorKey ?? null));
  }

  // ── Version 1's long answers: kept word for word, as Backup ─────────────
  const backup = reverseSellingBackup();
  // Version one is the FIRST fingerprint on each of its eighteen codes; v2's
  // follow it (seedHistory.js), and nine answers first shipped in v2 have v2
  // as their only entry.
  ok("every version-one answer is in Backup", backup.length === 18 && backup.every((b) => RETIRED_OBJECTIONS[b.code]?.[0] === objectionFingerprint(b)));
  ok("…word for word (each matches the fingerprint version one shipped with)", backup.every((b) => isUnedited("objection", b.code, objectionFingerprint(b))), backup.filter((b) => !isUnedited("objection", b.code, objectionFingerprint(b))).map((b) => b.code));
  ok("…the busy answer still asks when they won't be busy, and pulls back", /When do you think you won't be busy\?/.test(backup.find((b) => b.code === "RS_IM_BUSY").response) && /leave it here\?/.test(backup.find((b) => b.code === "RS_IM_BUSY").response));
  ok("…the partner answer still plays it out", /What are you afraid of happening\? Let's play it out/.test(backup.find((b) => b.code === "RS_PARTNER").response));
  ok("…best case / worst case is there", /Worst case/.test(backup.find((b) => b.code === "RS_BEST_WORST_CASE").response));
  ok("…and Backup is on the rep's screen beside the scripts", script("backup").lines.length === backup.length && backup.every((b) => script("backup").lines.some((l) => l.text === b.response && l.label === b.label)));
  ok("an unedited version-one or version-two install can be refreshed to version three",
    ["52fdf67b9aaed479", "9243007f25309fb7"].every((f) => RETIRED_PLAYBOOKS.REVERSE_SELLING?.includes(f)) && !isUnedited("playbook", PB.key, playbookFingerprint(PB)) && OBJ.every((o) => !isUnedited("objection", o.code, objectionFingerprint(o))));
  ok("the playbook and its answers are version three", PB.version === REVERSE_SELLING_VERSION && REVERSE_SELLING_VERSION === "3" && OBJ.every((o) => o.version === "3"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. No banned move, and the opener says the call is recorded");
// ═══════════════════════════════════════════════════════════════════════════
{
  const hits = [...everything, ...scriptHeadings].map((t) => ({ t: t.slice(0, 80), moves: bannedMovesIn(t) })).filter((h) => h.moves.length);
  ok("nothing in it makes a banned move", hits.length === 0, hits);
  ok("the referral plant makes none either", Object.values(REFERRAL_PLANT).every((p) => bannedMovesIn(p.say).length === 0));
  ok("the opener carries the recording disclosure", carriesDisclosure(stage("open").say));
  ok("the opener says FieldQuo and who is calling", /FieldQuo/.test(stage("open").say) && /\{repName\}/.test(stage("open").say));
  // Version 2's opener: support, plus control handed over — and the owner's
  // own support sentence kept word for word.
  const open = stage("open").say;
  ok("the opener keeps the owner's support line verbatim",
    open.includes("We support contractors who are doing their quotes and invoices at night after a full day on site. I'm calling to see if that's something we can take off your plate."));
  ok("…admits the call was unexpected without the banned bad-time question", /I know you weren't expecting my call/.test(open) && !/bad time/i.test(open));
  ok("…and lets THEM decide whether to go on", /If it's worth a couple of minutes, I'll ask you two quick questions and you decide from there\. Fair enough\?$/.test(open));
  ok("…with no permission ask (the owner chose support over permission)", !/Can I give you thirty seconds/i.test(open));
  ok("the banned-move sweep still fires on the bad-time admission the book would use", bannedMovesIn("I may be catching you at a bad time").includes("bad-time question"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The pieces outside the stages: for this playbook, and nobody else");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Rep notes render.
  const built = buildCallScript({ playbook: PB, prospect: PROSPECT, index: SCENARIOS.noWebsite, rep: REP });
  ok("its stages render their notes", built.stages.filter((s) => (s.tips || []).length).length >= 8);
  ok("…and its lines render with no hole", built.unresolvedLines === 0, built.unresolvedLines);
  const cp = read("app/components/sales/CallPlaybook.js");
  ok("the call screen draws the notes under the stage, headed in the rep's language", /stage\.tips/.test(cp) && /app\.salesCall\.repTips/.test(cp));
  ok("the reading screen draws them too", /app\.salesCall\.repTips/.test(read("app/sales/playbook/PlaybookView.js")));
  // Referral plant.
  ok("the plant is the document's sentence in English", REFERRAL_PLANT.en.say === "The way I know I did my job is if a month from now you'd tell another contractor about this. Fair enough?");
  ok("…in the three script languages", ["en", "fr", "es"].every((l) => REFERRAL_PLANT[l]?.say && REFERRAL_PLANT[l]?.why));
  ok("…falling back to English and saying so", referralPlantFor("de").language === "en" && referralPlantFor("de").fallback === true && referralPlantFor("fr").fallback === false);
  ok("the three stay-on-the-line sentences are untouched", md5(STAY_ON_THE_LINE) === "ea50aed3630ba26de31892132c5b2426", md5(STAY_ON_THE_LINE));
  ok("CallPlaybook passes the plant only for Reverse Selling", /const plant = isReverseSelling\(data\.playbook\?\.key\)/.test(cp) && (cp.match(/plant=\{plant\}/g) || []).length >= 5);
  const sotl = read("app/components/sales/StayOnTheLine.js");
  ok("StayOnTheLine draws the plant only when asked", /plant \? referralPlantFor\(language\) : null/.test(sotl));
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`the two headings exist in ${lang}`, ["app.salesCall.repTips", "app.salesCall.referralPlant"].every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].length > 0));
  }
  // The AI call script.
  const base = {
    playbook: { name: "Competitive displacement", selectorLabel: "x" },
    stages: [],
    objections: [],
    repName: "Dana Whitfield",
    prospect: { ...PROSPECT, province: "ON" },
    language: "en",
  };
  const plain = callScriptInputs(base);
  const nulled = callScriptInputs({ ...base, approach: null });
  const rs = callScriptInputs({ ...base, approach: REVERSE_SELLING_APPROACH });
  ok("no approach: the inputs carry no approach key, so every stored script's hash stands", !("approach" in plain) && callScriptInputHash(plain) === callScriptInputHash(nulled));
  ok("an unknown approach is ignored, never passed to the model", !("approach" in callScriptInputs({ ...base, approach: "vibes" })));
  ok("Reverse Selling: the inputs say so, and the hash moves (one regeneration on switch-on)", rs.approach === REVERSE_SELLING_APPROACH && callScriptInputHash(rs) !== callScriptInputHash(plain));
  ok("no approach: the system prompt is CALL_SCRIPT_SYSTEM", callScriptSystem(plain) === CALL_SCRIPT_SYSTEM && callScriptSystem(null) === CALL_SCRIPT_SYSTEM);
  ok("no approach: the style rules are CALL_SCRIPT_STYLE_RULES, the same array", callScriptStyleRules(undefined) === CALL_SCRIPT_STYLE_RULES);
  const pPlain = callScriptPrompt(plain);
  const pRs = callScriptPrompt(rs);
  ok("no approach: the prompt sells the fifteen minutes, as before", /closeAsk: sell the meeting/.test(pPlain) && !/Reverse Selling|free trial, started/.test(pPlain));
  ok("Reverse Selling: the close BOOKS THE DEMO with two choices of time, then the referral", /closeAsk: book the demo, as a question with two choices of time/.test(pRs) && pRs.includes(`Let's set up ${W(REP_DEMO_MINUTES)} minutes on a screen — earlier in the week or later, morning or afternoon?`) && /referral ask, which ends every call/.test(pRs) && !/closeAsk: sell the meeting/.test(pRs));
  ok("Reverse Selling: the close asks for the email and foreshadows the meeting", /ask for their email for the invite/.test(pRs) && /foreshadow the meeting/.test(pRs));
  ok("Reverse Selling: the trial only if they asked, never as the close", /no trial unless they asked to start now/.test(pRs) && !pRs.includes(`try it free for ${W(TRIAL_DAYS)} days?`));
  ok("Reverse Selling: the opener is support, then the decision handed over", /hand them the decision/.test(pRs) && /we support contractors who are doing their quotes and invoices at night/.test(pRs) && !/Second: own it — this is a cold call/.test(pRs));
  ok("Reverse Selling: two questions, what/how, never why", /never "why"/.test(pRs) && /the only questions on this call/.test(pRs) && !/Every one is a leading question with two or three answers/.test(pRs));
  ok("Reverse Selling: objection answers are two to four sentences, never argued, stories only the pattern", /two to four sentences/.test(pRs) && /never an argument/.test(pRs) && /A lot of owners I talk to/.test(pRs));
  ok("Reverse Selling: 'what is it?' ends on the demo, never the trial", /It ends by offering the demo/.test(pRs) && /never the trial and never a close/.test(pRs));
  ok("Reverse Selling: exactly three style rules swapped", callScriptStyleRules(REVERSE_SELLING_APPROACH).filter((r, i) => r !== CALL_SCRIPT_STYLE_RULES[i]).length === 3);
  ok("Reverse Selling: the next-step rule is the demo with two choices, trial only on request", callScriptStyleRules(REVERSE_SELLING_APPROACH).some((r) => /^The next step is a .*-minute demo on a screen, booked with two choices of time/.test(r) && /Only if they ask to start now/.test(r)));
  ok("Reverse Selling: the system prompt names the demo, the trial-on-request and the support framing", /SUPPORT the contractor/.test(callScriptSystem(rs)) && callScriptSystem(rs).includes(`book a ${W(REP_DEMO_MINUTES)}-minute demo`) && /Only if the contractor asks to start now/.test(callScriptSystem(rs)) && callScriptSystem(rs).includes(W(TRIAL_DAYS)) && !/\d/.test(callScriptSystem(rs)));
  ok("Reverse Selling: no day name and no digit in the swapped instructions", !/\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i.test(callScriptStyleRules(REVERSE_SELLING_APPROACH).join(" ")) && !/\d/.test(callScriptStyleRules(REVERSE_SELLING_APPROACH).join(" ")));
  ok("Reverse Selling: the trial length is spelled, never a digit", !pRs.includes(`${TRIAL_DAYS} days`) && !callScriptSystem(rs).includes(`${TRIAL_DAYS} days`));
  const handler = read("lib/sales/pipeline/handlers/generateCallScript.js");
  ok("the pipeline passes the approach and the per-call system prompt",
    /approach: playbook\?\.found \? approachForPlaybook\(playbook\.selection\?\.selected\?\.key\) : null/.test(handler) &&
      (handler.match(/system: callScriptSystem\(inputs\)/g) || []).length === 2 && !/system: CALL_SCRIPT_SYSTEM/.test(handler));
  // The talking-point prompt.
  const ctx = { byCode: new Map(), matrix: [] };
  const tpPlain = talkingPointPrompt({ prospect: PROSPECT, playbook: { key: "COMPETITIVE_DISPLACEMENT", name: "x", selectorKey: "competitor_detected" }, ctx });
  const tpRs = talkingPointPrompt({ prospect: PROSPECT, playbook: { key: PB.key, name: PB.name, selectorKey: PB.selectorKey }, ctx });
  ok("talking points: the Reverse Selling rules go to that playbook only", tpRs.includes(REVERSE_SELLING_POINT_RULES) && !tpPlain.includes("Reverse Selling"));
  // The QA reviewer sees what the rep saw.
  ok("call QA scopes the library the same way", /objectionsForPlaybook\(\{/.test(read("lib/sales/calls/qa.js")));
  ok("the reading screen hides answers a switched-off playbook owns", /objectionScope\(p\)\.own/.test(read("app/sales/playbook/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The console keeps what it saves; install creates it switched off");
// ═══════════════════════════════════════════════════════════════════════════
{
  const shaped = shapePlaybookInput({ ...PB, priority: PB.priority }, { partial: false });
  ok("a console save of this playbook keeps its notes and its objection scope", !shaped.error && md5(shaped.value.stages) === md5(PB.stages), shaped.error);
  const starter = seedPlaybooks()[0];
  const shapedStarter = shapePlaybookInput({ ...starter, stages: starter.stages.map((s) => ({ ...s, tips: [], ownObjectionCodes: [], hideObjectionCodes: [] })) });
  ok("a console save of a starter playbook stores exactly the shape it always had", !shapedStarter.error && md5(shapedStarter.value.stages) === md5(starter.stages));
  ok("scope codes are refused off the objections stage", Boolean(shapePlaybookInput({ ...PB, stages: [{ stageKey: "open", say: "", prompts: [], ownObjectionCodes: ["RS_IM_BUSY"] }] }).error));
  const editor = read("app/platform/sales/playbooks/page.js");
  ok("the console editor carries notes and scope in the draft and the body", /tips: \(row\?\.tips \|\| \[\]\)\.join/.test(editor) && /out\.ownObjectionCodes = lines\(s\.ownObjectionCodes\)/.test(editor) && /tips: lines\(s\.tips\)/.test(editor));

  // The dry-run of the console's Install button against a database that has
  // the four starter playbooks and the shared library — what production holds
  // as far as this repository knows. Recorded, never written.
  const writes = [];
  const have = { playbooks: seedPlaybooks().map((p) => ({ key: p.key })), objections: seedObjections().map((o) => ({ code: o.code })) };
  const client = {
    salesPlaybook: { findMany: async () => have.playbooks, createMany: (args) => ({ op: "salesPlaybook.createMany", args }) },
    salesObjection: { findMany: async () => have.objections, createMany: (args) => ({ op: "salesObjection.createMany", args }) },
    salesPlaybookExperiment: {},
    salesPlaybookAssignment: {},
    prospectTalkingPoint: {},
    platformAuditLog: { create: (args) => ({ op: "platformAuditLog.create", args }) },
    $transaction: async (ops) => {
      writes.push(...ops);
      return ops;
    },
  };
  const result = await installDefaults({ client, adminId: "dry-run" });
  const pbWrite = writes.find((w) => w.op === "salesPlaybook.createMany");
  const obWrite = writes.find((w) => w.op === "salesObjection.createMany");
  ok("install creates exactly the Reverse Selling playbook", result.playbooksCreated.length === 1 && result.playbooksCreated[0] === PB.key, result.playbooksCreated);
  ok("…switched off", pbWrite?.args?.data?.length === 1 && pbWrite.args.data[0].active === false);
  ok("…and exactly its own answers", obWrite?.args?.data?.length === OBJ.length && obWrite.args.data.every((o) => o.code.startsWith("RS_")));
  ok("…and touches no starter playbook and no shared answer", result.playbooksSkipped === 4 && result.objectionsSkipped === seedObjections().length);
  ok("…with the audit row in the same transaction", writes.some((w) => w.op === "platformAuditLog.create" && w.args.data.action === "sales_playbook_defaults_installed"));
  ok("…installed on the every-prospect rule, as version three", pbWrite?.args?.data?.[0]?.selectorKey === "every_prospect" && pbWrite.args.data[0].version === "3");
  if (process.argv.includes("--print-dry-run")) {
    console.log("\nDRY RUN — what the console's Install button would write:\n" + JSON.stringify({ result, writes: writes.map((w) => ({ op: w.op, rows: w.args?.data })) }, null, 2));
  }

  // ── Refresh: an unedited version-two install comes up to version three ──
  //
  // Version two's words are this version's with the demo at fifteen minutes
  // and two notes that said "beside the scripts" — rebuilt here, and proved to
  // BE version two by the fingerprint seedHistory.js recorded for it. Then the
  // console's "Refresh the built-ins" runs against a database holding the four
  // starters, the shared library and that v2 install: recorded, never written.
  const toV2 = (text) =>
    String(text)
      .replaceAll(`${W(REP_DEMO_MINUTES)} minutes on a screen`, "fifteen minutes on a screen")
      .replaceAll(`Here's how the ${W(REP_DEMO_MINUTES)} minutes go`, "Here's how the fifteen minutes go")
      .replace("are under Backup on the Playbook tab. They're for the demo", "are under Backup, beside the scripts. They're for the demo")
      .replace("the Friday text in Follow-up calls on the Playbook tab.", "the Friday text in Follow-up calls.");
  const v2pb = {
    ...PB,
    selectorKey: "anything_observed",
    version: "2",
    stages: PB.stages.map((st) => ({ ...st, say: toV2(st.say), prompts: st.prompts.map(toV2), ...(st.tips ? { tips: st.tips.map(toV2) } : {}) })),
  };
  ok("version two, rebuilt, is exactly what shipped (the fingerprint seedHistory recorded)", playbookFingerprint(v2pb) === "9243007f25309fb7", playbookFingerprint(v2pb));
  const v2obj = OBJ.map((o) => ({ ...o, response: toV2(o.response), version: "2" }));
  const changedObj = v2obj.filter((o) => objectionFingerprint(o) !== objectionFingerprint(OBJ.find((x) => x.code === o.code)));
  ok("…and every v2 answer that changed is recorded as unedited v2", changedObj.length === OBJ.length - 4 && changedObj.every((o) => isUnedited("objection", o.code, objectionFingerprint(o))), changedObj.filter((o) => !isUnedited("objection", o.code, objectionFingerprint(o))).map((o) => o.code));
  const rwrites = [];
  const rclient = {
    salesPlaybook: { findMany: async () => [...seedPlaybooks(), v2pb], update: (args) => ({ op: "salesPlaybook.update", args }) },
    salesObjection: { findMany: async () => [...seedObjections(), ...v2obj], update: (args) => ({ op: "salesObjection.update", args }) },
    salesPlaybookExperiment: {},
    salesPlaybookAssignment: {},
    prospectTalkingPoint: {},
    platformAuditLog: { create: (args) => ({ op: "platformAuditLog.create", args }) },
    $transaction: async (ops) => {
      rwrites.push(...ops);
      return ops;
    },
  };
  const refreshed = await refreshBuiltIns({ client: rclient, adminId: "dry-run" });
  const pbUpdate = rwrites.find((w) => w.op === "salesPlaybook.update");
  ok("refresh brings the v2 playbook up to v3: the every-prospect rule, version three, the thirty-minute words",
    refreshed.playbooksUpdated === 1 && pbUpdate?.args?.where?.key === PB.key && pbUpdate.args.data.selectorKey === "every_prospect" && pbUpdate.args.data.version === "3" && md5(pbUpdate.args.data.stages) === md5(PB.stages), refreshed);
  ok("…and the v2 answers that offer the demo, and nothing else",
    refreshed.objectionsUpdated === changedObj.length && rwrites.filter((w) => w.op === "salesObjection.update").every((w) => w.args.where.code.startsWith("RS_") && w.args.data.version === "3"));
  ok("…touching no starter playbook and no shared answer, with the audit row in the same transaction",
    rwrites.filter((w) => w.op === "salesPlaybook.update").length === 1 && rwrites.some((w) => w.op === "platformAuditLog.create" && w.args.data.action === "sales_playbook_builtins_refreshed") && refreshed.playbooksKept.length === 0 && refreshed.objectionsKept.length === 0);
  if (process.argv.includes("--print-dry-run")) {
    console.log("\nDRY RUN — what the console's Refresh button would write over an unedited v2 install:\n" + JSON.stringify({
      result: refreshed,
      writes: rwrites.map((w) => (w.op === "salesPlaybook.update"
        ? { op: w.op, key: w.args.where.key, selectorKey: w.args.data.selectorKey, version: w.args.data.version, stages: w.args.data.stages.length }
        : w.op === "salesObjection.update"
          ? { op: w.op, code: w.args.where.code, version: w.args.data.version }
          : { op: w.op, action: w.args.data.action })),
    }, null, 2));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The call coach scores the moves — on Reverse Selling calls, beside the old rubric");
// ═══════════════════════════════════════════════════════════════════════════
{
  const T = [
    { speaker: "rep", start: 0, end: 6, text: "Hi, is that Acme Painting? Dana here from FieldQuo, quick heads-up, this call may be recorded." },
    { speaker: "contractor", start: 6, end: 8, text: "Yeah, who's this?" },
    { speaker: "rep", start: 8, end: 20, text: "Can I give you thirty seconds on why I called? Why do you quote at night? Fair enough?" },
    { speaker: "contractor", start: 20, end: 30, text: "I'm busy, call me later." },
    { speaker: "rep", start: 30, end: 60, text: "Totally fair. Who do you know that could use this? What works better for you, mornings or afternoons?" },
  ];
  const yes = { met: true, evidence: "x" };
  const OLD_SCORES = { identityCheck: yes, permissionAsk: { asked: true, phrasedForYes: true, evidence: "" }, candour: yes, bannedMoves: [], pivot: { delivered: true, afterContractorAnswer: true, evidence: "" }, discovery: { questionCount: 3, turnaroundAsked: false, evidence: "" }, objections: [], nextStep: { offered: true, dated: false, evidence: "" }, closeAsk: yes, gatekeeper: { firstSpeakerDecisionMaker: true, nameObtained: false, timeObtained: false, evidence: "" } };
  const d = analyseTranscript(T, { repName: "Dana", businessName: "Acme Painting" });
  const starter = seedPlaybooks()[0];
  // Taken on the coach BEFORE the moves were added (same fixture). The old
  // schema, the old deterministic half, the old rubric and the old prompt.
  ok("the old scorecard schema is unchanged", md5(QA_SCHEMA) === "c2223359341cf93e2c269335801aaf04", md5(QA_SCHEMA));
  ok("the old deterministic half is unchanged", md5(d) === "7595166d6615ba4cec385c1760b3dc3e", md5(d));
  ok("the old rubric output is unchanged", md5(overallFrom({ deterministic: d, scores: OLD_SCORES })) === "ab77d12537061f32a680fbfda797a834");
  ok("a starter-playbook call's prompt is unchanged",
    md5(buildQaPrompt({ playbook: starter, playbookMatched: true, objections: seedObjections(), transcript: transcriptForModel(T), language: "en", repName: "Dana", businessName: "Acme Painting", callLanguage: "en" })) === "8a28c6a0e4c87cef687f8b772e588dc2");
  ok("…and a no-playbook call's", md5(buildQaPrompt({ playbook: null, playbookMatched: false, objections: [], transcript: transcriptForModel(T), language: "fr", repName: "Dana", businessName: "Acme", callLanguage: "fr" })) === "59eff909aa89286bb036730f618ec4b8");
  ok("the moves rubric sums to 100", Object.values(REVERSE_SELLING_WEIGHTS).reduce((a, b) => a + b, 0) === 100);
  ok("…and scores what the call is for: the demo booked with two choices, short discovery, objections redirected, control, prep, the referral",
    md5(Object.keys(REVERSE_SELLING_WEIGHTS)) === md5(["demoBooked", "twoChoiceTime", "minimalDiscovery", "objectionRedirect", "gaveControl", "prepQuestions", "referralAsk", "noWhy"]),
    REVERSE_SELLING_WEIGHTS);
  ok("…with the demo, the two choices, the redirect and the referral weighted heaviest",
    REVERSE_SELLING_WEIGHTS.demoBooked >= 20 && ["twoChoiceTime", "objectionRedirect", "referralAsk"].every((k) => REVERSE_SELLING_WEIGHTS[k] >= 15));
  ok("a starter call gets QA_SCHEMA itself", qaSchemaFor({ reverseSelling: false }) === QA_SCHEMA && !scoresReverseSelling(starter));
  const rsSchema = qaSchemaFor({ reverseSelling: true });
  const strict = (o) => o?.type !== "object" || (o.additionalProperties === false && Object.keys(o.properties || {}).every((k) => o.required.includes(k)) && Object.values(o.properties).every(strict));
  ok("a Reverse Selling call's schema adds the moves, strict-mode clean", scoresReverseSelling(PB) && rsSchema.properties.reverseSelling && rsSchema.required.includes("reverseSelling") && strict(rsSchema));
  ok("…and adds no number field", !JSON.stringify(REVERSE_SELLING_QA_PROPERTY).includes("\"integer\"") && !JSON.stringify(REVERSE_SELLING_QA_PROPERTY).includes("\"number\""));
  ok("…and the outcome is a closed list that tells a pushed trial from an asked-for one",
    md5(REVERSE_SELLING_QA_PROPERTY.properties.outcome.properties.result.enum) === md5(["demo_booked", "trial_on_request", "trial_pushed", "callback_dated", "none"]));
  const det = analyseReverseSelling(T);
  ok("a 'why' question on the rep's lines is caught", det.whyQuestions.length === 1 && /Why do you quote at night/.test(det.whyQuestions[0].text), det.whyQuestions);
  ok("…'thirty seconds on why I called?' is not — that is the reason, not a why question", !det.whyQuestions.some((w) => /thirty seconds/.test(w.text)) || det.whyQuestions.length === 1);
  ok("'that's exactly why I'm calling?' is not a why question", analyseReverseSelling([{ speaker: "rep", start: 0, end: 2, text: "And that's exactly why I'm calling?" }]).whyQuestions.length === 0);
  ok("'fair enough?' is counted as an agreement check", det.agreementChecks === 1);
  ok("'who do you know' is the referral ask", det.referralAsked === true && det.referralAt === 30);
  ok("the contractor's own 'why' never counts", analyseReverseSelling([{ speaker: "contractor", start: 0, end: 2, text: "Why are you calling?" }]).whyQuestions.length === 0);
  ok("'mornings or afternoons?' is a two-choice time", det.twoChoiceAsks.length === 1 && /mornings or afternoons/.test(det.twoChoiceAsks[0].text), det.twoChoiceAsks);
  const rep = (text) => analyseReverseSelling([{ speaker: "rep", start: 0, end: 2, text }]);
  ok("…so are 'Tuesday or Wednesday' and 'this week or next'", rep("I've got Tuesday or Wednesday open.").twoChoiceAsks.length === 1 && rep("Would this week or next be better?").twoChoiceAsks.length === 1);
  ok("…'you or the office?' is not — both sides have to be times", rep("Is that you or the office?").twoChoiceAsks.length === 0);
  ok("an open 'what time works for you?' is counted, not credited", rep("What time works for you?").openTimeAsks === 1 && rep("What time works for you?").twoChoiceAsks.length === 0);
  const ALL = {
    outcome: { result: "demo_booked", evidence: "" },
    twoChoiceTime: yes,
    minimalDiscovery: yes,
    objectionRedirect: { objectionRaised: true, met: true, evidence: "" },
    gaveControl: yes,
    prepQuestions: yes,
    referralAsked: yes,
    whyQuestions: [],
  };
  const NONE = { whyQuestions: [], twoChoiceAsks: [], referralAsked: false };
  const line = (scores, d0 = NONE) => (key) => reverseSellingFrom({ deterministic: d0, scores }).lines.find((l) => l.key === key).met;
  ok("every move made, no why question → 100", reverseSellingFrom({ deterministic: { ...NONE, referralAsked: true }, scores: ALL }).score === 100);
  ok("one why question loses exactly its line", reverseSellingFrom({ deterministic: det, scores: ALL }).score === 100 - REVERSE_SELLING_WEIGHTS.noWhy);
  ok("a trial the contractor ASKED for counts as the outcome", line({ ...ALL, outcome: { result: "trial_on_request", evidence: "" } })("demoBooked"));
  ok("…a trial the rep PUSHED does not", !line({ ...ALL, outcome: { result: "trial_pushed", evidence: "" } })("demoBooked"));
  ok("…nor a dated callback", !line({ ...ALL, outcome: { result: "callback_dated", evidence: "" } })("demoBooked"));
  ok("prep questions are earned on a booked demo only", !line({ ...ALL, outcome: { result: "trial_on_request", evidence: "" } })("prepQuestions") && line(ALL)("prepQuestions"));
  ok("no objection → the redirect is not owed", line({ ...ALL, objectionRedirect: { objectionRaised: false, met: false, evidence: "" } })("objectionRedirect"));
  ok("an argued objection loses the redirect line", !line({ ...ALL, objectionRedirect: { objectionRaised: true, met: false, evidence: "" } })("objectionRedirect"));
  ok("two choices heard in the transcript earn the line even if the model missed them", line({ ...ALL, twoChoiceTime: { met: false, evidence: "" } }, { ...NONE, twoChoiceAsks: [{ text: "x" }] })("twoChoiceTime"));
  ok("no model reply → no score, not zero", reverseSellingFrom({ deterministic: det, scores: null }).score === null);
  const rsPrompt = buildQaPrompt({ playbook: PB, playbookMatched: true, objections: [], transcript: transcriptForModel(T), language: "en", repName: "Dana", businessName: "Acme Painting", callLanguage: "en" });
  ok("a Reverse Selling call's prompt asks for the moves", rsPrompt.includes(REVERSE_SELLING_QA_SECTION));
  ok("…and says the call's job was to book a demo, not to push the trial", /The job of this call was to BOOK A DEMO, not to close and not to push the free trial/.test(REVERSE_SELLING_QA_SECTION));

  // End to end through scoreAttempt, both kinds of call, on the db stub.
  const MODEL = { ...OLD_SCORES, coaching: ["One.", "Two.", "Three."], reverseSelling: ALL };
  for (const kind of ["starter", "reverse"]) {
    resetDbStub();
    const pbRow = kind === "reverse" ? { ...PB, active: true } : starter;
    stubRows.salesCallAttempt.push({
      id: `att_${kind}`, salesRepId: "rep_1", prospectId: "p1", transcript: T, transcribedAt: new Date("2026-10-01T10:00:00Z"),
      playbookKey: pbRow.key, playbookVersion: pbRow.version, dialledAt: new Date("2026-10-01T09:55:00Z"), talkSeconds: 60, endedAt: null,
      salesRep: { id: "rep_1", name: "Dana Whitfield", workName: "Dana", language: "en" }, prospect: { businessName: "Acme Painting", province: "ON" }, qa: null, recordingMarks: [],
    });
    let sent = null;
    const r = await scoreAttempt(`att_${kind}`, {
      sample: false,
      checkBudgetFn: async () => ({ ok: true }),
      completeFn: async (args) => {
        sent = args;
        args.onUsage?.({ promptTokens: 3000, completionTokens: 700 });
        return { ok: true, data: kind === "reverse" ? MODEL : { ...OLD_SCORES, coaching: MODEL.coaching } };
      },
      recordUsageFn: async () => ({}),
      loadPlaybooksFn: async () => [...seedPlaybooks(), pbRow.key === PB.key ? pbRow : PB],
      loadObjectionsFn: async () => builtInObjections(),
      now: new Date("2026-10-01T10:05:00Z"),
    });
    const w = stubWrites.find((x) => x.model === "salesCallQa" && x.action.startsWith("upsert"));
    if (kind === "starter") {
      ok("starter call: scored with QA_SCHEMA and the 1800-token budget", r.ok && sent.schema === QA_SCHEMA && sent.maxTokens === 1800);
      ok("starter call: no moves scorecard, no moves in the deterministic half", w && !("reverseSellingRubric" in w.data.scores) && !("reverseSelling" in w.data.deterministic));
      ok("starter call: the prompt never mentions Reverse Selling", !/REVERSE SELLING/.test(sent.prompt));
    } else {
      ok("Reverse Selling call: scored with the moves schema", r.ok && sent.schema.properties.reverseSelling && sent.maxTokens > 1800);
      ok("Reverse Selling call: the moves scorecard is stored beside the old rubric", w && w.data.scores.reverseSellingRubric?.score === 100 - REVERSE_SELLING_WEIGHTS.noWhy && Array.isArray(w.data.scores.rubric), w?.data?.scores?.reverseSellingRubric);
      ok("Reverse Selling call: the overall is the OLD rubric's, untouched", w.data.overall === overallFrom({ deterministic: w.data.deterministic, scores: w.data.scores }).overall);
      ok("Reverse Selling call: the reviewer is shown that playbook's own answers", /RS_IM_BUSY|I'm busy right now, call me later/.test(sent.prompt) && !/I'm busy \/ I'm on a job right now/.test(sent.prompt));
    }
  }
  const review = read("app/components/sales/CallQualityReview.js");
  ok("the review screen draws the moves scorecard when there is one", /reverseSellingRubric/.test(review));
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`the moves heading exists in ${lang}`, typeof APP_MESSAGES[lang]["app.salesCallQa.reverseSellingRubric"] === "string");
  }
}


// ═══════════════════════════════════════════════════════════════════════════
section("11. Version 2: the cold call books the demo, and every lead source has its script");
// ═══════════════════════════════════════════════════════════════════════════
{
  // ── The cold call's next step is a demo, with a two-choice time ─────────
  const next = stage("next_step");
  ok("next_step targets the demo", next.say.includes(DEMO_OFFER) && /^Let's do this: let's set up/.test(next.say), next.say);
  ok("…with two concrete choices of day, then morning or afternoon", /\[day\] or \[day\]/.test(next.say) && /morning or afternoon\?$/.test(next.say));
  ok("…never an open 'what time works'", !/what time works|whenever suits|when's good for you/i.test(next.say));
  ok("…then the email for the invite, the foreshadow and the prep questions, in that order", (() => {
    const at = (re) => next.prompts.findIndex((p) => re.test(p));
    const email = at(/best email for the invite/);
    const fore = at(/^Foreshadow:/);
    const prep = at(/^Prep, so the demo is about them/);
    return email === 0 && fore > email && prep > fore;
  })());
  ok("…the prep questions cover trade, crew, what they use now, how they quote, and their biggest worry",
    ["What trade", "how many on the crew", "What are you using now", "how does a quote usually go out", "biggest worry"].every((w) => next.prompts.join(" ").includes(w)));
  ok("…and the trial is there only for a prospect who asks", next.prompts.filter((p) => /trial|free and no card/i.test(p)).every((p) => /^Only if they ask/.test(p)));
  ok("no stage pushes the trial: 'try it free' is never asked for on the call", !allLines.some((l) => /makes sense to try it free|let's get your trial started|start (?:it|your free trial) (?:now|while)/i.test(l)));
  ok("discovery on the call is two questions", stage("discovery").say.endsWith("?") && stage("discovery").prompts.filter((p) => /\?"?$/.test(p)).length === 1);
  ok("the call is laid out as questions, then maybe a demo, nothing decided today", /proper look on a screen another day/.test(stage("relevance").say) && /Nothing gets decided today/.test(stage("relevance").say));

  // ── Every lead source has a script, and each is the short shape ─────────
  ok("the lead sources the owner listed are all here",
    ["cold_call", "signup_unfinished", "trial_not_converted", "link_no_signup", "inbound_caller", "referred_by_customer", "uses_competitor", "former_customer"].every((k) => LEAD_SOURCE_KEYS.includes(k)));
  for (const key of LEAD_SOURCE_KEYS) {
    const s = script(key);
    ok(`${key}: has a script`, Boolean(s) && s.group === "lead_source");
    if (!s) continue;
    const texts = s.lines.map((l) => l.text);
    ok(`${key}: six to ten lines (${texts.length})`, texts.length >= 6 && texts.length <= 10);
    ok(`${key}: almost all questions`, texts.filter((t) => /\?/.test(t)).length >= Math.ceil(texts.length / 2), texts.filter((t) => !/\?/.test(t)));
    ok(`${key}: opens with who is calling and the recording aside`, carriesDisclosure(texts[0]) && /FieldQuo/.test(texts[0]) && /\{repName\}/.test(texts[0]));
    ok(`${key}: books the demo with a two-choice time`, texts.some((t) => t.includes(DEMO_OFFER) && /\[day\] or \[day\]/.test(t)));
    ok(`${key}: ends on the referral question`, texts[texts.length - 1].toLowerCase().includes(REFERRAL_ASK.toLowerCase().replace(/\?$/, "")));
    ok(`${key}: never pushes the trial`, texts.filter((t) => /trial|signup link|free and no card/i.test(t)).every((t) => /^\(Only if they ask|that's them asking|^You've been trying FieldQuo|^If you do try it|^What would have to be true/.test(t)), texts.filter((t) => /trial/i.test(t)));
  }
  // ── ONE cold-call script (owner, 2026-10-02): 1.0 and 2.0 merged ────────
  const cold = script("cold_call");
  ok("one cold-call script: no version 1.0 or 2.0 left", LEAD_SOURCE_KEYS.filter((k) => /^cold/.test(k)).length === 1 && !script("cold_v1") && !script("cold_v2") && SCRIPTS.filter((s) => /cold call/i.test(s.name)).length === 1);
  ok("…based on 1.0, the shortest: nine lines", cold.lines.length === 9);
  ok("…with 2.0's 'who else would want a say' folded into the booking line", cold.lines.some((l) => l.text.includes(DEMO_OFFER) && /for a time when everyone who decides is around/.test(l.text) && /\[day\] or \[day\]/.test(l.text)) && !cold.lines.some((l) => /who else would want a say/.test(l.text)));
  ok("…every line short (thirty-five words at most)", cold.lines.every((l) => l.text.split(/\s+/).length <= 35), cold.lines.map((l) => l.text.split(/\s+/).length));
  ok("…and question-led: all but the support line ask something", cold.lines.filter((l) => !/\?/.test(l.text)).length <= 1, cold.lines.filter((l) => !/\?/.test(l.text)).map((l) => l.text));
  ok("…and its 'what is it?' note says the stage's own words", cold.notes.some((n) => n.includes(stage("fit").say.split(" The easiest")[0])));
  ok("the referred script says the newcomer's month only comes through the referrer's link", script("referred_by_customer").lines.some((l) => l.text.includes("sign up through their link")) && script("referred_by_customer").notes.some((n) => /customer's own link/.test(n)));

  // ── Which script opens first ────────────────────────────────────────────
  ok("a cancelled subscription is a former customer", leadSourceFor({ subscriptionStatus: "canceled", signupKind: "stalled" }) === "former_customer");
  ok("an abandoned signup is 'started, didn't finish'", leadSourceFor({ signupKind: "abandoned" }) === "signup_unfinished");
  ok("a new or stalled signup with no active plan is the trial script", leadSourceFor({ signupKind: "new" }) === "trial_not_converted" && leadSourceFor({ signupKind: "stalled", subscriptionStatus: "trialing" }) === "trial_not_converted");
  ok("…a paying one gets no prospecting script at all", leadSourceFor({ signupKind: "new", subscriptionStatus: "active" }) === null);
  ok("a competitor on their site is the competitor script", leadSourceFor({ competitorDetected: true }) === "uses_competitor");
  ok("anything else is the cold call — researched, or nothing recorded yet", leadSourceFor({}) === "cold_call");
  ok("an unknown signup kind is never guessed into a source", leadSourceFor({ signupKind: "mystery" }) === null);
  const filled = fillScripts(SCRIPTS, { businessName: "Acme Painting", repName: "Dana", first: null });
  ok("the screen fills the business and the rep where it knows them", filled.find((s) => s.key === "cold_call").lines[0].text.startsWith("Hi, is this Acme Painting? It's Dana with FieldQuo"));
  ok("…and leaves a placeholder it does not know visible, never a hole", filled.find((s) => s.key === "trial_not_converted").lines[0].text.startsWith("Hi {first}, it's Dana"));

  // ── The follow-ups, the demo, the check-ins, the partner call ───────────
  const follow = SCRIPTS.filter((s) => s.group === "follow_up");
  ok("three follow-up scripts: hot, later, after the demo", md5(follow.map((s) => s.key)) === md5(["follow_up_hot", "follow_up_later", "follow_up_after_demo"]));
  for (const s of follow) {
    ok(`${s.key}: one to three lines, with a two-choice time`, s.lines.length >= 1 && s.lines.length <= 3 && s.lines.some((l) => /\[day\] or \[day\]/.test(l.text)));
  }
  ok("the later lead opens on what they said last time", /Last time we talked you said/.test(script("follow_up_later").lines[0].text) && /Is that still the case\?/.test(script("follow_up_later").lines[0].text));
  const demo = script("demo");
  const parts = [...new Set(demo.lines.map((l) => (l.label.match(/^(\d)\./) || [])[1]))];
  ok("the demo is seven parts, in order", md5(parts) === md5(["1", "2", "3", "4", "5", "6", "7"]), parts);
  ok("…opens with the agenda and a decision taken together", /we decide together if it makes sense/.test(demo.lines[0].text));
  ok("…says the honesty and the referral up front", /straight with you/.test(demo.lines[1].text) && /tell another contractor/.test(demo.lines[1].text));
  ok("…shows by asking ('if a quote goes out two days late…')", demo.lines.some((l) => /^4\./.test(l.label) && /If a quote goes out two days late, what usually happens\?/.test(l.text)));
  ok("…takes the risk off them with the constants: every plan, every feature, month to month, the trial", demo.lines.some((l) => /^5\./.test(l.label) && l.text.includes(PLAN_SENTENCE) && /month to month/.test(l.text) && l.text.includes(`The first ${W(TRIAL_DAYS)} days are free`)));
  ok("…keeps the owner's cost questions, present, reverse close and ask-resolve-ask", demo.lines.some((l) => /On a scale of one to ten/.test(l.text)) && demo.lines.some((l) => /So you said \[their words from your notes\]/.test(l.text)) && demo.lines.some((l) => /would you feel comfortable running your quotes on this/.test(l.text)) && demo.lines.some((l) => /So with that out of the way/.test(l.text)));
  ok("…and the plan is small yes questions", demo.lines.some((l) => /^7\. The plan/.test(l.label) && /When could you send your first real quote/.test(l.text)));
  const checkins = SCRIPTS.filter((s) => s.group === "check_in");
  ok("four check-ins through the year: new year, before busy, mid-year, before slow", md5(checkins.map((s) => s.key)) === md5(["checkin_new_year", "checkin_busy_season", "checkin_mid_year", "checkin_slow_season"]));
  for (const s of checkins) {
    ok(`${s.key}: gives something useful and ends on the referral question`, s.lines.length >= 3 && s.lines[s.lines.length - 1].text.toLowerCase().includes(REFERRAL_ASK.toLowerCase().replace(/\?$/, "")));
    ok(`${s.key}: says plainly that no check-in caller exists`, s.notes.some((n) => /no check-in caller or queue for this in FieldQuo yet/.test(n)));
  }
  const partner = script("partner");
  ok("the referral-partner call exists, for suppliers, bookkeepers and brokers", partner && /suppliers/.test(partner.when) && /bookkeepers/.test(partner.when) && /insurance brokers/.test(partner.when));
  ok("…is a script, not a programme: no money, no fee, no promise of business", /no partner programme/.test(partner.source) && partner.notes.some((n) => /Never offer money, a fee, a discount or a commission/.test(n)));
  ok("the groups are drawn in the server's order", md5([...new Set(SCRIPTS.map((s) => s.group))]) === md5([...SCRIPT_GROUPS]));

  // ── No digit, no banned move, no invented customer in any script ────────
  ok("no script line or note carries a digit", scriptText.every((t) => !/\d/.test(t)), scriptText.filter((t) => /\d/.test(t)));

  // ── Where the rep sees them ─────────────────────────────────────────────
  const routeSrc = read("app/api/sales/playbook/route.js");
  ok("the call route sends the script for the Reverse Selling playbook only", /if \(!isReverseSelling\(selectedKey\)\) return null;/.test(routeSrc) && /salesScripts: salesScriptsFor\(\{/.test(routeSrc));
  ok("…picking it from what it already read", /leadSourceFor\(\{\s*signupKind: mine\?\.signupKind/.test(routeSrc) && /contextSelectorKey === "competitor_detected"/.test(routeSrc));
  ok("…and sending only the call-screen selection, never every script", /return callScreenScripts\(scripts, \{ suggested, demoNow \}\);/.test(routeSrc) && !/scripts: fillScripts\(/.test(routeSrc));
  const cp = read("app/components/sales/CallPlaybook.js");
  const page = read("app/sales/playbook/page.js");
  ok("the reading screen draws them only while it is switched on", /playbooks\.some\(\(p\) => isReverseSelling\(p\.key\)\) \? reverseSellingScripts\(\) : \[\]/.test(page) && /scripts\.length \? <ReverseSellingScripts scripts=\{scripts\} showIntro \/> : null/.test(read("app/sales/playbook/PlaybookView.js")));
  const comp = read("app/components/sales/ReverseSellingScripts.js");
  ok("the client component never imports the script module (it reads the database through referrals)", !/from "@\/lib\/sales\/playbook\/reverseSellingScripts"|from "@\/lib\/sales\/playbook\/reverseSelling"/.test(comp));
  const KEYS = ["heading", "intro", "forThisLead", "whereFrom", ...SCRIPT_GROUPS.map((g) => `group.${g}`), "notColdCall", "notTheDemo", "tips", "tipsThisScript", "tipsEveryCall", "demoToday", "demoRunning", "noScript"].map((k) => `app.salesScripts.${k}`);
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`the scripts' headings exist in ${lang}`, KEYS.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].length > 0), KEYS.filter((k) => !APP_MESSAGES[lang][k]));
  }
  ok("every group heading the component uses is one of the server's groups", SCRIPT_GROUPS.every((g) => comp.includes(`"app.salesScripts.group.${g}"`)));

  // ── The owner's copy says exactly what the code says ────────────────────
  const doc = read("docs/sales/REVERSE-SELLING-SCRIPTS.md");
  const flatDoc = doc.replace(/\s+/g, " ");
  const missing = [
    ...PB.stages.flatMap((s) => [s.say, ...s.prompts]),
    ...OBJ.map((o) => o.response),
    ...SCRIPTS.filter((s) => s.group !== "backup").flatMap((s) => s.lines.map((l) => l.text)),
  ].filter((t) => t && !flatDoc.includes(t.replace(/\s+/g, " ")));
  ok("docs/sales/REVERSE-SELLING-SCRIPTS.md carries every line, word for word", missing.length === 0, missing.slice(0, 3));
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. Version 3: ONE script on the call screen, and a thirty-minute demo");
// ═══════════════════════════════════════════════════════════════════════════
{
  const SCREEN_GROUPS = new Set(["lead_source", "demo"]);
  // ── One script rendered: callScreenScripts, executed for every source ───
  for (const key of [...LEAD_SOURCE_KEYS, null, "mystery"]) {
    const cs = callScreenScripts(SCRIPTS, { suggested: key });
    const isLead = LEAD_SOURCE_KEYS.includes(key);
    ok(`${key}: exactly one script is shown`, isLead ? cs.shown === key && cs.reason === "lead_source" : cs.shown === null && cs.reason === "no_source", cs.shown);
    ok(`${key}: nothing but that script and its switch's options is sent`,
      cs.scripts.length === (cs.switch ? cs.switch.options.length : cs.shown ? 1 : 0) &&
        cs.scripts.every((s) => SCREEN_GROUPS.has(s.group)) &&
        (!cs.shown || cs.scripts[0].key === cs.shown),
      cs.scripts.map((s) => s.key));
    if (COLD_SOURCES.includes(key)) {
      ok(`${key}: carries the "Not a cold call?" switch to the three undetectable sources, on the same script`,
        cs.switch?.kind === "not_cold" && cs.switch.labelKey === SWITCH_LABEL_KEYS.not_cold && md5(cs.switch.options) === md5([key, ...NOT_A_COLD_CALL]));
    } else if (isLead) {
      ok(`${key}: no switch — its source was detected`, cs.switch === null);
    }
  }
  ok("the three undetectable sources are the owner's three", md5([...NOT_A_COLD_CALL]) === md5(["referred_by_customer", "link_no_signup", "inbound_caller"]));
  ok("no second script on the call screen: follow-ups, check-ins, the partner call and Backup are never sent to it",
    LEAD_SOURCE_KEYS.every((k) => callScreenScripts(SCRIPTS, { suggested: k, demoNow: { at: "x", running: false } }).scripts.every((s) => SCREEN_GROUPS.has(s.group))));

  // ── A demo booked for today shows the demo script INSTEAD ──────────────
  const NOW = new Date("2026-10-02T15:00:00.000Z"); // 11:00 in Toronto
  const at = (iso, extra = {}) => ({ startAt: new Date(iso), endAt: null, status: "scheduled", type: "demo", ...extra });
  const later = demoBookedNow([at("2026-10-02T19:00:00.000Z")], { now: NOW, timeZone: "America/Toronto" });
  ok("a demo later today is found", later?.at === "2026-10-02T19:00:00.000Z" && later.running === false, later);
  ok("…a demo running now is found, and says so", demoBookedNow([at("2026-10-02T14:45:00.000Z")], { now: NOW, timeZone: "America/Toronto" })?.running === true);
  ok("…one that has ended is not (no end time = one demo long)", demoBookedNow([at(new Date(NOW.getTime() - (REP_DEMO_MINUTES + 1) * 60_000).toISOString())], { now: NOW, timeZone: "America/Toronto" }) === null);
  ok("…tomorrow's is not today's", demoBookedNow([at("2026-10-03T14:00:00.000Z")], { now: NOW, timeZone: "America/Toronto" }) === null);
  ok("…a cancelled or done one never counts", demoBookedNow([at("2026-10-02T19:00:00.000Z", { status: "cancelled" }), at("2026-10-02T19:30:00.000Z", { status: "done" })], { now: NOW, timeZone: "America/Toronto" }) === null);
  ok("…'today' is the rep's day: 21:00 Vancouver on the 2nd is the 3rd in UTC and still today", demoBookedNow([at("2026-10-03T04:00:00.000Z")], { now: new Date("2026-10-02T23:00:00.000Z"), timeZone: "America/Vancouver" })?.at === "2026-10-03T04:00:00.000Z");
  const demoCs = callScreenScripts(SCRIPTS, { suggested: "cold_call", demoNow: later });
  ok("with a demo today the ONE script is the demo, with \"Not the demo?\" back to the call script", demoCs.shown === "demo" && demoCs.reason === "demo_now" && demoCs.demoAt === later.at && demoCs.switch?.kind === "not_demo" && md5(demoCs.switch.options) === md5(["demo", "cold_call"]) && demoCs.scripts.length === 2);

  // ── The component draws one script, and the call screen nothing else ───
  const comp = read("app/components/sales/ReverseSellingScripts.js");
  const callComp = comp.slice(comp.indexOf("export function ReverseSellingCallScript"));
  ok("the call-screen component draws ONE script's lines — never a list of scripts", (callComp.match(/<ScriptLines /g) || []).length === 1 && /<ScriptLines script=\{current\} \/>/.test(callComp) && !/scripts\.map\(\(s\) => \(\s*<Script/.test(callComp));
  ok("…its switch swaps that one script in place (a select over the server's options)", /onChange=\{\(e\) => setChoice\(e\.target\.value\)\}/.test(callComp) && /sw\.options\.map/.test(callComp));
  ok("…and the Tips area is one <details>, closed (no `open`)", (callComp.match(/<details /g) || []).length === 1 && /data-testid="rs-tips"/.test(callComp) && !/<details[^>]*\bopen\b/.test(callComp));
  const cp = read("app/components/sales/CallPlaybook.js");
  const routeSrc = read("app/api/sales/playbook/route.js");
  const branchStart = cp.indexOf("if (callScreen) {");
  const branchEnd = cp.indexOf("\n  return (\n    <div className={container}>", branchStart);
  const rsBranch = branchStart > 0 && branchEnd > branchStart ? cp.slice(branchStart, branchEnd) : "";
  ok("on Reverse Selling the call screen returns its one-script layout first", /const callScreen = plant && typeof data\.salesScripts\?\.reason === "string" \? data\.salesScripts : null;/.test(cp) && rsBranch.includes("<ReverseSellingCallScript"));
  ok("…with NO second script: no stepper, no AI script or its language switch, no signup opener, no turnaround, no trade points",
    !/<AiScript|<ConsoleScript|<ScriptLanguageSwitch|<SignupOpener|<TurnaroundQuestion|<TradePoints|setStageIndex|stageOf/.test(rsBranch), rsBranch.slice(0, 200));
  ok("…the objection answers beneath it, and the after-a-yes box inside Tips", /<ObjectionRail /.test(rsBranch) && /afterYes=\{<StayOnTheLine /.test(rsBranch));
  ok("the full scripts panel is no longer drawn on the call screen (Playbook tab only)", !/<ReverseSellingScripts /.test(cp) && !/import ReverseSellingScripts/.test(cp));
  ok("every other playbook keeps the stepper, the AI script and the signup opener exactly where they were", /<SignupOpener signup=\{data\.prospect\.signup\}/.test(cp) && /<AiScript script=\{data\.callScript\}/.test(cp) && /app\.salesCall\.stageOf/.test(cp));
  ok("the route spends nothing on an AI script the Reverse Selling screen does not show", /if \(!reverseSelling && language !== defaultLanguage/.test(routeSrc) && /available: reverseSelling \? \[\] : SCRIPT_LANGUAGES/.test(routeSrc));
  ok("…and reads today's demo only on that playbook", /demoNow: reverseSelling\s*\? await demoNowFor\(/.test(routeSrc));

  // ── The demo is thirty minutes, and its script is paced for it ─────────
  const demo = script("demo");
  const pace = demoPacing();
  ok("the demo script's name says thirty minutes, from the constant", demo.name === `The demo — ${W(REP_DEMO_MINUTES)} minutes, seven parts`);
  ok("its rep notes are paced for thirty: 'thirty minutes means thirty minutes', then minute marks", demo.notes[0].startsWith(`${W(REP_DEMO_MINUTES)} minutes means ${W(REP_DEMO_MINUTES)} minutes.`) && demo.notes[0].includes(`minute ${W(pace.discoveryBy)}`) && demo.notes[0].includes(`last ${W(pace.close)}`));
  ok("…and the marks add up: open < discovery < show < the end, the close fills the rest", pace.minutes === REP_DEMO_MINUTES && pace.openBy < pace.discoveryBy && pace.discoveryBy < pace.showBy && pace.showBy + pace.close === pace.minutes && pace.discoveryBy - pace.openBy === Math.round(REP_DEMO_MINUTES / 3));
  ok("…a fifteen-minute pacing would differ (the notes are derived, not typed)", demoPacing(15).discoveryBy !== pace.discoveryBy);
  ok("no script, note or answer says fifteen minutes any more", !/fifteen minutes|fifteen-minute/i.test([...scriptText.filter((t) => !reverseSellingBackup().some((b) => b.response === t)), ...allLines, ...allTips, ...allResponses].join(" ")));

  // ── The doc says it ─────────────────────────────────────────────────────
  const doc = read("docs/sales/REVERSE-SELLING-SCRIPTS.md");
  ok("the owner's document says thirty minutes and one script", doc.includes(`**The demo is ${REP_DEMO_MINUTES} minutes**`) && /ONE script/.test(doc) && doc.includes("version " + REVERSE_SELLING_VERSION + ")"));
}

console.log(`\n${failures.length ? `${failures.length} FAILED` : "PASSED"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
