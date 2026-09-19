// lib/aiEmployee/permission.js
//
// May the AI employee do this on its own, or does a person have to say yes?
//
// ══ Three modes, three risk classes, one floor ═════════════════════════════
//
// The owner's words: "similar to Claude Code: auto, manual, accept edits…
// where we warn about them changing the type of permissions", and "it needs a
// final human approval before it is changed". So the switch that used to be a
// boolean ("send automatically?") is a MODE, and the thing it is applied to is
// not a tool name but the tool's RISK — declared beside the tool in
// lib/aiEmployee/tools.js and asserted complete by scripts/check-ai-employee.mjs,
// so a tool added without a risk class fails the build rather than quietly
// running under whatever the mode allows.
//
//   reversible  a reply in a chat, a drafted quote, a callback request. Wrong
//               is embarrassing; a person can follow up and fix it.
//   commits     a real slot on the calendar, a quote sent, a post published.
//               Wrong is a van in a driveway nobody asked for.
//   floor       money spent, anything deleted, a confirmed job moved, a
//               contract sent, a setting or a permission changed. NEVER
//               alone, in any mode. The floor is the reason this is three
//               words and not a boolean: "auto" must not be able to mean
//               "spend the company's money", and a mode that could be
//               configured to is a mode somebody will configure to.
//
// ══ Tainted turns ═══════════════════════════════════════════════════════════
//
// From docs/research/activepieces-decision.md: a turn whose INPUT came from an
// untrusted party — every inbound web-chat message, SMS, Meta DM, email — is
// tainted. Its words are the thing that might be talking the employee into
// something. So in `accept_edits` a tainted turn may still do reversible
// things (reply, draft), but any COMMITTING action it wants becomes a proposal
// exactly as in `ask`, even though the mode would otherwise allow it. Only
// `auto` lets a tainted turn commit, and the auto sentence on the settings
// screen says so in words ("customers' messages can book your calendar
// directly"). Every channel turn the employee answers is tainted; the
// argument defaults to true so a caller that forgets gets the safe answer.
//
// ══ Pure, and checked ══════════════════════════════════════════════════════
//
// No database, no clock. The check walks the whole matrix, including the one
// row that must never change: floor in auto is a proposal.

import { createHash } from "node:crypto";

/** The three modes, in the order the settings screen offers them. */
export const MODES = Object.freeze(["ask", "accept_edits", "auto"]);
export const MODE_ASK = "ask";
export const MODE_ACCEPT_EDITS = "accept_edits";
export const MODE_AUTO = "auto";

/** The three risk classes. Closed. */
export const RISKS = Object.freeze(["reversible", "commits", "floor"]);
export const RISK_REVERSIBLE = "reversible";
export const RISK_COMMITS = "commits";
export const RISK_FLOOR = "floor";

/**
 * The mode a row is in, read the way decide.js's sendMode used to read the
 * boolean: an unknown or absent value is `ask`, never a truthier guess. A row
 * written before the column existed carries the schema default already; this
 * is for a value somebody typed.
 */
export function modeOf(employee) {
  const m = employee?.mode;
  return MODES.includes(m) ? m : MODE_ASK;
}

/** Is this a risk class the tool table may declare? */
export function isRisk(value) {
  return RISKS.includes(value);
}

/**
 * The one decision.
 *
 * @param mode     one of MODES; anything else is treated as `ask`.
 * @param risk     one of RISKS; anything else is treated as `floor` — an
 *                 unclassified tool is the most dangerous kind, because nobody
 *                 has said what it does.
 * @param tainted  did the turn's input come from an untrusted party? Defaults
 *                 to TRUE. See the header.
 * @returns true when the employee may run it now; false when it must propose.
 */
export function mayActAlone({ mode, risk, tainted = true } = {}) {
  const m = MODES.includes(mode) ? mode : MODE_ASK;
  const r = RISKS.includes(risk) ? risk : RISK_FLOOR;

  // The floor, first and unconditionally. Nothing below this line can reach
  // a floor tool.
  if (r === RISK_FLOOR) return false;

  if (m === MODE_ASK) return false;

  if (m === MODE_ACCEPT_EDITS) {
    if (r === RISK_REVERSIBLE) return true;
    // A committing action on a tainted turn is proposed, whatever the mode
    // says. Untainted commits (none exist on a channel today) would be allowed.
    return tainted !== true;
  }

  // auto: reversible and commits run alone. Floor was refused above.
  return true;
}

/**
 * The consequence sentences, as i18n KEYS. The settings screen prints the
 * translation; this list exists so the check can assert every mode has a
 * sentence in every language, and so the screen cannot offer a mode that has
 * no sentence.
 */
export const MODE_SENTENCE_KEY = Object.freeze({
  ask: "app.aiEmployee.mode.ask.sentence",
  accept_edits: "app.aiEmployee.mode.accept_edits.sentence",
  auto: "app.aiEmployee.mode.auto.sentence",
});

/**
 * The English sentences, as data. The i18n catalogue's English entries are
 * asserted equal to these by the check, so the words a contractor reads are
 * the words this file was written against.
 */
export const MODE_SENTENCE_EN = Object.freeze({
  ask: "Nothing happens without you. Every reply, booking and quote link waits here for you to approve, edit or decline. Money is never spent without you.",
  accept_edits:
    "Replies reach customers with nobody reading them first. Anything that commits you — a slot on your calendar, a quote link with a price — still waits here for a yes, because a customer's message asked for it. Money is never spent without you.",
  auto: "Replies reach customers with nobody reading them first. Customers' messages can book your calendar directly and send your quote links. Money is never spent, nothing is deleted, no confirmed job is moved and no setting is changed without you.",
});

/**
 * What no mode can do alone, in the order the settings screen lists it.
 * i18n keys again, for the same reason.
 */
export const FLOOR_LIST_KEYS = Object.freeze([
  "app.aiEmployee.floor.spend",
  "app.aiEmployee.floor.delete",
  "app.aiEmployee.floor.move",
  "app.aiEmployee.floor.contract",
  "app.aiEmployee.floor.settings",
]);

/**
 * A stable hash of a proposal's arguments.
 *
 * Bound to the approval: the approve request carries the hash of the
 * arguments the person READ (or edited), and the route refuses to execute
 * anything whose recomputed hash differs. Keys are sorted so two encodings of
 * the same object hash the same, and a model-supplied companyId — which
 * executeFor overwrites anyway — is not part of what is hashed, so it cannot
 * be used to make an edit look like a different proposal.
 */
export function argsHash(args) {
  const canonical = (v) => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object") {
      return Object.keys(v)
        .filter((k) => k !== "companyId")
        .sort()
        .reduce((acc, k) => {
          acc[k] = canonical(v[k]);
          return acc;
        }, {});
    }
    return v === undefined ? null : v;
  };
  return createHash("sha256").update(JSON.stringify(canonical(args || {}))).digest("hex").slice(0, 32);
}
