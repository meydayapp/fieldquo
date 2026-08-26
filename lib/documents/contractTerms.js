// lib/documents/contractTerms.js
//
// Starter scope-of-work and contract wording, per trade.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// Company.defaultProcessNotes is copied onto every new quote as
// Quote.processNotes and printed on the document. The column has been
// readable and writable through the API since it was added — and there has
// never been a screen anywhere in /app that sets it, so it has been null on
// every company and every quote. The field was not broken; it was unreachable.
//
// The gap it leaves is real. A contractor's quote competes against two others
// on the same kitchen table, and the one that says what will happen — how deep
// the excavation goes, how many lifts the base is compacted in, who hauls the
// old patio away, what happens if the client changes the design halfway — is
// the one that reads like somebody who has done the job before. Writing that
// from a blank box is homework nobody does at nine at night.
//
// ── Where the wording comes from ────────────────────────────────────────────
//
// Two real Ottawa documents, used as structure rather than copied as text:
//
//   INTERLO-KING / INW Landscaping, May 2020 — the phase breakdown
//   (excavation and site prep → aggregates and base → material installed) and
//   the shape of the contract clauses.
//
//   Custom Interlocking, February 2021 — the scope detail: excavate 12" and
//   6" wider than the paved area, geotextile, 12" of granular base in three
//   compacted lifts, pattern squared to the house, border course, flush to
//   grade, 2% slope away from the building, edge restraint, polymeric sand
//   compacted, then grade, soil and seed.
//
// ── What is deliberately left blank ─────────────────────────────────────────
//
// Every number a company has to own: the warranty term, the deposit split, the
// lead time, the change-order fee. They appear as [SQUARE BRACKETS] so an
// unedited template is visibly unfinished rather than quietly asserting a
// commitment nobody agreed to. serviceContent.js states the same rule for the
// "what's included" lists and it holds here for the same reason — a default
// warranty is a contract term, not a nice touch.

const PAVING_SCOPE = `SCOPE OF WORK

Phase 1 — Site preparation and excavation
· Utility locates arranged before any ground is broken.
· Existing surface removed and disposed of where the quote says so.
· Excavation to the depth this quote specifies, carried [6]" wider than the
  finished paved area so the base is supported at its edges.
· Access route protected; any fence panel or gate temporarily removed for
  machine access is reinstated on completion.

Phase 2 — Base and aggregates
· Geotextile separation fabric over the subgrade.
· Granular base placed and mechanically compacted in [3] lifts to the depth
  this quote specifies.
· Bedding layer screeded to grade.
· Finished level set flush to the surrounding grade unless drawn otherwise,
  with a minimum 2% fall away from the building.

Phase 3 — Paving and finishing
· Units laid to the pattern shown, squared to the house, with a border course.
· Cuts made on site to suit the finished shape.
· Edge restraint installed and secured.
· Polymeric sand swept into the joints and compacted.
· Disturbed ground graded, topsoil placed and seeded.
· Full clean-up; surplus material removed from site.

WHAT IS NOT INCLUDED
· Permits and any municipal fees.
· Relocation of utilities or irrigation found during excavation.
· Correction of pre-existing drainage or grading beyond the work area.
· Anything not written above. Additional work is quoted separately before it
  starts.

TERMS
1. The contractor will carry out the work described in this quote in a good
   and workmanlike manner, and is not obliged to carry out further work unless
   agreed in writing.
2. Where a drawing and a written specification disagree, the written
   specification governs.
3. Only the items listed in this quote are included. All listed work is due
   for payment whether or not the client is on site while it is done.
4. The client is responsible for obtaining any planning permission the work
   requires, and for pointing out private services — irrigation, invisible
   fencing, low-voltage lighting — that a locate will not find.
5. Changes to the design or materials after acceptance may change the price
   and the schedule, and are confirmed in writing before the change is made.
6. Payment: [deposit on acceptance, balance on completion — set your own].
7. Warranty: [state your own term and what it covers].
8. Scheduling depends on weather and ground conditions. Dates are targets, and
   the contractor will give as much notice as possible of a change.

Accepting this quote means accepting these terms.`;

const SEALING_SCOPE = `SCOPE OF WORK

· Surface swept and blown clean; oil and grease spots treated so the sealer
  will bond.
· Cracks filled where this quote includes crack filling.
· Edges trimmed and adjacent surfaces masked.
· Sealer applied at the coat count this quote specifies.

WHAT IS NOT INCLUDED
· Repair of alligatored or failed asphalt, which sealing will not fix.
· Resurfacing or replacement.

TERMS
1. The driveway must be kept clear of vehicles from the morning of the work
   until the cure time below has passed.
2. Cure before driving: [24-48 hours]. Cure before parking: [state your own].
3. Sealer cannot be applied below [10]°C or with rain forecast inside [24]
   hours; the work will be rescheduled rather than applied in poor conditions.
4. Sealing is maintenance, not repair. It slows oxidation and water ingress;
   it does not restore a surface that has already failed.
5. Payment: [set your own].
6. Warranty: [state your own term and what it covers].`;

const SNOW_SCOPE = `SCOPE OF WORK

· Driveway cleared for the season, [November 1] to [April 15].
· Service triggered at [5] cm of accumulation. Clearing is completed within
  [a stated window] of snowfall ending.
· Plow ridge left by the municipal plow cleared [as part of the visit / on
  request].
· Markers placed before the season to protect edges, lawn and beds.

WHAT IS NOT INCLUDED
· Salting or sanding unless this quote lists it.
· Roof or balcony clearing.
· Damage to items left in the clearing area and not visible under snow.

TERMS
1. The season ends at [250] cm of total accumulation as recorded by
   Environment Canada, or on the end date above, whichever comes first.
   Clearing past that point is charged at the overage rate on this quote.
2. Vehicles must be moved off the driveway for service. A driveway that cannot
   be cleared because it is blocked counts as a completed visit.
3. Payment: [set your own — many companies take the season in two instalments].
4. Cancellation: [set your own].`;

/**
 * Trades that ship a starter template, keyed on ServiceCategory.key.
 *
 * Absent means absent. A trade with no template offers no text rather than a
 * generic one, because "we will do the work in a good and workmanlike manner"
 * with no scope under it is worse than an empty box — it looks finished.
 */
export const CONTRACT_TEMPLATES = {
  paving: { label: "Interlock & paving", body: PAVING_SCOPE },
  driveway_sealing: { label: "Driveway sealing", body: SEALING_SCOPE },
  snow_removal: { label: "Snow removal", body: SNOW_SCOPE },
};

/** The starter template for a trade, or null. Own-property lookup. */
export function contractTemplate(categoryKey) {
  return Object.prototype.hasOwnProperty.call(CONTRACT_TEMPLATES, categoryKey)
    ? CONTRACT_TEMPLATES[categoryKey]
    : null;
}

/** Every template, for a picker. Order is declaration order. */
export function contractTemplateList() {
  return Object.entries(CONTRACT_TEMPLATES).map(([key, t]) => ({
    key,
    label: t.label,
    body: t.body,
  }));
}

/**
 * Is this template's body already sitting in a set of notes?
 *
 * The settings screen offers one button per trade and used to APPEND on every
 * press, so pressing Painting twice printed the painting terms twice on every
 * quote the company sent, and there was nothing on screen to say it had
 * happened. Appending was the deliberate choice — overwriting terms somebody
 * had already written by hand is the destructive-operation-labelled-as-cosmetic
 * failure — but "never overwrite" and "append blindly" are not the same thing.
 *
 * Exact substring, and that is the point rather than a limitation. Once a
 * contractor edits the inserted text it is THEIRS: the button stops claiming to
 * have added it, and stops offering to take it away. Removing text a person has
 * since rewritten, on the strength of a fuzzy match, is the destruction the
 * append was avoiding in the first place.
 */
export function templateApplied(body, templateBody) {
  const haystack = String(body ?? "");
  const needle = String(templateBody ?? "").trim();
  return needle.length > 0 && haystack.includes(needle);
}

/**
 * Add a template's body, or take back exactly the block that was added.
 *
 * Returns the new text. Everything the contractor typed themselves survives
 * both directions — removal only ever deletes the exact inserted block and the
 * blank line that joined it on.
 */
export function toggleTemplate(body, templateBody) {
  const current = String(body ?? "");
  const block = String(templateBody ?? "").trim();
  if (!block) return current;

  if (!templateApplied(current, block)) {
    const trimmed = current.trim();
    return trimmed ? `${trimmed}\n\n${block}` : block;
  }

  // Take out the block and the separator that was put in with it, then tidy
  // the seam so removing a middle template doesn't leave a three-line gap.
  return current
    .replace(`\n\n${block}`, "")
    .replace(`${block}\n\n`, "")
    .replace(block, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Placeholders still left unfilled in a body.
 *
 * The screen uses this to say "you have 6 things left to decide" rather than
 * letting a template go out with [state your own term] printed on a document a
 * homeowner is reading.
 */
export function unfilledPlaceholders(body) {
  const found = String(body ?? "").match(/\[[^\]\n]{1,80}\]/g);
  return found ? [...new Set(found)] : [];
}
