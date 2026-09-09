// lib/sales/playbook/objections.js
//
// What to say when they push back — as data, not as prose inside a playbook.
//
// ══ Why the responses are their own store ═════════════════════════════════
//
// §22 asks for objection responses as configurable data, and there is a
// second, sharper reason than configurability: the same eight objections come
// up on every call whichever playbook is open. Written inline, each playbook
// would carry its own copy of "we already use Jobber", four copies would drift,
// and the copy nobody looks at is the one a rep reads out — AGENTS.md failure
// class 4, with a customer listening.
//
// ══ Nothing here is generated ═════════════════════════════════════════════
//
// A model may personalise a TALKING POINT, which cites an opportunity row that
// cites evidence. An objection response is the answer to a challenge, it is
// often about our own pricing and our own limits, and there is nothing for a
// generated sentence to cite. So these are written by a superadmin, edited by a
// superadmin, and rendered verbatim. That is also why they may contain a
// figure and an AI talking point may not: a person put it there and can answer
// for it.
//
// ══ Prospect evidence attaches where it exists, and NOWHERE else ══════════
//
// "We already use Jobber" is a different sentence when we detected Jobber than
// when we did not. So an objection may name a `contextSelectorKey` out of the
// same closed selector vocabulary the playbooks use, and when that selector
// matches, the response carries the observations behind it. When it does not
// match — or the objection names no selector at all — the response is still
// shown, with `context: null` and the screen saying it is a general answer.
//
// It is NOT filtered out. A rep hears what a rep hears, and hiding the
// too-expensive answer because we have no evidence about this prospect's
// budget would be hiding the answer to the most common objection there is.
import { runSelector, selector } from "./selectors";

/** Bounds a superadmin's edit has to satisfy. Shape, not judgement. */
export const MAX_OBJECTION_LABEL = 120;
export const MAX_OBJECTION_RESPONSE = 1200;
export const MAX_CUES = 12;
export const MAX_CUE_LENGTH = 80;

/**
 * The starter library.
 *
 * Written here and then living in the database, exactly like
 * lib/sales/intel/rules.js's seeds and for the same reason: which answers work
 * is a sales judgement that changes monthly, and a judgement that needs a
 * deploy to change is a judgement nobody revises.
 *
 * `cues` are the words a prospect actually says, so a rep scanning on a phone
 * mid-call finds the row by what they just heard rather than by our name for
 * it. They are matched as lower-cased substrings — no stemming, no fuzzy
 * matching: a near-match that opens the wrong answer is worse than no match,
 * because the rep reads it out.
 */
//
// ══ The shape every response follows, and why ═════════════════════════════
//
// Saylor ch.11 §2's own six strategies, in his order: view the objection as a
// QUESTION rather than an attack; restate it before answering, which proves
// you listened and buys a beat; answer with reframed economics or third-party
// evidence rather than a discount; never argue. Futrell adds forestalling —
// raise the objection the answer itself creates before the prospect has to.
//
// So: restate → welcome → answer → a small next step. Every one of the eight
// ends in something the prospect can do, and NONE of them ends the sequence.
//
// ══ The rule that got three of these rewritten ════════════════════════════
//
// They used to end "I will leave you alone", "say so and I will just send it"
// and "one question and then I will go". Saylor ch.13 puts 81% of sales on or
// after the FIFTH call and has a prospect saying no about five times before
// buying; Futrell's twelfth key to a close is to leave the door open. A
// response a single word can end throws four contacts away — and it does it at
// the exact moment the prospect is engaged enough to push back, which Saylor
// calls a gift rather than a rejection.
//
// The ONE exception is NOT_INTERESTED's do-not-call promise. That is not a
// rhetorical exit, it is a switch: the `do_not_call` disposition writes
// doNotContact permanently and lib/sales/suppression's ALL_CHANNELS default
// stops the email and the texts with it. A promise we keep may be made; a
// promise made only to sound reasonable may not. scripts/check-playbook-copy.mjs
// exempts exactly that sentence and requires it to say what the switch does.
const OBJECTIONS = [
  {
    code: "ALREADY_USE_COMPETITOR",
    label: "We already use [another platform]",
    priority: 100,
    contextSelectorKey: "competitor_detected",
    cues: ["already use", "we have jobber", "we use jobber", "housecall", "servicetitan", "we're on"],
    // Restate → welcome → the ONE narrow claim → a next step that costs them
    // nothing. The retired version ended "if that is not a problem you have, I
    // will leave you alone", which threw the other four contacts away on a
    // single word (Saylor ch.13: 81% on or after the fifth call).
    response:
      "So you have already got that solved, and it works. Good — that is the right order to " +
      "solve it in, and I am not going to tell you your scheduler is broken. Two things it may " +
      "not be doing. Whose name the homeowner sees: with us the quote, the invoice, the booking " +
      "page and every email between them carry yours and none of them carry ours. And what " +
      "happens before the quote goes out — every one gets read back to you, free, every time: " +
      "what you have left off it, and whether the price is above or below what you have " +
      "actually been winning at. Your own accepted and declined jobs, not other contractors' " +
      "numbers — yours do not go anywhere either. Does the one you use now do that? Give me " +
      "your logo and your colour and I will build one real quote with your name on it, review " +
      "and all — put it next to the last one you sent and tell me what is wrong with it.",
  },
  {
    code: "TOO_EXPENSIVE",
    label: "That sounds expensive / we can't afford another subscription",
    priority: 90,
    contextSelectorKey: null,
    cues: ["expensive", "too much", "can't afford", "cannot afford", "cost", "another subscription"],
    // Saylor ch.11 §2 on price: answer with value and differentiation, never a
    // discount — and his own figure is that 40% of buyers ask for a concession
    // only "because they had to ask", while 50% of sellers concede on the first
    // request. So the response refuses to discount and hands the arithmetic
    // back with THEIR number in it (Futrell: attach a bottom-line figure to the
    // implication, and get the prospect to state it).
    response:
      "So what you are saying is you are not sure it pays for itself. That is the right " +
      "question and I would rather you put it now than three months in. I am not going to " +
      "discount it, because the number that decides this is not ours — it is what one quote you " +
      "never got round to sending is worth to you, and what a quote priced under what you " +
      "usually win at costs you when it is accepted too fast. The second one you cannot see " +
      "without something reading your own history back to you, which is the part that is free " +
      "and runs on every quote. You are the only one who knows your average job. Tell me " +
      "roughly what that is and I will do the arithmetic with your figure instead of mine, in " +
      "writing, so you can read it when you are not standing on somebody's drive.",
  },
  {
    code: "NO_TIME_TO_SWITCH",
    label: "I don't have time to learn new software",
    priority: 85,
    contextSelectorKey: null,
    cues: ["no time", "too busy", "learn", "set up", "switch"],
    // Barron's "reduce the cost of change": the competitor here is inertia, not
    // a rival. The proof is a demonstration rather than an assurance, because
    // an assurance about effort is exactly the claim a busy person discounts.
    response:
      "So it is the changeover you are weighing, not the thing itself. That is the honest " +
      "reason most people stay where they are and it is the one I would want answered too. " +
      "Nothing has to move at once — the next quote goes out of the new one and everything else " +
      "stays exactly where it is until you decide otherwise. If you want the old records " +
      "brought across, that is a paid job we do for you, not an import screen we hand you. " +
      "Rather than argue about how long it takes: give me one job you have already done and I " +
      "will set it up the way it would really run, and you tell me whether that was the effort " +
      "you were picturing.",
  },
  {
    code: "DONT_NEED_A_WEBSITE",
    label: "All my work is word of mouth, I don't need a website",
    priority: 80,
    contextSelectorKey: "no_website",
    cues: ["word of mouth", "referral", "don't need a website", "do not need a website", "busy enough"],
    // Cialdini ch.7 loss framing, on a loss that is REAL: the enquiry you never
    // hear about. Godin's broker statistic sits underneath it — more than 80%
    // of people who hire one choose the first to come back to them, so being
    // findable at all is most of the contest.
    response:
      "So the work comes from people who already know you. That is the best kind there is and I " +
      "am not going to argue it down. The narrow thing word of mouth cannot do is answer at " +
      "nine at night: your customer gives your name to a neighbour, the neighbour looks you up " +
      "on their phone, finds nothing, and rings the second name instead. You would never hear " +
      "about that one, which is exactly why it is worth a look rather than a shrug. Send me " +
      "three photos of a job you are proud of and I will show you what that neighbour would " +
      "have found — then tell me what is wrong with it.",
  },
  {
    code: "BOOKING_NOT_FOR_US",
    label: "People need to talk to me before I can book anything",
    priority: 75,
    contextSelectorKey: "website_without_booking",
    cues: ["need to talk", "every job is different", "can't just book", "site visit"],
    // Saylor's rule that you never argue: the objection is conceded outright,
    // because it is true. What follows corrects the subject of the sentence
    // (the visit, not the job) rather than the prospect.
    response:
      "So what you are saying is a job like yours cannot be priced without seeing it. Agreed — " +
      "nobody is booking a kitchen off a form, and if I told you otherwise you would be right " +
      "not to believe the rest of it. What gets booked is the visit, not the job: they pick " +
      "from hours you have already said you will accept, it lands in your calendar with the " +
      "address and their photos already attached, and the four texts to arrange it never " +
      "happen. Tell me the hours you would genuinely accept and I will set it up inside those, " +
      "and you look at it before anybody else can.",
  },
  {
    code: "EMAIL_WORKS_FINE",
    label: "My email address is on the site, that works fine",
    priority: 70,
    contextSelectorKey: "email_only_quote_request",
    cues: ["email works", "they email me", "my email is on there", "inbox"],
    // Forestalls the objection the answer itself creates — "so I lose the email
    // address" — before they raise it. Futrell: once an objection is said aloud
    // the prospect has to defend it, so the answer arrives first.
    response:
      "So the address on the site is doing the job. For the people who write to you it is — the " +
      "question is what happens between them writing and you answering. It works right up until " +
      "you are on a roof, and then it is an email you will answer tonight, and tonight you are " +
      "doing invoices. A form asks the four things you always end up asking anyway, and what " +
      "lands is a job in a list with the answers already on it rather than a note in an inbox. " +
      "You keep the address either way — anyone who would rather just email you still can. Tell " +
      "me the four things you always end up asking and I will build it round yours, not ours.",
  },
  {
    code: "SEND_ME_INFO",
    label: "Just send me some information",
    priority: 60,
    contextSelectorKey: null,
    cues: ["send me", "email me something", "send information", "brochure"],
    // Saylor ch.11: "just send me something" is a STALL, not an objection —
    // it masks unaddressed risk. So the material is promised unconditionally
    // (refusing it would be the argument he forbids) and the ask that follows
    // is an alternative-choice one. The retired version ended "if you would
    // rather I did not, say so and I will just send it", which handed the
    // prospect a one-word way out of the only thing being asked for.
    response:
      "So you want to see something in writing before you spend any more time on the phone. " +
      "Fair — I would want the same, and I will send it. I would rather send the one that is " +
      "about your problem than the one that is about all of them, so which is it more: the " +
      "quotes going out, or the money " +
      "coming back in? That is in your inbox today either way. The reason I would still like " +
      "fifteen minutes on top is that a document read at eleven at night answers no questions " +
      "back. Thursday morning, before you are out — and if Thursday is the wrong day, give me " +
      "one that is not.",
  },
  {
    code: "NOT_INTERESTED",
    label: "Not interested",
    priority: 50,
    contextSelectorKey: null,
    cues: ["not interested", "no thanks", "we're fine", "we are fine"],
    // ── The one response that MAY end the sequence, and only honestly ──────
    //
    // "I will take you off the list" is not a rhetorical exit here: it is the
    // suppression promise FieldQuo actually keeps. The `do_not_call`
    // disposition sets doNotContact permanently, and lib/sales/suppression's
    // ALL_CHANNELS default is the widest reading — a stop given on the phone
    // stops the email and the texts too. So the sentence says what the switch
    // really does, and points the rep at the switch.
    //
    // What was retired is the rest of it. "One question and then I will go"
    // spent the other four contacts on a single word before the question had
    // even been answered.
    response:
      "Understood, and I am not going to talk you round. One thing before you get on, and it is " +
      "a question rather than a pitch: when a quote goes out, is that you at the kitchen table " +
      "at nine at night? If it is not, then this really is not for you and I would rather say " +
      "so than keep ringing. If it is, that is the whole of what I called about, and it is " +
      "worth one more conversation rather than none. And if you would rather we did not ring " +
      "at all, tell me now and I will put you on the do-not-call list today — that is a switch " +
      "in here rather than a form of words: it is permanent, and it stops the email and the " +
      "texts as well.",
  },
];

export const OBJECTION_CODES = Object.freeze(OBJECTIONS.map((o) => o.code));

/**
 * The starter rows, validated before anybody sees them.
 *
 * Throws rather than filtering, on the same argument seedOpportunityRules
 * makes: a starter row that silently did not ship is a library that looks
 * complete and is not, and this is the cheapest moment to see it.
 */
export function seedObjections() {
  const rows = OBJECTIONS.map((o) => ({
    code: o.code,
    label: o.label,
    cues: [...o.cues],
    response: o.response,
    contextSelectorKey: o.contextSelectorKey,
    priority: o.priority,
    active: true,
    version: "1",
  }));

  const problems = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.code)) problems.push(`${row.code}: duplicate objection code`);
    seen.add(row.code);
    const { ok, problems: found } = validateObjection(row);
    if (!ok) problems.push(`${row.code}: ${found.join(", ")}`);
  }
  if (problems.length) throw new Error(`seedObjections: ${problems.join("; ")}`);
  return rows;
}

/** Why an objection row cannot be written. */
export const OBJECTION_PROBLEMS = Object.freeze({
  no_code: "An objection needs a code.",
  no_label: "An objection needs a label — it is what a rep scans for mid-call.",
  no_response: "An objection with no response is a row that answers nothing.",
  response_too_long:
    "The response is longer than anybody reads while somebody is waiting on the phone.",
  unknown_selector:
    "The context rule names a selector this engine does not implement, so the response could never pick up any evidence.",
  too_many_cues: "Too many cues — a list nobody can scan is a list nobody uses.",
  cue_too_long: "A cue is the words a prospect says, not a sentence.",
  empty_cue: "A blank cue matches everything, which would open this answer on every objection.",
});

export function validateObjection(row) {
  const problems = [];
  if (!row?.code) problems.push("no_code");
  if (!row?.label || !String(row.label).trim()) problems.push("no_label");

  const response = typeof row?.response === "string" ? row.response.trim() : "";
  if (!response) problems.push("no_response");
  else if (response.length > MAX_OBJECTION_RESPONSE) problems.push("response_too_long");

  if (row?.contextSelectorKey && !selector(row.contextSelectorKey)) {
    problems.push("unknown_selector");
  }

  const cues = Array.isArray(row?.cues) ? row.cues : [];
  if (cues.length > MAX_CUES) problems.push("too_many_cues");
  for (const cue of cues) {
    const text = typeof cue === "string" ? cue.trim() : "";
    if (!text) problems.push("empty_cue");
    else if (text.length > MAX_CUE_LENGTH) problems.push("cue_too_long");
  }

  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

/**
 * The objection list for one prospect: every active row, in call order, each
 * carrying this prospect's observations where its context rule matched.
 *
 * Nothing is dropped for want of evidence. See the header — hiding an answer
 * because we know nothing about this prospect's version of the objection is
 * hiding it exactly when the rep needs it.
 */
export function objectionsForProspect({ objections = [], index = {} } = {}) {
  const rows = (Array.isArray(objections) ? objections : []).filter((o) => o?.active !== false);

  return rows
    .slice()
    .sort(
      (a, b) =>
        (Number(b?.priority) || 0) - (Number(a?.priority) || 0) ||
        String(a?.code || "").localeCompare(String(b?.code || "")),
    )
    .map((o) => {
      let context = null;
      if (o.contextSelectorKey && selector(o.contextSelectorKey)) {
        const run = runSelector(o.contextSelectorKey, index);
        if (run.matched) {
          context = {
            selectorKey: run.key,
            describe: run.describe,
            facts: run.facts,
            evidenceIds: run.observationEvidenceIds,
          };
        }
      }
      return {
        code: o.code,
        label: o.label,
        cues: Array.isArray(o.cues) ? o.cues : [],
        response: o.response,
        priority: Number(o.priority) || 0,
        contextSelectorKey: o.contextSelectorKey ?? null,
        // Null means "this is the general answer", and the screen says so. It
        // does NOT mean the objection does not apply.
        context,
      };
    });
}

/**
 * Find the rows whose cues contain what the prospect just said.
 *
 * Substring, lower-cased, no stemming and no fuzziness — see the seed's
 * comment. Returns ALL matches rather than a best one: two objections often
 * arrive in one sentence ("we already use Jobber and it's expensive enough"),
 * and picking one would hide the other.
 */
export function matchObjectionText(text, objections) {
  const heard = typeof text === "string" ? text.toLowerCase().trim() : "";
  if (!heard) return [];
  return (Array.isArray(objections) ? objections : []).filter((o) =>
    (Array.isArray(o?.cues) ? o.cues : []).some(
      (cue) => typeof cue === "string" && cue.trim() && heard.includes(cue.toLowerCase().trim()),
    ),
  );
}

/**
 * What the mid-call objection list shows when a rep types what they just heard.
 *
 * ══ A miss shows EVERYTHING, and that is the whole point ══════════════════
 *
 * `matchObjectionText` is substring-exact by design — no stemming, no fuzzy
 * matching, because a near-match opens the wrong answer and the rep reads it
 * out. The cost of that strictness is that it misses often: "we've already got
 * something for that" matches no cue in the library, and a filter that emptied
 * the panel on it would take all eight answers off the screen at the exact
 * second the rep needed one, with a stranger waiting. So a miss is not a
 * result — it falls back to the full list and the screen says the typing
 * matched nothing.
 *
 * ══ Order is never recomputed ═════════════════════════════════════════════
 *
 * `objectionsForProspect` has already ranked these for this prospect. Re-sorting
 * a filtered subset would move a different answer under the rep's thumb than
 * the one that was there a moment ago — muscle memory is most of what makes a
 * mid-call panel usable at all. This function only ever removes rows, never
 * reorders them.
 *
 * @returns {{ rows: Array, filtered: boolean, heard: string, missed: boolean }}
 *   `filtered` false means the rows are the whole list — either nothing was
 *   typed, or what was typed matched nothing. `missed` distinguishes the two,
 *   so the screen can say which without inferring it from a count.
 */
export function objectionsToShow(heard, objections) {
  const rows = Array.isArray(objections) ? objections : [];
  const text = typeof heard === "string" ? heard.trim() : "";
  if (!text) return { rows, filtered: false, heard: "", missed: false };

  const hits = matchObjectionText(text, rows);
  if (hits.length === 0) return { rows, filtered: false, heard: text, missed: true };
  return { rows: hits, filtered: true, heard: text, missed: false };
}
