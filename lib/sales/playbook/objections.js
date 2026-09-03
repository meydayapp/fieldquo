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
const OBJECTIONS = [
  {
    code: "ALREADY_USE_COMPETITOR",
    label: "We already use [another platform]",
    priority: 100,
    contextSelectorKey: "competitor_detected",
    cues: ["already use", "we have jobber", "we use jobber", "housecall", "servicetitan", "we're on"],
    response:
      "Good — then you already know what it is worth having one. I am not going to tell you " +
      "your scheduler is broken. The one thing worth two minutes is whose name the homeowner " +
      "sees: with us the quote, the invoice, the booking page and every email carry yours, and " +
      "nothing carries ours. If that is not a problem you have, I will leave you alone.",
  },
  {
    code: "TOO_EXPENSIVE",
    label: "That sounds expensive / we can't afford another subscription",
    priority: 90,
    contextSelectorKey: null,
    cues: ["expensive", "too much", "can't afford", "cannot afford", "cost", "another subscription"],
    response:
      "Fair. What does one quote you did not get round to sending cost you? That is the " +
      "comparison, and I would rather you make it than take my word. I can send the numbers in " +
      "writing so you can look at them when you are not on site.",
  },
  {
    code: "NO_TIME_TO_SWITCH",
    label: "I don't have time to learn new software",
    priority: 85,
    contextSelectorKey: null,
    cues: ["no time", "too busy", "learn", "set up", "switch"],
    response:
      "That is the usual reason people stay where they are, and it is a real one. Nothing has " +
      "to move at once — the quote goes out of the new one, everything else stays where it is " +
      "until you want it moved. If you want the old records brought across, we do that for you " +
      "as a paid job rather than handing you an import screen.",
  },
  {
    code: "DONT_NEED_A_WEBSITE",
    label: "All my work is word of mouth, I don't need a website",
    priority: 80,
    contextSelectorKey: "no_website",
    cues: ["word of mouth", "referral", "don't need a website", "do not need a website", "busy enough"],
    response:
      "Word of mouth is the best kind of work and I am not going to argue with it. The thing " +
      "word of mouth cannot do is answer at nine at night, when the person your customer " +
      "recommended you to is looking you up on their phone and finds nothing. That is the only " +
      "gap it fills.",
  },
  {
    code: "BOOKING_NOT_FOR_US",
    label: "People need to talk to me before I can book anything",
    priority: 75,
    contextSelectorKey: "website_without_booking",
    cues: ["need to talk", "every job is different", "can't just book", "site visit"],
    response:
      "Agreed — nobody is booking a kitchen off a form. What gets booked is the LOOK, not the " +
      "job. They pick a slot for you to come and measure, it lands in your calendar with the " +
      "address and the photos already on it, and you have not had four texts to arrange it.",
  },
  {
    code: "EMAIL_WORKS_FINE",
    label: "My email address is on the site, that works fine",
    priority: 70,
    contextSelectorKey: "email_only_quote_request",
    cues: ["email works", "they email me", "my email is on there", "inbox"],
    response:
      "It works right up until you are on a roof. Then it is an email you will answer tonight, " +
      "and tonight you are doing invoices. A form asks the four things you always end up asking " +
      "anyway, and what comes back is a job in a list rather than a note in an inbox.",
  },
  {
    code: "SEND_ME_INFO",
    label: "Just send me some information",
    priority: 60,
    contextSelectorKey: null,
    cues: ["send me", "email me something", "send information", "brochure"],
    response:
      "I will, but let me send you the right one — are you more bothered about the quotes going " +
      "out, or about the money coming back in? And can I put fifteen minutes in for Thursday so " +
      "it does not sit unread? If you would rather I did not, say so and I will just send it.",
  },
  {
    code: "NOT_INTERESTED",
    label: "Not interested",
    priority: 50,
    contextSelectorKey: null,
    cues: ["not interested", "no thanks", "we're fine", "we are fine"],
    response:
      "Understood. One question and then I will go: when a quote goes out, is that you at the " +
      "kitchen table at nine? If it is not, I have nothing to sell you and I will take you off " +
      "the list.",
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
