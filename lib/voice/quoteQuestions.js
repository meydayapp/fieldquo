// lib/voice/quoteQuestions.js
//
// What the receptionist should ASK so a quote can be worked out afterwards.
//
// ══ Asking is not quoting ══════════════════════════════════════════════════
//
// lib/voice/prompt.js absolute rule 1 — the agent never says a price, a range,
// or a "usually around" — is untouched by this file and must stay that way.
// Gathering the inputs for a quote and quoting are two different acts. This
// file produces the QUESTIONS; nothing here produces, formats, or carries a
// figure, and check-voice-quote-intake.mjs executes that claim rather than
// trusting it.
//
// ══ The list is the company's own, and it is already maintained ════════════
//
// There is no hand-written question list here, and there must never be one. The
// instant estimator already knows, per company, which trades are offered
// instantly (InstantQuoteConfig rows) and exactly which measurements each one
// needs (MEASURE_SHAPES in lib/estimate/callEstimate.js — the same shapes that
// decide whether a drafted call can be priced at all). Deriving from those two
// means:
//
//   * a company that switches Cabinet Refacing on gets doors and drawers in
//     its agent's prompt on the next provision, with nobody editing anything;
//   * a company that has never configured an instant trade gets NO question
//     block, rather than an empty heading a model would try to fill;
//   * the questions the agent asks and the fields the draft needs cannot drift,
//     because they are the same list read twice.
//
// ══ Two measurement shapes are deliberately absent ═════════════════════════
//
// lawn_polygon is a shape traced on a map and item_picker is a list built from
// a catalogue. Neither can come out of a conversation, and MEASURE_SHAPES
// already says so. Asking for them on the phone would produce an answer nobody
// can use and a caller who thinks they have been quoted.
//
// ══ Material labels are company text, so they are treated as hostile ═══════
//
// A material label is typed by the contractor into their instant-quote config,
// and it lands verbatim in a prompt read by a model that then talks to a
// stranger. Two things can go wrong: a label like "Premium — $4,500/kitchen"
// puts a figure into the mouth of an agent forbidden from saying one, and a
// label containing instructions is a prompt injection with a settings screen
// for a front door. safeMaterialLabel() drops both rather than sanitising them
// into something plausible.

import { db } from "@/lib/db";
import { INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";
import { MEASURE_SHAPES, categoryKeyForTrade } from "@/lib/estimate/callEstimate";
import { sanitiseInstantConfig } from "@/lib/estimate/instantQuoteReadiness";
import { TRADE_LABELS } from "@/lib/estimate/instantQuoteServer";
import { categoryLabel } from "@/lib/i18n/translateContent";

/**
 * How to ask for each measurement, out loud.
 *
 * Keyed by the measurement keys in MEASURE_SHAPES `reads`. This is genuinely
 * new information — "doorCount" is a form label and "how many cabinet doors
 * there are" is a question a person asks — so it is not a copy of
 * app/data/quoteIntakeFields.js and does not rot alongside it. What WOULD rot
 * is a phrasing map that falls behind the shapes, so unphrasedMeasureKeys()
 * exists and the check fails on any key without one.
 *
 * Note what is not in any of these: a number, a unit price, a duration. The
 * agent asks how many doors; it never says what a door is worth.
 */
export const ASK_PHRASING = {
  doorCount: "how many cabinet doors there are",
  drawerCount: "how many drawer fronts there are",
  boxLinearFt: "how much cabinet box needs covering, in feet along the wall",
  squareFootage: "roughly how big the area is, in square feet",
  treads: "how many steps there are",
  railingFt: "whether there's railing too, and how much of it",
  tearOffLayers: "how many layers of old roofing are up there",
};

/** The address of the WORK, for the trades measured from one. */
const ADDRESS_PHRASING = "the address of the property, so it can be measured";

/**
 * Measurement keys a shape reads that nobody has written a spoken question for.
 *
 * Empty, or the agent would be told to collect something it cannot name. Run by
 * the check, so adding a field to MEASURE_SHAPES fails loudly here rather than
 * silently producing a shorter question list.
 */
export function unphrasedMeasureKeys() {
  const out = [];
  for (const shape of Object.values(MEASURE_SHAPES)) {
    if (shape.blocked) continue;
    for (const key of shape.reads || []) {
      if (!ASK_PHRASING[key] && !out.includes(key)) out.push(key);
    }
  }
  return out;
}

// Anything that could read as money, a percentage, or a rate. Deliberately
// broad: a dropped material label costs the agent one prompt ("which finish
// did you have in mind?"), where a kept one puts a number in its mouth.
//
// It is NOT "contains a digit". Real material names carry small numbers —
// "3-tab asphalt shingles", "24ga standing seam", "2-coat polyaspartic" — and
// dropping those would quietly shorten the list a contractor configured. What
// is rejected is a run of three or more digits (every price is one), a
// currency mark, a percentage, and the per-unit phrasings a rate arrives in.
const MONEY_SHAPED =
  /[$€£¥]|\b(?:usd|cad|eur|gbp)\b|\d[\d,.]{2,}|\d\s*%|\bper\b|\/\s*(?:sq|ft|sf|each|door|drawer|hour|hr|day|kitchen)\b/i;

// A label is a noun phrase. Newlines, colons and markdown fences are how text
// stops being a label and starts being a section header in someone else's
// prompt — see the injection note at the top.
const NOT_A_LABEL = /[\n\r`{}<>|]|--|^\s*#/;

/**
 * One material label, or null if it isn't safe to put in a prompt.
 *
 * Rejects rather than repairs. A label with the price stripped out reads as the
 * contractor's own wording and isn't, and the contractor never sees the edit.
 */
export function safeMaterialLabel(label) {
  const s = String(label ?? "").trim();
  if (!s || s.length > 60) return null;
  if (MONEY_SHAPED.test(s)) return null;
  if (NOT_A_LABEL.test(s)) return null;
  return s;
}

/** At most this many materials read out per trade. A list is not a conversation. */
const MAX_MATERIALS = 5;

/**
 * The questions for one company's instantly-quotable trades.
 *
 * Pure — no database — so the check can execute it against a cabinet-only
 * company, a roofing company, a company with nothing enabled, and a company
 * whose material labels are hostile.
 *
 * @param rows [{ trade, label, materials: [{ key, label }] }] — already
 *             per-company; `label` in the company's own language.
 * @returns [{ trade, label, asks: string[], materials: string[] }]
 */
export function quoteTopics(rows = []) {
  const topics = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const spec = INSTANT_ESTIMATE_TRADES[row?.trade];
    if (!spec) continue;

    const shape = MEASURE_SHAPES[spec.measure];
    // Unknown or un-askable (a polygon on a map, a list of items to haul). Not
    // a gap: a question the caller cannot answer is worse than no question.
    if (!shape || shape.blocked) continue;

    const asks = [];
    if (shape.needsAddress) asks.push(ADDRESS_PHRASING);
    for (const key of shape.reads || []) {
      const phrase = ASK_PHRASING[key];
      if (phrase && !asks.includes(phrase)) asks.push(phrase);
    }

    const materials = spec.hasMaterials
      ? (Array.isArray(row.materials) ? row.materials : [])
          .map((m) => safeMaterialLabel(m?.label))
          .filter(Boolean)
          .slice(0, MAX_MATERIALS)
      : [];

    // Nothing to ask and nothing to choose is not a topic. It happens when a
    // shape reads only fields nobody has phrased yet, which the drift check
    // above turns into a failure rather than a silent omission.
    if (!asks.length && !materials.length) continue;

    topics.push({
      trade: row.trade,
      label: String(row.label || TRADE_LABELS[row.trade] || row.trade).slice(0, 80),
      asks,
      materials,
      // Said out loud only when the company has configured options. A trade
      // that prices on material with none set up gets the open question rather
      // than an empty list.
      picksMaterial: Boolean(spec.hasMaterials),
    });
  }

  return topics;
}

/**
 * The same thing, read from this company's own rows.
 *
 * InstantQuoteConfig is the authority — it is what the public instant quote
 * itself reads, so the agent asks for exactly what that form would need. Labels
 * come from the matching ServiceCategory in the company's language, because the
 * agent says the trade name out loud; the measurement phrasings stay English
 * because the whole instruction set is English (the model speaks French to a
 * French caller either way — see provisionAgent's `language`).
 */
export async function quoteTopicsForCompany(companyId, language = "en") {
  const rows = await db.instantQuoteConfig.findMany({
    where: { companyId, enabled: true },
    select: { trade: true, config: true },
  });
  if (!rows.length) return [];

  const byKey = new Map();
  const keys = rows.map((r) => categoryKeyForTrade(r.trade)).filter(Boolean);
  if (keys.length) {
    const categories = await db.serviceCategory.findMany({
      where: { key: { in: keys } },
      select: { key: true, label: true, labelTranslations: true },
    });
    for (const c of categories) byKey.set(c.key, c);
  }

  return quoteTopics(
    rows.map((row) => {
      const category = byKey.get(categoryKeyForTrade(row.trade));
      return {
        trade: row.trade,
        label: category ? categoryLabel(category, language) : TRADE_LABELS[row.trade],
        // Through the sanitiser, like every other read of a saved config: the
        // row is browser-authored JSON and a malformed materials array must
        // cost one question, not the whole provision.
        materials: sanitiseInstantConfig(row.config)?.materials || [],
      };
    }),
  );
}

/**
 * Where a caller should send photos, or null.
 *
 * The company's own published contact address and nothing else. A call cannot
 * carry a photo, and the ask is worth making — but only to somewhere the
 * company actually reads. The obvious alternatives were rejected:
 *
 *   the sending domain (emailFromLocal@emailDomain) — outbound only, and on an
 *     unverified domain it does not exist at all;
 *   a text to the voice number — Retell's line cannot receive MMS, and the crew
 *     inbox is a different number belonging to a different provider;
 *   a link texted to the caller — needs an SMS send we are not making here.
 *
 * Null when they have not set one, and null means the whole photo instruction
 * is omitted from the prompt. Absence of an address is not an invitation to
 * invent one (AGENTS.md failure class 5).
 */
export function photoDestination(company) {
  const email = String(company?.email ?? "").trim();
  // Loose on purpose — this is a display string for a model to read out, not an
  // address we are about to send to.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email.slice(0, 120);
}
