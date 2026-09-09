// scripts/check-playbook-copy.mjs
//
//   npm run check:playbook-copy
//
// The words a rep says out loud, and the prompt that writes the next ones.
//
// ══ Why this exists ══════════════════════════════════════════════════════
//
// The first version of lib/sales/playbook/defaults.js was written by imagining
// what a sales call sounds like. It reproduced, almost line for line, the
// openers the standard selling texts name as failures: a promise not to waste
// their time (Saylor: suggests you are somebody who might), a bad-time question
// (Saylor: agreeing with you ends the call), and a close a single word could
// end (Futrell: hanging up the telephone on yourself) in a business where 81%
// of sales happen on or after the fifth call (Saylor ch.13).
//
// Rewriting those four scripts fixes four calls. This file is what stops them
// coming back — because the same sentence is easy to write again, and because
// lib/sales/playbook/generate.js writes a sentence for every prospect in every
// campaign, so a good prompt with bad principles reproduces the failure at
// scale.
//
// The reasoning behind every rule is in docs/sales/SCRIPT-PRINCIPLES.md, with
// the study behind each. This file is the enforcement, not the argument.
//
// ══ What is EXECUTED, and what is pinned by hand ═════════════════════════
//
// Executed: the seed library is built by seedPlaybooks() and swept, the
// generator's system prompt is the EXPORTED string that is actually sent to the
// vendor rather than a regex over source, and the prompt assembly is run
// against a fixture prospect with a model deliberately unavailable.
//
// Self-tested: every detector below is fired at the retired sentence it was
// written for. A pattern that has stopped recognising the failure it exists for
// fails loudly here rather than passing silently over copy it no longer reads —
// which is the false pass this project has hit before.
//
// Pinned by hand: whether a concession is TRUE, and whether it could really
// lose the call, cannot be computed. The four are listed below as exact
// substrings. Editing one means editing the table, which is the moment to ask
// Cialdini's question again — a conceded drawback engineered to be costless is
// the Vincent-the-waiter trick, not the move.
//
// ══ Scope: the scripts, the generator prompt, AND the objection library ══
//
// The objection library used to be outside this file's reach, on the argument
// that some of what reads as foreclosure there is correct behaviour. That was
// half true and it protected the wrong three sentences: "I will leave you
// alone", "say so and I will just send it" and "one question and then I will
// go" were the retired close wearing a different coat, and they were being read
// out at the exact moment a prospect had engaged enough to push back.
//
// The half that was true is ONE sentence. "I will take you off the list" said
// to somebody who has actually said they are not interested is the suppression
// promise FieldQuo keeps: the `do_not_call` disposition writes doNotContact
// permanently, and lib/sales/suppression's ALL_CHANNELS default stops the
// email and the texts with it. So the sweep runs over the objection seeds too,
// with ONE exemption, and the exemption has a condition — the promise must say
// what the switch actually does. A promise made to sound reasonable does not
// qualify; a promise we keep does.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The prompt assembly must run with no model whatever the developer's
// environment says. Set before any module reads it — `isAiConfigured()` reads
// process.env at call time, so this is enough.
delete process.env.OPENAI_API_KEY;

import { seedPlaybooks } from "../lib/sales/playbook/defaults.js";
import {
  MAX_GENERATED_POINTS,
  TALKING_POINT_SYSTEM,
  generateTalkingPoints,
  talkingPointPrompt,
  talkingPointSchema,
} from "../lib/sales/playbook/generate.js";
import { seedObjections } from "../lib/sales/playbook/objections.js";
import {
  RETIRED_OBJECTIONS,
  RETIRED_PLAYBOOKS,
  isUnedited,
  objectionFingerprint,
  playbookFingerprint,
} from "../lib/sales/playbook/seedHistory.js";
import { talkingPointContext } from "../lib/sales/playbook/talkingPoints.js";
import { capabilityMatrix } from "../lib/sales/intel/capabilities.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
/** Returns the verdict — see check-sales-rule-admin.mjs on `ok()` returning undefined. */
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

const PLAYBOOKS = seedPlaybooks();
const stageOf = (p, key) => p.stages.find((s) => s.stageKey === key);
const sayOf = (p, key) => stageOf(p, key)?.say ?? "";
const promptsOf = (p, key) => stageOf(p, key)?.prompts ?? [];

// ═══════════════════════════════════════════════════════════════════════════
// The retired script. Kept verbatim, because it is the test material.
// ═══════════════════════════════════════════════════════════════════════════
//
// These are the actual sentences that were deleted. They are here so every
// detector can be fired at the thing it was built for, and so a reader can see
// what "reintroducing the old opener" means without going through git.
const RETIRED = Object.freeze({
  opener:
    "Hi — is that Eco Painting? It's Dan at FieldQuo. I'll be ninety seconds and then you can " +
    "tell me to go away. Have I caught you on site?",
  opener_two_minutes:
    "Hi — Eco Painting? It's Dan at FieldQuo. Two minutes, and it's about where your work comes " +
    "from rather than anything technical. All right?",
  opener_ninety:
    "Hi — is that Eco Painting? Dan at FieldQuo. Ninety seconds about your website, and I've " +
    "actually looked at it. Have you got a minute?",
  opener_is_now_bad:
    "Hi — Eco Painting? It's Dan at FieldQuo. Ninety seconds about how quotes come in to you. Is now bad?",
  close:
    "So — Thursday, and I'll send the quote across before then so you've already seen it. If it " +
    "doesn't look better than what you send now, say so and that's the end of it. Thanks for the " +
    "ninety seconds.",
  close_thanks: "Right — three photos to the number I'm ringing from, and I'll call you Thursday morning. Thanks for your time.",
});

// The three objection responses that were retired for the same fault. Kept
// verbatim for the same reason as RETIRED above: every detector below is fired
// at the sentence it was built for, so a pattern that has stopped recognising
// the failure fails loudly instead of passing over a rewrite of it.
const RETIRED_OBJECTION = Object.freeze({
  competitor:
    "The one thing worth two minutes is whose name the homeowner sees. If that is not a " +
    "problem you have, I will leave you alone.",
  send_info:
    "And can I put fifteen minutes in for Thursday so it does not sit unread? If you would " +
    "rather I did not, say so and I will just send it.",
  not_interested:
    "Understood. One question and then I will go: when a quote goes out, is that you at the " +
    "kitchen table at nine? If it is not, I have nothing to sell you and I will take you off " +
    "the list.",
});

// ═══════════════════════════════════════════════════════════════════════════
// The banned moves. Each one names its source and the sentence it retired.
// ═══════════════════════════════════════════════════════════════════════════
const BANNED = [
  {
    move: "apology",
    why:
      "Futrell ch.10, what fails on arrival: do not apologise for taking the prospect's time. " +
      "Saylor names the same move in its list of openings to avoid.",
    pattern:
      /\b(?:sorry (?:to|for|about)|apolog(?:y|ies|ise|ize|ising|izing)|thanks? (?:you )?for (?:your|the) time|thanks for the ninety seconds)\b/i,
    fires: [RETIRED.close, RETIRED.close_thanks],
  },
  {
    move: "time-limit promise",
    why:
      "Saylor ch.9 §2: 'I promise I'm not going to waste your time' suggests you are somebody " +
      "who might. It conveys a lack of confidence and sets a negative tone.",
    pattern: new RegExp(
      [
        "\\bninety seconds\\b",
        "\\bwon'?t (?:waste|take up|take much of|keep you)\\b",
        "\\bnot going to waste your time\\b",
        "\\b(?:i'?ll|i will) (?:be|only be|only take|take) (?:about )?(?:a |one |two |three |five |ten |fifteen )?(?:seconds?|minutes?)\\b",
        "\\b(?:this|it) (?:will|'ll) only take\\b",
        "\\b(?:two|three|five|ten|ninety) (?:seconds|minutes)\\s*,\\s*and\\b",
        "\\bi'?ll be (?:quick|brief)\\b",
      ].join("|"),
      "i",
    ),
    fires: [RETIRED.opener, RETIRED.opener_two_minutes, RETIRED.opener_ninety, RETIRED.close],
  },
  {
    move: "bad-time question",
    why:
      "Saylor ch.9 §2, the telephone don'ts: never ask 'did I catch you at a bad time?' — the " +
      "prospect simply agrees, and agreeing ends the call. Ask whether it is a GOOD time.",
    pattern:
      /\b(?:bad time|bad moment|is now bad|have i caught you|did i catch you|caught you (?:on site|at|mid)|are you busy)\b/i,
    fires: [RETIRED.opener, RETIRED.opener_is_now_bad],
  },
  {
    move: "yes/no opener",
    why:
      "Futrell ch.10: never phrase a direct question so that a single word ends the " +
      "conversation — he calls it hanging up the telephone on yourself. Saylor's type case is " +
      "'would you be interested in saving money?'.",
    pattern:
      /\b(?:would you be interested|have you got a minute|got a second|all right\?|okay\?|interested\?)/i,
    fires: [RETIRED.opener_two_minutes, RETIRED.opener_ninety],
  },
  {
    move: "manufactured scarcity",
    why:
      "Cialdini ch.7. The vacuum-cleaner script he infiltrated ('I can't come back and sell it " +
      "to you later') had a stated internal purpose: to stop the prospect thinking it over. " +
      "There is no real scarcity in a subscription, so any limit written here is invented.",
    pattern:
      /\b(?:limited (?:time|number|places|spots|offer)|offer ends|ends (?:on )?(?:monday|tuesday|wednesday|thursday|friday)|this month only|last chance|only a few (?:places|spots|left)|places left|spots left|while it lasts|first come|before (?:the )?prices? go up)\b/i,
    fires: [
      "We've only got a few onboarding places left this month, so I'd want to get you in before Friday.",
    ],
  },
  {
    move: "counterfeit social proof",
    why:
      "Cialdini ch.4 and the epilogue: invented peer counts are the category he says warrants " +
      "boycott. It is also barred by FieldQuo's own non-negotiable 8 — no tenant's data is " +
      "quoted to another.",
    pattern:
      /\b(?:contractors like you|most of our customers|hundreds of (?:contractors|painters|companies)|thousands of (?:contractors|painters|companies)|nine out of ten|9 out of 10|everyone (?:else )?(?:in your area|is moving)|all the other (?:painters|plumbers|contractors))\b/i,
    fires: ["Most of our customers are painters like you, and nine out of ten switch within a month."],
  },
  {
    move: "flattery",
    why:
      "Cialdini ch.5, the North Carolina study: the pure flatterer was liked best, it held even " +
      "though recipients knew he wanted something, and — unlike every other comment type — the " +
      "praise did not have to be accurate. That is a device that exploits the shortcut rather " +
      "than informing it.",
    pattern:
      /\b(?:i love what you|great(?:-| )looking (?:website|site|work)|really impressive|impressive (?:website|work|setup)|you (?:guys )?do (?:great|fantastic|lovely|beautiful) work|beautiful work)\b/i,
    fires: ["I love what you've done with the website — you do beautiful work."],
  },
  {
    move: "foreclosing exit line",
    why:
      "Saylor ch.13: 81% of all sales happen on or after the FIFTH call, and a prospect says no " +
      "about five times before buying. Futrell's twelfth key to a close is to leave the door " +
      "open. In the owner's own twenty conversations not one win closed on first contact.",
    pattern:
      // `i(?:'ll| will)`, not `i'?ll`. The contraction-only version passed over
      // "I will leave you alone" — which is exactly how the objection library
      // was written, since these seeds are expanded throughout. A detector that
      // only catches one spelling of a banned move is a detector that catches
      // whichever spelling the last author did not use.
      /\b(?:that'?s the end of it|tell me to go away|i(?:'ll| will) (?:leave you alone|go away)|i (?:won'?t|will not) (?:call|bother|ring) (?:you )?again|say (?:so|the word) and i(?:'ll| will) (?:go|stop|leave|never)|never (?:call|ring) you again)\b/i,
    fires: [RETIRED.opener, RETIRED.close, RETIRED_OBJECTION.competitor],
  },
];

// Feature nouns that may not appear in an OPENER. Futrell: announcing what you
// sell before the buyer perceives a need raises the odds of a negative
// response. Naming the COMPANY is required by Saylor (name, company and purpose
// inside twenty seconds), so "FieldQuo" is not on this list — what is banned is
// the product.
const PITCH_WORDS = [
  "booking page",
  "booking link",
  "invoicing",
  "scheduler",
  "scheduling",
  "software",
  "platform",
  "crm",
  "subscription",
  "free trial",
  "demo",
  "dashboard",
  "onboarding",
];

// ═══════════════════════════════════════════════════════════════════════════
section("The detectors recognise the sentences they retired");
// ═══════════════════════════════════════════════════════════════════════════
//
// The mutation test, built in. Reintroducing the old opener has to fail this
// file, so the old opener is kept here and every pattern is fired at it.
{
  for (const b of BANNED) {
    ok(
      `"${b.move}" still matches the copy it was written for`,
      b.fires.every((s) => b.pattern.test(s)),
      b.fires.find((s) => !b.pattern.test(s)),
    );
  }

  // The composite: the whole retired opener and the whole retired close, run
  // through the sweep exactly as a seed row would be.
  const retiredHits = (text) => BANNED.filter((b) => b.pattern.test(text)).map((b) => b.move);
  ok(
    "the retired opener trips at least three separate rules",
    retiredHits(RETIRED.opener).length >= 3,
    retiredHits(RETIRED.opener),
  );
  ok(
    "the retired close trips the apology, the time promise and the foreclosure",
    ["apology", "time-limit promise", "foreclosing exit line"].every((m) =>
      retiredHits(RETIRED.close).includes(m),
    ),
    retiredHits(RETIRED.close),
  );
  ok(
    "a mutated seed — the old opener pasted back into a playbook — is caught",
    (() => {
      const mutated = PLAYBOOKS.map((p) => ({
        ...p,
        stages: p.stages.map((s) => (s.stageKey === "open" ? { ...s, say: RETIRED.opener } : s)),
      }));
      return mutated.every((p) => BANNED.some((b) => b.pattern.test(sayOf(p, "open"))));
    })(),
  );

  // And the inverse: the patterns must NOT fire on the sentences that are
  // correct. A detector that matched "Is this a good time?" would force the
  // shipped copy to drop the one move Saylor explicitly prescribes.
  const shouldPass = [
    "Is this a good time?",
    "Then fifteen minutes on Thursday to look at it next to the last one you sent.",
    "If I don't hear anything I'll try you again in a couple of weeks.",
    "I'd rather hear that now than after I've built you something.",
  ];
  for (const s of shouldPass) {
    ok(
      `no rule fires on "${s.slice(0, 40)}…"`,
      BANNED.every((b) => !b.pattern.test(s)),
      BANNED.filter((b) => b.pattern.test(s)).map((b) => b.move),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("No seed script contains a banned move");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("there are four starter playbooks to sweep", PLAYBOOKS.length === 4, PLAYBOOKS.length);

  const lines = [];
  for (const p of PLAYBOOKS) {
    for (const s of p.stages) {
      if (s.say) lines.push({ where: `${p.key}/${s.stageKey}/say`, text: s.say });
      for (const [i, q] of (s.prompts || []).entries()) {
        lines.push({ where: `${p.key}/${s.stageKey}/prompt[${i}]`, text: q });
      }
    }
  }
  ok("the sweep read something, so a clean result means something", lines.length >= 40, lines.length);

  for (const b of BANNED) {
    const hits = lines.filter((l) => b.pattern.test(l.text));
    ok(
      `no script line makes the "${b.move}" move`,
      hits.length === 0,
      hits.map((h) => `${h.where}: ${h.text.slice(0, 90)}`),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("The objection seeds follow the same rules");
// ═══════════════════════════════════════════════════════════════════════════
//
// Saylor ch.11 §2's shape — restate, welcome, answer, next step — and above
// all: never end the sequence in the response. See this file's scope header
// for the one exemption and the condition on it.

/**
 * The suppression promise, and the test of whether it is a real one.
 *
 * "I will take you off the list" is the only sentence in the library allowed
 * to say we will stop, because `do_not_call` writes doNotContact permanently
 * and lib/sales/suppression's ALL_CHANNELS default carries it to the email and
 * the texts. The exemption is conditional on the response SAYING that: a
 * response that promises to stop without saying the promise is permanent and
 * covers every channel is making the retired rhetorical exit with better
 * manners, and it fails.
 */
const SUPPRESSION_PROMISE = /\b(?:do[-\s]not[-\s]call list|take you off the list)\b/i;
const SUPPRESSION_IS_REAL = [
  { what: "says it is permanent", pattern: /\bpermanent\b/i },
  { what: "says it covers the other channels", pattern: /\b(?:email|text)/i },
  {
    what: "distinguishes it from a form of words",
    pattern: /\b(?:a switch|switch in here|rather than a form of words|not a form of words)\b/i,
  },
];

// Bans that apply to a RESPONSE and not to a script line. A script has no
// prospect sentence in front of it; a response does, and the failure mode is
// handing them a one-word way out of the thing being asked for.
const OBJECTION_BANNED = [
  {
    move: "refusal invitation",
    why:
      "Futrell ch.10: never phrase a question so that a single word ends the conversation. In " +
      "a response it is worse than in an opener — the prospect has already engaged, which " +
      "Saylor ch.11 calls a gift, and the sentence hands it back.",
    pattern: new RegExp(
      [
        "\\bif you(?:'d| would) rather i (?:did ?n[o']?t|didn'?t)",
        "\\bsay so and i(?:'ll| will) just\\b",
        "\\bjust say the word\\b",
        "\\bone question and then i(?:'ll| will) go\\b",
        "\\bif not,? (?:no (?:problem|worries)|that'?s fine and i'?ll)\\b",
      ].join("|"),
      "i",
    ),
    fires: [RETIRED_OBJECTION.send_info, RETIRED_OBJECTION.not_interested],
  },
];

{
  const seeds = seedObjections();
  ok("there are eight objection seeds to sweep", seeds.length === 8, seeds.length);

  // Self-test first, exactly as the script detectors are self-tested: a
  // detector that no longer recognises the sentence it retired is worthless,
  // and it fails silently unless it is fired at it.
  for (const b of OBJECTION_BANNED) {
    for (const line of b.fires) {
      ok(`the "${b.move}" detector still recognises the sentence it retired`, b.pattern.test(line), line);
    }
  }
  ok(
    'the "foreclosing exit line" detector recognises the competitor response it retired',
    BANNED.find((b) => b.move === "foreclosing exit line").pattern.test(RETIRED_OBJECTION.competitor),
  );

  // ── The sweep ─────────────────────────────────────────────────────────
  for (const b of BANNED) {
    const hits = seeds.filter((o) => {
      if (!b.pattern.test(o.response)) return false;
      // THE ONE EXEMPTION. A foreclosure that is the suppression promise is
      // allowed — provided it is a real one. Anything else, including a
      // foreclosure in a response that merely mentions the list in passing,
      // is a hit.
      if (b.move !== "foreclosing exit line") return true;
      return !SUPPRESSION_PROMISE.test(o.response);
    });
    ok(
      `no objection response makes the "${b.move}" move`,
      hits.length === 0,
      hits.map((h) => `${h.code}: ${h.response.slice(0, 90)}`),
    );
  }
  for (const b of OBJECTION_BANNED) {
    const hits = seeds.filter((o) => b.pattern.test(o.response));
    ok(
      `no objection response makes the "${b.move}" move`,
      hits.length === 0,
      hits.map((h) => `${h.code}: ${h.response.slice(0, 90)}`),
    );
  }

  // ── The exemption is not a loophole ───────────────────────────────────
  const promising = seeds.filter((o) => SUPPRESSION_PROMISE.test(o.response));
  ok(
    "exactly one response makes the suppression promise",
    promising.length === 1,
    promising.map((p) => p.code),
  );
  ok(
    "…and it is the one said to somebody who has said they are not interested",
    promising[0]?.code === "NOT_INTERESTED",
    promising[0]?.code,
  );
  for (const condition of SUPPRESSION_IS_REAL) {
    ok(
      `…and it ${condition.what}, so it is a switch rather than a form of words`,
      condition.pattern.test(promising[0]?.response || ""),
    );
  }

  // ── Saylor's shape, per response ──────────────────────────────────────
  //
  // Restate and next step are testable; "welcome it" is a tone and is not.
  // Restating is checked as an explicit acknowledgement of what they just
  // said, which is the observable half of Saylor's third strategy.
  const RESTATES =
    /\b(?:so (?:what )?you(?:'re| are)? saying|so (?:you|the|it|that)|understood|agreed|fair|that is the)\b/i;
  const NEXT_STEP =
    /\b(?:tell me|send me|give me|show you|i will (?:build|send|show|set|put|do)|put it next to|look at it|give me one)\b/i;

  for (const o of seeds) {
    ok(`${o.code} opens by restating or conceding what they just said`, RESTATES.test(o.response.slice(0, 140)), o.response.slice(0, 80));
    ok(`${o.code} ends in something the prospect can actually do`, NEXT_STEP.test(o.response));
    // The sequence-ending test, stated positively: the response must not be
    // the last word. NOT_INTERESTED is the exemption and says so in its own
    // sentence — it offers one more conversation BEFORE it offers the list.
    if (o.code === "NOT_INTERESTED") {
      ok(
        "NOT_INTERESTED offers another conversation before it offers the list",
        o.response.indexOf("one more conversation") > 0 &&
          o.response.indexOf("one more conversation") < o.response.search(SUPPRESSION_PROMISE),
      );
    } else {
      ok(
        `${o.code} does not end the sequence`,
        !BANNED.find((b) => b.move === "foreclosing exit line").pattern.test(o.response) &&
          !SUPPRESSION_PROMISE.test(o.response),
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("The opener — Saylor's twenty seconds, and a real reason");
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const p of PLAYBOOKS) {
    const open = sayOf(p, "open");
    ok(`${p.key}: the opener is written`, open.trim().length > 0);

    // Saylor ch.9 §2: name and purpose inside the first twenty seconds.
    // Spoken conversationally at roughly 150 words a minute (the figure Saylor
    // itself uses for a speaker is 125), twenty seconds is about fifty words.
    // Fifty-five is the allowance; past that the opener is no longer the thing
    // the source describes.
    const words = open.split(/\s+/).filter(Boolean).length;
    ok(`${p.key}: the opener is sayable inside twenty seconds`, words <= 55, words);

    ok(`${p.key}: the opener names the rep`, open.includes("{repName}"));
    ok(`${p.key}: the opener names the company`, /\bFieldQuo\b/.test(open));

    // Langer via Cialdini ch.1: a reason lifts a small ask from 60% to 94%.
    // The reason is mandatory. Whether it is a REAL one — the 20-page condition
    // in Langer, Blank & Chanowitz — is the part this cannot compute, so the
    // pinned table below is what holds it.
    ok(
      `${p.key}: the opener states a reason for the call`,
      /\bbecause\b/i.test(open) || /\bthe reason (?:i'?m|i am) calling\b/i.test(open),
      open.slice(0, 80),
    );

    // Saylor: permission is asked, and phrased so YES is the helpful answer.
    ok(`${p.key}: permission is asked, phrased for a yes`, open.includes("Is this a good time?"));

    // Futrell's direct-negative-no rule. The only two questions allowed in an
    // opener are the identity check and the permission question; anything else
    // is a question a single word could end.
    const remaining = open
      .replace(/is that \{businessName\}\?/i, "")
      .replace(/Is this a good time\?/i, "");
    ok(
      `${p.key}: the opener asks no other question a word could end`,
      !remaining.includes("?"),
      remaining.slice(Math.max(0, remaining.indexOf("?") - 60), remaining.indexOf("?") + 2),
    );

    const named = PITCH_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(open));
    ok(`${p.key}: the opener names no product before a need exists`, named.length === 0, named);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("Relevance — research proved, and a concession that could cost us");
// ═══════════════════════════════════════════════════════════════════════════
//
// PINNED BY HAND. Cialdini ch.6: the move only works while the conceded
// drawback is TRUE and material. Listerine's bad taste and Avis being number
// two are secondary and easily outweighed — that is the theatrical version,
// and Vincent the waiter is in the book as a trick because his weakness was
// fabricated. No regex can tell the difference, so each concession is named
// here with the reason it can lose the call, and with where it is verifiable.
const CONCESSIONS = new Map([
  [
    "COMPETITIVE_DISPLACEMENT",
    {
      text: "if that has never once bothered you, I'm the wrong call",
      cost:
        "Tells a contractor who has never thought about branding not to take the meeting — " +
        "which is most of them. Futrell: if the customer has no need, accept it and move on.",
    },
  ],
  [
    "ONLINE_PRESENCE",
    {
      text: "while it's free it carries a small \"Site by FieldQuo\" line at the bottom",
      cost:
        "Volunteers the one place our name appears on a client-facing surface, in a call whose " +
        "whole pitch is white-labelling. True: see the Terms, lib/billing/access.js, and the " +
        "free-tier credit in lib/billing/cancelConsequences.js. Sites are served from a " +
        "fieldquo.com subdomain (lib/site/subdomain.js) and assembled from the company's own " +
        "jobs (lib/site/generateSite.js), both of which are conceded in the same breath.",
    },
  ],
  [
    "BOOKING_GAP",
    {
      text: "a booking page will not bring you one extra enquiry",
      cost:
        "Disqualifies the single most common reason a contractor would say yes. If the diary is " +
        "empty, this is the wrong product and the call ends there.",
    },
  ],
  [
    "QUOTE_AUTOMATION",
    {
      text: "Some people won't fill one in, and those will still land in your inbox exactly as they do now",
      cost: "Concedes that the thing being sold does not solve the case the prospect cares most about.",
    },
  ],
]);
{
  for (const p of PLAYBOOKS) {
    const rel = sayOf(p, "relevance");
    ok(`${p.key}: the relevance stage is written`, rel.trim().length > 0);
    const pinned = CONCESSIONS.get(p.key);
    ok(`${p.key}: a concession is pinned for this playbook`, Boolean(pinned));
    if (pinned) {
      ok(
        `${p.key}: the pinned concession is still in the script`,
        rel.includes(pinned.text),
        `expected to find: ${pinned.text}\n      because: ${pinned.cost}`,
      );
    }
  }
  ok("no concession is pinned for a playbook that no longer exists", CONCESSIONS.size === PLAYBOOKS.length);
}

// ═══════════════════════════════════════════════════════════════════════════
section("Discovery — a survey, not an interrogation");
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const p of PLAYBOOKS) {
    const say = sayOf(p, "discovery");
    // Rackham's SPIN opening via Saylor ch.10 §4: the most important element is
    // getting agreement to ask questions.
    ok(`${p.key}: discovery asks permission before asking`, /\bcan i ask you\b/i.test(say), say.slice(0, 70));
    // Saylor's survey approach: information only, no services and no costs
    // discussed. That is what makes it the non-threatening first contact.
    ok(
      `${p.key}: discovery says no money is being asked about`,
      /nothing about (?:what you charge|money|your prices|your rates)/i.test(say),
      say,
    );
    const prompts = promptsOf(p, "discovery");
    ok(`${p.key}: discovery asks questions rather than talking`, prompts.length >= 2, prompts.length);
    ok(`${p.key}: every discovery prompt is a question`, prompts.every((q) => q.trim().endsWith("?")));
  }

  // Futrell: get the prospect to state the number, so it is their figure and
  // not ours. Every playbook has to ask for one.
  for (const p of PLAYBOOKS) {
    const asks = promptsOf(p, "pain");
    ok(
      `${p.key}: the pain stage asks the prospect for a number`,
      asks.some((q) => /\bhow many\b/i.test(q)),
      asks,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("Next step and close — specific, and the door left open");
// ═══════════════════════════════════════════════════════════════════════════
const DAY = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
// Futrell's twelfth key to a close: leave the door open. What that looks like in
// a sentence — a contingency that keeps the sequence alive if the agreed step
// does not happen.
const KEEPS_DOOR_OPEN =
  /\b(?:try you again|i'?ll call anyway|call you back|we'?ll move it|find you the week after|find another one|take another run|i'?ll bring)\b/i;
{
  for (const p of PLAYBOOKS) {
    const next = sayOf(p, "next_step");
    ok(`${p.key}: the next step is written`, next.trim().length > 0);
    // Barron: ask for something small and specific. "I'll send you some
    // information" is not a next step (stages.js says so too).
    ok(
      `${p.key}: the next step names something concrete`,
      DAY.test(next) || /\bfifteen minutes\b/i.test(next) || /\bthree photos\b/i.test(next),
      next.slice(0, 90),
    );
    ok(
      `${p.key}: the next step does not ask for a purchase decision`,
      !/\b(?:sign up|get started|card details|credit card|start your (?:trial|subscription))\b/i.test(next),
      next,
    );

    const close = sayOf(p, "close");
    ok(`${p.key}: the close is written`, close.trim().length > 0);
    ok(`${p.key}: the close names the specific next step`, DAY.test(close), close.slice(0, 90));
    ok(
      `${p.key}: the close does not invite a refusal`,
      !BANNED.find((b) => b.move === "foreclosing exit line").pattern.test(close),
      close,
    );
    // Saylor ch.13: 81% on or after the fifth call. A close that ends the
    // sequence throws four of them away.
    ok(`${p.key}: the close keeps follow-up open`, KEEPS_DOOR_OPEN.test(close), close.slice(-120));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("The generator prompt forbids each move by name");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the system prompt is exported so it can be asserted on", typeof TALKING_POINT_SYSTEM === "string");
  ok("it is substantial enough to carry the rules", TALKING_POINT_SYSTEM.length > 1500, TALKING_POINT_SYSTEM.length);

  // The exported string must be the one that is actually sent. Asserting on the
  // export alone would pass on a prompt assembled differently at the call site.
  const gen = read("lib/sales/playbook/generate.js").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  ok("the exported prompt is the one handed to the model", /system:\s*TALKING_POINT_SYSTEM/.test(gen));

  // Barron: the only goal of outreach is the next conversation.
  ok(
    "the prompt states the job of the call",
    /earn the next conversation/i.test(TALKING_POINT_SYSTEM) &&
      /not to close/i.test(TALKING_POINT_SYSTEM),
  );

  // Each banned move has to be named. A prompt that forbids "being pushy" in
  // general forbids nothing a model can act on.
  const NAMED = [
    ["apology", /\bAPOLOGY\b/],
    ["time-limit promise", /\bTIME-LIMIT PROMISE\b/],
    ["bad-time question", /\bBAD-TIME QUESTION\b/],
    ["yes/no opener", /\bYES\/NO OPENER\b/],
    ["product name before a need", /\bPRODUCT OR FEATURE NAME\b/],
    ["manufactured scarcity", /\bMANUFACTURED SCARCITY\b/],
    ["counterfeit social proof", /\bCOUNTERFEIT SOCIAL PROOF\b/],
    ["flattery", /\bFLATTERY\b/],
    ["fabricated concession", /\bCONCEDED DRAWBACK YOU INVENTED\b/],
    ["foreclosing exit line", /\bEXIT LINE THAT FORECLOSES FOLLOW-UP\b/],
  ];
  for (const [name, re] of NAMED) {
    ok(`the prompt forbids "${name}" by name`, re.test(TALKING_POINT_SYSTEM));
  }

  // The examples matter as much as the labels — a model reaches the move by a
  // synonym otherwise.
  const EXAMPLES = [
    /won'?t waste your time/i,
    /ninety seconds/i,
    /bad time/i,
    /would you be interested/i,
    /that'?s the end of it/i,
    /leave you alone/i,
  ];
  for (const re of EXAMPLES) {
    ok(`the prompt quotes the banned phrase ${re}`, re.test(TALKING_POINT_SYSTEM));
  }

  // Those quotes are only safe because they sit under the prohibition. If a
  // banned phrase ever appears ABOVE the marker it would read as an
  // instruction, so the half of the prompt before it is swept like a script.
  const MARKER = "Never write any of the following";
  ok("the prohibition section is marked", TALKING_POINT_SYSTEM.includes(MARKER));
  const beforeBans = TALKING_POINT_SYSTEM.split(MARKER)[0];
  for (const b of BANNED) {
    ok(
      `no banned phrase appears as an instruction ("${b.move}")`,
      !b.pattern.test(beforeBans),
      beforeBans.match(b.pattern)?.[0],
    );
  }

  // The old rules are still there. Rebuilding the prompt around the selling
  // literature must not have dropped the fences generate.js's header argues
  // for — the evidence gate, the figure ban and the competitor ban.
  ok("the prompt still closes the citation to the given list", /Say only what is on the list/i.test(TALKING_POINT_SYSTEM));
  ok("the prompt still bans figures of any kind", /No figures of any kind/i.test(TALKING_POINT_SYSTEM));
  ok(
    "the prompt still bans claims about a competitor's product",
    /Never claim anything about a competitor'?s product/i.test(TALKING_POINT_SYSTEM),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Prompt assembly, executed against a fixture");
// ═══════════════════════════════════════════════════════════════════════════
{
  const MATRIX = capabilityMatrix();
  const ctx = talkingPointContext({
    opportunities: [
      {
        capabilityCode: "ONLINE_BOOKING",
        reason: "Their site has no way to book a visit.",
        evidenceIds: ["e1"],
        rank: 1,
      },
      { capabilityCode: "WEBSITE", reason: "No website of their own.", evidenceIds: ["e2"], rank: 2 },
    ],
    matrix: MATRIX,
  });

  const prompt = talkingPointPrompt({
    prospect: { id: "p1", businessName: "Eco Painting Plus", city: "Ottawa", tradeKey: "painting" },
    playbook: PLAYBOOKS.find((p) => p.key === "BOOKING_GAP"),
    ctx,
  });

  ok("the prompt carries the business", prompt.includes("Eco Painting Plus"));
  ok("the prompt carries the observations, and their reasons", prompt.includes("ONLINE_BOOKING") && prompt.includes("no way to book"));
  ok("the prompt bounds the number of points", prompt.includes(String(MAX_GENERATED_POINTS)));
  for (const b of BANNED) {
    ok(`the assembled prompt makes no "${b.move}" move`, !b.pattern.test(prompt), prompt.match(b.pattern)?.[0]);
  }

  // No numeric field at any depth — generate.js's third fence. A number in the
  // schema is a claim that a model's guess is good enough to say out loud.
  const schema = talkingPointSchema(ctx.citableCodes);
  const numeric = [];
  (function walk(node, path) {
    if (!node || typeof node !== "object") return;
    if (node.type === "number" || node.type === "integer") numeric.push(path);
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  })(schema, "schema");
  ok("the generated-point schema has no numeric field at any depth", numeric.length === 0, numeric);

  // And with no model configured the whole thing still produces sayable
  // sentences rather than a blank stage.
  const result = await generateTalkingPoints({
    prospect: { id: "p1", businessName: "Eco Painting Plus" },
    playbook: PLAYBOOKS.find((p) => p.key === "BOOKING_GAP"),
    ctx,
  });
  ok("with no model the generator degrades rather than failing", result.degraded === true && result.reason === "unconfigured", result.reason);
  ok("and there are still sentences to say", result.points.length > 0, result.points.length);
  for (const b of BANNED) {
    const bad = result.points.filter((p) => b.pattern.test(p.text));
    ok(`the fallback sentences make no "${b.move}" move`, bad.length === 0, bad.map((p) => p.text));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("A rewrite can still reach the rows it just made stale");
// ═══════════════════════════════════════════════════════════════════════════
//
// The seeds live in the DATABASE, and installDefaults CREATES and never
// updates so a superadmin's rewrite is safe from the install button. The cost
// of that rule surfaced the day these scripts were rebuilt: source was right,
// production was word for word the old script, a deploy changed nothing, and
// the owner read the deleted sentence back off a live prospect screen.
//
// refreshBuiltIns closes it — but only for rows whose fingerprint is listed as
// retired. So the assertion that matters is that a rewrite RECORDED what it
// retired. A rewrite that forgets loses the ability to refresh the rows it
// just made stale, silently, and nobody finds out until a rep reads the old
// words aloud.

{
  const objections = seedObjections();
  const playbooks = seedPlaybooks();

  for (const o of objections) {
    const fp = objectionFingerprint(o);
    ok(
      `${o.code}'s CURRENT words are not listed as retired`,
      !isUnedited("objection", o.code, fp),
      "a current seed listed in seedHistory means the history was written from the wrong version",
    );
    ok(
      `${o.code} has at least one retired fingerprint to recognise an unedited row by`,
      (RETIRED_OBJECTIONS[o.code] || []).length > 0,
      RETIRED_OBJECTIONS[o.code],
    );
  }
  for (const p of playbooks) {
    ok(
      `${p.key}'s CURRENT script is not listed as retired`,
      !isUnedited("playbook", p.key, playbookFingerprint(p)),
    );
    ok(
      `${p.key} has at least one retired fingerprint`,
      (RETIRED_PLAYBOOKS[p.key] || []).length > 0,
      RETIRED_PLAYBOOKS[p.key],
    );
  }

  // The fingerprint has to actually distinguish two versions, or the whole
  // mechanism is a no-op that reports success.
  const one = objections[0];
  ok(
    "changing a single character changes the fingerprint",
    objectionFingerprint(one) !== objectionFingerprint({ ...one, response: `${one.response} ` }),
  );
  ok(
    "…and the label counts too, because editing it is editing the row",
    objectionFingerprint(one) !== objectionFingerprint({ ...one, label: `${one.label} ` }),
  );
  // Cues deliberately do NOT count — see seedHistory's header.
  ok(
    "…while adding a cue does not, so tuning how a rep finds a row is not an edit",
    objectionFingerprint(one) === objectionFingerprint({ ...one, cues: [...one.cues, "new cue"] }),
  );
  ok(
    "a playbook's stage ORDER is part of its fingerprint",
    playbookFingerprint(playbooks[0]) !==
      playbookFingerprint({ ...playbooks[0], stages: [...playbooks[0].stages].reverse() }),
  );

  // And the refresh must never create, never touch an edited row, and never
  // write `active`.
  const store = read("lib/sales/playbook/store.js");
  const fn = store.slice(store.indexOf("export async function refreshBuiltIns"), store.indexOf("export async function installDefaults"));
  ok("refreshBuiltIns was found", fn.length > 400, fn.length);
  ok("…it never creates a row", !/\.create\(|createMany\(/.test(fn.replace(/platformAuditLog\.create\(/g, "")));
  ok("…it skips anything not listed as unedited", /if \(!isUnedited\(/.test(fn));
  ok("…it names what it left alone rather than counting it", /objectionsKept/.test(fn) && /playbooksKept/.test(fn));
  ok("…and it does not write `active`, which is operational", !/active:/.test(fn));
}

// ═══════════════════════════════════════════════════════════════════════════
section("The written reasoning exists and still matches");
// ═══════════════════════════════════════════════════════════════════════════
{
  const doc = read("docs/sales/SCRIPT-PRINCIPLES.md");
  ok("docs/sales/SCRIPT-PRINCIPLES.md exists", doc.length > 4000, doc.length);
  // The findings a future editor most needs, each by its number, so a rewrite
  // that drops one is visible here.
  for (const [what, re] of [
    ["Langer's 60/94/93", /60%[\s\S]{0,400}94%[\s\S]{0,400}93%/],
    ["the 20-page condition", /twenty pages/i],
    ["Regan's Coca-Cola", /Regan/],
    ["the zoo study", /83%[\s\S]{0,200}17%[\s\S]{0,300}50%/],
    ["Bickman's uniform", /92%[\s\S]{0,120}42%/],
    ["the beef study", /six\s*\n?\s*times|six times/i],
    ["Saylor's fifteen seconds", /fifteen seconds/i],
    ["the 81%", /81%/],
  ]) {
    ok(`the doc still cites ${what}`, re.test(doc));
  }
  ok("the doc names this check as the enforcement", doc.includes("scripts/check-playbook-copy.mjs"));
  ok("the source file points at the doc", read("lib/sales/playbook/defaults.js").length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("This file is actually run");
// ═══════════════════════════════════════════════════════════════════════════
//
// The same self-assertion check:sales-call-playbook makes, for the same reason:
// a check nobody runs is a check that passes for ever.
{
  const pkg = JSON.parse(read("package.json"));
  ok("check:playbook-copy is a script", typeof pkg.scripts?.["check:playbook-copy"] === "string");
  ok(
    "…and it points at this file",
    (pkg.scripts?.["check:playbook-copy"] || "").includes("scripts/check-playbook-copy.mjs"),
  );
  ok(
    "…and check:all runs it, so it cannot quietly stop being run",
    (pkg.scripts?.["check:all"] || "").includes("npm run check:playbook-copy"),
  );
}

if (failures.length) {
  console.error(`\ncheck:playbook-copy FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `\ncheck:playbook-copy passed — ${PLAYBOOKS.length} playbooks, ${seedObjections().length} objection ` +
    `seeds, ${BANNED.length + OBJECTION_BANNED.length} banned moves, ${CONCESSIONS.size} pinned ` +
    `concessions, ${pass} assertions.`,
);
