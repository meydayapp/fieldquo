// lib/sales/playbook/bannedMoves.js
//
// The moves a FieldQuo sales line may never make, as data.
//
// ══ Why this left the check script ═══════════════════════════════════════
//
// These detectors lived inside scripts/check-playbook-copy.mjs, which was the
// right place while the only thing to sweep was the seed library. It stopped
// being the right place the moment there was a SECOND thing that produces
// sentences a rep reads out loud: lib/sales/playbook/battlecards.js assembles
// its lines from the competitor rows, and those lines are as much a script as
// any stage in defaults.js.
//
// Two checks with two copies of the same regex is failure class 4 with a
// customer listening — and this repository has the exact scar: `deliverReplySms`
// checked `result.ok` while `sendSms` returned `success`, so every reply was
// delivered and reported as failed for months. One table, imported twice.
//
// ══ Why in lib/ and not in scripts/ ══════════════════════════════════════
//
// Because it is not only a test fixture. What may not be said to a contractor
// is product knowledge — the same knowledge generate.js states as prohibitions
// in its system prompt — and a screen that lets a superadmin edit an objection
// response is entitled to warn them before they save "I'll leave you alone".
// Nothing does that yet; when something does, it imports this rather than
// growing a third copy.
//
// ══ What is NOT here ═════════════════════════════════════════════════════
//
// The `fires` lists — the retired sentences each detector is fired at — stay
// in the check. They are deleted prose kept as test material, and the argument
// seedHistory.js makes about keeping words out of the bundle applies: the
// question this module answers is "does this sentence make a banned move", and
// nothing at runtime needs the sentences that once did.
//
// The reasoning behind each rule, with the study under it, is in
// docs/sales/SCRIPT-PRINCIPLES.md. This file is the enforcement, not the
// argument.

export const BANNED_MOVES = Object.freeze([
  {
    move: "apology",
    why:
      "Futrell ch.10, what fails on arrival: do not apologise for taking the prospect's time. " +
      "Saylor names the same move in its list of openings to avoid.",
    pattern:
      /\b(?:sorry (?:to|for|about)|apolog(?:y|ies|ise|ize|ising|izing)|thanks? (?:you )?for (?:your|the) time|thanks for the ninety seconds)\b/i,
  },
  {
    move: "time-limit promise",
    why:
      "Saylor ch.9 §2: 'I promise I'm not going to waste your time' suggests you are somebody " +
      "who might. It conveys a lack of confidence and sets a negative tone.",
    // ── What this bans, and the one word that separates it from what it does not ──
    //
    // A PROMISE about the rep's own behaviour, volunteered and unasked. It is
    // not the same move as a bounded request for PERMISSION ("can I give you
    // thirty seconds on why I called?"), which is what every opener now ends
    // with — see defaults.js's PERMISSION_ASK header for the argument, and the
    // self-test below, which fires this pattern at both spellings and requires
    // it to catch one and let the other through.
    //
    // The number alternation used to stop at "fifteen", so "I'll only take
    // thirty seconds" — the exact sentence somebody would write while trying to
    // reproduce the permission ask from memory — walked straight past it. A
    // detector that only catches the numbers the last author happened to use is
    // the "name in JavaScript is not a column" failure in a regex.
    pattern: new RegExp(
      [
        "\\bninety seconds\\b",
        "\\bwon'?t (?:waste|take up|take much of|keep you)\\b",
        "\\bnot going to waste your time\\b",
        "\\b(?:i'?ll|i will) (?:be|only be|only take|take) (?:about )?(?:a |one |two |three |five |ten |fifteen |twenty |thirty |forty |sixty |ninety |\\d+ )?(?:seconds?|minutes?)\\b",
        "\\b(?:this|it) (?:will|'ll) only take\\b",
        "\\b(?:two|three|five|ten|thirty|ninety) (?:seconds|minutes)\\s*,\\s*and\\b",
        "\\bi'?ll be (?:quick|brief)\\b",
      ].join("|"),
      "i",
    ),
  },
  {
    move: "bad-time question",
    why:
      "Saylor ch.9 §2, the telephone don'ts: never ask 'did I catch you at a bad time?' — the " +
      "prospect simply agrees, and agreeing ends the call. Ask whether it is a GOOD time.",
    pattern:
      /\b(?:bad time|bad moment|is now bad|have i caught you|did i catch you|caught you (?:on site|at|mid)|are you busy)\b/i,
  },
  {
    move: "yes/no opener",
    why:
      "Futrell ch.10: never phrase a direct question so that a single word ends the " +
      "conversation — he calls it hanging up the telephone on yourself. Saylor's type case is " +
      "'would you be interested in saving money?'.",
    pattern:
      /\b(?:would you be interested|have you got a minute|got a second|all right\?|okay\?|interested\?)/i,
  },
  {
    move: "manufactured scarcity",
    why:
      "Cialdini ch.7. The vacuum-cleaner script he infiltrated ('I can't come back and sell it " +
      "to you later') had a stated internal purpose: to stop the prospect thinking it over. " +
      "There is no real scarcity in a subscription, so any limit written here is invented.",
    pattern:
      /\b(?:limited (?:time|number|places|spots|offer)|offer ends|ends (?:on )?(?:monday|tuesday|wednesday|thursday|friday)|this month only|last chance|only a few (?:places|spots|left)|places left|spots left|while it lasts|first come|before (?:the )?prices? go up)\b/i,
  },
  {
    move: "counterfeit social proof",
    why:
      "Cialdini ch.4 and the epilogue: invented peer counts are the category he says warrants " +
      "boycott. It is also barred by FieldQuo's own non-negotiable 8 — no tenant's data is " +
      "quoted to another.",
    pattern:
      /\b(?:contractors like you|most of our customers|hundreds of (?:contractors|painters|companies)|thousands of (?:contractors|painters|companies)|nine out of ten|9 out of 10|everyone (?:else )?(?:in your area|is moving)|all the other (?:painters|plumbers|contractors))\b/i,
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
  },
]);
/**
 * Which moves this text makes, by name. Empty is the passing answer.
 *
 * Returns the LIST rather than a boolean on purpose: a caller reporting "this
 * line is not allowed" without saying which rule it broke has told an author
 * to guess, and guessing at a rewrite is how the retired opener came back the
 * first time.
 */
export function bannedMovesIn(text) {
  const s = String(text || "");
  return BANNED_MOVES.filter((b) => b.pattern.test(s)).map((b) => b.move);
}
