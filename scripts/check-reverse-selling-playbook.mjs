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
//      dry-run of what the button would write).
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
  PLAN_SENTENCE,
  REFERRAL_OFFER,
  REVERSE_SELLING_PRIORITY,
  REVERSE_SELLING_SELECTOR,
  STARTS_AT,
  TRIAL_DAYS_WORDS,
  seedReverseSellingObjections,
  seedReverseSellingPlaybook,
} from "@/lib/sales/playbook/reverseSelling";
import { buildCallScript } from "@/lib/sales/playbook/script";
import { runSelector } from "@/lib/sales/playbook/selectors";
import { REFERRAL_PLANT, STAY_ON_THE_LINE, referralPlantFor } from "@/lib/sales/playbook/stayOnTheLine";
import { builtInObjections, builtInPlaybooks, installDefaults } from "@/lib/sales/playbook/store";
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
const everything = [...allLines, ...allTips, ...allResponses];

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
  ok("it opens on anything_observed", PB.selectorKey === REVERSE_SELLING_SELECTOR && REVERSE_SELLING_SELECTOR === "anything_observed");
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
  ok("switched on, it still opens on nothing for a business nothing was recorded for",
    selectForProspect({ allPlaybooks: builtInPlaybooks().map((p) => ({ ...p, active: true })), index: SCENARIOS.nothing }).selection.selected === null);
  ok("it may not say {competitor} — it can open with no competitor detected",
    !validatePlaybook({ ...PB, stages: [{ stageKey: "open", say: "You run {competitor}.", prompts: [] }] }).ok);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The referral ask is in Wrap up — both branches, the offer, the plant");
// ═══════════════════════════════════════════════════════════════════════════
{
  const close = stage("close");
  ok("Wrap up opens with the signed-up referral ask", /who do you know that could benefit from this too/i.test(close.say) && /Congrats/.test(close.say), close.say);
  ok("…the didn't-sign-up branch is there", close.prompts.some((p) => /If they didn't sign up/.test(p) && /who do you know that's growing their company/.test(p)));
  ok("…the hesitation helpers are there", close.prompts.some((p) => /a guy you sub for/.test(p)) && close.prompts.some((p) => /wants to scale their business/.test(p)));
  ok("…the referral offer is said", close.prompts.some((p) => p.includes(REFERRAL_OFFER)));
  ok("…with where their link lives", close.prompts.some((p) => /Settings, Refer & Earn/.test(p)));
  ok("…and the details to collect", close.prompts.some((p) => /name, trade, phone number/.test(p)));
  ok("the early plant is a Wrap up note", (close.tips || []).some((t) => /The way I know I did my job is if a month from now/.test(t)));
  ok("…and ask on every call, signed up or not", (close.tips || []).some((t) => /Ask on every call, whether they signed up or not/.test(t)));
  ok("discovery's 'everything is fine' branch ends politely with a referral ask", (stage("current_process").tips || []).some((t) => /ask for a referral/.test(t)));
  ok("ask-resolve-ask sends a firm no twice to the referral ask", (stage("next_step").tips || []).some((t) => /same firm no twice/.test(t) && /referral ask/.test(t)));
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
  ok("the present (fit) carries the plan sentence", stage("fit").say.includes(PLAN_SENTENCE));
  ok("the present says the trial length and no card", stage("fit").say.includes(`The first ${W(TRIAL_DAYS)} days are free and no card is needed to start`));
  ok("the close asks for the trial in its own length", stage("next_step").say.includes(`try it free for ${W(TRIAL_DAYS)} days`));
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
section("6. The objection answers: found, five-step, scoped");
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
  ok("…while the shared answers it does not replace stay", ["HOW_DID_YOU_GET_MY_NUMBER", "CONTRACT_LOCK_IN", "WHO_OWNS_MY_DATA", "JUST_TELL_ME_THE_PRICE", "WRONG_PERSON"].every((c) => codes.has(c)));
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
  };
  for (const [heard, code] of Object.entries(HEARD)) {
    const hit = matchObjectionText(heard, library).map((o) => o.code);
    ok(`"${heard}" finds ${code}`, hit.includes(code), hit);
  }
  // The five-step answer: agree, their side, "Let's do this" (or the
  // document's own next step), what's in it for them, control and a check.
  const FIVE_STEP = ["RS_PARTNER", "RS_NO_TIME_TO_LEARN", "RS_PAPER_WORKS", "RS_TOO_EXPENSIVE", "RS_TRIED_SOFTWARE", "RS_SEND_INFO", "RS_THINK_ABOUT_IT", "RS_ALREADY_USE_APP", "RS_DO_YOU_HAVE", "RS_IM_BUSY"];
  for (const code of FIVE_STEP) {
    const r = OBJ.find((o) => o.code === code).response;
    const nextStep = /Let's do this|Give me ten minutes|How about we get them on the phone|That's why I do it with you on the call/.test(r);
    const control = /Fair enough\?|for real\?|when you're both around\?|Then you decide/.test(r);
    ok(`${code} suggests the next step and hands control back`, nextStep && control);
  }
  ok("the busy answer asks when they won't be busy, and pulls back", /When do you think you won't be busy\?/.test(OBJ.find((o) => o.code === "RS_IM_BUSY").response) && /leave it here\?/.test(OBJ.find((o) => o.code === "RS_IM_BUSY").response));
  ok("the partner answer confronts the land mine and plays it out", /What are you afraid of happening\? Let's play it out/.test(OBJ.find((o) => o.code === "RS_PARTNER").response));
  ok("the competitor answer links the battlecard and never trashes the app", /battlecard is on the Playbook tab/.test(OBJ.find((o) => o.code === "RS_ALREADY_USE_APP").response) && /Never trash the other app/.test(OBJ.find((o) => o.code === "RS_ALREADY_USE_APP").response));
  ok("'do you have X' never promises it is coming", /Never promise it's coming/.test(OBJ.find((o) => o.code === "RS_DO_YOU_HAVE").response));
  ok("'not interested' keeps the do-not-call switch", /mark do-not-call in the dialer/.test(OBJ.find((o) => o.code === "RS_NOT_INTERESTED").response));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. No banned move, and the opener says the call is recorded");
// ═══════════════════════════════════════════════════════════════════════════
{
  const hits = everything.map((t) => ({ t: t.slice(0, 80), moves: bannedMovesIn(t) })).filter((h) => h.moves.length);
  ok("nothing in it makes a banned move", hits.length === 0, hits);
  ok("the referral plant makes none either", Object.values(REFERRAL_PLANT).every((p) => bannedMovesIn(p.say).length === 0));
  ok("the opener carries the recording disclosure", carriesDisclosure(stage("open").say));
  ok("the opener says FieldQuo and who is calling", /FieldQuo/.test(stage("open").say) && /\{repName\}/.test(stage("open").say));
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
  ok("Reverse Selling: the close asks for the trial in TRIAL_DAYS, and the referral", pRs.includes(`try it free for ${W(TRIAL_DAYS)} days`) && /referral ask, which ends every call/.test(pRs) && !/closeAsk: sell the meeting/.test(pRs));
  ok("Reverse Selling: the opener is support, not a cold call", /open as someone calling to SUPPORT them/.test(pRs) && !/Second: own it — this is a cold call/.test(pRs));
  ok("Reverse Selling: questions are what/how, never why", /never "why"/.test(pRs) && !/Every one is a leading question with two or three answers/.test(pRs));
  ok("Reverse Selling: objections are the five-step answer, and stories only the pattern", /five-step answer/.test(pRs) && /A lot of owners I talk to/.test(pRs));
  ok("Reverse Selling: exactly three style rules swapped", callScriptStyleRules(REVERSE_SELLING_APPROACH).filter((r, i) => r !== CALL_SCRIPT_STYLE_RULES[i]).length === 3);
  ok("Reverse Selling: the system prompt names the trial and the support framing", /SUPPORT the contractor/.test(callScriptSystem(rs)) && callScriptSystem(rs).includes(W(TRIAL_DAYS)) && !/\d/.test(callScriptSystem(rs)));
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
  if (process.argv.includes("--print-dry-run")) {
    console.log("\nDRY RUN — what the console's Install button would write:\n" + JSON.stringify({ result, writes: writes.map((w) => ({ op: w.op, rows: w.args?.data })) }, null, 2));
  }
}

console.log(`\n${failures.length ? `${failures.length} FAILED` : "PASSED"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
